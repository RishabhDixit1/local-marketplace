# Feature Deviation Log

Lay book: where the shipped app deviates from its intended/blueprint behavior.
Companion to `docs/PRODUCT_BIBLE.md`, `docs/IA_MENTAL_MODEL.md`, and
`docs/LAUNCH_CHECKLIST.md`. Each row = one deviation, its impact, status.

## Resolved this sprint (Sep 17)

| # | Deviation | Impact | Fix |
|---|-----------|--------|-----|
| D1 | Gemini model `gemini-2.0-flash` retired by Google (404 for new keys). Every `generate*` call silently failed -> app always fell back to keyword intent parsing. "AI doesn't work as intended." | AI broken end-to-end | `lib/ai/provider.ts` -> `gemini-3.6-flash` (env-overridable `GOOGLE_GEMINI_MODEL`); verified live |
| D2 | `fetchMatchingProviders` (`app/api/ai/prompt/route.ts`) pulled the ENTIRE `profiles` table into memory on every debounced keystroke, no `.limit()`, no SQL filter | Per-keystroke /search slowness | Filter in SQL (`services::text.ilike.%v%`) + `.limit(50)` |
| D3 | `isBuyIntent` regex matched bare "need"/"want" -> "I need a plumber" misrouted to buy_product flow | Wrong product/buy UX for service users | `lib/ai/intentParser.ts` requires explicit product language |
| D4 | Landing fetched ~100 providers to render 6 cards; "N providers near you" = array `.length` (undercounts) | Slow landing, wrong counts | `limit=12` + `facets.totalProviders` |
| D5 | `/api/market/zones` `Cache-Control: no-store`, no in-memory cache (same for `/`) | ~2s landing per load | `withCache` TTL 300s (1.9s -> 8ms) |
| D6 | `/search` fired two identical searches on mount (no-coords then coords) | Duplicate API load | Geolocation resolves before first search; 3.5s no-coords fallback |
| D7 | Dashboard chat auto-navigated after 500ms even for conversational answers | Working answers disappeared | Only navigate on concrete destination actions |
| D8 | Duplicate DB index `idx_reviews_provider_created` (twin `_v2`) | Write amplification | Dropped in migration |
| D9 | `orders(provider_id, lower(status))` had no functional index -> seq scan in `get_provider_order_stats`; no `pg_trgm` -> all `ilike '%x%'` full scans | Slow search/order endpoints | `20260917000000_search_perf_indexes.sql` (pg_trgm GIN x4, covering predicate, functional index, partial index) |

## Known, not yet resolved (log for roadmap)

| # | Deviation | Impact | Where |
|---|-----------|--------|-------|
| D10 | Web custom-JWT fallback in `app/api/auth/verify-link/route.ts` is broken; hard refresh after GoTrue token expiry can redirect to home | Session persistence on web | `app/api/auth/verify-link/route.ts` |
| D11 | Real intent engine `app/api/ai/intent` (six-input trust ranking + FTS) has NO caller; keyword substring match is the live path | Ranking quality << blueprint | `app/api/ai/intent/route.ts`, `lib/ai/intentMatching.ts` |
| D12 | `public.featured_placements` EMPTY on live DB -> no genuinely-featured providers; verified badge also doubles as "featured" | Featured section shows fallback ordering | `supabase` + `marketplace-landing` |
| D13 | All `/app/*` routes auth-gated; no public full-provider-listing route (Mobile mirrors) | Anonymous "Browse all" lands on Sign In | `app_router` / `app/search/page.tsx` |
| D14 | Provider quick-response still lacks ETA (schema/API/mobile) | Pilot gap, logged in PRODUCT_BIBLE Roadmap | -- |
| D15 | Gemini free-tier daily quota (RESOURCE_EXHAUSTED) available; paid tier is a [Founder] decision | AI degrades to keyword fallback at quota | `docs/FOUNDER_ACTION_LIST.md` |
| D16 | Supabase dev base is cleartext (`http://54.253.40.174:8000`) locally; prod uses HTTPS via nginx | None functional; flag for mobile dev only | `.env.local` |
| D17 | `analytics` + `studio` supabase containers consume ~390MB RAM on a 3.7GB box | Resource pressure | infra |