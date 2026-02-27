package api

import (
	"io"
	"io/fs"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"bot-manager/internal/db"
	"bot-manager/internal/manager"
	"bot-manager/internal/storage"
)

var zeroTime = time.Time{}

type Server struct {
	router        *chi.Mux
	database      *db.DB
	minio         *storage.MinioStore
	mgr           *manager.Manager
	adminUsername string
	passwordHash  string
	sessionSecret []byte
	distFS        fs.FS // embedded React frontend (nil = no static files served)
}

func NewServer(
	database *db.DB,
	minio *storage.MinioStore,
	mgr *manager.Manager,
	adminUsername, passwordHash string,
	sessionSecret []byte,
	distFS fs.FS,
) *Server {
	s := &Server{
		database:      database,
		minio:         minio,
		mgr:           mgr,
		adminUsername: adminUsername,
		passwordHash:  passwordHash,
		sessionSecret: sessionSecret,
		distFS:        distFS,
	}
	s.router = s.buildRouter()
	return s
}

func (s *Server) Handler() http.Handler { return s.router }

func (s *Server) buildRouter() *chi.Mux {
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	// Auth (public)
	r.Post("/api/auth/login", s.handleLogin)
	r.Post("/api/auth/logout", s.handleLogout)
	r.Get("/api/auth/me", s.handleMe)

	// Bots (protected)
	r.Group(func(r chi.Router) {
		r.Use(s.authMiddleware)

		r.Get("/api/bots", s.handleListBots)
		r.Post("/api/bots", s.handleCreateBot)
		r.Get("/api/bots/{id}", s.handleGetBot)
		r.Put("/api/bots/{id}", s.handleUpdateBot)
		r.Delete("/api/bots/{id}", s.handleDeleteBot)

		r.Post("/api/bots/{id}/start", s.handleStartBot)
		r.Post("/api/bots/{id}/stop", s.handleStopBot)
		r.Post("/api/bots/{id}/restart", s.handleRestartBot)
		r.Get("/api/bots/{id}/logs", s.handleGetLogs)

		r.Get("/api/bots/{id}/assets", s.handleListAssets)
		r.Post("/api/bots/{id}/assets", s.handleUploadAsset)
		r.Post("/api/bots/{id}/welcome", s.handleUploadWelcome)
		r.Delete("/api/bots/{id}/assets/{key}", s.handleDeleteAsset)

		// Export / Import
		r.Get("/api/export", s.handleExport)
		r.Post("/api/import", s.handleImport)
		r.Post("/api/import/zip", s.handleImportZIP)
	})

	// Serve embedded React SPA with index.html fallback
	if s.distFS != nil {
		fileServer := http.FileServer(http.FS(s.distFS))
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path
			if path == "/" || path == "" {
				path = "index.html"
			} else {
				path = path[1:] // strip leading slash
			}

			f, err := s.distFS.Open(path)
			if err != nil {
				// SPA fallback: serve index.html for all unknown paths
				index, err2 := s.distFS.Open("index.html")
				if err2 != nil {
					http.NotFound(w, r)
					return
				}
				defer index.Close()
				rs, ok := index.(io.ReadSeeker)
				if !ok {
					http.NotFound(w, r)
					return
				}
				http.ServeContent(w, r, "index.html", zeroTime, rs)
				return
			}
			f.Close()
			fileServer.ServeHTTP(w, r)
		})
	}

	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
