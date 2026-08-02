# ServiQ Engineering Audit

> **Date:** 2026-07-31
> **Scope:** Full-stack audit: Flutter mobile, Next.js web, Supabase backend
> **Owner:** Engineering

---

## 1. Executive Summary

ServiQ is a hyperlocal services marketplace (akin to Urban Company) targeting Delhi NCR. The codebase spans three major surfaces — a Flutter 3.41 mobile app, a Next.js 16 (App Router) web app, and a Supabase-powered backend — with a shared PostgreSQL database, Row-Level Security, and real-time capabilities.

The architecture follows modern best practices where explicitly adopted: feature-first clean architecture on mobile, App Router with route handlers on web, and well-structured Supabase migrations with RLS. However, the codebase exhibits significant maturity gaps typical of a rapidly shipped product: near-zero test coverage on mobile, fragmented design system ownership, missing observability on critical AI paths, and accumulating dead code from abandoned features.

**Key metrics:**
- Mobile: ~190+ files across 40 feature modules
- Web: 42+ page routes, 97+ API endpoints
- Database: 63 sequential migrations, RLS on all tables, ~20 real-time publication tables
- Testing: 0% meaningful coverage on Flutter; partial Vitest coverage on web
- Dead features identified: AI Launchpad, Quote Room, Deal Room, Lead OS

**Top recommendations:**
1. Establish mandatory test coverage thresholds (unit + widget for Flutter, expanded Vitest for web)
2. Consolidate design system ownership — web needs parity with Flutter's component library
3. Add observability to AI pipeline (prompt logging, token tracking, cost monitoring)
4. Remove or archive dead feature code
5. Implement API contract testing between mobile and web
6. Enable TypeScript strict mode across the entire web codebase

---

## 2. Flutter Architecture Analysis

### 2.1 Structure

Feature-first clean architecture with three layers per module:

```
lib/
├── core/                          # Cross-cutting: design system, network, auth, cache
│   ├── design_system/             # design_tokens.dart, app_theme.dart, 7 components
│   ├── shared/                    # 19 shared components
│   └── widgets/                   # 8 shared widgets
├── features/                      # 40 feature modules
│   └── <feature>/
│       ├── data/                  # Repositories, DTOs, data sources
│       ├── domain/                # Models (freezed), providers (Riverpod)
│       └── presentation/          # Pages, widgets, notifiers
└── main.dart
```

### 2.2 State Management — Riverpod 3.x

Providers are the primary unit of state and dependency injection. The codebase uses `flutter_riverpod` with `freezed` for immutable model classes. Patterns observed:

| Pattern | Usage |
|---|---|
| `StateNotifierProvider` | Form state, complex async flows |
| `FutureProvider` / `AsyncNotifierProvider` | API-driven data with loading/error states |
| `StreamProvider` | Realtime subscriptions |
| `Provider` | Pure dependencies (repositories, services) |

### 2.3 Navigation — go_router 17.x

Declarative routing with `post_auth_route_resolver` for redirect logic. Route configuration includes guard clauses for authentication state. No deep-link handling audit was performed.

### 2.4 Design System

Tokens are defined as **static `const`** values in `design_tokens.dart` — no runtime toggling or remote configuration. Seven design system components and 19 shared components provide reasonable surface coverage, but the system is Flutter-only; the web app has no equivalent unified component library.

### 2.5 Key Services

| Service | File | Role |
|---|---|---|
| API Client | `mobile_api_client.dart` / `mobile_api_provider.dart` | HTTP transport |
| Auth | `auth_state_controller.dart` / `mobile_auth_service.dart` | Session management |
| Connectivity | `connectivity_service.dart` | Offline detection |
| Offline Queue | `offline_queue.dart` / `offline_sync_manager.dart` | Request queuing + replay |
| Cache | `cache_manager.dart` / `feed_cache.dart` / `people_cache.dart` | Local caching |
| Realtime | `mobile_live_hub.dart` | Supabase Realtime channels |
| Rate Limiter | `rate_limiter.dart` | Per-user rate limiting |
| Error Mapping | `app_error_mapper.dart` / `app_exception.dart` | Error classification |
| Firebase | `app_firebase.dart` / `mobile_push_notifications.dart` | Push + perf monitoring |
| Localization | 6 language files (en, hi, bn, mr, ta, te) | i18n |

### 2.6 Offline Architecture

The offline strategy uses `connectivity_plus` to gate network calls, an `offline_queue` to enqueue mutations during disconnection, and `offline_sync_manager` to replay them on reconnection. This is sound for optimistic UI patterns, but there is no conflict resolution strategy documented for when queued mutations conflict with server state.

