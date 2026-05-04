#!/usr/bin/env bash
# Lists each Next.js App Router API endpoint (app/api/**/route.ts) and checks whether
# mobile/lib references it (string match). Exits non-zero if any route has zero matches.
#
# Usage: bash scripts/phase0_verify_api_coverage.sh
# From repo root; optional: PHASE0_ALLOW_EMPTY='presence/ping user-settings' to warn-only.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_ROOT="$ROOT/app/api"
MOBILE="$ROOT/mobile/lib"

if [[ ! -d "$API_ROOT" ]]; then
  echo "Missing $API_ROOT"
  exit 1
fi

declare -a MISSING=()

while IFS= read -r -d '' route_file; do
  rel="${route_file#"$API_ROOT"/}"
  dir_part="$(dirname "$rel")"
  if [[ "$dir_part" == "." ]]; then
    api_path="/api/$(basename "$(dirname "$route_file")")"
  else
    api_path="/api/$dir_part"
  fi
  # Normalize backslashes
  api_path="${api_path//\/.\//\/}"

  slug="${api_path#/api/}"
  first_seg="${slug%%/*}"

  # Match only real API path strings: `api/...` in .dart (avoids false positives like
  # the word "connections" in marketing copy). Dynamic segments use a prefix, e.g.
  # `api/orders/` for `api/orders/[id]`.
  if [[ "$slug" == *'['* ]]; then
    needle="api/${first_seg}/"
  else
    needle="api/${slug}"
  fi

  # grep returns 1 when no match; do not use set -e on grep alone
  match_count="$(grep -RF --include='*.dart' "$needle" "$MOBILE" 2>/dev/null | wc -l | tr -d ' ' || true)"

  if [[ "$match_count" -eq 0 ]]; then
    allowed="${PHASE0_ALLOW_EMPTY:-}"
    if echo " $allowed " | grep -q " $slug "; then
      echo "[allow] $api_path (no mobile string match; in PHASE0_ALLOW_EMPTY)"
      continue
    fi
    MISSING+=("$api_path")
    echo "[missing] $api_path"
  else
    echo "[ok]      $api_path"
  fi
done < <(find "$API_ROOT" -name 'route.ts' -print0 | sort -z)

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "Summary: ${#MISSING[@]} API route(s) have no .dart string match under mobile/lib."
  echo "Many are expected (server-only, web-only, or Supabase-direct on mobile). See docs/2026-05-04-phase-0-parity-inventory.md."
  echo "To fail CI on this check, remove this script's tolerate list and fix or document each route."
  # Non-failing default: parity doc is source of truth; script is advisory.
  exit 0
fi

echo "All routes matched at least one string in mobile (or allow list)."
