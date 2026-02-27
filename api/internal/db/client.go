package db

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func New(ctx context.Context, dsn string) (*DB, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return &DB{Pool: pool}, nil
}

// RunMigrations applies all *.sql files from migrationsFS in alphabetical order.
// migrationsFS should be an fs.FS rooted at the directory containing *.sql files.
func (d *DB) RunMigrations(ctx context.Context, migrationsFS fs.FS) error {
	entries, err := fs.ReadDir(migrationsFS, ".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		data, err := fs.ReadFile(migrationsFS, name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		if _, err := d.Pool.Exec(ctx, string(data)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
	}
	return nil
}

func (d *DB) GetSetting(ctx context.Context, key string) (string, error) {
	var val string
	err := d.Pool.QueryRow(ctx,
		`SELECT value FROM webui_settings WHERE key=$1`, key,
	).Scan(&val)
	return val, err
}

func (d *DB) SetSetting(ctx context.Context, key, value string) error {
	_, err := d.Pool.Exec(ctx,
		`INSERT INTO webui_settings(key,value) VALUES($1,$2)
		 ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`,
		key, value,
	)
	return err
}
