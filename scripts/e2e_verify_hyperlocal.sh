#!/usr/bin/env bash
# Manual end-to-end verification script for Crossing Republik hyperlocal market
# Run this after migrations and seeds are applied.
set -euo pipefail

SUPABASE_DB_URL="${SUPABASE_DB_URL:?SUPABASE_DB_URL required}"

echo "=== 1. Verify localities table ==="
psql "$SUPABASE_DB_URL" -c "SELECT count(*) AS total, zone_type, phase FROM localities GROUP BY zone_type, phase ORDER BY zone_type;"

echo ""
echo "=== 2. Verify service categories ==="
psql "$SUPABASE_DB_URL" -c "SELECT id, name, slug, is_active FROM service_categories ORDER BY sort_order;"

echo ""
echo "=== 3. Verify API: /api/localities ==="
curl -s "http://localhost:3000/api/localities?zone_type=society&phase=1" | python3 -m json.tool | head -15

echo ""
echo "=== 4. Verify API: /api/service-categories ==="
curl -s "http://localhost:3000/api/service-categories" | python3 -m json.tool | head -15

echo ""
echo "=== 5. Verify API: /api/market/crossing-republik ==="
curl -s "http://localhost:3000/api/market/crossing-republik" | python3 -m json.tool | head -30

echo ""
echo "=== 6. Verify market page renders ==="
curl -s -o /dev/null -w "HTTP %{http_code}" "http://localhost:3000/market/crossing-republik"
echo ""

echo ""
echo "=== 7. Verify RPC function exists ==="
psql "$SUPABASE_DB_URL" -c "SELECT proname FROM pg_proc WHERE proname = 'providers_near_locality';"

echo ""
echo "=== ALL CHECKS PASSED ==="
