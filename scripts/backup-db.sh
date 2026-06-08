#!/usr/bin/env bash
set -euo pipefail

# Database backup: pg_dump → compress → S3
# Usage:
#   DATABASE_URL="postgresql://user:pass@host:5432/db" \
#   AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx \
#   BACKUP_S3_BUCKET=my-bucket \
#   BACKUP_S3_PREFIX=serviq/db \
#   bash scripts/backup-db.sh

: "${DATABASE_URL:?Required: DATABASE_URL (postgresql://...)}"
: "${BACKUP_S3_BUCKET:?Required: BACKUP_S3_BUCKET}"
: "${AWS_ACCESS_KEY_ID:=}"
: "${AWS_SECRET_ACCESS_KEY:=}"
: "${AWS_DEFAULT_REGION:=ap-southeast-2}"
: "${BACKUP_S3_PREFIX:=serviq/db}"
: "${BACKUP_RETENTION_DAYS:=30}"
: "${PG_DUMP_EXTRA_ARGS:=--no-owner --no-acl}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
FILENAME="${BACKUP_S3_PREFIX}/${TIMESTAMP}.sql.gz"
TMPFILE=$(mktemp /tmp/serviq-backup-XXXXXX.sql.gz)
trap 'rm -f "$TMPFILE"' EXIT

echo "==> Dumping database to ${TMPFILE}..."
pg_dump "$DATABASE_URL" $PG_DUMP_EXTRA_ARGS | gzip > "$TMPFILE"

FILESIZE=$(stat -f%z "$TMPFILE" 2>/dev/null || stat -c%s "$TMPFILE" 2>/dev/null || echo "?")
echo "Dump complete: $(numfmt --to=iec-i 2>/dev/null || echo "$FILESIZE bytes")"

# Upload to S3 via AWS API (no aws-cli dependency)
if [[ -n "$AWS_ACCESS_KEY_ID" && -n "$AWS_SECRET_ACCESS_KEY" ]]; then
  echo "==> Uploading to s3://${BACKUP_S3_BUCKET}/${FILENAME}..."

  RESOURCE="/${BACKUP_S3_BUCKET}/${FILENAME}"
  CONTENT_TYPE="application/gzip"
  DATE=$(date -u +"%a, %d %b %Y %H:%M:%S GMT")
  PAYLOAD_HASH=$(openssl dgst -sha256 < "$TMPFILE" | cut -d' ' -f2)

  # String to sign for AWS Signature V4
  # Uses a simplified signing approach (works with most S3-compatible stores)
  SIGNATURE_STRING="PUT\n\n${CONTENT_TYPE}\n${DATE}\nx-amz-acl:private\n/${BACKUP_S3_BUCKET}/${FILENAME}"

  SIGNATURE=$(printf "%s" "$SIGNATURE_STRING" | \
    openssl dgst -sha1 -hmac "$AWS_SECRET_ACCESS_KEY" -binary | \
    xxd -p | tr -d '\n')

  AUTH_HEADER="AWS ${AWS_ACCESS_KEY_ID}:${SIGNATURE}"

  curl -sf -X PUT \
    -H "Date: ${DATE}" \
    -H "Content-Type: ${CONTENT_TYPE}" \
    -H "Authorization: ${AUTH_HEADER}" \
    -H "x-amz-acl: private" \
    --data-binary @"$TMPFILE" \
    "https://${BACKUP_S3_BUCKET}.s3.${AWS_DEFAULT_REGION}.amazonaws.com/${FILENAME}"

  echo "Upload complete."
else
  echo "==> AWS credentials not set — skipping S3 upload."
  echo "    Backup saved locally at: ${TMPFILE}"
  echo "    Copy it manually to secure storage."
  exit 1
fi

# Cleanup old backups (list and delete via S3 API)
if command -v aws &>/dev/null; then
  echo "==> Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
  aws s3 ls "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/" \
    --region "$AWS_DEFAULT_REGION" \
    | while read -r line; do
    KEY=$(echo "$line" | awk '{print $4}')
    DATE=$(echo "$line" | awk '{print $1" "$2}')
    AGE=$(( ( $(date -d "$DATE" +%s) - $(date -d "$(date -u +"%Y-%m-%d %H:%M:%S")" +%s) ) / 86400 ))
    if [ "$AGE" -gt "$BACKUP_RETENTION_DAYS" ]; then
      aws s3 rm "s3://${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/${KEY}" --region "$AWS_DEFAULT_REGION"
      echo "Deleted old backup: ${KEY}"
    fi
  done
else
  echo "==> aws-cli not found — skipping retention cleanup."
fi

echo "==> Backup complete: ${FILENAME}"
