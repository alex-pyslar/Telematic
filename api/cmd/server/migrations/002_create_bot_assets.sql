CREATE TABLE IF NOT EXISTS bot_assets (
    id           SERIAL PRIMARY KEY,
    bot_id       TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    minio_key    TEXT NOT NULL,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT '',
    size         BIGINT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
