#!/usr/bin/env bash
set -euo pipefail

# Performance audit script for ServiQ marketplace
# Runs Lighthouse audits on critical pages and reports bundle/image stats.
# All output goes to reports/performance/ — safe to run anytime.

REPORTS_DIR="reports/performance"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORTS_DIR}/audit-${TIMESTAMP}.txt"
LH_DIR="${REPORTS_DIR}/lighthouse-${TIMESTAMP}"

mkdir -p "$REPORTS_DIR"

echo "==========================================" | tee -a "$REPORT_FILE"
echo "  ServiQ Performance Audit — $(date)"       | tee -a "$REPORT_FILE"
echo "==========================================" | tee -a "$REPORT_FILE"

# ---------------------------------------------------------------------------
# 1. Lighthouse CI audit (via CLI)
# ---------------------------------------------------------------------------
echo "" | tee -a "$REPORT_FILE"
echo "--- Lighthouse CI ---" | tee -a "$REPORT_FILE"

if command -v lhci &>/dev/null; then
  PAGES=(
    "http://localhost:3000/"
    "http://localhost:3000/market/crossing-republik"
    "http://localhost:3000/search"
    "http://localhost:3000/business/sample-business"
    "http://localhost:3000/dashboard"
  )

  mkdir -p "$LH_DIR"
  for url in "${PAGES[@]}"; do
    echo "  Auditing: $url" | tee -a "$REPORT_FILE"
    npx lhci collect --url="$url" --collect.numberOfRuns=1 --collect.settings.output=html,json \
      --collect.outputDir="$LH_DIR" 2>&1 | tee -a "$REPORT_FILE" || true
  done

  echo "  Lighthouse reports saved to: $LH_DIR" | tee -a "$REPORT_FILE"
else
  echo "  [SKIP] Lighthouse CI not installed." | tee -a "$REPORT_FILE"
  echo "  Install: npm install -g @lhci/cli" | tee -a "$REPORT_FILE"
  echo "  Or run: npx github:GoogleChrome/lighthouse-ci" | tee -a "$REPORT_FILE"
fi

# ---------------------------------------------------------------------------
# 2. Bundle size analysis (if ANALYZE=true)
# ---------------------------------------------------------------------------
echo "" | tee -a "$REPORT_FILE"
echo "--- Bundle Size Analysis ---" | tee -a "$REPORT_FILE"

if [ "${ANALYZE:-}" = "true" ]; then
  if [ -d ".next/analyze" ]; then
    echo "  Bundle analysis found in .next/analyze/:" | tee -a "$REPORT_FILE"
    ls -lh .next/analyze/ | tee -a "$REPORT_FILE"
    cp -r .next/analyze "$REPORTS_DIR/analyze-${TIMESTAMP}" 2>/dev/null || true
    echo "  Copied to: $REPORTS_DIR/analyze-${TIMESTAMP}" | tee -a "$REPORT_FILE"
  else
    echo "  [SKIP] No bundle analysis found. Run: ANALYZE=true npm run build" | tee -a "$REPORT_FILE"
  fi
else
  echo "  [SKIP] Set ANALYZE=true to include bundle analysis." | tee -a "$REPORT_FILE"
fi

# ---------------------------------------------------------------------------
# 3. Image optimization audit — find raw <img> tags (not next/image)
# ---------------------------------------------------------------------------
echo "" | tee -a "$REPORT_FILE"
echo "--- Image Optimization Audit ---" | tee -a "$REPORT_FILE"

RAW_IMG=$(grep -rn '<img' app/ --include='*.tsx' --include='*.ts' 2>/dev/null || true)

if [ -n "$RAW_IMG" ]; then
  echo "  Potential raw <img> tags (not using next/image):" | tee -a "$REPORT_FILE"
  while IFS= read -r line; do
    echo "    $line" | tee -a "$REPORT_FILE"
  done <<< "$RAW_IMG"
else
  echo "  No raw <img> tags found in app/ — good!" | tee -a "$REPORT_FILE"
fi

# Count next/image usage
IMAGE_COUNT=$(grep -rn "from 'next/image'" app/ --include='*.tsx' --include='*.ts' 2>/dev/null | wc -l | tr -d ' ')
echo "  next/image imports: ${IMAGE_COUNT:-0}" | tee -a "$REPORT_FILE"

# ---------------------------------------------------------------------------
# 4. Summary
# ---------------------------------------------------------------------------
echo "" | tee -a "$REPORT_FILE"
echo "==========================================" | tee -a "$REPORT_FILE"
echo "  Audit complete."                          | tee -a "$REPORT_FILE"
echo "  Report: $REPORT_FILE"                     | tee -a "$REPORT_FILE"
echo "==========================================" | tee -a "$REPORT_FILE"