### 2.7 Dead Code / Abandoned Features

Multiple feature modules exist with no active entry points or UI references:
- **AI Launchpad** — provider launchpad with AI-assisted setup (never completed)
- **Quote Room** — real-time quote negotiation interface
- **Deal Room** — deal management workspace
- **Lead OS** — lead management operating system

These contribute to codebase bloat and cognitive load during navigation/import resolution.

---

## 3. Next.js Architecture Analysis

### 3.1 Structure

Next.js 16 App Router with route groups for organization:

```
app/
├── (marketing)/                   # Public pages
├── (dashboard)/                   # Authenticated user pages
├── (provider)/                    # Provider-specific flows
├── api/                           # 97+ route handlers
└── layout.tsx                     # Root layout with providers
```

### 3.2 Routing & Data Fetching

- **42+ page routes** using App Router file conventions
- **97+ API endpoints** using Route Handlers (`route.ts`)
- Server data access via `supabaseServer.ts` / `supabaseClients.ts` (server client factory)
- Client data fetching via `clientApi.ts` (`fetchAuthedJson` wrapper)
- No React Query, SWR, or TanStack Query — data fetching is manual with `useEffect` + `fetchAuthedJson`
- No shared API client SDK between web and mobile

### 3.3 Authentication

Magic link via Supabase Auth, Google OAuth, and a custom auth server path. Middleware protects authenticated routes. No session token rotation strategy beyond Supabase defaults.

### 3.4 State Management

React Context + hooks — no global state library. This works for the app's complexity level but has led to prop-drilling in some deep page trees. Forms use `react-hook-form`.

### 3.5 Design System (Web)

**Ad-hoc.** Web components use Tailwind 4 utility classes with CSS variables for theming, but there is no unified component library equivalent to Flutter's `AppTextField`, `ServiqScaffold`, `ServiqTopBar`, etc. This creates inconsistency — similar UI patterns are reimplemented per page.

### 3.6 Build Configuration

`next.config.ts` includes:
- Image optimization (Squoosh/sharp)
- Package imports optimization (`lucide-react`, `@supabase/supabase-js`, `framer-motion`)
- Standalone output for Docker deployment
- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Service worker: `public/sw.js`
- PWA manifest: `public/manifest.json`

### 3.7 Observability

Custom instrumentation, Sentry error tracking, and Vercel Analytics for web vitals. No custom business metrics or dashboard-level monitoring.

---

## 4. Backend / Database Architecture Analysis

### 4.1 Migrations

63 sequential migration files covering schema creation, RLS policies, functions, triggers, and seed data. Migrations are well-structured but several RLS policies are duplicated across 3+ migrations — indicating policy drift and potential for inconsistent enforcement.

### 4.2 Row-Level Security

RLS is enabled on all tables with user-isolation patterns. This is the primary authorization mechanism. However:
- Complex policies are duplicated across migration files
- No automated RLS test suite exists to validate policy correctness
- Migration re-runs would fail due to duplicate policy creation

### 4.3 Real-time

The `supabase_realtime` publication tracks ~20 tables for live updates. The Flutter client (`mobile_live_hub.dart`) connects with exponential backoff (5s–60s, 20 retries).

### 4.4 RPC Functions

| Function | Purpose |
|---|---|
| Haversine distance matching | Geo-spatial service discovery |
| Help request acceptance | Accept service requests |
| Presence management | Online/offline tracking |
| Promo code validation | Coupon/promotion logic |
| Profile metrics calculation | Rating, completion, etc. |

### 4.5 Triggers

| Trigger | Behavior |
|---|---|
| `updated_at` auto-update | All tables with timestamps |
| Profile field normalization | Consistent formatting |
| Notification fan-out | Create notifications on relevant events |

### 4.6 Background Jobs

The `background_jobs` table uses a conditional claim pattern with exponential backoff — preventing double-processing. This is implemented correctly (SELECT ... FOR UPDATE SKIP LOCKED style claim + backoff column).

### 4.7 Rate Limiting

Per-user rate limiting via `rate_limits` table using atomic upsert to prevent race conditions. Applied to AI endpoints and auth endpoints.

### 4.8 Full-Text Search

GIN-indexed full-text search on `service_listings`. No tuning analysis performed — default PostgreSQL text search configuration.

---

## 5. State Management Patterns

