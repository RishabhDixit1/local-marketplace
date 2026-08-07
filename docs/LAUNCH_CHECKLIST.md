# ServiQ Launch Checklist (Beta: 5 September 2026)

> Companion to `docs/LAUNCH_BLUEPRINT.md` (Aug–Sep 2026 master plan). Anchor date: **5 September 2026**.
> This checklist tracks concrete readiness items with status, owner, and evidence. Updated Aug 6, 2026.
>
> **Status legend:** ✅ Done & verified &nbsp;|&nbsp; 🟡 In progress / partial &nbsp;|&nbsp; 🔲 Not started &nbsp;|&nbsp; ⚠️ Needs decision / risk
> **Owner legend:** [Eng] Engineering &nbsp;|&nbsp; [Founder] Founder / business &nbsp;|&nbsp; [Ops] Operations
>
> Every [Founder]/[Ops] item is a **launch-blocking decision or deliverable due by 5 Sep** unless marked otherwise.
> Updated Aug 7, 2026: public browse route shipped (3.1); featured = verified-first shipped (3.2); Firebase init wiring fixed + test-crash button added (1.7, 6.1, 11.1).

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
| 1.7 | Crashlytics wired for production | 🟡 | [Eng] | **Fixed Firebase init wiring bug**: `appFirebaseProvider` was a hardcoded `disabled` Provider; now a `FutureProvider` backed by a memoized `initialize()` using the merged bootstrap config → crash handlers, analytics, push all observe real state. Debug builds still disabled by design. Verify on first release build |
| 1.8 | Analytics (mobile) | 🟡 | [Eng] | Firebase Analytics wired; `app_open_mobile` now awaits the real `appFirebaseProvider.future` (logs genuine `firebase_ready`, not a hardcoded false). Release-build verification pending |
| 1.9 | Web stable | ✅ | [Eng] | Live at https://www.serviqapp.com (Vercel, `vercel.json`); Playwright + Vitest suites; Sentry SDK 10.x configured (client/edge/server) |
| 1.10 | Web Sentry DSN confirmed in prod env | ⚠️ | [Eng] | `.env.staging.example` DSN is placeholder `your-sentry-dsn`; confirm real `SENTRY_DSN` is set in the production environment |
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
| 3.3 | Supabase (Postgres/RLS/Realtime) | ✅ | [Eng] | Live at `54.253.40.174:8000`; RLS + realtime; versioned migrations in `supabase/migrations/`; `services` text[] handled via `.ilike` |
| 3.4 | Database backups | 🟡 | [Ops] | `scripts/backup-db.sh` exists — confirm scheduled cadence + restore drill by 5 Sep |
| 3.5 | Domain + HTTPS | ✅ | [Ops] | serviqapp.com live; `Caddyfile` for TLS (EC2) + Vercel for web |
| 3.6 | Production deploy automation | ✅ | [Eng] | `scripts/deploy-docker.sh`, `Dockerfile`, `docker-compose.yml`; web via Vercel |
| 3.7 | Monitoring / uptime alerts | 🟡 | [Ops] | Sentry (web) + app logging; add uptime + Supabase health alerts by 5 Sep |

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
| 6.1 | Push notifications | 🟡 | [Eng] | FCM wired (`firebase_messaging`); channels `serviq_messages`/`reviews`/`orders`/`connections`; `POST_NOTIFICATIONS` granted on-device. Push service now reads the real `appFirebaseProvider` state (was permanently `disabled`), so `start()` fires once init completes. Release-build + signed-in FCM verification pending |
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
| 11.2 | iOS photo-library string missing | ⚠️ | [Eng] | `NSPhotoLibraryUsageDescription` absent; `image_picker` PHPicker (iOS 14+) generally does not require it. Add key if supporting older iOS or direct photo access |
| 11.3 | Android <12 splash is plain white | ⚠️ | [Eng] | `launch_background.xml` has no branded asset; Android 12+ auto-shows brand icon. Optional polish before 5 Sep |
| 11.4 | "Featured" label mismatch | 🟡 | [Founder] | Badge now only renders for **verified** providers (`featured == verified`); empty `featured_placements` no longer mislabels the list. Seeding paid placements is a separate [Founder] decision (see 3.2) |
| 11.5 | No offline banner on public landing | 🟡 | [Eng] | `OfflineBanner` lives in authenticated AppShell only; public landing relies on fail-fast toasts/error sheets |
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
2. **Release build verification** — Crashlytics + Analytics + FCM on a signed release build (1.7, 1.8, 6.1, 11.1) [Eng]
3. **Razorpay live keys + webhook test** (4.3–4.4) [Founder]/[Ops]
4. **Compliance docs finalization** — GST, DLT, legal review (2.5–2.7) [Founder]
5. **Store listings** — Play Console + App Store Connect submission (7.4) [Founder]
