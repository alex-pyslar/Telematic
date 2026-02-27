# Bot Manager

Self-hosted web panel for managing Telegram subscription-gate bots. The backend is a single Go binary that embeds the compiled React frontend — no reverse proxy needed.

## How it works

Each bot acts as a **subscription gate**: when a user messages the bot, it checks whether they are subscribed to a configured Telegram channel. Depending on the result:

- **Subscribed** → the bot delivers the configured payload (a document or a private invite link) and shows a success message.
- **Not subscribed** → the bot replies with a prompt to join the channel first.

Two bot types are supported:

| Type | Payload on success |
|---|---|
| `document-bot` | Sends a file from the asset library |
| `link-bot` | Sends a private invite link |

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Go 1.24, [chi](https://github.com/go-chi/chi), [pgx](https://github.com/jackc/pgx) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI |
| Database | PostgreSQL |
| File storage | MinIO (S3-compatible) |
| Container | Docker, Docker Compose |

## Project structure

```
bot-manager/
├── api/                    # Go backend
│   ├── cmd/server/         # Entry point (embeds frontend)
│   ├── internal/
│   │   ├── api/            # HTTP handlers & middleware
│   │   ├── botrunner/      # Bot lifecycle & log ring-buffer
│   │   ├── config/         # Config from env
│   │   ├── db/             # PostgreSQL queries
│   │   ├── manager/        # Bot manager (start/stop/restart)
│   │   └── storage/        # MinIO client
│   ├── migrations/         # SQL migrations
│   └── Dockerfile
├── web-ui/                 # React frontend
├── docker-compose.yml
├── deploy.sh               # One-command redeploy
├── dev.sh                  # Local development helper
└── .env.example
```

## Prerequisites

- **Docker & Docker Compose** — for production
- **Go 1.24+** and **Node.js 22+** — for local development
- **PostgreSQL** and **MinIO** — external services (bring your own or add to `docker-compose.yml`)

## Quick start (Docker)

```bash
# 1. Copy and fill in the environment file
cp .env.example .env
$EDITOR .env

# 2. Build and start
docker-compose up --build -d
```

The app is available at `http://localhost:8080`.

## Environment variables

Copy `.env.example` to `.env` and adjust the values:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `MINIO_ENDPOINT` | MinIO host:port |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_BUCKET` | Bucket name for bot assets |
| `MINIO_USE_SSL` | `true` / `false` |
| `LISTEN_ADDR` | Backend listen address (default `:8080`) |
| `ADMIN_USERNAME` | Admin username — **first run only** |
| `ADMIN_PASSWORD` | Admin password — **first run only** |
| `SESSION_SECRET` | 32-byte hex session secret (auto-generated if empty) |

> **Admin credentials** are used only on the very first startup to seed the database. After that, change the password through the UI.

## Local development

```bash
# Install frontend dependencies
cd web-ui && npm install && cd ..

# Build frontend and run the Go server
./dev.sh
```

The server will be available at `http://localhost:8080`.

To run the frontend dev server separately with HMR:

```bash
# Terminal 1 — backend
cd api && go run ./cmd/server

# Terminal 2 — frontend with HMR
cd web-ui && npm run dev
```

## Deployment

```bash
./deploy.sh
```

This pulls the latest code and rebuilds the Docker image.

## API overview

All endpoints require session authentication (`POST /api/auth/login`).

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/me` | Current user |
| `POST` | `/api/auth/logout` | Log out |
| `GET` | `/api/bots` | List all bots with status |
| `POST` | `/api/bots` | Create a bot |
| `GET` | `/api/bots/{id}` | Get bot details |
| `PUT` | `/api/bots/{id}` | Update a bot |
| `DELETE` | `/api/bots/{id}` | Delete a bot |
| `POST` | `/api/bots/{id}/start` | Start bot |
| `POST` | `/api/bots/{id}/stop` | Stop bot |
| `POST` | `/api/bots/{id}/restart` | Restart bot |
| `GET` | `/api/bots/{id}/logs` | Get recent logs |
| `GET` | `/api/bots/{id}/assets` | List bot assets |
| `POST` | `/api/bots/{id}/assets` | Upload an asset |
| `DELETE` | `/api/bots/{id}/assets/{key}` | Delete an asset |

## License

[MIT](LICENSE)