| Surface | Pattern | Strengths | Weaknesses |
|---|---|---|---|
| Flutter | Riverpod 3.x + freezed | Immutable state, compile-time safety, testable providers | No provider-level metrics, some over-fetching |
| Web | React Context + hooks | Simple, no dependencies | Manual fetch logic, prop-drilling, no cache layer |
| Backend | Supabase + RLS | Declarative auth, real-time built-in | Policy duplication, no automated policy tests |

**Gap:** No shared state synchronization between web and mobile — each maintains its own cache. A user switching surfaces mid-session will see different local state.

---

## 6. Data Flow Diagrams

### 6.1 Web Data Flow

```
Client Browser
    │
    ├── Page Load → Next.js Server (RSC) → supabaseServer.ts → Supabase (authenticated user)
    │                                            │
    └── Client Action → fetchAuthedJson() → /api/<route> → Route Handler → Supabase (service role key for admin)
                                                                                  │
                                                                                  └── RLS enforced at row level
```

### 6.2 Mobile Data Flow

```
Flutter App
    │
    ├── Online → Feature Provider (Riverpod) → Repository → Supabase SDK (direct) OR Next.js API (HTTP)
    │                                                                                           │
    ├── Offline → Fallback to cache_manager.dart / offline_queue.dart (enqueue for later replay)
    │                                                                                           │
    └── Realtime → mobile_live_hub.dart → Supabase Realtime channel (with backoff reconnect)
```

### 6.3 Payment Flow

```
Client → /api/payment/verify → HMAC timing-safe comparison → Razorpay verification
    → Order status update → Double-refund idempotency guard (atomic check before refund)
```

---

## 7. Performance Analysis

### 7.1 Web

| Measure | Status |
|---|---|
| Image optimization | Enabled (next.config.ts) |
| Package imports | Optimized (lucide-react, supabase-js, framer-motion) |
| CSP headers | Configured |
| Compression | Enabled |
| React 19 concurrent features | Available (not audited for usage) |
| Font loading | Not audited |
| CLS / LCP / INP | Not measured (Vercel Analytics available) |
| Bundle size monitoring | Not configured |
| CDN for static assets | **None** — images served from Supabase storage directly |

### 7.2 Mobile

| Measure | Status |
|---|---|
| Image caching | `CachedNetworkImage` for avatars |
| Performance monitoring | `firebase_performance` |
| Shimmer/loading states | Present in feed and detail screens |
| Code splitting | Flutter's deferred imports — not audited |
| Widget rebuild minimization | Not audited |
| Memory profiling | Not available |

### 7.3 Database

| Measure | Status |
|---|---|
| Indexes | Present on lat/lng, FTS, foreign keys |
| Query analysis | Not performed |
| Connection pooling | Supabase managed (PgBouncer) |
| Slow query monitoring | Not configured |
| Migration testing | None |

### 7.4 Load Testing

A k6 script exists in the repository but no results are documented. No load test baselines or performance budgets are defined.

---

## 8. Security Analysis

### 8.1 Implemented

| Control | Location |
|---|---|
| CSP headers | `next.config.ts` |
| HSTS preload | `next.config.ts` |
| Rate limiting (per-user) | AI + auth endpoints (`rateLimiter.ts`) |
| RLS on all tables | Every migration |
| HMAC timing-safe payment verification | `api/payment/verify/route.ts` |
| Double-refund idempotency | `api/orders/[id]/route.ts` |
| File upload validation | `fileValidation.ts` |
| Block/unblock user | User management tables |
| Content moderation (AI prompts) | Prompt validation middleware |
| Suspension system | `user_suspension` migration |
| No secrets in codebase | Confirmed (env-based) |

### 8.2 Gaps

| Gap | Severity | Notes |
|---|---|---|
| No automated RLS policy tests | Medium | Policy drift detected across migrations |
| No API rate limit monitoring | Medium | Limits exist but no alerting on bursts |
| No audit log for admin actions | Medium | Admin operations are not tracked |
| No brute-force protection on auth | Low | Rate limiting exists but no account lockout |
| No API versioning | Low | No version prefix in `/api/*` routes |
| No secret rotation policy | Low | Env-based secrets with no rotation cadence |

---

## 9. Testing Coverage Analysis

### 9.1 Flutter

| Type | Coverage | Status |
|---|---|---|
| Unit tests | ~0% | No meaningful tests exist |
| Widget tests | ~0% | None beyond generated boilerplate |
| Integration tests | ~0% | `integration_test/` directory exists but empty |
| Patrol tests | ~0% | Patrol dependency declared, no tests written |
| mocktail | Declared | No usage found |

**Verdict:** The Flutter codebase has effectively zero test coverage. This is the highest-priority risk.

