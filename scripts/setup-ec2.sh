#!/usr/bin/env bash
set -euo pipefail

# One-time EC2 setup: Docker, cron for process-jobs, directory structure
# Run via: ssh ec2-user@<host> 'bash -s' < scripts/setup-ec2.sh

APP_URL="${APP_URL:-http://localhost:3000}"
SUPABASE_URL="${SUPABASE_URL:-http://54.253.40.174:8000}"

echo "==> Installing Docker if missing..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker ec2-user
  echo "Docker installed. You may need to log out and back in for group changes."
fi

echo "==> Ensuring deploy directory..."
mkdir -p /home/ec2-user/serviq

echo "==> Setting up cron for background job queue..."
CRON_JOB="* * * * * curl -sf -X POST ${APP_URL}/api/cron/process-jobs >/dev/null 2>&1 || true"
(
  crontab -l 2>/dev/null | grep -v 'process-jobs' || true
  echo "$CRON_JOB"
) | crontab -
echo "Cron installed: $CRON_JOB"

echo "==> Verifying Docker..."
docker --version
echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Verify GitHub Actions secrets are set (EC2_HOST, EC2_SSH_KEY, etc.)"
echo "  2. Push to main to trigger the deploy workflow"
echo "  3. Run the DB migration for background_jobs table:"
echo "     docker exec -i serviq psql \$DATABASE_URL < supabase/migrations/20260608000000_background_jobs.sql"
