#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MOBILE_DIR="$PROJECT_DIR/mobile"
RELEASES_DIR="$PROJECT_DIR/public/app/releases"

# Read version from pubspec.yaml or use argument
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(grep '^version: ' "$MOBILE_DIR/pubspec.yaml" | awk '{print $2}' | sed 's/[+]0$//' | sed 's/[+]/-/')
fi

APK_NAME="serviq-v${VERSION}.apk"

echo "==> Building APK v${VERSION}..."

cd "$MOBILE_DIR"
flutter build apk --release --no-pub

echo "==> Copying APK to releases..."
mkdir -p "$RELEASES_DIR"
cp build/app/outputs/flutter-apk/release/app-release.apk "$RELEASES_DIR/$APK_NAME"
echo "==> Published: public/app/releases/$APK_NAME"

echo ""
echo "==> Done. Update APP_VERSION=$VERSION in your .env.local when you deploy."
