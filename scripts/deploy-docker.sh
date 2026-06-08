#!/usr/bin/env bash
set -euo pipefail

# Docker-based deploy script for EC2
# Usage: bash scripts/deploy-docker.sh [build|deploy|setup]

APP_NAME="serviq"
REGISTRY="ghcr.io/${GITHUB_REPOSITORY_OWNER:-local}/${APP_NAME}"
TAG="${GITHUB_SHA:-$(git rev-parse HEAD)}"
PORT="${PORT:-3000}"

setup() {
  echo "==> Setting up Docker environment on EC2..."

  if ! command -v docker &>/dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$(whoami)"
    echo "Docker installed. You may need to log out and back in."
  fi

  if ! docker info &>/dev/null; then
    echo "ERROR: Docker daemon not running. Start it with: sudo systemctl start docker"
    exit 1
  fi

  echo "Docker ready."
}

build() {
  echo "==> Building Docker image..."

  docker build \
    --build-arg "SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN:-}" \
    --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:?required}" \
    --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:?required}" \
    --build-arg "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:?required}" \
    -t "${APP_NAME}:${TAG}" \
    -t "${APP_NAME}:latest" \
    .

  echo "Built ${APP_NAME}:${TAG}"
}

deploy() {
  local image="${1:-${APP_NAME}:latest}"

  echo "==> Deploying ${image}..."

  # Pull latest if from registry
  if [[ "$image" == */* ]]; then
    docker pull "$image"
  fi

  # Stop existing container gracefully
  if docker ps -q --filter "name=${APP_NAME}" | grep -q .; then
    echo "Stopping existing container..."
    docker stop "${APP_NAME}" --time 30 2>/dev/null || true
  fi

  # Remove old container
  docker rm "${APP_NAME}" 2>/dev/null || true

  # Start new container
  echo "Starting new container..."
  docker run -d \
    --name "${APP_NAME}" \
    --restart unless-stopped \
    -p "${PORT}:3000" \
    -e "NODE_ENV=production" \
    -e "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:?required}" \
    -e "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:?required}" \
    -e "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:?required}" \
    -e "NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:?required}" \
    -e "RESEND_API_KEY=${RESEND_API_KEY:-}" \
    -e "BACKUP_EMAIL_API_KEY=${BACKUP_EMAIL_API_KEY:-}" \
    -e "SENTRY_DSN=${SENTRY_DSN:-}" \
    -e "RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID:-}" \
    -e "RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET:-}" \
    -e "RAZORPAY_WEBHOOK_SECRET=${RAZORPAY_WEBHOOK_SECRET:-}" \
    -e "SERVIQ_INTERNAL_PUSH_KEY=${SERVIQ_INTERNAL_PUSH_KEY:-}" \
    -e "VAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY:-}" \
    -e "VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY:-}" \
    -e "VAPID_EMAIL=${VAPID_EMAIL:-}" \
    -e "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID:-}" \
    -e "FIREBASE_SERVICE_ACCOUNT_JSON=${FIREBASE_SERVICE_ACCOUNT_JSON:-}" \
    -e "OPENAI_API_KEY=${OPENAI_API_KEY:-}" \
    "${image}"

  # Health check
  echo "Waiting for container to be healthy..."
  for i in $(seq 1 12); do
    if curl -sf "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
      echo "Container is healthy!"
      exit 0
    fi
    sleep 5
  done

  echo "ERROR: Container health check failed after 60s"
  docker logs "${APP_NAME}" --tail 50
  exit 1
}

main() {
  local cmd="${1:-help}"

  case "$cmd" in
    setup) setup ;;
    build) build ;;
    deploy) deploy "${2:-}" ;;
    *)
      echo "Usage: $0 [setup|build|deploy]"
      echo ""
      echo "  setup   Install Docker on the server (run once)"
      echo "  build   Build Docker image locally"
      echo "  deploy  Deploy image to local Docker daemon"
      exit 1
      ;;
  esac
}

main "$@"
