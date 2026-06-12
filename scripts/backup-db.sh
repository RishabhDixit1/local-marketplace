#!/usr/bin/env bash
set -euo pipefail

# Database backup: pg_dump → compress → S3
# Designed to run ON the EC2 instance where Supabase (self-hosted) lives.
#
# Auto-detects the Supabase Postgres container, dumps via docker exec,
# compresses, and uploads to S3 if aws-cli is configured.
#
# Usage (on EC2):
#   AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx \
#   BACKUP_S3_BUCKET=my-bucket \
#   bash scripts/backup-db.sh

BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-serviq/db}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-ap-southeast-2}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
FILENAME="${BACKUP_S3_PREFIX}/${TIMESTAMP}.sql.gz"
TMPFILE=$(mktemp /tmp/serviq-backup-XXXXXX.sql.gz)
trap 'rm -f "$TMPFILE"' EXIT

# --- Auto-detect Supabase Postgres container ---
SUPABASE_CONTAINER=""
for candidate in supabase-db supabase_db_db supabase_db; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${candidate}$"; then
    SUPABASE_CONTAINER=$candidate
    break
  fi
done

if [[ -z "$SUPABASE_CONTAINER" ]]; then
  # Fallback: pick the first container running postgres image
  SUPABASE_CONTAINER=$(docker ps --filter ancestor=postgres --format '{{.Names}}' 2>/dev/null | head -1)
fi

if [[ -z "$SUPABASE_CONTAINER" ]]; then
  echo "ERROR: Could not find a Postgres container. Is Supabase running?"
  echo "Tried: supabase-db, supabase_db_db, supabase_db, and any postgres image."
  exit 1
fi

echo "==> Found Postgres container: ${SUPABASE_CONTAINER}"

# --- Dump inside the container ---
echo "==> Dumping database via docker exec..."
docker exec "$SUPABASE_CONTAINER" pg_dump -U postgres --no-owner --no-acl postgres 2>/dev/null | gzip > "$TMPFILE"

FILESIZE=$(stat -c%s "$TMPFILE" 2>/dev/null || echo "?")
echo "Dump complete: $FILESIZE bytes"

# --- Upload to S3 ---
if [[ -n "$BACKUP_S3_BUCKET" ]] && command -v aws &>/dev/null; then
  echo "==> Uploading to s3://${BACKUP_S3_BUCKET}/${FILENAME}..."
  aws s3 cp "$TMPFILE" "s3://${BACKUP_S3_BUCKET}/${FILENAME}" --region "$AWS_DEFAULT_REGION" --no-progress
  echo "Upload complete."

  # --- Cleanup old backups ---
  echo "==> Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
  aws s3api list-objects-v2 \
    --bucket "$BACKUP_S3_BUCKET" \
    --prefix "${BACKUP_S3_PREFIX}/" \
    --query "Contents[?LastModified<=\`$(date -u -d "${BACKUP_RETENTION_DAYS} days ago" +%Y-%m-%dT00:00:00Z)\`].Key" \
    --output text \
    --region "$AWS_DEFAULT_REGION" \
  | while read -r key; do
    if [[ -n "$key" && "$key" != "None" ]]; then
      aws s3 rm "s3://${BACKUP_S3_BUCKET}/${key}" --region "$AWS_DEFAULT_REGION" --no-progress
      echo "Deleted old backup: ${key}"
    fi
  done
elif [[ -z "$BACKUP_S3_BUCKET" ]]; then
  echo "==> BACKUP_S3_BUCKET not set — saving locally."
  LOCAL_DIR="/home/ec2-user/backups"
  mkdir -p "$LOCAL_DIR"
  cp "$TMPFILE" "${LOCAL_DIR}/${FILENAME}"
  echo "    Backup saved to: ${LOCAL_DIR}/${FILENAME}"
  echo "    To upload later, copy to S3 or SCP."
elif ! command -v aws &>/dev/null; then
  echo "==> aws-cli not found — saving locally."
  LOCAL_DIR="/home/ec2-user/backups"
  mkdir -p "$LOCAL_DIR"
  cp "$TMPFILE" "${LOCAL_DIR}/${FILENAME}"
  echo "    Backup saved to: ${LOCAL_DIR}/${FILENAME}"
fi

echo "==> Backup complete: ${FILENAME}"
