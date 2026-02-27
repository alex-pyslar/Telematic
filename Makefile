.PHONY: help dev build up down logs ps deploy tidy lint

# Default target
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  dev       Build frontend and run Go backend locally"
	@echo "  tidy      Run go mod tidy"
	@echo ""
	@echo "Docker:"
	@echo "  build     Build Docker image"
	@echo "  up        Start containers (docker-compose up -d)"
	@echo "  down      Stop containers"
	@echo "  logs      Follow container logs"
	@echo "  ps        Show container status"
	@echo "  deploy    Pull latest code and redeploy"

# ── Local development ─────────────────────────────────────────────────────────

dev:
	./dev.sh

tidy:
	cd api && go mod tidy

# ── Docker ───────────────────────────────────────────────────────────────────

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

ps:
	docker-compose ps

deploy:
	./deploy.sh
