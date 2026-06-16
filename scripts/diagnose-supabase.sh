#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# Supabase EC2 Diagnostics & Restart Script
# Run this ON the EC2 instance where Supabase runs.
# ──────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }

echo ""
echo "========================================"
echo "  Supabase EC2 Diagnostics"
echo "========================================"
echo ""

# ── Step 1: Docker status ──
echo "1. Docker containers"
echo "---------------------"
if ! docker info &>/dev/null; then
  fail "Docker daemon not running. Start it with: sudo systemctl start docker"
  exit 1
fi
pass "Docker daemon is running"

# Find Supabase containers
for name in supabase-db supabase_db_db supabase_db db; do
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${name}$"; then
    DB_CONTAINER="$name"
    break
  fi
done

for name in supabase-auth auth gotrue; do
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${name}$"; then
    AUTH_CONTAINER="$name"
    break
  fi
done

for name in supabase-rest rest postgrest; do
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${name}$"; then
    REST_CONTAINER="$name"
    break
  fi
done

for name in supabase-kong kong; do
  if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${name}$"; then
    KONG_CONTAINER="$name"
    break
  fi
done

echo "  DB container:       ${DB_CONTAINER:-NOT FOUND}"
echo "  Auth (GoTrue):      ${AUTH_CONTAINER:-NOT FOUND}"
echo "  REST (PostgREST):   ${REST_CONTAINER:-NOT FOUND}"
echo "  Kong (API Gateway): ${KONG_CONTAINER:-NOT FOUND}"

# Find the Supabase docker-compose directory
SUPABASE_DIR=""
for dir in /home/ec2-user/supabase /opt/supabase /srv/supabase /supabase ~/supabase; do
  if [ -f "$dir/docker-compose.yml" ]; then
    SUPABASE_DIR="$dir"
    break
  fi
done

if [ -n "$SUPABASE_DIR" ]; then
  pass "Found Supabase docker-compose at: $SUPABASE_DIR"
else
  warn "No docker-compose.yml found in common locations."
  info "If Supabase uses docker-compose, edit SUPABASE_DIR in this script."
fi

# ── Step 2: Check each container ──
echo ""
echo "2. Container health"
echo "---------------------"

if [ -n "$DB_CONTAINER" ]; then
  DB_STATUS=$(docker inspect --format='{{.State.Status}}' "$DB_CONTAINER" 2>/dev/null)
  DB_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "none")
  if [ "$DB_STATUS" = "running" ]; then
    pass "Database ($DB_CONTAINER): running, health=$DB_HEALTH"
  else
    fail "Database ($DB_CONTAINER): $DB_STATUS"
  fi
else
  fail "No database container found. Supabase may not be running."
fi

if [ -n "$AUTH_CONTAINER" ]; then
  AUTH_STATUS=$(docker inspect --format='{{.State.Status}}' "$AUTH_CONTAINER" 2>/dev/null)
  if [ "$AUTH_STATUS" = "running" ]; then
    pass "Auth/GoTrue ($AUTH_CONTAINER): running"
    # Check GoTrue logs for DB errors
    AUTH_ERRORS=$(docker logs "$AUTH_CONTAINER" --tail 30 2>&1 | grep -i "error\|database\|panic" | tail -5 || true)
    if [ -n "$AUTH_ERRORS" ]; then
      warn "GoTrue recent errors:"
      echo "$AUTH_ERRORS" | sed 's/^/    /'
    fi
  else
    fail "Auth/GoTrue ($AUTH_CONTAINER): $AUTH_STATUS"
  fi
else
  fail "No auth/gotrue container found"
fi

if [ -n "$REST_CONTAINER" ]; then
  REST_STATUS=$(docker inspect --format='{{.State.Status}}' "$REST_CONTAINER" 2>/dev/null)
  if [ "$REST_STATUS" = "running" ]; then
    pass "PostgREST ($REST_CONTAINER): running"
    REST_ERRORS=$(docker logs "$REST_CONTAINER" --tail 20 2>&1 | grep -i "error\|database\|schema" | tail -5 || true)
    if [ -n "$REST_ERRORS" ]; then
      warn "PostgREST recent errors:"
      echo "$REST_ERRORS" | sed 's/^/    /'
    fi
  else
    fail "PostgREST ($REST_CONTAINER): $REST_STATUS"
  fi
