# Load Tests

Tools:
- **k6** for API load testing: https://k6.io/docs/get-started/installation/
- **Artillery** for broader scenario testing: `npm install -g artillery`

## Quick Start

```bash
# Install k6 (macOS via Homebrew)
brew install k6

# Run a basic smoke test
k6 run smoke-test.js
```

## Scripts

| Script | Description | Target |
|--------|-------------|--------|
| `smoke-test.js` | Baseline — 5 VUs for 30s, hits feed + categories + localities | All cached endpoints |
| `load-test.js` | Moderate load — 50 VUs ramping to 100 over 3 min, hits feed + providers-by-category + search | Cached + uncached |
| `stress-test.js` | Stress — 200 VUs sustained, hits uncached order/review endpoints | Uncached paths |

## Scenarios

1. **Smoke** — Validate caching works (first request should miss, subsequent hit)
2. **Load** — 50 concurrent users browsing feed, categories, and provider listings
3. **Stress** — 200 concurrent users with burst traffic to test Redis-backed caching limits

## Notes

- Default base URL: `http://localhost:3000`
- Set `BASE_URL` env var to target a different environment (e.g., `BASE_URL=https://serviqapp.com`)
- Cached endpoints (feed, people, localities, categories, admin stats) should show significantly lower p95 latency under load
