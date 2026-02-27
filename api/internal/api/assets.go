package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"bot-manager/internal/db"
)

func (s *Server) handleListAssets(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	assets, err := s.database.GetAssets(r.Context(), id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	type assetResponse struct {
		db.Asset
		URL string `json:"url"`
	}

	resp := make([]assetResponse, 0, len(assets))
	for _, a := range assets {
		u, _ := s.minio.PresignURL(r.Context(), a.MinioKey, time.Hour)
		resp = append(resp, assetResponse{Asset: a, URL: u})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleUploadAsset(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)

	if err := r.ParseMultipartForm(64 << 20); err != nil {
		jsonError(w, "parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file field required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	key := fmt.Sprintf("%s/docs/%s", id, header.Filename)
	if err := s.minio.Upload(r.Context(), key, contentType, file, header.Size); err != nil {
		jsonError(w, "upload: "+err.Error(), http.StatusInternalServerError)
		return
	}

	asset := db.Asset{
		BotID:       id,
		MinioKey:    key,
		Filename:    header.Filename,
		ContentType: contentType,
		Size:        header.Size,
	}
	if err := s.database.InsertAsset(r.Context(), asset); err != nil {
		jsonError(w, "db: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(asset)
}

func (s *Server) handleDeleteAsset(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	// path: /api/bots/{id}/assets/{key...}
	after := strings.TrimPrefix(r.URL.Path, fmt.Sprintf("/api/bots/%s/assets/", id))
	if after == "" {
		jsonError(w, "asset key required", http.StatusBadRequest)
		return
	}

	if err := s.minio.Delete(r.Context(), after); err != nil {
		jsonError(w, "minio: "+err.Error(), http.StatusInternalServerError)
		return
	}
	if err := s.database.DeleteAsset(r.Context(), id, after); err != nil {
		jsonError(w, "db: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleUploadWelcome(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)

	if err := r.ParseMultipartForm(16 << 20); err != nil {
		jsonError(w, "parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "file field required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, "read file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = http.DetectContentType(data)
	}

	ext := ".jpg"
	if strings.Contains(contentType, "png") {
		ext = ".png"
	}
	key := fmt.Sprintf("%s/welcome/welcome%s", id, ext)

	// Delete the old welcome image(s) before uploading the new one.
	// We try both extensions so a switch from jpg→png (or vice versa) is handled.
	for _, oldExt := range []string{".jpg", ".png"} {
		if oldExt != ext {
			s.minio.Delete(r.Context(), fmt.Sprintf("%s/welcome/welcome%s", id, oldExt)) //nolint:errcheck
		}
	}

	if err := s.minio.Upload(r.Context(), key, contentType,
		bytes.NewReader(data), int64(len(data))); err != nil {
		jsonError(w, "upload: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := s.database.UpdateWelcomeImg(r.Context(), id, key); err != nil {
		jsonError(w, "db: "+err.Error(), http.StatusInternalServerError)
		return
	}

	u, _ := s.minio.PresignURL(r.Context(), key, time.Hour)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"key": key, "url": u})
}
