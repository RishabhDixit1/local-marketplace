#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MOBILE_DIR="$REPO_ROOT/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
KEY_PROPERTIES="$ANDROID_DIR/key.properties"
KEYSTORE_PATH="$MOBILE_DIR/release/serviq-release.keystore"
CREDENTIALS_PATH="$MOBILE_DIR/release/android-signing-credentials.txt"
KEY_ALIAS="${KEY_ALIAS:-serviq-release}"
STORE_PASSWORD="${STORE_PASSWORD:-}"
KEY_PASSWORD="${KEY_PASSWORD:-}"

if [[ -f "$KEY_PROPERTIES" ]]; then
  echo "Android signing config already exists: $KEY_PROPERTIES"
  echo "Leaving it untouched."
  exit 0
fi

if [[ -f "$KEYSTORE_PATH" ]]; then
  echo "Keystore already exists but $KEY_PROPERTIES is missing: $KEYSTORE_PATH" >&2
  echo "Create $KEY_PROPERTIES from mobile/android/key.properties.example and point it at ../release/serviq-release.keystore." >&2
  exit 1
fi

if [[ -z "$STORE_PASSWORD" ]]; then
  STORE_PASSWORD="$(openssl rand -base64 36 | tr -d '\n')"
fi

if [[ -z "$KEY_PASSWORD" ]]; then
  KEY_PASSWORD="$STORE_PASSWORD"
fi

KEYTOOL_BIN="${KEYTOOL_BIN:-}"
if [[ -z "$KEYTOOL_BIN" && -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" ]]; then
  KEYTOOL_BIN="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"
fi
if [[ -z "$KEYTOOL_BIN" ]]; then
  KEYTOOL_BIN="keytool"
fi
if ! command -v "$KEYTOOL_BIN" >/dev/null 2>&1; then
  echo "keytool was not found. Install Android Studio or set KEYTOOL_BIN." >&2
  exit 1
fi

mkdir -p "$MOBILE_DIR/release"

"$KEYTOOL_BIN" -genkeypair \
  -v \
  -keystore "$KEYSTORE_PATH" \
  -storetype PKCS12 \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "CN=ServiQ, OU=Mobile, O=ServiQ, L=Bengaluru, ST=Karnataka, C=IN"

cat >"$KEY_PROPERTIES" <<EOF
storePassword=$STORE_PASSWORD
keyPassword=$KEY_PASSWORD
keyAlias=$KEY_ALIAS
storeFile=../release/serviq-release.keystore
EOF

cat >"$CREDENTIALS_PATH" <<EOF
ServiQ Android release signing credentials

Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Keystore: $KEYSTORE_PATH
Gradle config: $KEY_PROPERTIES
Alias: $KEY_ALIAS
Store password: $STORE_PASSWORD
Key password: $KEY_PASSWORD

Keep this file and the keystore private. Back them up in the team's password
manager or secrets vault before deleting this local note.
EOF

chmod 600 "$KEY_PROPERTIES" "$CREDENTIALS_PATH" "$KEYSTORE_PATH"

echo "Created Android release keystore: $KEYSTORE_PATH"
echo "Created Android signing config: $KEY_PROPERTIES"
echo "Saved local backup note: $CREDENTIALS_PATH"
echo "These files are ignored by git. Store the credentials somewhere durable."
