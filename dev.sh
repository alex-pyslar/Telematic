#!/usr/bin/env bash
# dev.sh — build frontend and run Go backend for local development
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Build frontend (outputs into api/cmd/server/frontend_dist)
echo "==> Building frontend..."
cd "$SCRIPT_DIR/webui"
npm run build

# 2. Run the Go backend (embeds the freshly built frontend)
echo "==> Starting backend..."
cd "$SCRIPT_DIR/api"
go run ./cmd/server
