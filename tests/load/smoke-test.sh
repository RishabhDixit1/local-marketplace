#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FAILED=0

endpoints=(
  "/"
  "/market/crossing-republik/electrician"
  "/search?q=plumber"
  "/search?q=electrician"
  "/market/crossing-republik/carpenter"
)

echo "=== Smoke Test: $BASE_URL ==="
echo ""

for endpoint in "${endpoints[@]}"; do
  full_url="${BASE_URL}${endpoint}"
  start=$(date +%s%N)

  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$full_url" 2>/dev/null || echo "000")

  end=$(date +%s%N)
  elapsed_ms=$(( (end - start) / 1000000 ))

  if [ "$status" = "200" ]; then
    echo "  PASS  ${elapsed_ms}ms  ${endpoint}"
  else
    echo "  FAIL  HTTP ${status}  ${elapsed_ms}ms  ${endpoint}"
    FAILED=1
  fi
done

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
  exit 1
fi
