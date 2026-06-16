#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Supabase EC2 — Fix Database Connection
# ─────────────────────────────────────────────────────────────
# SSH into EC2 first, then run these commands one by one.
# ─────────────────────────────────────────────────────────────

set -euo pipefail

echo "======================================"
echo "  STEP 1: Check disk space"
echo "======================================"
df -h /

echo ""
echo "======================================"
echo "  STEP 2: Find Supabase containers"
echo "======================================"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep supabase
# Also try without supabase prefix:
docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep -v "^NAMES"

echo ""
echo "======================================"
echo "  STEP 3: Check Postgres health"
echo "======================================"
# Find the DB container name
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase.*db|db' | head -1)
echo "DB container: $DB_CONTAINER"

# Check if it's running
docker inspect "$DB_CONTAINER" --format 'Status={{.State.Status}} Health={{.State.Health.Status}}' 2>/dev/null || echo "DB container not found"

# Test Postgres directly
docker exec "$DB_CONTAINER" pg_isready -U postgres
docker exec "$DB_CONTAINER" psql -U postgres -c "SELECT 1" 2>&1

echo ""
echo "======================================"
echo "  STEP 4: Check Postgres logs"
echo "======================================"
docker logs "$DB_CONTAINER" --tail 30 2>&1

echo ""
echo "======================================"
echo "  STEP 5: Check GoTrue logs"
echo "======================================"
AUTH_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase.*auth|auth|gotrue' | head -1)
docker logs "$AUTH_CONTAINER" --tail 30 2>&1

echo ""
echo "======================================"
echo "  STEP 6: Check PostgREST logs"
echo "======================================"
REST_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase.*rest|rest|postgrest' | head -1)
docker logs "$REST_CONTAINER" --tail 30 2>&1

echo ""
echo "======================================"
echo "  STEP 7: Check GoTrue environment"
echo "======================================"
docker inspect "$AUTH_CONTAINER" --format '{{range $k, $v := .Config.Env}}{{if or (hasPrefix $k "GOTRUE") (hasPrefix $k "DATABASE")}}{{$k}}={{$v}}{{"\n"}}{{end}}{{end}}' 2>/dev/null || echo "Could not read env — use: docker exec $AUTH_CONTAINER env"
# Alternative:
docker exec "$AUTH_CONTAINER" env | grep -E 'GOTRUE|DATABASE' 2>/dev/null || true

echo ""
echo "======================================"
echo "  THE FIX (if DB is running but GoTrue can't connect)"
echo "======================================"
echo ""
echo "  1. Restart just the auth container:"
echo "     docker restart $AUTH_CONTAINER"
echo "     sleep 5"
echo ""
echo "  2. If that doesn't work, restart the whole stack:"
echo "     docker compose down"
echo "     docker compose up -d"
echo "     sleep 15"
echo "     docker compose ps"
echo ""
echo "  3. Verify:"
echo "     curl -H 'apikey: <anon_key>' http://localhost:8000/auth/v1/health"
echo "     curl -H 'apikey: <anon_key>' -X POST http://localhost:8000/auth/v1/otp \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"email\":\"test@example.com\"}'"
