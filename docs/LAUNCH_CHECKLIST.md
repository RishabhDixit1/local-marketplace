# ServiQ Launch Checklist (Beta: 5 September 2026)

> Companion to `docs/LAUNCH_BLUEPRINT.md` (Aug–Sep 2026 master plan). Anchor date: **5 September 2026**.
> This checklist tracks concrete readiness items with status, owner, and evidence. Updated Aug 14, 2026.
>
> **Status legend:** ✅ Done & verified &nbsp;|&nbsp; 🟡 In progress / partial &nbsp;|&nbsp; 🔲 Not started &nbsp;|&nbsp; ⚠️ Needs decision / risk
> **Owner legend:** [Eng] Engineering &nbsp;|&nbsp; [Founder] Founder / business &nbsp;|&nbsp; [Ops] Operations
>
> Every [Founder]/[Ops] item is a **launch-blocking decision or deliverable due by 5 Sep** unless marked otherwise.
> Updated Aug 7, 2026: public browse route shipped (3.1); featured = verified-first shipped (3.2); Firebase init wiring fixed + test-crash button added (1.7, 6.1, 11.1).
> Updated Aug 9, 2026: release-build verification prep (1.7/1.8/6.1/11.1) - prod-mode signed APK builds with full dart-defines; prod config now throws on missing Firebase keys; **new blocker found: Supabase HTTPS endpoint not provisioned (3.8)**.
> Updated Aug 9, 2026 (on-device Firebase verification, 1.7/1.8/6.1): debug APK on emulator-5554 confirms Firebase init, `app_open_mobile` (firebase_ready=true), and FCM token retrieval. **Race fixed**: first `screen=home_welcome` event fired before Firebase init and was dropped - now awaits `appFirebaseProvider.future`; `app_open_mobile` timeout raised 10s->30s (cold start after install exceeded 10s, falsely reporting firebase_ready=false). **New finding**: Supabase Realtime websocket returns 503 on dev endpoint `http://54.253.40.174:8000/realtime/v1/websocket` (app retries with correct backoff; underlying issue part of 3.8).
> Updated Aug 14, 2026: **Supabase HTTPS endpoint live (3.8) + Realtime 503 fixed**. Production mobile builds now reach Supabase over HTTPS: release APK built with `SUPABASE_URL=https://www.serviqapp.com` (EC2 nginx already terminates TLS for `www.serviqapp.com` and proxies `/auth/v1` `/rest/v1` `/storage/v1` `/realtime/v1` -> Kong:8000 with websocket upgrade). Supabase bootstrap verified on emulator-5554; realtime websocket upgrades **101** (was 503). Root cause of the 503: the `supabase-realtime` container was never running - started via `docker-compose up -d realtime`. Subdomain split (`supabase.serviqapp.com`) kept optional (Route 53 A records + certbot) - see `docs/SUPABASE_HTTPS_RUNBOOK.md`.
> Updated Aug 9, 2026 (QA + monitoring, 3.4/3.7/6.1): **local API QA (#8)**: AI prompt works end-to-end vs live data; **fixed** `/api/ai/prompt/stream` using bare `@ai-sdk/google` provider (read `GOOGLE_GENERATIVE_AI_API_KEY`, never set) -> web AI chat never streamed Gemini (now uses keyed `getModel`). **New**: Gemini free-tier daily quota exhausted (`RESOURCE_EXHAUSTED`, limit 0) - mobile AI + web AI degrade to keyword fallback; paid tier is a [Founder] decision (FOUNDER_ACTION_LIST.md). **Monitoring (#9)**: added `uptime-check.yml` (15-min, issue-on-failure) + `backup-verify.yml` (daily 02:30 freshness) + `docs/DB_OPERATIONS.md` (RPO 24h, RTO 2h, restore drill gate). **Founder list (#10)**: `docs/FOUNDER_ACTION_LIST.md` created.

---

## 1. Product

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 1.1 | Android app buildable & installable (debug) | ✅ | [Eng] | `app-debug.apk` installed on emulator-5554 (API 37), launches cleanly |
| 1.2 | Android app icon = ServiQ brand (not Flutter default) | ✅ | [Eng] | APK mipmap bytes match regenerated source (md5 equal); ~98% opaque, rounded corners; Android 12+ splash shows brand icon |
| 1.3 | iOS app icon = ServiQ brand | ✅ | [Eng] | All 15 AppIcon slots regenerated from `public/serviq-icon.svg`; 1024px slot 100% opaque (App Store requirement); LaunchImage @1x/2x/3x present |
| 1.4 | Explore Markets "Featured providers" section capped + "Browse all" navigates | ✅ | [Eng] | Landing preview capped to 3 cards (matches Live Now count), category grid 8, zones 3; "Browse all" opens public `/browse` (no sign-in) auto-loading the featured listing. Verified: 3 cards then CTA; featured sort is API-side (`sortBy=featured`) and now = verified first |
| 1.5 | Offline behavior (no hang / no crash) | ✅ | [Eng] | Airplane-mode verified: cold start renders + logs "Update check failed: You appear to be offline"; AI query shows graceful error sheet with Retry; connectivity recovery confirmed |
| 1.6 | Crash handling — no blank screens | ✅ | [Eng] | `FlutterError.onError` + `runZonedGuarded` → `AppFirebase.recordError` (safe no-op when Firebase absent); 8s bootstrap timeout → retry UI; clean relaunch after hard kill |
| 1.7 | Crashlytics wired for production | 🟡 | [Eng] | **Firebase init wiring bug fixed** (appFirebaseProvider now a FutureProvider over memoized init). **Release-build verification prep done Aug 9**: prod-mode signed APK (`mobile/release/apk/serviq-mobile-1.0.0-20260809-release-verify-prod.apk`) builds with full dart-defines; `AppConfig._requireProductionFirebaseConfig` now throws at startup if Firebase keys are missing in a prod build (was silent). **On-device Aug 9**: debug build initializes Firebase + registers Crashlytics 20.0.6. Remaining: on-device Crashlytics **upload** via test-crash button (`ENABLE_TEST_CRASH=true`, signed build, signed-in) |
| 1.8 | Analytics (mobile) | 🟡 | [Eng] | Firebase Analytics wired; `app_open_mobile` awaits the real `appFirebaseProvider.future` (logs genuine `firebase_ready`, not a hardcoded false). **Verified on-device Aug 9** (debug, emulator-5554): `app_open_mobile` + `screen=home_welcome` fire; first screen event previously dropped on cold start (fired pre-init) - now awaits `appFirebaseProvider.future` (welcome_page.dart); `app_open_mobile` init timeout raised 10s->30s (first cold start after install exceeded 10s -> false `firebase_ready:false`). Release-build verification pending |
| 1.9 | Web stable | ✅ | [Eng] | Live at https://www.serviqapp.com (Vercel, `vercel.json`); Playwright + Vitest suites; Sentry SDK 10.x configured (client/edge/server) |
| 1.10 | Web Sentry DSN confirmed in prod env | ⚠️ | [Eng] | Aug 9: could not confirm from repo/local — `.env.local`, `.env.staging.example` (placeholder `your-sentry-dsn`), and `.env.ec2.example` (empty) all lack a real DSN and there's no Vercel CLI/token locally. **Manual step**: check the Vercel project env (`vercel env ls production` or dashboard) for a real `SENTRY_DSN` |
| 1.11 | ETA on provider quick-response | 🔲 | [Eng] | Known gap from pilot audit (no schema/API/mobile support) — logged to PRODUCT_BIBLE Roadmap, not built |

## 2. Compliance

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 2.1 | Privacy Policy page live | ✅ | [Founder] | `app/privacy` — legal copy review by 5 Sep |
| 2.2 | Terms of Service page live | ✅ | [Founder] | `app/terms` — legal copy review by 5 Sep |
| 2.3 | Refund Policy page live | ✅ | [Founder] | `app/legal/refund-policy` — must reflect Razorpay refund flows (double-refund guard + HMAC verify in place) |
| 2.4 | Cookie Policy page live | ✅ | [Founder] | `app/legal/cookie-policy` |
| 2.5 | GST registration & invoicing | 🔲 | [Founder] | Invoices feature exists in app; GST setup + tax invoice flow due 5 Sep |
| 2.6 | Telecom DLT (SMS/WhatsApp templates) | 🔲 | [Founder] | Required for transactional/OTP/promo messaging. Due 5 Sep |
| 2.7 | Trademark planning | 🔲 | [Founder] | ServiQ name/mark. Due 5 Sep |

## 3. Infrastructure

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 3.1 | Public browse funnel | ✅ | [Eng] | **Decision made + implemented**: public `/browse` route added (fresh-search state via `?browse=0`, browse-all via `?browse=1`); landing search icon + AI prompt results + Browse All all target it for anonymous users. Listings are public preview; booking/contact still sign-in gated |
| 3.2 | Featured placements definition | 🟡 | [Founder] | **"Featured" now defined as verified-first** in `providers-by-category/route.ts` (sort order + `featured`/badge gated on verified; removed the empty `featured_placements` lookup). Paid-boost/placement seeding is still an open [Founder] decision + seed. Due 5 Sep |
| 3.3 | Supabase (Postgres/RLS/Realtime) | ✅ | [Eng] | Live at `54.253.40.174:8000`; RLS + realtime; versioned migrations in `supabase/migrations/`; `services` text[] handled via `.ilike`. **Resolved Aug 14**: the Aug 9 Realtime **503** was a down `supabase-realtime` container (never started) - started via `docker-compose up -d realtime`, now healthy, websocket upgrades **101** over `https://www.serviqapp.com/realtime/v1/websocket` |
| 3.4 | Database backups | 🟡 | [Ops] | `scripts/backup-db.sh` (daily 02:00 UTC via workflow) + `restore-db.sh`; **backup-verify.yml added Aug 9** (02:30 freshness check, fails if >27h or <1MB); `docs/DB_OPERATIONS.md` (RPO 24h / RTO 2h). Restore drill still due 5 Sep |
| 3.5 | Domain + HTTPS | ✅ | [Ops] | serviqapp.com live; `Caddyfile` for TLS (EC2) + Vercel for web |
| 3.6 | Production deploy automation | ✅ | [Eng] | `scripts/deploy-docker.sh`, `Dockerfile`, `docker-compose.yml`; web via Vercel |
| 3.7 | Monitoring / uptime alerts | 🟡 | [Ops] | Sentry (web) + app logging; **uptime-check.yml added Aug 9** (15-min checks of web/api-health/Kong, opens labeled `uptime` issue on failure, auto-closes on recovery); `backup-verify.yml` guards DB backups. Supabase still checked over HTTP until 3.8 is done |
| 3.8 | Supabase HTTPS endpoint for mobile | ✅ | [Ops] | **Aug 14 done + verified**: production mobile builds now reach Supabase over HTTPS. Release APK `mobile/release/apk/serviq-mobile-1.0.0-20260814-release-verify-https.apk` built with `SUPABASE_URL=https://www.serviqapp.com` (EC2 nginx already terminates TLS for `www.serviqapp.com` and proxies `/auth/v1` `/rest/v1` `/storage/v1` `/realtime/v1` -> Kong:8000, realtime with websocket upgrade). Verified: Supabase bootstrap completes on emulator-5554 (release APK), Kong REST returns 401 (service alive), realtime websocket upgrades **101**. Cleartext `http://54.253.40.174:8000` no longer baked into the APK. **Realtime 503 root-caused + fixed**: `supabase-realtime` container was never running - started via `docker-compose up -d realtime` (`/home/ec2-user/supabase`). Optional subdomain split (`supabase.serviqapp.com`/`realtime.serviqapp.com`) deferred - needs Route 53 A records + certbot (see `docs/SUPABASE_HTTPS_RUNBOOK.md`). Signed-in FCM + realtime subscription on-device verification is part of the Aug 14 release-verify APK pass (item 3 below). |

## 4. Payments

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 4.1 | Razorpay integration (web + mobile) | ✅ | [Eng] | `razorpay` (web) + `razorpay_flutter`; order lifecycle + refunds implemented |
| 4.2 | Payment security guards | ✅ | [Eng] | HMAC timing-safe verification; double-refund idempotency guard; atomic rate-limit upsert |
| 4.3 | Razorpay live onboarding | 🔲 | [Founder] | Live keys + KYC. Due 5 Sep |
| 4.4 | Webhook testing + settlement reconciliation | 🟡 | [Ops] | Implementation present; end-to-end test with live keys by 5 Sep |

## 5. Identity & Trust

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 5.1 | Trust score = real job completion | ✅ | [Eng] | Migration `20260803000000` deployed; `refresh_profile_marketplace_metrics` uses completed÷accepted; `trg_orders_sync_metrics` refreshes on order status change |
| 5.2 | Routing uses live trust | ✅ | [Eng] | `lib/ai/intentMatching.ts` batch-fetches order stats via RPC; `loadTrustScores` feeds job completion + repeat |
| 5.3 | Admin tooling & security | ✅ | [Eng] | `app/dashboard/admin` + `app/api/admin/*` all auth + rate-limited; verifications, disputes, listings, feature-flags, batch-payouts endpoints |
| 5.4 | KYC API integration | 🔲 | [Founder] | Vendor/provider KYC. Due 5 Sep |
| 5.5 | Moderation / fraud playbook | 🟡 | [Ops] | Admin dispute/verification flows exist; escalation SOP due 5 Sep |

## 6. Communication

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 6.1 | Push notifications | 🟡 | [Eng] | FCM wired (`firebase_messaging`); channels `serviq_messages`/`reviews`/`orders`/`connections`; `POST_NOTIFICATIONS` granted on-device. Push service reads the real `appFirebaseProvider` state (was permanently `disabled`), so `start()` fires once init completes. **FCM token verified on-device Aug 9** (debug, emulator-5554: `ServiQ: FCM token=...`). Remaining: signed-in FCM delivery verification on release build |
| 6.2 | OTP cooldown (60s) web + mobile | ✅ | [Eng] | Implemented on both platforms |
| 6.3 | Email templates | 🔲 | [Founder] | Transactional + marketing. Due 5 Sep |
| 6.4 | SMS / WhatsApp templates + DLT | 🔲 | [Founder] | See 2.6. Due 5 Sep |

## 7. Marketing

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 7.1 | Landing page | ✅ | [Eng] | Live; Explore Markets + Discovery localized (en/hi/bn/mr/ta/te) |
| 7.2 | Referral program | ✅ | [Eng] | `app/referral` (web) + `mobile/lib/features/referrals`; leaderboard |
| 7.3 | Social media + launch campaign | 🔲 | [Founder] | Due 5 Sep |
| 7.4 | App store listings (Play Console + App Store Connect) | 🔲 | [Founder] | Screenshots, descriptions, privacy nutrition labels. Due 5 Sep |

## 8. Operations

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 8.1 | Vendor onboarding SOP | 🔲 | [Ops] | Due 5 Sep |
| 8.2 | Customer support SOP | 🔲 | [Ops] | Due 5 Sep |
| 8.3 | Escalation matrix | 🔲 | [Ops] | Due 5 Sep |
| 8.4 | Pilot vendors onboarded (pilot scope) | 🔲 | [Founder] | Per PRODUCT_BIBLE Phase Boundary (pilot vs roadmap) |

## 9. Finance

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 9.1 | Grant utilization plan | 🔲 | [Founder] | Due 5 Sep |
| 9.2 | Monthly budget + burn | 🔲 | [Founder] | Due 5 Sep |
| 9.3 | Accounting (settlements, payouts) | 🟡 | [Founder] | Payouts UI + batch-payouts API exist; ledger/finance process due 5 Sep |

## 10. KPIs

| # | Item | Status | Owner | Evidence / Notes |
|---|------|--------|-------|------------------|
| 10.1 | Analytics dashboards | 🟡 | [Eng] | Mobile analytics page + transactions exist; Firebase Analytics release-build pending |
| 10.2 | KPI targets (users/vendors/orders/activation/retention/NPS) | 🔲 | [Founder] | Define launch KPIs. Due 5 Sep |

## 11. Risks & Mitigations

| # | Risk | Status | Owner | Mitigation / Notes |
|---|------|--------|-------|------------------|
| 11.1 | Firebase init fails in debug builds | 🟡 | [Eng] | Wiring bug fixed (1.7): `appFirebaseProvider` is now a `FutureProvider` over a memoized init using merged config. **Test-crash button added** — `_TestCrashCard` on Profile hub, gated by `enableTestCrashButton` (always in debug, release only with `--dart-define=ENABLE_TEST_CRASH=true`, never in prod). Verify report upload on first release build |
| 11.2 | iOS photo-library string missing | ✅ | [Eng] | Aug 9: `NSPhotoLibraryUsageDescription` added to `Info.plist` ("attach photos to requests, services, and chat messages") — covers older iOS + direct photo access |
| 11.3 | Android <12 splash is plain white | ✅ | [Eng] | Aug 9: both `launch_background.xml` files now use `@color/brand_dark` (#0F172A) with the centered brand icon (`@mipmap/ic_launcher`); `values/colors.xml` added. Android 12+ auto-shows brand icon |
| 11.4 | "Featured" label mismatch | 🟡 | [Founder] | Badge now only renders for **verified** providers (`featured == verified`); empty `featured_placements` no longer mislabels the list. Seeding paid placements is a separate [Founder] decision (see 3.2) |
| 11.5 | No offline banner on public landing | ✅ | [Eng] | Aug 9: `OfflineBanner` added to `MarketplaceLandingPage` (public `/`) inside `SafeArea`, same Column pattern as AppShell |
| 11.6 | Web Sentry DSN placeholder risk | ⚠️ | [Eng] | Confirm real DSN in prod env (see 1.10) |

---

## Blueprint "Launch Checklist" mapping

| Blueprint item | Status | Where |
|----------------|--------|-------|
| Android ready | 🟡 | Core verified (1.1–1.6); release build + store submission due 5 Sep |
| iOS ready | 🟡 | Icons/strings verified (1.3); iOS build, signing, TestFlight pending |
| Web stable | ✅ | 1.9–1.10 |
| Payments live | 🟡 | Code done (4.1–4.2); live onboarding + webhook test pending (4.3–4.4) |
| KYC working | 🔲 | 5.4 |
| Notifications | 🟡 | 6.1 |
| Monitoring | 🟡 | 1.10, 3.7 |
| Support | 🔲 | 8.2–8.3 |
| Marketing assets | 🔲 | 7.3–7.4 |
| Pilot vendors onboarded | 🔲 | 8.4 |

---

## Top launch-blocking items (must close before 5 Sep beta)

1. **Featured placements** — seed paid/boost placements once the model is chosen (3.2, 11.4) [Founder]
2. **Release-build verification (on-device, signed-in)** — Crashlytics upload + Analytics + signed-in FCM + Realtime subscription on the Aug 14 HTTPS-verify APK (1.7, 1.8, 6.1, 11.1) [Eng]
3. **Razorpay live keys + webhook test** (4.3–4.4) [Founder]/[Ops]
4. **Compliance docs finalization** — GST, DLT, legal review (2.5–2.7) [Founder]
5. **Store listings** — Play Console + App Store Connect submission (7.4) [Founder]
