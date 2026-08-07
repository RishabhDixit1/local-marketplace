# AWS Guidance

- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.

# ServiQ Project Context

- ServiQ is a hyperlocal services marketplace (like Urban Company) targeting Delhi NCR.
- Tech: Next.js 16 (App Router), React 19, Flutter 3.41, Supabase (Auth/Postgres/Realtime/RLS), Razorpay payments, Sentry monitoring.
- Live at https://www.serviqapp.com, repo at https://github.com/RishabhDixit1/local-marketplace

## Verification commands

- Flutter: `cd mobile && flutter analyze --no-pub`
- TypeScript/ESLint: `npx eslint <changed-files>`
- Full TS check: `npx tsc --noEmit`

## Key conventions

- Flutter uses Riverpod for state, go_router for navigation, Supabase for backend.
- Web uses Next.js App Router, Tailwind CSS, CSS variables for theming.
- `services` column in profiles is `text[]` - use `services::text.ilike.%keyword%` (NOT `.cs.{keyword}` which fails).
- Toast notifications: Flutter uses `ServiqToast.show()` from `serviq_chrome.dart`, not raw SnackBar.
- The `messages` table has an unused `metadata jsonb` column used for chat image attachments.

## Completed work summary

### P0 (Critical)
- Double-refund idempotency guard in `orders/[id]/route.ts`
- HMAC timing-safe comparison in `payment/verify/route.ts`
- Rate limit race condition (atomic upsert in `rateLimit.ts`)
- Background job double-processing prevention (conditional claim + exponential backoff)
- Web dark mode CSS variables (20+ `dark:` modifiers in chat/page.tsx, AppFooter, ProviderCardSkeleton, error.tsx, global-error.tsx)
- AI search bug fix: `.cs.{}` → `.ilike` for services text[] column

### P1 (This week)
- Flutter: Login keyboard dismiss, OTP autofill hints, chat timestamps + auto-scroll, haptic feedback, profile avatar CachedNetworkImage
- Flutter: Orders page status filtering tabs (All/Active/Completed/Cancelled)
- Flutter: 98 raw SnackBar calls → ServiqToast across 27 files
- Flutter: Chat media attachments (image picker + upload + display in bubbles)
- Web: LoginPageClient `role="alert"` on error

### P2 (2 weeks)
- OTP cooldown timer (60s countdown on both web + Flutter)
- Profile hub reorganization (18 flat tiles → 4 grouped sections: Provider Tools, Orders & Payments, Communication & Trust, Account)

### Flutter Mobile Hardening (Phase A complete)
- Realtime reconnect-with-backoff (exponential, 5s-60s, 20 retries)
- Offline fail-fast on every network call via connectivity_plus
- Session refresh timeout (8s) to prevent hung cold starts
- FlutterSecureStorage pre-warm for faster Supabase init
- Global OfflineBanner widget in app shell
- Haptic feedback on feed actions, chat send, quote operations
- Semantic labels on feed icons, chat back button, feed card images
- Error handling fixes: catch blocks added to toggleService, toggleProduct, _runAction, _respondConnection, _respond (connections), _acceptQuote
- Loading states added to _rejectQuote, profile sync button
- Success toasts added to connection accept/reject/cancel
- Offline sync endpoint path fixed (/api/orders/[id]/status → /api/orders/[id])
- AI prompts now send auth token for user-level rate limits
- Empty states added to: workspace detail, subscriptions, analytics, availability
- Dead code removed (_TextField widget from provider launchpad)
- Shared AppTextField component extracted for listing forms

### Design System Migration (Phase C complete)
- AppTextField extended with `suffixText`, `inputFormatters`, proper constructor init
- **Raw TextField/TextFormField → AppTextField**: 36+ fields across 14 files (disputes, reporting, settings, availability, payouts, referrals, tasks, workspaces, profile, quotes, task_post, create_need)
- **Private widget collapse**: `_ProfileTextField` (6 usages) → AppTextField, `_FilterChip` → AppPill
- **Scaffold/AppBar → ServiqScaffold/ServiqTopBar**: 17 pages migrated (onboarding, launchpad, boosts, verification, quote_comparison, task_post, subscriptions, listing_detail, control, map_discovery, public_business, profile, tasks, create_need, marketplace_landing + task_post + profile)
- **Intentionally kept raw**: Auth pages (login, sign_up, forgot_password, setup), welcome/onboarding, chat page (dynamic leading), admin/connections/referrals (TabBar in bottom), market_zones (custom search), ai_prompt_bar (custom container), chat_composer (borderless), budget prefixText field
- **Visual changes from swap**: All swapped fields now get AppTextField's `filled: true` background + `OutlineInputBorder` for consistent design system look

