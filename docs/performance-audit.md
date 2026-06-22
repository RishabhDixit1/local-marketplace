# Performance Audit Guide

## Prerequisites

```bash
# Install Lighthouse CI globally (optional — script handles missing tools gracefully)
npm install -g @lhci/cli
```

---

## 1. Lighthouse CI (Web Performance Audits)

Run a full Lighthouse audit against production or local build.

```bash
# Local: build first, then audit
next build && npx lhci autorun --collect.url=http://localhost:3000 --collect.numberOfRuns=1

# Or use the convenience script
bash scripts/performance-audit.sh
```

The script audits these 5 critical pages:
- `/` — Home
- `/market/crossing-republik` — Marketplace listing
- `/search` — Search results
- `/business/[slug]` — Business profile (uses a sample slug)
- `/dashboard` — User dashboard

Reports are saved to `reports/performance/`.

---

## 2. Bundle Analyzer

Analyze JavaScript bundle sizes to find large dependencies.

```bash
# Add @next/bundle-analyzer first (if not already installed):
# npm install -D @next/bundle-analyzer

# Run the build with analysis
ANALYZE=true npm run build
```

This generates an interactive treemap in `.next/analyze/` showing the size of each module.

**Configuration**: See `next.config.ts` — the `withBundleAnalyzer` wrapper is pre-configured but commented out. Uncomment when `@next/bundle-analyzer` is installed.

---

## 3. Image Optimization Audit

Check that all images use `next/image` (not raw `<img>` tags) and are served from modern formats.

```bash
# Find raw <img> tags that should be next/image
grep -rn '<img' app/ --include='*.tsx' --include='*.ts' | grep -v 'next/image' | grep -v 'node_modules'

# Check for missing width/height on Image components
bash scripts/performance-audit.sh  # includes image check
```

**Best practices**:
- Always use `import Image from 'next/image'` instead of `<img>`
- Provide `width` and `height` or `fill` prop
- Use `sizes` prop for responsive images
- Leverage WebP/AVIF via `next.config.ts` `formats` config

---

## 4. API Response Times

Measure API endpoint latency using server logs or a simple script.

```bash
# Check server-side timing via Vercel Analytics or Sentry
# Or use curl to manually measure:

# Measure Supabase API response times
time curl -s -o /dev/null -w "Connect: %{time_connect}s, TTFB: %{time_starttransfer}s, Total: %{time_total}s\n" \
  https://YOUR_SUPABASE_PROJECT.supabase.co/rest/v1/

# Profile a local page load (includes API calls)
curl -H "X-Forwarded-Proto: https" -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" http://localhost:3000
```

**Key endpoints to monitor**:
- `/api/` routes (search, listings, orders)
- Supabase REST API (`/rest/v1/`)
- Supabase Auth (`/auth/v1/`)

---

## 5. Render-Blocking Resources

Identify CSS/JS that blocks the initial render.

```bash
# Use Lighthouse (it reports render-blocking resources)
# Or check manually:
# 1. Open DevTools → Coverage tab → Reload
# 2. Look for unused bytes in CSS/JS
# 3. Audit with: npx lhci collect --url=http://localhost:3000 --collect.settings.onlyCategories=performance
```

**Mitigations already in place**:
- `next.config.ts` has `staticPageGenerationTimeout: 120`
- `optimizePackageImports` configured for `lucide-react`, `@supabase/supabase-js`, `framer-motion`
- Content Security Policy is set via security headers

---

## 6. Core Web Vitals

Measure LCP, FID/INP, and CLS.

```bash
# Browser-based (DevTools): Performance tab → Core Web Vitals
# CLI via Lighthouse:
npx lhci collect --url=http://localhost:3000 --collect.settings.onlyCategories=performance

# Programmatic using web-vitals library (already in dependencies):
# See web-vitals: ^5.1.0 in package.json
# Report to any analytics endpoint by listening to `onCLS`, `onFCP`, `onLCP`, `onINP`
```

**Targets**:
| Metric     | Good    | Needs Improvement | Poor    |
|------------|---------|-------------------|---------|
| LCP        | ≤ 2.5s  | 2.5s – 4.0s       | > 4.0s  |
| INP        | ≤ 200ms | 200ms – 500ms     | > 500ms |
| CLS        | ≤ 0.1   | 0.1 – 0.25        | > 0.25  |
| FCP        | ≤ 1.8s  | 1.8s – 3.0s       | > 3.0s  |

---

## 7. Mobile App Startup Time

For the Flutter-based mobile app, measure cold start and time-to-interactive.

```bash
# Android (from mobile/ directory):
cd mobile
flutter run --profile  # profile mode for realistic metrics
# Then in DevTools: Performance → Timeline → record startup

# Or use the command-line:
flutter build apk --profile --target-platform android-arm64
# Install and launch, then check logs:
adb logcat -s flutter | grep "Timeline"
```

**Key metrics**:
- Cold start: < 5 seconds (target)
- Time-to-interactive: < 3 seconds
- First frame: < 2 seconds

---

## Running the Full Suite

```bash
bash scripts/performance-audit.sh
```

This runs all available audits and writes results to `reports/performance/`.
