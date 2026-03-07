#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

show_help() {
  cat <<'EOF'
Usage: bash scripts/supabase_setup.sh [options]

Runs canonical Supabase migrations (supabase/migrations/*.sql) in sorted order.
Execution engine preference:
  1) local `psql`
  2) Docker fallback (`postgres:16-alpine`) when `psql` is unavailable

Required env:
  SUPABASE_DB_URL   Postgres connection string for the Supabase project.

Options:
  --with-dashboard-seed   Apply supabase/seed_dashboard_demo.sql
  --with-realtime-seed    Apply supabase/seed_realtime_tabs_demo.sql (implies dashboard seed)
  --with-seeds            Apply both optional seed files
  --with-verify           Apply supabase/verify_realtime_setup.sql at the end
  --dry-run               Print the execution plan without running SQL
  -h, --help              Show this help message
EOF
}

with_dashboard_seed=0
with_realtime_seed=0
with_verify=0
dry_run=0

for arg in "$@"; do
  case "$arg" in
    --with-dashboard-seed)
      with_dashboard_seed=1
      ;;
    --with-realtime-seed)
      with_dashboard_seed=1
      with_realtime_seed=1
      ;;
    --with-seeds)
      with_dashboard_seed=1
      with_realtime_seed=1
      ;;
    --with-verify)
      with_verify=1
      ;;
    --dry-run)
      dry_run=1
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      show_help
      exit 1
      ;;
  esac
done

if [[ -z "${SUPABASE_DB_URL:-}" && "$dry_run" -eq 0 ]]; then
  echo "SUPABASE_DB_URL is required."
  echo "Example: export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'"
  exit 1
fi

validate_supabase_db_url() {
  local url="$1"
  local rest authority authority_without_ats at_count

  if [[ "$url" != postgresql://* && "$url" != postgres://* ]]; then
    echo "SUPABASE_DB_URL must start with postgres:// or postgresql://"
    exit 1
  fi

  rest="${url#*://}"
  authority="${rest%%/*}"

  if [[ -z "$authority" ]]; then
    echo "SUPABASE_DB_URL is malformed: missing host section."
    exit 1
  fi

  if [[ "$authority" == *" "* || "$authority" == *$'\t'* || "$authority" == *$'\n'* ]]; then
    echo "SUPABASE_DB_URL is malformed: host section contains whitespace."
    exit 1
  fi

  authority_without_ats="${authority//@/}"
  at_count=$(( ${#authority} - ${#authority_without_ats} ))

  if (( at_count > 1 )); then
    echo "SUPABASE_DB_URL is malformed: found multiple '@' characters before the path."
    echo "If your DB password contains '@', URL-encode it as %40."
    echo "Example: postgresql://postgres:pa%40ss@db.<project-ref>.supabase.co:5432/postgres"
    exit 1
  fi
}

psql_mode="dry-run"

if [[ "$dry_run" -eq 0 ]]; then
  validate_supabase_db_url "$SUPABASE_DB_URL"

  if command -v psql >/dev/null 2>&1; then
    psql_mode="local"
  elif command -v docker >/dev/null 2>&1; then
    psql_mode="docker"
    echo "psql not found. Using Docker fallback (postgres:16-alpine)."
  else
    echo "Neither local psql nor docker is available."
    echo "Install PostgreSQL client tools (psql) or Docker, then retry."
    exit 1
  fi
fi

run_sql_file() {
  local relative_file="$1"
  local absolute_file="$ROOT_DIR/$relative_file"

  if [[ ! -f "$absolute_file" ]]; then
    echo "Missing SQL file: $relative_file"
    exit 1
  fi

  echo "-> $relative_file"

  if [[ "$dry_run" -eq 1 ]]; then
    return
  fi

  if [[ "$psql_mode" == "local" ]]; then
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$absolute_file"
    return
  fi

  if [[ "$psql_mode" == "docker" ]]; then
    docker run --rm \
      -e SUPABASE_DB_URL="$SUPABASE_DB_URL" \
      -e SQL_FILE="$relative_file" \
      -v "$ROOT_DIR:/workspace:ro" \
      postgres:16-alpine \
      sh -lc 'psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "/workspace/$SQL_FILE"'
    return
  fi

  echo "Unsupported SQL execution mode: $psql_mode"
  exit 1
}

migration_files=()
while IFS= read -r file; do
  migration_files+=("$file")
done < <(find "$ROOT_DIR/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | sort)

if [[ "${#migration_files[@]}" -eq 0 ]]; then
  echo "No migration files found in supabase/migrations."
  exit 1
fi

echo "Applying canonical Supabase migrations..."
for absolute_sql_file in "${migration_files[@]}"; do
  relative_sql_file="${absolute_sql_file#$ROOT_DIR/}"
  run_sql_file "$relative_sql_file"
done

if [[ "$with_dashboard_seed" -eq 1 ]]; then
  echo "Applying optional dashboard demo seed..."
  run_sql_file "supabase/seed_dashboard_demo.sql"
fi

if [[ "$with_realtime_seed" -eq 1 ]]; then
  echo "Applying optional realtime tab seed..."
  run_sql_file "supabase/seed_realtime_tabs_demo.sql"
fi

if [[ "$with_verify" -eq 1 ]]; then
  echo "Applying verification checks..."
  run_sql_file "supabase/verify_realtime_setup.sql"
fi

if [[ "$dry_run" -eq 1 ]]; then
  echo "Dry run complete."
else
  echo "Supabase setup complete."
fi
