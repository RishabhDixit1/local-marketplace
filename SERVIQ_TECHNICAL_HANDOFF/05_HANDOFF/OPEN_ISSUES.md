# Open Issues

**Last updated:** August 2026  
**Source:** Full codebase audit

---

## Critical (Launch-Blocking)

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 1 | **Featured placements empty on live DB** | "Featured providers" section on landing page shows fallback (top providers by sort, not truly featured). Boost/placement system exists but `public.featured_placements` table is empty. | Needs content seeding |
| 2 | **Browse-all auth gate** | Anonymous users tapping "Browse all" or category "View all" land on Sign In. No public full-listing route exists. Product decision needed: keep funnel vs public listing. | Product decision |
| 3 | **Gemini free-tier quota exhausted** | Daily limit 0/day on free tier. AI search degrades to keyword fallback. Paid tier is a founder decision. | Needs paid tier |
| 4 | **Supabase single-EC2 risk** | No horizontal scaling, no HA, no read replicas. Single point of failure. | Architecture change needed |

## High

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 5 | **Realtime websocket 503 on dev endpoint** | Container was never running. Started Aug 14, verified 101 upgrade. However, the raw dev endpoint `http://54.253.40.174:8000/realtime/v1/websocket` may still return 503 if Kong is not properly routing. Production path via `www.serviqapp.com` works. | Fixed (partially) |
| 6 | **Crashlytics upload unverified** | Crashlytics is `!kDebugMode` — cannot be demonstrated in debug builds. Needs `ENABLE_TEST_CRASH=true` signed build + signed-in test account to verify upload works. | Unverified |
| 7 | **Sentry DSN needs manual check** | Sentry DSN is configured but actual Sentry project/dashboard setup was not verifiable from code alone. Needs manual Vercel dashboard check. | Manual check needed |
| 8 | **No automated Crashlytics test-crash button** | No way to trigger a test crash from the app to verify Crashlytics is working end-to-end. Recommended: add a hidden debug action. | Missing feature |
| 9 | **No admin dashboard UI** | All admin tasks (user management, order review, analytics) require direct database queries. No web UI exists. | Not started |
| 10 | **No analytics warehouse** | Events scattered across Firebase, Vercel, and Supabase tables. No centralized store for cross-domain analysis, funnels, or cohort analysis. | Not started |

## Medium

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 11 | **NSPhotoLibraryUsageDescription may be needed for older iOS** | Currently missing from Info.plist. Fine for image_picker PHPicker on iOS 14+, but would be needed if targeting older iOS. | Low risk |
| 12 | **Dual listing system** | Legacy (`service_listings`, `product_catalog`) and V2 (`services`, `products`) both exist. Code references both. Migration incomplete. | Tech debt |
| 13 | **No automated E2E test suite** | 10+ Playwright specs exist but not comprehensive. No Flutter integration tests. | Gap |
| 14 | **Email templates incomplete** | Only partial email templates. Most notifications are push/SMS only. | Partial |
| 15 | **WhatsApp not implemented** | Schema exists (`whatsapp_notifications`) but no WhatsApp Business API integration. | Not started |
| 16 | **Live Talk disabled** | WebRTC Live Talk feature exists in codebase but is compile-time off. Camera/mic permissions still requested. | Intentional |
| 17 | **English-only AI responses** | Gemini prompts and responses are English-only. Hindi/multilingual AI not implemented. | Not started |
| 18 | **No horizontal scaling** | Single EC2 instance. No load balancer, no auto-scaling, no read replicas. | Not started |

## Low

| # | Issue | Impact | Status |
|---|-------|--------|--------|
| 19 | **KYC review workflow missing** | Verification documents can be uploaded but no admin review UI exists. Documents are stored but not reviewed programmatically. | Not started |
| 20 | **No RTL support** | App is LTR only. No RTL layout support for future markets. | Future |
| 21 | **Partial offline support** | Offline banner exists, fail-fast on network calls, but no offline-first data caching or sync. | Partial |
| 22 | **No A/B testing framework** | Cannot experiment on UI changes or measure impact. | Future |
| 23 | **Daily backups unverified** | GitHub Actions workflow exists (`backup-db.yml`) but execution history was not checked. Assumes working. | Verify |

---

## Recently Resolved

| Issue | Resolved | How |
|-------|----------|-----|
| Supabase HTTPS endpoint | Aug 14, 2026 | Pointed `SUPABASE_URL` to `https://www.serviqapp.com` (nginx proxies to Kong) |
| Realtime container not running | Aug 14, 2026 | `docker-compose up -d realtime` on EC2 |
| AI search bug (`.cs.{}` on text[]) | Earlier | Changed to `.ilike` for services column |
| Brand icons (default Flutter logo) | Aug 2026 | Regenerated all 23 assets from brand SVG |
| Onboarding sheet persistence | Aug 2026 | `consumeStoredHandoff()` clears route after landing redirect |
