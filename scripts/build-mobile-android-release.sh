#!/usr/bin/env bash

set -euo pipefail

ENV_FILE=".env.local"
APP_ENV="production"
API_BASE_URL="https://www.serviqapp.com"
BUILD_NAME=""
BUILD_NUMBER=""
LABEL="android-release"
OUTPUT_KIND="apk"
RUN_CHECKS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE="${2:?Missing value for --env-file}"
      shift 2
      ;;
    --app-env)
      APP_ENV="${2:?Missing value for --app-env}"
      shift 2
      ;;
    --api-base-url)
      API_BASE_URL="${2:?Missing value for --api-base-url}"
      shift 2
      ;;
    --build-name)
      BUILD_NAME="${2:?Missing value for --build-name}"
      shift 2
      ;;
    --build-number)
      BUILD_NUMBER="${2:?Missing value for --build-number}"
      shift 2
      ;;
    --label)
      LABEL="${2:?Missing value for --label}"
      shift 2
      ;;
    --aab)
      OUTPUT_KIND="aab"
      shift
      ;;
    --skip-checks)
      RUN_CHECKS=0
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

if [[ ! -f "$MOBILE_DIR/android/key.properties" ]]; then
  echo "Android release signing is not configured." >&2
  echo "Run: bash scripts/setup-mobile-android-keystore.sh" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "$ENV_PATH" | head -n 1 || true)"
  if [[ -z "$line" ]]; then
    echo ""
    return
  fi
  printf '%s' "${line#*=}"
}

required_env_value() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"
  if [[ -z "$value" ]]; then
    echo "Missing $key in $ENV_PATH" >&2
    exit 1
  fi
  printf '%s' "$value"
}

SUPABASE_URL="$(required_env_value "NEXT_PUBLIC_SUPABASE_URL")"
SUPABASE_ANON_KEY="$(required_env_value "NEXT_PUBLIC_SUPABASE_ANON_KEY")"

case "$API_BASE_URL" in
  *10.0.2.2*|*localhost*|*127.0.0.1*|*0.0.0.0*)
    echo "Refusing to build a tester artifact with local/emulator API_BASE_URL: $API_BASE_URL" >&2
    echo "Use a deployed staging/production API URL for physical devices." >&2
    exit 1
    ;;
esac

if [[ -z "$BUILD_NAME" ]]; then
  BUILD_NAME="$(grep -E '^version:' "$MOBILE_DIR/pubspec.yaml" | head -n 1 | awk '{print $2}' | cut -d '+' -f 1)"
fi

if [[ -z "$BUILD_NUMBER" ]]; then
  BUILD_NUMBER="$(date -u +%Y%m%d%H)"
fi

ALLOW_BAD_CERTIFICATES="false"
raw_bad_certs="$(read_env_value "MOBILE_ALLOW_BAD_CERTIFICATES" | tr '[:upper:]' '[:lower:]')"
if [[ "$raw_bad_certs" == "1" || "$raw_bad_certs" == "true" || "$raw_bad_certs" == "yes" || "$raw_bad_certs" == "on" ]]; then
  ALLOW_BAD_CERTIFICATES="true"
fi

FLUTTER_DEFINES=(
  "--dart-define=APP_ENV=$APP_ENV"
  "--dart-define=SUPABASE_URL=$SUPABASE_URL"
  "--dart-define=SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
  "--dart-define=API_BASE_URL=$API_BASE_URL"
  "--dart-define=AUTH_REDIRECT_SCHEME=serviq"
  "--dart-define=AUTH_REDIRECT_HOST=auth-callback"
  "--dart-define=ALLOW_BAD_CERTIFICATES=$ALLOW_BAD_CERTIFICATES"
)

optional_define_from_env() {
  local source_key="$1"
  local define_key="$2"
  local value
  value="$(read_env_value "$source_key")"
  if [[ -n "$value" ]]; then
    FLUTTER_DEFINES+=("--dart-define=$define_key=$value")
  fi
}

optional_define_from_env "MOBILE_FIREBASE_API_KEY" "FIREBASE_API_KEY"
optional_define_from_env "MOBILE_FIREBASE_PROJECT_ID" "FIREBASE_PROJECT_ID"
optional_define_from_env "MOBILE_FIREBASE_MESSAGING_SENDER_ID" "FIREBASE_MESSAGING_SENDER_ID"
optional_define_from_env "MOBILE_FIREBASE_STORAGE_BUCKET" "FIREBASE_STORAGE_BUCKET"
optional_define_from_env "MOBILE_FIREBASE_ANDROID_APP_ID" "FIREBASE_ANDROID_APP_ID"
optional_define_from_env "MOBILE_FIREBASE_ANDROID_CLIENT_ID" "FIREBASE_ANDROID_CLIENT_ID"

cd "$MOBILE_DIR"

if [[ "$RUN_CHECKS" -eq 1 ]]; then
  flutter analyze --no-pub
  flutter test --no-pub
fi

if [[ "$OUTPUT_KIND" == "aab" ]]; then
  flutter build appbundle --release \
    --build-name "$BUILD_NAME" \
    --build-number "$BUILD_NUMBER" \
    "${FLUTTER_DEFINES[@]}"
  SOURCE_PATH="$MOBILE_DIR/build/app/outputs/bundle/release/app-release.aab"
  EXTENSION="aab"
else
  flutter build apk --release \
    --build-name "$BUILD_NAME" \
    --build-number "$BUILD_NUMBER" \
    "${FLUTTER_DEFINES[@]}"
  SOURCE_PATH="$MOBILE_DIR/build/app/outputs/flutter-apk/app-release.apk"
  EXTENSION="apk"
fi

if [[ ! -f "$SOURCE_PATH" ]]; then
  echo "Expected build output was not created: $SOURCE_PATH" >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%d-%H%M)"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -cs '[:alnum:]._-' '-')"
OUTPUT_DIR="$MOBILE_DIR/release/apk"
OUTPUT_PATH="$OUTPUT_DIR/serviq-mobile-$BUILD_NAME-$BUILD_NUMBER-$SAFE_LABEL-$STAMP.$EXTENSION"
mkdir -p "$OUTPUT_DIR"
cp "$SOURCE_PATH" "$OUTPUT_PATH"
shasum -a 256 "$OUTPUT_PATH" >"$OUTPUT_PATH.sha256"

if [[ "$EXTENSION" == "apk" ]]; then
  ANDROID_SDK_ROOT_RESOLVED="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
  APKSIGNER="$ANDROID_SDK_ROOT_RESOLVED/build-tools/36.1.0/apksigner"
  if [[ ! -x "$APKSIGNER" ]]; then
    APKSIGNER="$HOME/Library/Android/sdk/build-tools/36.1.0/apksigner"
  fi
  if [[ -x "$APKSIGNER" ]]; then
    JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}" \
      "$APKSIGNER" verify --print-certs "$OUTPUT_PATH"
  fi
fi

echo "Created tester artifact: $OUTPUT_PATH"
echo "Checksum: $OUTPUT_PATH.sha256"
