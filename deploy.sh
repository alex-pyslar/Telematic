#!/usr/bin/env bash
# deploy.sh — pull latest code and redeploy with Docker Compose
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Pulling latest changes..."
git pull

echo "==> Building and restarting containers..."
docker-compose up --build -d

echo "==> Checking health..."
docker-compose ps

echo ""
echo "Deploy complete. App is running on port ${LISTEN_PORT:-8080}."