### Design System Migration — Token Sweep & Cleanup (Phase D complete)
- **Part 0 — Environment**: Flutter 3.41.9 verified; `flutter pub get` clean. Fixed **11 errors** (missing imports for `ServiqScaffold`/`ServiqTopBar`/`AppTextField` in 9 files, `Expanded` missing `child:` in `quote_room_page.dart`, missing `TextInputFormatter` import in `app_text_field.dart`, deprecated `value→initialValue` in 2 files). Removed 40+ redundant shared-component imports superseded by `design_system.dart` barrel.
- **Part 1 — Token sweep**: 200+ replacements across 20+ files:
  - `SizedBox(height/width: N)` → `AppSpacing.*` (xs=8, sm=12, md=16, lg=20, xl=24, xxl=32, xxxl=40)
  - `EdgeInsets.all/symmetric/only/fromLTRB(N)` → token equivalents
  - `BorderRadius.circular(N)` → `AppRadii.*` (xs=4, sm=6, md=8, lg=12, xl=16, pill=999)
  - Files covered: `welcome_widgets`, `seeker_onboarding`, `admin_page`, `analytics_page`, `referrals_page`, `search_page`, `map_discovery_page`, `checkout_page`, `order_detail_page`, `workspace_detail_page`, `payouts_page`, `verification_page`, `review_card`, `provider_boosts_page`, `transactions_page`, `provider_subscriptions_page`, `notifications_page`, `bookings_page`, `chat_page`, `app.dart`, `main.dart`, `cart_sheet`, `setup_page`, `create_need_page`, `invoices_page`, `availability_page`, `workspaces_page`, `welcome_page`, `locality_providers_screen`, `market_zones_screen`, `quote_room_page`, `profile_page`, `payout_status_chip`, `payout_summary_card`, `quote_comparison_page`, `onboarding_walkthrough_page`
- **Part 2 — Deferred widgets**: `_ThreadEmptyState` in `chat_page.dart` confirmed genuinely bespoke (safety notes + contextual logic — not a candidate for `EmptyStateView` extension). `_SheetScaffold` in `provider_listings_page.dart` confirmed one of 3 different `DraggableScrollableSheet` patterns with distinct sizing/content — no shared `AppBottomSheet` primitive warranted.
- **Part 3 — Visual spot-check**: Code review of payouts `suffixText`, quote room dense rows, and profile password fields shows no cramping or breakage from the `filled`/`OutlineInputBorder` style. All standard `InputDecoration` properties render correctly.

### Blueprint Reconciliation + Trust/Routing/Voice (Aug 3 complete)
- **docs/PRODUCT_BIBLE.md** reconciled with the implementation blueprint: added Provider Graph data model (§3), Phase Boundary splitting pilot vs roadmap (§5), and a calculable six-input Trust Score replacing the checklist framing (§6).
- **Trust score = real job completion**: `supabase/migrations/20260803000000_provider_trust_job_completion.sql` adds `calculate_job_completion_rate`, extends `get_provider_order_stats` with `accepted_jobs` + `repeat_consumers`, rewrites `refresh_profile_marketplace_metrics` to use job completion (completed ÷ accepted, not profile completeness), and adds `trg_orders_sync_metrics` so scores refresh on every order status change. Deployed to production (must `drop function` before changing an RPC return type — `create or replace` fails on it).
- **Routing uses live trust**: `lib/ai/intentMatching.ts` drops hardcoded `trustScore: 50`/`responseTimeMinutes: 30`/`repeatClientsCount: 0`; batch-fetches order stats via RPC and computes trust per provider with the same six-input formula. `lib/profile/marketplaceData.ts` `loadTrustScores` feeds job completion + repeat from the RPC too.
- **Flutter voice input**: added `speech_to_text: ^7.4.0`; new shared `VoiceInputButton` (`mobile/lib/shared/components/voice_input_button.dart`) wired into the AI prompt bar suffix and the create-need "Need" field. RECORD_AUDIO already present; iOS mic string now covers voice input. Needs real-device verification.

