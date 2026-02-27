package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"bot-manager/internal/db"
)

// exportPayload is the canonical import/export format.
// It is intentionally compatible with the legacy bots.json format.
type exportPayload struct {
	Version    int      `json:"version"`
	ExportedAt string   `json:"exported_at"`
	Bots       []db.Bot `json:"bots"`
}

// importBot mirrors the legacy bots.json shape (extra fields are ignored).
type importBot struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Type       string `json:"type"`
	Token      string `json:"token"`
	ChannelID  int64  `json:"channel_id"`
	InviteLink string `json:"invite_link"`
	WelcomeMsg string `json:"welcome_msg"`
	ButtonText string `json:"button_text"`
	NotSubMsg  string `json:"not_sub_msg"`
	SuccessMsg string `json:"success_msg"`
	Enabled    bool   `json:"enabled"`
	// Legacy fields — present in old bots.json, silently ignored.
	AssetsDir  string `json:"assets_dir,omitempty"`
	WelcomeImg string `json:"welcome_img,omitempty"`
}

// handleExportJSON exports all bot configs as a JSON file.
// GET /api/export
func (s *Server) handleExportJSON(w http.ResponseWriter, r *http.Request) {
	bots, err := s.database.GetAllBots(r.Context())
	if err != nil {
		jsonError(w, "db: "+err.Error(), http.StatusInternalServerError)
		return
	}

	payload := exportPayload{
		Version:    1,
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Bots:       bots,
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=bots_export.json")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	enc.Encode(payload) //nolint:errcheck
}

// handleExportZIP exports all bot configs + all MinIO assets as a ZIP archive.
// GET /api/export?format=zip
func (s *Server) handleExportZIP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	bots, err := s.database.GetAllBots(ctx)
	if err != nil {
		jsonError(w, "db: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=bots_export.zip")

	zw := zip.NewWriter(w)
	defer zw.Close()

	// Write bots.json
	payload := exportPayload{
		Version:    1,
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Bots:       bots,
	}
	jsonBytes, _ := json.MarshalIndent(payload, "", "  ")
	jf, err := zw.Create("bots.json")
	if err == nil {
		jf.Write(jsonBytes) //nolint:errcheck
	}

	// Write assets for each bot.
	for _, bot := range bots {
		// Welcome image
		if bot.WelcomeImgKey != "" {
			rc, _, err := s.minio.GetObject(ctx, bot.WelcomeImgKey)
			if err == nil {
				if f, err := zw.Create("assets/" + bot.WelcomeImgKey); err == nil {
					io.Copy(f, rc) //nolint:errcheck
				}
				rc.Close()
			}
		}

		// Documents
		prefix := fmt.Sprintf("%s/docs/", bot.ID)
		objects, err := s.minio.ListObjects(ctx, prefix)
		if err != nil {
			continue
		}
		for _, obj := range objects {
			rc, _, err := s.minio.GetObject(ctx, obj.Key)
			if err != nil {
				continue
			}
			if f, err := zw.Create("assets/" + obj.Key); err == nil {
				io.Copy(f, rc) //nolint:errcheck
			}
			rc.Close()
		}
	}
}

// handleExport routes between JSON and ZIP export based on ?format= query param.
func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("format") == "zip" {
		s.handleExportZIP(w, r)
		return
	}
	s.handleExportJSON(w, r)
}

// handleImport imports bots from a JSON body.
// Accepts both:
//   - { "bots": [...] }  (new format)
//   - [...]              (flat array, legacy)
//
// POST /api/import
func (s *Server) handleImport(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 10<<20))
	if err != nil {
		jsonError(w, "read body: "+err.Error(), http.StatusBadRequest)
		return
	}

	var importBots []importBot

	// Try wrapped format first.
	var wrapped struct {
		Bots []importBot `json:"bots"`
	}
	if err := json.Unmarshal(body, &wrapped); err == nil && len(wrapped.Bots) > 0 {
		importBots = wrapped.Bots
	} else {
		// Try flat array.
		if err := json.Unmarshal(body, &importBots); err != nil {
			jsonError(w, "invalid JSON: "+err.Error(), http.StatusBadRequest)
			return
		}
	}

	var imported []string
	var errs []string

	for _, ib := range importBots {
		ib.ID = strings.TrimSpace(ib.ID)
		ib.Token = strings.TrimSpace(ib.Token)

		if ib.ID == "" || ib.Token == "" {
			errs = append(errs, fmt.Sprintf("%q: id and token are required", ib.Name))
			continue
		}

		bot := db.Bot{
			ID:         ib.ID,
			Name:       ib.Name,
			Type:       db.BotType(ib.Type),
			Token:      ib.Token,
			ChannelID:  ib.ChannelID,
			InviteLink: ib.InviteLink,
			WelcomeMsg: ib.WelcomeMsg,
			ButtonText: ib.ButtonText,
			NotSubMsg:  ib.NotSubMsg,
			SuccessMsg: ib.SuccessMsg,
			Enabled:    false, // never auto-enable on import
		}

		if err := s.mgr.AddBot(r.Context(), bot); err != nil {
			errs = append(errs, fmt.Sprintf("%q: %v", ib.ID, err))
			continue
		}
		imported = append(imported, ib.ID)
	}

	if imported == nil {
		imported = []string{}
	}
	if errs == nil {
		errs = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"imported": imported,
		"errors":   errs,
	})
}

