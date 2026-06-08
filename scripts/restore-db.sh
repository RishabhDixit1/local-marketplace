#!/usr/bin/env bash
set -euo pipefail

# Database restore: download from S3 → psql restore
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db" \
#   AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx \
#   RESTORE_S3_BUCKET=my-bucket \
#   RESTORE_KEY=serviq/db/2024-01-01T00-00-00Z.sql.gz \
#   bash scripts/restore-db.sh

: "${DATABASE_URL:?Required: DATABASE_URL}"
: "${RESTORE_S3_BUCKET:?Required: RESTORE_S3_BUCKET}"
: "${RESTORE_KEY:?Required: RESTORE_KEY (S3 object key)}"
: "${AWS_ACCESS_KEY_ID:?Required: AWS_ACCESS_KEY_ID}"
: "${AWS_SECRET_ACCESS_KEY:?Required: AWS_SECRET_ACCESS_KEY}"
: "${AWS_DEFAULT_REGION:=ap-southeast-2}"

TMPFILE=$(mktemp /tmp/serviq-restore-XXXXXX.sql.gz)
trap 'rm -f "$TMPFILE"' EXIT

echo "==> Downloading s3://${RESTORE_S3_BUCKET}/${RESTORE_KEY}..."
RESOURCE="/${RESTORE_S3_BUCKET}/${RESTORE_KEY}"
DATE=$(date -u +"%a, %d %b %Y %H:%M:%S GMT")
STRING_TO_SIGN="GET\n\n\n${DATE}\n${RESOURCE}"
SIGNATURE=$(printf "%s" "$STRING_TO_SIGN" | \
  openssl dgst -sha1 -hmac "$AWS_SECRET_ACCESS_KEY" -binary | \
  xxd -p | tr -d '\n')

curl -sf -o "$TMPFILE" \
  -H "Date: ${DATE}" \
  -H "Authorization: AWS ${AWS_ACCESS_KEY_ID}:${SIGNATURE}" \
  "https://${RESTORE_S3_BUCKET}.s3.${AWS_DEFAULT_REGION}.amazonaws.com/${RESTORE_KEY}"

echo "Downloaded. Restoring..."

# Drop and recreate — USE WITH CAUTION
gunzip -c "$TMPFILE" | psql "$DATABASE_URL"

echo "Restore complete."