### Launch Blueprint Persistence + Store-Readiness Audit (Phase 3 complete)
- **docs/LAUNCH_BLUEPRINT.md** created from `~/Downloads/ServiQ_Master_Launch_Blueprint_August_2026.docx` (Sept 5, 2026 beta target). Cross-checked against PRODUCT_BIBLE Phase Boundary — no contradiction. The intent-engine narrative blueprint could NOT be found (PPTX blueprints are image-only).
- **Flutter pilot gap audit**: all 8 requirements verified except **ETA absent** from provider quick-response (no schema/API/mobile support) — logged to PRODUCT_BIBLE Roadmap, not built.
- **Mobile brand icons FIXED**: Android `ic_launcher.png` and iOS AppIcon were the **default Flutter logo** (blue #54C5F8/#01579B); iOS `LaunchImage.png` was a 1×1 transparent placeholder. Regenerated all 23 assets from `public/serviq-icon.svg` (dark #0F172A, teal #14B8A6 check, white "S") using `rsvg-convert`: Android mipmap 48/72/96/144/192 + iOS AppIcon all 15 slots (opaque, 0 alpha for App Store) + LaunchImage @1x/2x/3x. Regenerate anytime via the same SVG + `rsvg-convert -w <px> -h <px>`.
- **iOS camera string fixed**: `Info.plist` `NSCameraUsageDescription` said "during live video calls" (Live Talk is compile-time off) → now "to take photos of requests, services, and verification documents."
- **iOS mic string aligned** (same Live Talk issue): `NSMicrophoneUsageDescription` now only describes voice input ("asking the assistant and posting needs"), no longer mentions live calls.
- **Audit PASS**: crash handling (FlutterError.onError + runZonedGuarded + PlatformDispatcher.onError → Crashlytics, no blank-screen paths); permissions (camera/mic legitimately used despite Live Talk off); offline (Discovery `AsyncValue.when` error+retry, AI bar fail-fast via `_sendJson` offline check at mobile_api_client.dart:359); locale (all new-surface keys translated in hi/bn/mr/ta/te).
- **Discovery page localized** (P2 closed): added 23 `discovery*`/`zone*` keys to all 6 locale files (`l10n.dart` + en/hi/bn/mr/ta/te); `discovery_page.dart` now uses l10n for section headers, search hint, empty/error states, map fallback, zone subtitles, "Upcoming" pill, and "View all N providers". Raw `'$err'` error rendering replaced with localized `discoveryLoadError` + retry. Only intentional non-localized strings: fallback category chips (English search terms matched against backend service names).

### Explore Markets Featured Section + On-Device Store-Readiness Verification (Aug 6 complete)
- **Explore Markets "Featured providers" bug FIXED**: landing page bounded the fetch (limit=50) but rendered ALL providers with no UI cap (other sections capped: categories=8, zones=3). `marketplace_landing_page.dart` now caps unfiltered preview to 3 full-width cards (matches Live Now count), keeps 8-category grid, and adds a "Browse all" action that pushes `/app/search?browse=1`. `marketplace_repository.dart` now passes `sortBy: 'featured'` for unfiltered fetches; `marketplace_provider.dart` gained a `featured` bool; `marketplace_provider_card.dart` renders a marigold "Featured" pill for verified features. `search_page.dart` gained `browseAll` (auto-loads all providers with featured sort on empty query). Verified on-device: 3 cards then CTA; card order matches the `sortBy=featured` API response. **Flagged**: `public.featured_placements` is EMPTY on live DB, so no true featured providers exist — the section shows fallback top providers and the badge only appears once boosts/placements exist.
- **"Browse all" auth-gate finding**: all `/app/*` routes are auth-gated; anonymous users tapping "Browse all" (or the pre-existing search icon / category View all) land on Sign In. No public full-listing route exists. Product decision needed (keep funnel vs public listing).
- **On-device verification method** (emulator-5554, API 37): use `adb shell screencap -p /sdcard/x.png && adb pull` (NOT `adb exec-out screencap` which yields corrupt output); `adb shell uiautomator dump` hangs when the UI is mid-transition; Flutter semantics expose text via `content-desc` (never `text=`); the soft keyboard never shows unless `settings put secure show_ime_with_hard_keyboard 1` (virtual HW keyboard suppresses IME) — with it enabled, ENTER triggers `onSubmitted`.
- **Verified on-device (store-readiness)**: offline cold start renders + logs "You appear to be offline" (no hang); offline AI query shows graceful error sheet with Retry; connectivity recovery works; app relaunches cleanly after hard kill; camera/mic permissions correctly runtime-gated (granted=false → OS prompt on first use); POST_NOTIFICATIONS + location granted; app icon renders as brand icon in launcher and Android 12+ splash (APK bytes md5-match source, 1024px AppIcon 100% opaque).
- **iOS strings re-verified**: camera/mic usage descriptions correct; `NSPhotoLibraryUsageDescription` MISSING (fine for image_picker PHPicker on iOS 14+; add if older iOS targeted).
- **Crash-handling caveat**: `FlutterError.onError`/`runZonedGuarded` → `recordError` safe no-op when Firebase absent; Crashlytics is `!kDebugMode` so it CANNOT be demonstrated in debug builds (`firebase_ready: false`) — verify on first release build. No Crashlytics test-crash button exists (recommended).
- **docs/LAUNCH_CHECKLIST.md created**: tracks all 11 blueprint sections with status/owner/evidence, flags every [Founder]/[Ops] item as due 5 Sep, and lists top launch-blocking items (featured placements, browse-funnel decision, release-build Firebase verification, Razorpay live keys, compliance, store listings).
- **Test fix**: `widget_test.dart` "search page shows nearby provider matches" was hanging (`pumpAndSettle` timeout) because `_doSearch` now awaits `userLocationProvider.future` (geolocator) which never resolves in the test env — added `userLocationProvider.overrideWith((ref) async => null)` to the test. Full suite: 190 passed; `flutter analyze` clean; `tsc --noEmit` clean.