// handleImportZIP imports bots and files from a ZIP archive.
// POST /api/import/zip  (multipart: field "file")
func (s *Server) handleImportZIP(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(200 << 20); err != nil {
		jsonError(w, "parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	f, _, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file field required", http.StatusBadRequest)
		return
	}
	defer f.Close()

	data, err := io.ReadAll(f)
	if err != nil {
		jsonError(w, "read zip: "+err.Error(), http.StatusBadRequest)
		return
	}

	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		jsonError(w, "invalid zip: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Find and parse bots.json.
	var importBots []importBot
	for _, zf := range zr.File {
		if zf.Name != "bots.json" {
			continue
		}
		rc, err := zf.Open()
		if err != nil {
			jsonError(w, "open bots.json: "+err.Error(), http.StatusBadRequest)
			return
		}
		var wrapped struct {
			Bots []importBot `json:"bots"`
		}
		body, _ := io.ReadAll(rc)
		rc.Close()
		if err := json.Unmarshal(body, &wrapped); err == nil && len(wrapped.Bots) > 0 {
			importBots = wrapped.Bots
		} else {
			json.Unmarshal(body, &importBots) //nolint:errcheck
		}
		break
	}

	if len(importBots) == 0 {
		jsonError(w, "bots.json not found or empty in archive", http.StatusBadRequest)
		return
	}

	// Import bot configs.
	var imported []string
	var errs []string
	for _, ib := range importBots {
		if ib.ID == "" || ib.Token == "" {
			errs = append(errs, fmt.Sprintf("%q: id and token are required", ib.Name))
			continue
		}
		bot := db.Bot{
			ID:         ib.ID,
			Name:       ib.Name,
			Type:       db.BotType(ib.Type),
			Token:      ib.Token,
			ChannelID:  ib.ChannelID,
			InviteLink: ib.InviteLink,
			WelcomeMsg: ib.WelcomeMsg,
			ButtonText: ib.ButtonText,
			NotSubMsg:  ib.NotSubMsg,
			SuccessMsg: ib.SuccessMsg,
			Enabled:    false,
		}
		if err := s.mgr.AddBot(r.Context(), bot); err != nil {
			errs = append(errs, fmt.Sprintf("%q: %v", ib.ID, err))
			continue
		}
		imported = append(imported, ib.ID)
	}

	// Upload assets from the archive.
	ctx := r.Context()
	for _, zf := range zr.File {
		// Only process files under assets/
		if !strings.HasPrefix(zf.Name, "assets/") || zf.FileInfo().IsDir() {
			continue
		}
		minioKey := strings.TrimPrefix(zf.Name, "assets/")
		if minioKey == "" {
			continue
		}

		rc, err := zf.Open()
		if err != nil {
			continue
		}
		fileData, _ := io.ReadAll(rc)
		rc.Close()

		contentType := http.DetectContentType(fileData)
		s.minio.Upload(ctx, minioKey, contentType, bytes.NewReader(fileData), int64(len(fileData))) //nolint:errcheck

		// If it's a welcome image, update the DB record.
		if strings.Contains(minioKey, "/welcome/") {
			parts := strings.SplitN(minioKey, "/", 2)
			if len(parts) == 2 {
				s.database.UpdateWelcomeImg(ctx, parts[0], minioKey) //nolint:errcheck
			}
		}

		// If it's a document, register in bot_assets.
		if strings.Contains(minioKey, "/docs/") {
			parts := strings.Split(minioKey, "/")
			if len(parts) >= 3 {
				botID := parts[0]
				filename := parts[len(parts)-1]
				asset := db.Asset{
					BotID:       botID,
					MinioKey:    minioKey,
					Filename:    filename,
					ContentType: contentType,
					Size:        int64(len(fileData)),
				}
				s.database.InsertAsset(ctx, asset) //nolint:errcheck
			}
		}
	}

	if imported == nil {
		imported = []string{}
	}
	if errs == nil {
		errs = []string{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"imported": imported,
		"errors":   errs,
	})
}
