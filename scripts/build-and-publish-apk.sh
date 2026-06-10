#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$PROJECT_DIR/mobile"
RELEASES_DIR="$PROJECT_DIR/public/app/releases"
ENV_FILE="$PROJECT_DIR/.env.local"

# Read version from pubspec.yaml or use argument
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(grep '^version: ' "$MOBILE_DIR/pubspec.yaml" | awk '{print $2}' | sed 's/[+]0$//' | sed 's/[+]/-/')
fi

APK_NAME="serviq-v${VERSION}.apk"

echo "==> Building APK v${VERSION}..."

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — cannot read Supabase URL/anon key." >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" | head -n 1 | sed 's/^[^=]*=//'
}

SUPABASE_URL="$(read_env_value "NEXT_PUBLIC_SUPABASE_URL")"
SUPABASE_ANON_KEY="$(read_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY")"
API_BASE_URL="https://www.serviqapp.com"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in $ENV_FILE" >&2
  exit 1
fi

cd "$MOBILE_DIR"
flutter pub get
flutter build apk --release \
  --dart-define=APP_ENV=production \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  --dart-define=API_BASE_URL="$API_BASE_URL" \
  --dart-define=AUTH_REDIRECT_SCHEME=serviq \
  --dart-define=AUTH_REDIRECT_HOST=auth-callback \
  --dart-define=ALLOW_BAD_CERTIFICATES=false

echo "==> Copying APK to releases..."
mkdir -p "$RELEASES_DIR"
cp build/app/outputs/flutter-apk/app-release.apk "$RELEASES_DIR/$APK_NAME"
echo "==> Published: public/app/releases/$APK_NAME"

echo ""
echo "==> Done. Update APP_VERSION=$VERSION in your .env.local when you deploy."
