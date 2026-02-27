CREATE TABLE IF NOT EXISTS bots (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('document-bot', 'link-bot')),
    token           TEXT NOT NULL,
    channel_id      BIGINT NOT NULL,
    invite_link     TEXT NOT NULL DEFAULT '',
    welcome_img_key TEXT NOT NULL DEFAULT '',
    welcome_msg     TEXT NOT NULL DEFAULT '',
    button_text     TEXT NOT NULL DEFAULT '',
    not_sub_msg     TEXT NOT NULL DEFAULT '',
    success_msg     TEXT NOT NULL DEFAULT '',
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webui_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
