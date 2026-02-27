package config

import (
	"encoding/hex"
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	ListenAddr    string
	DatabaseURL   string
	MinioEndpoint string
	MinioAccess   string
	MinioSecret   string
	MinioBucket   string
	MinioUseSSL   bool
	AdminUsername string
	AdminPassword string // plaintext, used only if no bcrypt hash stored
	SessionSecret []byte // 32 bytes for HMAC-SHA256
}

func Load() (*Config, error) {
	c := &Config{
		ListenAddr:    getenv("LISTEN_ADDR", ":8080"),
		DatabaseURL:   getenv("DATABASE_URL", ""),
		MinioEndpoint: getenv("MINIO_ENDPOINT", ""),
		MinioAccess:   getenv("MINIO_ACCESS_KEY", ""),
		MinioSecret:   getenv("MINIO_SECRET_KEY", ""),
		MinioBucket:   getenv("MINIO_BUCKET", ""),
		AdminUsername: getenv("ADMIN_USERNAME", "admin"),
		AdminPassword: getenv("ADMIN_PASSWORD", "changeme"),
	}

	c.MinioUseSSL = getenv("MINIO_USE_SSL", "false") == "true"

	if c.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	secretHex := getenv("SESSION_SECRET", "")
	if secretHex == "" {
		c.SessionSecret = make([]byte, 32)
		// Will be populated from DB or generated on first run
	} else {
		b, err := hex.DecodeString(secretHex)
		if err != nil || len(b) != 32 {
			return nil, fmt.Errorf("SESSION_SECRET must be 64 hex chars (32 bytes)")
		}
		c.SessionSecret = b
	}

	return c, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getenvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// Suppress unused warning
var _ = getenvInt
