#!/usr/bin/env bash
# Apply pending Supabase migrations to the self-hosted EC2 instance.
#
# Uses the _migrations tracking table (supabase/migrations/20260709000000_migration_tracking.sql)
# to skip migrations that are already applied, and records every successful apply.
#
# Usage:
#   scripts/apply-migrations.sh --list              # show applied vs pending (read-only)
#   scripts/apply-migrations.sh --apply <file.sql>  # apply one migration (skips if recorded)
#   scripts/apply-migrations.sh --all               # apply every unrecorded migration in order
#
# Env overrides: DEPLOY_HOST, SSH_KEY
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-ec2-user@54.253.40.174}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/serviq-ec2-key.pem}"
MIGRATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../supabase/migrations" && pwd)"
DB="docker exec supabase-db psql -U postgres -d postgres"

ssh_run() {
  ssh -i "$SSH_KEY" -o ConnectTimeout=15 -o BatchMode=yes "$DEPLOY_HOST" "$@"
}

content_md5() {
  if command -v md5 >/dev/null 2>&1 && [[ "$(uname)" == "Darwin" ]]; then
    md5 -q "$1"
  else
    md5sum "$1" | awk '{print $1}'
  fi
}

list_applied() {
  ssh_run "$DB -Atc \"SELECT filename FROM public._migrations WHERE success = true ORDER BY filename;\""
}

is_applied() {
  local filename="$1"
  ssh_run "$DB -Atc \"SELECT public.migration_applied('$filename');\"" | grep -q t
}

record_migration() {
  local filename="$1" checksum="$2"
  ssh_run "$DB -Atc \"SELECT public.record_migration('$filename', '$checksum', 0);\""
}

apply_one() {
  local file="$1"
  local filename checksum
  filename="$(basename "$file")"
  checksum="$(content_md5 "$file")"

  if is_applied "$filename"; then
    echo "SKIP  $filename (already recorded in _migrations)"
    return 0
  fi

  echo "APPLY $filename"
  if ssh_run "$DB -v ON_ERROR_STOP=1" < "$file"; then
    record_migration "$filename" "$checksum"
    echo "OK    $filename (recorded)"
    return 0
  fi
  echo "FAIL  $filename"
  return 1
}

case "${1:---list}" in
  --list)
    echo "Host: $DEPLOY_HOST"
    echo "Dir:  $MIGRATION_DIR"
    echo ""
    echo "== Applied (from _migrations) =="
    local_applied="$(list_applied)"
    echo "$local_applied" | sed 's/^/  /'
    echo ""
    echo "== Pending =="
    pending=0
    while IFS= read -r file; do
      filename="$(basename "$file")"
      if ! printf '%s\n' "$local_applied" | grep -qx "$filename"; then
        echo "  $filename"
        pending=$((pending + 1))
      fi
    done < <(find "$MIGRATION_DIR" -name '*.sql' | sort)
    echo ""
    echo "$pending pending migration(s)."
    ;;
  --apply)
    [[ -n "${2:-}" ]] || { echo "Usage: $0 --apply <file.sql>" >&2; exit 1; }
    file="$MIGRATION_DIR/$2"
    [[ -f "$file" ]] || { echo "Not found: $file" >&2; exit 1; }
    apply_one "$file"
    ;;
  --all)
    failed=0
    while IFS= read -r file; do
      apply_one "$file" || failed=$((failed + 1))
    done < <(find "$MIGRATION_DIR" -name '*.sql' | sort)
    echo ""
    if [[ "$failed" -gt 0 ]]; then
      echo "$failed migration(s) failed. See output above."
      exit 1
    fi
    echo "All migrations applied."
    ;;
  *)
    echo "Unknown mode: $1" >&2
    exit 1
    ;;
esac
