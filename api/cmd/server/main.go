package main

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"golang.org/x/crypto/bcrypt"

	"bot-manager/internal/api"
	"bot-manager/internal/config"
	"bot-manager/internal/db"
	"bot-manager/internal/manager"
	"bot-manager/internal/storage"
)

//go:embed migrations
var migrationsFS embed.FS

//go:embed frontend_dist
var frontendFS embed.FS

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Database
	database, err := db.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}

	migrSub, _ := fs.Sub(migrationsFS, "migrations")
	if err := database.RunMigrations(ctx, migrSub); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	// Session secret
	sessionSecret := cfg.SessionSecret
	if len(sessionSecret) == 0 {
		stored, err := database.GetSetting(ctx, "session_secret")
		if err != nil || stored == "" {
			b := make([]byte, 32)
			rand.Read(b)
			stored = hex.EncodeToString(b)
			database.SetSetting(ctx, "session_secret", stored)
		}
		sessionSecret, _ = hex.DecodeString(stored)
	}

	// Admin password hash (bcrypt), stored in DB
	passwordHash, err := database.GetSetting(ctx, "admin_password_hash")
	if err != nil || passwordHash == "" {
		plain := cfg.AdminPassword
		hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("bcrypt: %v", err)
		}
		passwordHash = string(hash)
		database.SetSetting(ctx, "admin_password_hash", passwordHash)
		fmt.Printf("\n=== WebUI Credentials ===\nUsername: %s\nPassword: %s\n=========================\n\n",
			cfg.AdminUsername, plain)
	}

	// MinIO
	minio, err := storage.NewMinio(cfg.MinioEndpoint, cfg.MinioAccess, cfg.MinioSecret, cfg.MinioBucket, cfg.MinioUseSSL)
	if err != nil {
		log.Fatalf("minio init: %v", err)
	}
	if err := minio.EnsureBucket(ctx); err != nil {
		log.Fatalf("minio bucket: %v", err)
	}

	// Bot manager
	mgr := manager.New(database, minio)
	mgr.StartAll(ctx)

	// Frontend FS (nil-safe: server works without frontend in dev mode)
	distSub, _ := fs.Sub(frontendFS, "frontend_dist")

	// HTTP server
	srv := api.NewServer(database, minio, mgr, cfg.AdminUsername, passwordHash, sessionSecret, distSub)
	httpServer := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: srv.Handler(),
	}

	go func() {
		log.Printf("Listening on %s", cfg.ListenAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("http: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("Shutting down...")

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 75*time.Second)
	defer shutCancel()
	httpServer.Shutdown(shutCtx)
	mgr.StopAll()
	log.Println("All bots stopped. Bye.")
}
