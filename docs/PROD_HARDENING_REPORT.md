# Production-Grade Hardening Report

Status snapshot after the Sep 17 performance/AI/infra sprint. Audience: founders +
eng. Companion docs: `docs/FOUNDER_ACTION_LIST.md`, `docs/LAUNCH_CHECKLIST.md`,
`docs/DB_OPERATIONS.md`, `docs/FEATURE_DEVIATIONS_LOG.md`.

## What was wrong (summary)

1. AI fully offline: Google retired our Gemini model -> every call 404 -> silent keyword fallback.
2. Landing + search slow: full-table fetches, no SQL filtering, no caching, no DB trigram/functional indexes, duplicate searches.
3. EC2 disk 100% full (291MB free) from a legacy, crash-looping PM2 "serviq" daemon (37G of logs) that was not serving traffic (nginx -> docker serviq).
4. Intent misrouting, dashboard nav-away, zones uncached.

## Fixed & shipped (Sep 17)

- AI: `gemini-3.6-flash` model fix (env-overridable); verified live streaming.
- Perf: SQL-bound + limited AI provider fetch; landing fetch 100->12; zones cache 300s (1.9s->8ms); search geo dedupe.
- DB: pg_trgm GIN x4, `reviews(provider_id, rating)` covering index, `orders(provider_id, lower(status))` functional index, partial search index, duplicate index dropped. Applied to prod live DB.
- Infra: purged 29G of zombie pm2 logs, disabled+inactive its boot unit, vacuumed journal. Disk 100% -> 40% used.
- Intent/UX: `isBuyIntent` fix; dashboard chat only navigates on concrete actions.

## Priority roadmap

### P0 — do before advertising scale (days)
1. **Wire the real intent engine** (`/api/ai/intent`) as the live path behind `/api/ai/prompt` and the mobile AI bar — replaces naive substring matching (D11). This is the "billion-dollar-grade" differentiator already built but dead.
2. **Shared cache**: promote `lib/cache/withCache` from in-memory Map to shared store (`REDIS_URL`/`KV_URL` via ioredis already supported). In-memory resets per instance and invalidates under multi-pod deploys.
3. **Fix web auth fallback** (D10): `app/api/auth/verify-link/route.ts` custom-JWT path — refresh robustness; add a regression test that a GoTrue-expired refresh bounces to login, not home.
4. **Revisit Supabase footprint**: stop `analytics` + `studio` containers (~390MB RAM, not needed in prod) or move Supabase to its own instance. 3.7GB box + swap thrash is the ceiling on growth.

### P1 — this quarter
5. Featured placements: seed/operate `public.featured_placements` (D12) or remove the featured sort surface.
6. Public listing route for anonymous browse (D13) — decision: funnel vs public.
7. Gemini paid tier (D15) or rate-limit AI surface client-side; consider a cheaper fast model for streaming.
8. CDN/edge caching for public GETs (`/api/market/zones`, community) — move off Node to a CDN layer or `revalidate`.

### P2 — next quarter
9. DB-aware uptime: extend `.github/workflows/uptime-check.yml` to assert REST/Realtime + migration drift, not just HTTP 200s.
10. Autoscaling story: split web (serviq) from Supabase; enable instance type upgrade; add swapfile sizing.
11. Provider ETA (D14) — completes the quick-response pilot gap.
12. Mobile/web parity pass for the remaining differences (D16; desktop PWA vs mobile nav).

## Metrics before/after

| Check | Before | After |
|-------|--------|-------|
| Gemini generateContent | 404 (model retired) | 200 `gemini-3.6-flash` |
| Zones endpoint | 1.9s (uncached) | 8ms (TTL 300s) |
| Landing provider fetch | 100 rows -> 6 shown | 12 rows, true count from facets |
| AI prompt DB load | full table/keystroke | SQL filtered, `.limit(50)` |
| Disk / | 100% (291M free) | 40% (31G free) |
| Web unit tests | 223 pass | 223 pass |
| Mobile tests | 239 pass | 239 pass |