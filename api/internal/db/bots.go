package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

type BotType string

const (
	BotTypeDocument BotType = "document-bot"
	BotTypeLink     BotType = "link-bot"
)

type Bot struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Type          BotType   `json:"type"`
	Token         string    `json:"token"`
	ChannelID     int64     `json:"channel_id"`
	InviteLink    string    `json:"invite_link"`
	WelcomeImgKey string    `json:"welcome_img_key"`
	WelcomeMsg    string    `json:"welcome_msg"`
	ButtonText    string    `json:"button_text"`
	NotSubMsg     string    `json:"not_sub_msg"`
	SuccessMsg    string    `json:"success_msg"`
	Enabled       bool      `json:"enabled"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Asset struct {
	ID          int       `json:"id"`
	BotID       string    `json:"bot_id"`
	MinioKey    string    `json:"minio_key"`
	Filename    string    `json:"filename"`
	ContentType string    `json:"content_type"`
	Size        int64     `json:"size"`
	CreatedAt   time.Time `json:"created_at"`
}

func (d *DB) GetAllBots(ctx context.Context) ([]Bot, error) {
	rows, err := d.Pool.Query(ctx, `
		SELECT id, name, type, token, channel_id, invite_link,
		       welcome_img_key, welcome_msg, button_text, not_sub_msg,
		       success_msg, enabled, created_at, updated_at
		FROM bots ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bots []Bot
	for rows.Next() {
		var b Bot
		if err := rows.Scan(
			&b.ID, &b.Name, &b.Type, &b.Token, &b.ChannelID, &b.InviteLink,
			&b.WelcomeImgKey, &b.WelcomeMsg, &b.ButtonText, &b.NotSubMsg,
			&b.SuccessMsg, &b.Enabled, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		bots = append(bots, b)
	}
	return bots, rows.Err()
}

func (d *DB) GetBot(ctx context.Context, id string) (Bot, error) {
	var b Bot
	err := d.Pool.QueryRow(ctx, `
		SELECT id, name, type, token, channel_id, invite_link,
		       welcome_img_key, welcome_msg, button_text, not_sub_msg,
		       success_msg, enabled, created_at, updated_at
		FROM bots WHERE id=$1`, id,
	).Scan(
		&b.ID, &b.Name, &b.Type, &b.Token, &b.ChannelID, &b.InviteLink,
		&b.WelcomeImgKey, &b.WelcomeMsg, &b.ButtonText, &b.NotSubMsg,
		&b.SuccessMsg, &b.Enabled, &b.CreatedAt, &b.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return b, fmt.Errorf("bot %q not found", id)
	}
	return b, err
}

func (d *DB) UpsertBot(ctx context.Context, b Bot) error {
	_, err := d.Pool.Exec(ctx, `
		INSERT INTO bots(id, name, type, token, channel_id, invite_link,
		                 welcome_img_key, welcome_msg, button_text, not_sub_msg,
		                 success_msg, enabled, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
		ON CONFLICT(id) DO UPDATE SET
		    name=EXCLUDED.name, type=EXCLUDED.type, token=EXCLUDED.token,
		    channel_id=EXCLUDED.channel_id, invite_link=EXCLUDED.invite_link,
		    welcome_img_key=EXCLUDED.welcome_img_key, welcome_msg=EXCLUDED.welcome_msg,
		    button_text=EXCLUDED.button_text, not_sub_msg=EXCLUDED.not_sub_msg,
		    success_msg=EXCLUDED.success_msg, enabled=EXCLUDED.enabled,
		    updated_at=NOW()`,
		b.ID, b.Name, b.Type, b.Token, b.ChannelID, b.InviteLink,
		b.WelcomeImgKey, b.WelcomeMsg, b.ButtonText, b.NotSubMsg,
		b.SuccessMsg, b.Enabled,
	)
	return err
}

func (d *DB) DeleteBot(ctx context.Context, id string) error {
	tag, err := d.Pool.Exec(ctx, `DELETE FROM bots WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("bot %q not found", id)
	}
	return nil
}

func (d *DB) UpdateWelcomeImg(ctx context.Context, botID, key string) error {
	_, err := d.Pool.Exec(ctx,
		`UPDATE bots SET welcome_img_key=$2, updated_at=NOW() WHERE id=$1`, botID, key)
	return err
}

// --- Assets ---

func (d *DB) GetAssets(ctx context.Context, botID string) ([]Asset, error) {
	rows, err := d.Pool.Query(ctx, `
		SELECT id, bot_id, minio_key, filename, content_type, size, created_at
		FROM bot_assets WHERE bot_id=$1 ORDER BY created_at`, botID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assets []Asset
	for rows.Next() {
		var a Asset
		if err := rows.Scan(
			&a.ID, &a.BotID, &a.MinioKey, &a.Filename, &a.ContentType, &a.Size, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

func (d *DB) InsertAsset(ctx context.Context, a Asset) error {
	_, err := d.Pool.Exec(ctx, `
		INSERT INTO bot_assets(bot_id, minio_key, filename, content_type, size)
		VALUES($1,$2,$3,$4,$5)`,
		a.BotID, a.MinioKey, a.Filename, a.ContentType, a.Size,
	)
	return err
}

func (d *DB) DeleteAsset(ctx context.Context, botID, minioKey string) error {
	tag, err := d.Pool.Exec(ctx,
		`DELETE FROM bot_assets WHERE bot_id=$1 AND minio_key=$2`, botID, minioKey)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("asset %q not found", minioKey)
	}
	return nil
}