### 9.2 Web

| Type | Coverage | Status |
|---|---|---|
| Unit tests (Vitest) | Partial | Some route handler tests exist |
| E2E smoke tests | Partial | Basic smoke tests present |
| Component tests | None | No component-level testing |

### 9.3 Backend

| Type | Coverage | Status |
|---|---|---|
| RLS policy tests | None | No automated policy validation |
| Migration tests | None | No rollback or dry-run testing |
| RPC function tests | None | No inline SQL tests |

### 9.4 Cross-Cutting

| Gap | Impact |
|---|---|
| No API contract testing | Web ↔ Mobile API drift undetected |
| No load test results | k6 script exists but no baselines |
| No CI gating on coverage | No minimum coverage thresholds |

---

## 10. Technical Debt Inventory

| # | Item | Category | Effort | Impact |
|---|---|---|---|---|
| 1 | Zero Flutter test coverage | Testing | High | Critical |
| 2 | No TypeScript strict mode (some `any` types) | Code Quality | Medium | High |
| 3 | Dead features: AI Launchpad, Quote Room, Deal Room, Lead OS | Bloat | Low | Medium |
| 4 | RLS policy duplication across migrations | Database | Medium | High |
| 5 | Web has no unified design system components | Architecture | High | Medium |
| 6 | No shared API client between web and mobile | Architecture | High | Medium |
| 7 | Manual data fetching on web (no React Query/SWR) | Architecture | Medium | Medium |
| 8 | Fragmented env config (`.env.example`, `.env.local`, `.env.ec2.example`) | DevOps | Low | Medium |
| 9 | No CDN for static assets | Performance | Medium | Medium |
| 10 | No database migration rollback plan | DevOps | Low | High |
| 11 | No API versioning strategy | Architecture | Low | Medium |
| 12 | Flutter design tokens are static (no remote config) | Architecture | Medium | Low |
| 13 | No staging environment parity | DevOps | High | High |
| 14 | Cache invalidation is basic | Performance | Medium | Medium |
| 15 | No AI observability (prompt logging, token tracking) | Observability | Medium | High |
| 16 | No feature flag UI | DevOps | Medium | Low |
| 17 | No custom business metrics | Observability | Medium | Medium |
| 18 | No service worker caching strategy documented | Performance | Low | Low |
| 19 | Error handling is not fully standardized | Code Quality | Medium | Medium |
| 20 | Web and mobile maintain independent cache state | Architecture | High | Medium |

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Flutter regression undetected (no tests) | High | High | Mandate tests for all new features; set up CI coverage gates |
| RLS policy drift leads to data leak | Low | Critical | Automated RLS test suite; policy-as-code review |
| Offline mutation conflict causes data loss | Medium | High | Document conflict resolution strategy; add server-side conflict detection |
| AI cost overrun (no token tracking) | Medium | High | Add observability; set spend limits |
| Dead code confuses new contributors | High | Low | Archive unused feature directories |
| Failed migration rollback causes downtime | Low | High | Implement down migrations; test rollback in CI |
| CSP bypass via untrusted CDN assets | Low | High | Audit all third-party script sources |
| Staging ≠ Production causes deploy failures | Medium | High | Invest in staging parity; add smoke tests per environment |
| Payment flow regression loses money | Low | Critical | Payment-focused E2E tests; manual regression checklist |

---

## 12. Scalability Assessment

### 12.1 Database

- **Supabase Postgres** with PgBouncer connection pooling scales vertically to ~8GB/2vCPU before read-replica or connection pooling limits become visible.
- Geo-queries on `service_listings` (lat/lng with indexes) will degrade beyond ~1M rows without PostGIS or a dedicated geospatial index strategy.
- The `background_jobs` table with conditional claim pattern is horizontally scalable as written — multiple workers can claim jobs safely.
- RLS policy evaluation cost increases linearly with row counts on policy filter columns.

### 12.2 Web

- Next.js 16 standalone output enables horizontal scaling via Docker/ECS.
- Route handlers are stateless by design (Supabase session from cookie).
- Current architecture will scale to moderate load (~10K concurrent users) before needing caching layers (Redis/CDN).
- No WebSocket/SSE usage beyond standard HTTP.

### 12.3 Mobile

- Offline queue protects against network blips but not sustained offline periods — sync conflicts grow with offline duration.
- Riverpod providers are memory-managed; no provider leak pattern observed.

### 12.4 Known Bottlenecks

