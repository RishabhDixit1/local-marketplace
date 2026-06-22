#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Update .env.local with the correct Supabase project URL
# ─────────────────────────────────────────────────────────────
# Run this after migrating from self-hosted EC2 Supabase to
# managed Supabase project.
#
# Usage:
#   bash scripts/update-supabase-url.sh <your-project-ref>
#
# Example:
#   bash scripts/update-supabase-url.sh hcayrcsmddtqqlvkvaqd
#
# This updates SUPABASE_URL in .env.local to point to your
# managed Supabase project instead of the old EC2 instance.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: bash scripts/update-supabase-url.sh <project-ref>"
  echo ""
  echo "Example:"
  echo "  bash scripts/update-supabase-url.sh hcayrcsmddtqqlvkvaqd"
  echo ""
  echo "Your project ref is the subdomain in your Supabase URL:"
  echo "  https://<project-ref>.supabase.co"
  exit 1
fi

PROJECT_REF="$1"
NEW_URL="https://${PROJECT_REF}.supabase.co"
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found in current directory."
  echo "Run this script from the project root."
  exit 1
fi

# Check if running on macOS for sed compatibility
if [[ "$(uname)" == "Darwin" ]]; then
  SED_CMD="sed -i ''"
else
  SED_CMD="sed -i"
fi

echo "Updating SUPABASE_URL in $ENV_FILE ..."
echo "  Old: $(grep '^SUPABASE_URL=' "$ENV_FILE" || echo 'not set')"
echo "  New: SUPABASE_URL=$NEW_URL"

# Update or add SUPABASE_URL
if grep -q '^SUPABASE_URL=' "$ENV_FILE"; then
  eval "$SED_CMD" "s|^SUPABASE_URL=.*|SUPABASE_URL=$NEW_URL|" "$ENV_FILE"
else
  echo "SUPABASE_URL=$NEW_URL" >> "$ENV_FILE"
fi

echo ""
echo "Done! SUPABASE_URL updated to $NEW_URL"
echo ""
echo "Next steps:"
echo "  1. Restart your dev server (npm run dev)"
echo "  2. Run the cart migration: node scripts/apply-pending-migrations.mjs"
echo "     OR paste supabase/migrations/20260616000000_cart_sync.sql into Supabase SQL Editor"
echo "  3. Verify images load: http://localhost:3000/storage/v1/object/public/profile-avatars/..."
