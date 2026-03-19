#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

enable_system_ca_for_local_node() {
  local current_options="${NODE_OPTIONS:-}"

  if [[ " ${current_options} " == *" --use-system-ca "* ]]; then
    return
  fi

  if [[ -n "$current_options" ]]; then
    export NODE_OPTIONS="--use-system-ca ${current_options}"
  else
    export NODE_OPTIONS="--use-system-ca"
  fi
}

wait_for_server() {
  local url="$1"
  local pid="$2"
  local log_file="$3"

  for _ in {1..60}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Authenticated E2E server exited before becoming ready." >&2
      cat "$log_file" >&2
      return 1
    fi

    sleep 2
  done

  echo "Timed out waiting for authenticated E2E server at $url" >&2
  cat "$log_file" >&2
  return 1
}

resolve_free_port() {
  node - <<'NODE'
const net = require("net");

const host = "127.0.0.1";
const startPort = Number(process.env.PLAYWRIGHT_PORT || 3100);
const maxAttempts = 25;

const canListen = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });

(async () => {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    if (await canListen(port)) {
      process.stdout.write(String(port));
      return;
    }
  }

  process.exit(1);
})();
NODE
}

load_env_file ".env"
load_env_file ".env.local"
load_env_file ".env.e2e.local"

enable_system_ca_for_local_node

if [[ -z "${PLAYWRIGHT_BASE_URL:-}" ]]; then
  SERVER_PORT="$(resolve_free_port)"
  export PLAYWRIGHT_BASE_URL="http://127.0.0.1:${SERVER_PORT}"
fi

export NEXT_PUBLIC_SITE_URL="$PLAYWRIGHT_BASE_URL"
export PLAYWRIGHT_SKIP_WEBSERVER=1

SERVER_PORT="$(node -e "const url = new URL(process.env.PLAYWRIGHT_BASE_URL); process.stdout.write(String(url.port || (url.protocol === 'https:' ? 443 : 80)));")"
SERVER_LOG="$ROOT_DIR/.playwright-auth-server.log"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

if [[ -z "${E2E_MAGIC_LINK_URL:-}" ]]; then
  echo "Generating E2E magic link URL via Supabase admin API..."
  E2E_MAGIC_LINK_URL="$(node scripts/generate_e2e_magic_link.mjs)"
  export E2E_MAGIC_LINK_URL
fi

echo "Building app for authenticated Playwright suite..."
npm run build

echo "Starting production server at $PLAYWRIGHT_BASE_URL ..."
npm run start -- --hostname 127.0.0.1 --port "$SERVER_PORT" >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
wait_for_server "$PLAYWRIGHT_BASE_URL" "$SERVER_PID" "$SERVER_LOG"

echo "Running authenticated Playwright suite..."
npx playwright test tests/e2e/smoke.spec.ts tests/e2e/welcome-feed.spec.ts "$@"