1. **Supabase Storage direct serving** — no CDN means all image traffic hits Supabase directly. Add CloudFront or Imgix.
2. **No query cache layer** — every page load hits the database. Add Redis or Supabase's built-in caching.
3. **Monolithic API routes** — `api/` directory has 97+ routes with no separation of concerns. Consider BFF patterns or GraphQL federation for very high scale.

---

## 13. Prioritized Recommendations

### P0 — Must address (next sprint)

1. **Establish testing mandate for Flutter.** Add minimum unit test coverage gate (60%) in CI. Write smoke widget tests for the 10 most critical screens (feed, chat, orders, profile, checkout, onboarding, search, listing detail, subscriptions, settings). Use mocktail for repository-level tests.

2. **Add AI observability.** Implement prompt logging, token counting, and cost tracking for all AI requests. Send metrics to CloudWatch or a dedicated `ai_metrics` table. Set spend alerts.

3. **Remove or archive dead features.** Delete or move (to `archive/`) AI Launchpad, Quote Room, Deal Room, and Lead OS modules from both Flutter and Next.js.

### P1 — Address this quarter

4. **Consolidate RLS policies.** Deduplicate policies spanning 3+ migrations into a single `018_rls_consolidation` migration. Add inline comments documenting intent. Validate with an automated test that queries each table as each role.

5. **Build web design system parity.** Port Flutter's `AppTextField`, `ServiqScaffold`, `ServiqTopBar`, `AppPill`, `AppSpacing`, `AppRadii` patterns to a shared web component library using Tailwind + React components.

6. **Add API contract tests.** Use a tool like Zod or TypeBox to define API response shapes shared between web and mobile. Add a CI step that validates API responses against these schemas.

7. **Implement database migration rollback.** Write `DOWN` migration counterpart for each migration. Add a CI step that runs `supabase db reset` and validates migration replay against staging.

### P2 — Address this half

8. **Add CDN for static assets.** Configure CloudFront or similar CDN in front of Supabase Storage. Update image URLs to point to CDN domain.

9. **Move Flutter design tokens to remote config.** Allow runtime token overrides via Supabase or a config service for theming flexibility.

10. **Add feature flag management UI.** Build an admin page to toggle feature flags stored in the database, replacing direct SQL edits.

11. **TypeScript strict mode sweep.** Remove all `any` types. Enable `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` project-wide.

12. **Add staging environment.** Duplicate production infrastructure (Supabase project, Vercel deployment, env config). Add smoke tests that run against staging on every PR.

13. **Implement business-level monitoring.** Add custom metrics for: orders created, quotes sent, messages sent, search-to-booking conversion, provider activation rate. Dashboard in CloudWatch or Grafana.

### P3 — Nice to have

14. **Replace manual data fetching with React Query** on web. Enables caching, deduplication, background refetch, and optimistic updates.

15. **API versioning.** Prefix routes with `/api/v1/`. Maintain backward compatibility for at least one version.

16. **Load test baseline.** Run k6 script, document results, set performance budgets (e.g., P95 API response < 500ms).

17. **Service worker caching strategy.** Document and implement cache-first for static assets, network-first for API routes.

18. **Cross-surface session state.** Investigate local storage / BroadcastChannel to sync auth state and basic cache across web and mobile.

---

## Appendix A: File Counts by Surface

| Surface | Routes | API Endpoints | Files (approx) |
|---|---|---|---|
| Flutter | 40+ | — | 190+ |
| Next.js | 42+ | 97+ | ~150 |
| Supabase | — | 63 migrations, ~20 RPCs, ~15 triggers | ~80 |

## Appendix B: Key Dependencies

### Flutter
- `flutter_riverpod` — state management
- `go_router` — navigation
- `freezed` — immutable models
- `supabase_flutter` — backend client
- `firebase_performance`, `firebase_messaging` — monitoring + push
- `connectivity_plus` — offline detection
- `cached_network_image` — image caching
- `mocktail` — testing (unused)

### Web
- `next` 16 — framework
- `react` 19 — UI
- `@supabase/supabase-js` — backend client
- `react-hook-form` — form management
- `framer-motion` — animation
- `maplibre-gl` — maps
- `tailwindcss` 4 — styling
- `vitest` — testing (partial coverage)

## Appendix C: Migration Health

| Metric | Value |
|---|---|
| Total migrations | 63 |
| RLS policy duplication instances | 5+ tables with policies in ≥3 migrations |
| Tables without RLS | 0 |
| Triggers | ~15 |
| RPC functions | ~20 |
| Background job tables | 1 (`background_jobs`) |
| Rate limit tables | 1 (`rate_limits`) |
