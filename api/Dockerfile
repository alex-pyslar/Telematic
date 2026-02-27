# Stage 1: Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /frontend
COPY webui/package.json webui/package-lock.json* ./
RUN npm ci --prefer-offline
COPY webui/ ./
RUN npm run build

# Stage 2: Build Go backend
FROM golang:1.23-alpine AS backend-builder
WORKDIR /app
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api/ ./
# Embed the compiled frontend into the Go binary
COPY --from=frontend-builder /frontend/dist ./cmd/server/frontend_dist
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /botmanager ./cmd/server

# Stage 3: Minimal runtime image
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend-builder /botmanager .
EXPOSE 8080
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/api/auth/me || exit 1
CMD ["./botmanager"]
