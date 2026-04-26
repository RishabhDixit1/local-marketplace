#!/usr/bin/env bash

set -euo pipefail

DEVICE_ID="emulator-5554"
API_BASE_URL="http://10.0.2.2:3000"
ENV_FILE=".env.local"
APP_ENV="development"
SYNC_ONLY=0
PRINT_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device)
      DEVICE_ID="${2:?Missing value for --device}"
      shift 2
      ;;
    --api-base-url)
      API_BASE_URL="${2:?Missing value for --api-base-url}"
      shift 2
      ;;
    --env-file)
      ENV_FILE="${2:?Missing value for --env-file}"
      shift 2
      ;;
    --app-env)
      APP_ENV="${2:?Missing value for --app-env}"
      shift 2
      ;;
    --sync-only)
      SYNC_ONLY=1
      shift
      ;;
    --print-only)
      PRINT_ONLY=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/mobile"

if [[ "$ENV_FILE" = /* ]]; then
  ENV_PATH="$ENV_FILE"
else
  ENV_PATH="$REPO_ROOT/$ENV_FILE"
fi

if [[ ! -f "$ENV_PATH" ]]; then
  echo "Env file not found: $ENV_PATH" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_PATH" | head -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo "Missing $key in $ENV_PATH" >&2
    exit 1
  fi
  printf '%s' "${line#*=}"
}

SUPABASE_URL="$(read_env_value "NEXT_PUBLIC_SUPABASE_URL")"
SUPABASE_ANON_KEY="$(read_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY")"

ALLOW_BAD_CERTIFICATES="false"
if grep -q '^MOBILE_ALLOW_BAD_CERTIFICATES=' "$ENV_PATH"; then
  raw="$(read_env_value "MOBILE_ALLOW_BAD_CERTIFICATES" | tr '[:upper:]' '[:lower:]')"
  if [[ "$raw" == "1" || "$raw" == "true" || "$raw" == "yes" || "$raw" == "on" ]]; then
    ALLOW_BAD_CERTIFICATES="true"
  fi
fi

if ! command -v flutter >/dev/null 2>&1; then
  echo "Flutter is not installed or not on PATH." >&2
  echo "Install it with: brew install --cask flutter" >&2
  exit 1
fi

CONFIG_DIR="$MOBILE_DIR/config"
CONFIG_PATH="$CONFIG_DIR/local.json"
MASKED_KEY="[set]"
if [[ ${#SUPABASE_ANON_KEY} -gt 12 ]]; then
  MASKED_KEY="${SUPABASE_ANON_KEY:0:6}...${SUPABASE_ANON_KEY: -4}"
fi

echo "Using env file: $ENV_PATH"
echo "Device: $DEVICE_ID"
echo "Supabase host: $SUPABASE_URL"
echo "Anon key: $MASKED_KEY"
echo "API base URL: $API_BASE_URL"
echo "Allow bad certificates: $ALLOW_BAD_CERTIFICATES"
echo "Mobile config path: $CONFIG_PATH"

FLUTTER_ARGS=(
  run
  -d "$DEVICE_ID"
  "--dart-define=APP_ENV=$APP_ENV"
  "--dart-define=SUPABASE_URL=$SUPABASE_URL"
  "--dart-define=SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
  "--dart-define=API_BASE_URL=$API_BASE_URL"
  "--dart-define=AUTH_REDIRECT_SCHEME=serviq"
  "--dart-define=AUTH_REDIRECT_HOST=auth-callback"
  "--dart-define=ALLOW_BAD_CERTIFICATES=$ALLOW_BAD_CERTIFICATES"
)

if [[ $PRINT_ONLY -eq 1 ]]; then
  echo
  echo "Resolved flutter command:"
  echo "flutter run -d $DEVICE_ID --dart-define=APP_ENV=$APP_ENV --dart-define=SUPABASE_URL=$SUPABASE_URL --dart-define=SUPABASE_ANON_KEY=$MASKED_KEY --dart-define=API_BASE_URL=$API_BASE_URL --dart-define=AUTH_REDIRECT_SCHEME=serviq --dart-define=AUTH_REDIRECT_HOST=auth-callback --dart-define=ALLOW_BAD_CERTIFICATES=$ALLOW_BAD_CERTIFICATES"
  exit 0
fi

mkdir -p "$CONFIG_DIR"
cat >"$CONFIG_PATH" <<EOF
{
  "APP_ENV": "$APP_ENV",
  "SUPABASE_URL": "$SUPABASE_URL",
  "SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY",
  "API_BASE_URL": "$API_BASE_URL",
  "AUTH_REDIRECT_SCHEME": "serviq",
  "AUTH_REDIRECT_HOST": "auth-callback",
  "ALLOW_BAD_CERTIFICATES": $ALLOW_BAD_CERTIFICATES
}
EOF

echo "Synced mobile debug config."

if [[ $SYNC_ONLY -eq 1 ]]; then
  exit 0
fi

cd "$MOBILE_DIR"
flutter "${FLUTTER_ARGS[@]}"
