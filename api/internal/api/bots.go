package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"bot-manager/internal/db"
)

// botDetail extends Bot with a presigned URL for the welcome image.
type botDetail struct {
	db.Bot
	WelcomeImgURL string `json:"welcome_img_url,omitempty"`
}

func (s *Server) handleListBots(w http.ResponseWriter, r *http.Request) {
	snapshots := s.mgr.Status()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snapshots)
}

func (s *Server) handleCreateBot(w http.ResponseWriter, r *http.Request) {
	var bot db.Bot
	if err := json.NewDecoder(r.Body).Decode(&bot); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	if bot.ID == "" || bot.Token == "" {
		jsonError(w, "id and token are required", http.StatusBadRequest)
		return
	}

	if err := s.mgr.AddBot(r.Context(), bot); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if r.URL.Query().Get("start") == "1" {
		s.mgr.Start(bot.ID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(bot)
}

func (s *Server) handleGetBot(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	bot, err := s.database.GetBot(r.Context(), id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	resp := botDetail{Bot: bot}
	if bot.WelcomeImgKey != "" {
		u, _ := s.minio.PresignURL(r.Context(), bot.WelcomeImgKey, time.Hour)
		resp.WelcomeImgURL = u
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleUpdateBot(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	var bot db.Bot
	if err := json.NewDecoder(r.Body).Decode(&bot); err != nil {
		jsonError(w, "invalid body", http.StatusBadRequest)
		return
	}
	bot.ID = id

	if err := s.mgr.UpdateBot(r.Context(), bot); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	updated, _ := s.database.GetBot(r.Context(), id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

func (s *Server) handleDeleteBot(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	if err := s.mgr.DeleteBot(r.Context(), id); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleStartBot(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	if err := s.mgr.Start(id); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Write([]byte(`{"ok":true}`))
}

func (s *Server) handleStopBot(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	if err := s.mgr.Stop(id); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Write([]byte(`{"ok":true}`))
}

func (s *Server) handleRestartBot(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	if err := s.mgr.Restart(id); err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Write([]byte(`{"ok":true}`))
}

func (s *Server) handleGetLogs(w http.ResponseWriter, r *http.Request) {
	id := botIDFromPath(r)
	lines, err := s.mgr.Logs(id)
	if err != nil {
		jsonError(w, err.Error(), http.StatusNotFound)
		return
	}
	if lines == nil {
		lines = []string{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(lines)
}

// botIDFromPath extracts the bot id from /api/bots/{id}/...
func botIDFromPath(r *http.Request) string {
	// path: /api/bots/{id} or /api/bots/{id}/action
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/bots/"), "/")
	return parts[0]
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