else
  fail "No postgrest container found"
fi

# ── Step 3: Kong health check ──
echo ""
echo "3. Kong API Gateway"
echo "---------------------"
KONG_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8000 2>/dev/null || echo "unreachable")
if [ "$KONG_HTTP_CODE" != "unreachable" ]; then
  pass "Kong on port 8000: HTTP $KONG_HTTP_CODE"
else
  fail "Kong on port 8000: unreachable"
fi

# ── Step 4: GoTrue health ──
echo ""
echo "4. GoTrue health check"
echo "-----------------------"
GOTRUE_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:8000/auth/v1/health 2>/dev/null || echo "unreachable")
if [ "$GOTRUE_HEALTH" = "401" ]; then
  pass "GoTrue: responding (HTTP 401 = healthy, needs auth header)"
elif [ "$GOTRUE_HEALTH" = "200" ]; then
  pass "GoTrue: healthy (HTTP 200)"
else
  fail "GoTrue: HTTP $GOTRUE_HEALTH (expected 401)"
fi

# ── Step 5: Database connectivity ──
echo ""
echo "5. Database connectivity"
echo "-------------------------"
if [ -n "$DB_CONTAINER" ]; then
  if docker exec "$DB_CONTAINER" pg_isready -U postgres &>/dev/null; then
    pass "Postgres is accepting connections"
  else
    fail "Postgres is NOT accepting connections"
    info "Check logs: docker logs $DB_CONTAINER --tail 50"
  fi
else
  fail "Cannot check database — no container found"
fi

# ── Summary and fix ──
echo ""
echo "========================================"
echo "  Summary & Fix"
echo "========================================"
echo ""

BROKEN=false
if [ -z "$DB_CONTAINER" ] || { [ -n "$DB_CONTAINER" ] && ! docker exec "$DB_CONTAINER" pg_isready -U postgres &>/dev/null; }; then
  BROKEN=true
  echo -e "  ${RED}ISSUE: Database is down${NC}"
  echo "  Fix: Restart the Supabase stack"
fi

if [ -n "$AUTH_CONTAINER" ] && [ -n "$REST_CONTAINER" ] && \
   docker inspect --format='{{.State.Status}}' "$AUTH_CONTAINER" 2>/dev/null | grep -q running && \
   docker inspect --format='{{.State.Status}}' "$REST_CONTAINER" 2>/dev/null | grep -q running; then
  echo -e "  ${GREEN}All core services appear to be running.${NC}"
  echo ""
  echo "  The issue may be a stale database connection in GoTrue."
  echo "  Try restarting just GoTrue:"
  echo ""
  echo "    docker restart $AUTH_CONTAINER"
  echo "    sleep 3"
  echo "    docker restart $REST_CONTAINER"
  echo ""
fi

if [ "$BROKEN" = true ] || [ "$KONG_HTTP_CODE" = "unreachable" ]; then
  echo ""
  echo "  ┌──────────────────────────────────────────────────────┐"
  echo "  │  RUN THIS TO RESTART THE SUPABASE STACK:             │"
  echo "  └──────────────────────────────────────────────────────┘"
  echo ""

  if [ -n "$SUPABASE_DIR" ]; then
    echo "    cd $SUPABASE_DIR"
    echo "    docker compose down"
    echo "    docker compose up -d"
    echo "    sleep 10"
    echo "    docker compose ps"
  else
    echo "    # Navigate to your Supabase docker-compose directory, then:"
    echo "    docker compose down"
    echo "    docker compose up -d"
    echo "    sleep 10"
    echo "    docker compose ps"
  fi

  echo ""
  echo "  Then verify:"
  echo "    curl http://localhost:8000/auth/v1/health"
  echo "    curl -H 'apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY' http://localhost:8000/rest/v1/"
  echo ""
fi

# ── Quick fix option ──
echo ""
echo "  ┌──────────────────────────────────────────────────────┐"
echo "  │  QUICK FIX: Restart all Supabase containers          │"
echo "  └──────────────────────────────────────────────────────┘"
echo ""
echo "  Run this single command:"
echo ""
echo '    docker ps --filter "name=supabase" --format "{{.Names}}" | xargs -r docker restart && sleep 5 && echo "Done"'
echo ""
echo "  This restarts all containers with 'supabase' in their name"
echo "  (handles auth/db/rest/kong/realtime in any order)."
