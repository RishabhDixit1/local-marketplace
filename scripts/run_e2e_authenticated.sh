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

load_env_file ".env"
load_env_file ".env.local"
load_env_file ".env.e2e.local"

if [[ -z "${E2E_MAGIC_LINK_URL:-}" ]]; then
  echo "Generating E2E magic link URL via Supabase admin API..."
  E2E_MAGIC_LINK_URL="$(node scripts/generate_e2e_magic_link.mjs)"
  export E2E_MAGIC_LINK_URL
fi

echo "Running authenticated Playwright suite..."
npx playwright test tests/e2e/smoke.spec.ts tests/e2e/welcome-feed.spec.ts "$@"
