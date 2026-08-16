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

### 3-Tab Navigation Restructure (Need Something | Explore | You) (Aug 9 complete)
- **Router**: `app_router.dart` shell now has 3 branches — 0: welcome+explore (AI home), 1: discovery, 2: profile (You). `TasksPage` and `ChatPage` (incl. `thread/:threadId`) moved OUT of the shell to **top-level GoRoutes** so deep links, notification taps, and `push` still work as full pages with back buttons. The 14 `redirect: ... => AppRoutes.profile` routes and the `/app/inbox`→chat, `/app/tasks/:taskId`→focused-tasks redirects are unchanged and still resolve.
- **Bottom nav / rail**: `main_bottom_nav.dart` destinations are now Need Something (`needSomething` l10n key, auto_awesome icon) | Explore | You (person icon). Removed `chatCount`/`taskCount` badge plumbing and `CountBadge` usage from nav (badges live on AI home now). `shouldShowPostActionForBranch(0|1)=true` still true → FAB only on Need Something/Explore, hidden on You.
- **app_shell.dart**: avatar IconButton (top-right) removed (profile is now the You tab); chat/task count watches removed from shell (moved to AI home).
- **AI home additions** (`welcome_page.dart` + `welcome_widgets.dart`): new `_InboxHomeSection` (up to 3 recent conversations with per-conversation `CountBadge` unread dots, "N new messages" subtitle, View all → `/app/chat`, row tap → `/app/chat/thread/:id`) and `_WorkHomeSection` (My needs / My work tiles with active counts → `/app/tasks`). Both only render when data exists; they reuse `chatConversationsProvider`/`taskSnapshotProvider` (previously watched in the shell). New l10n keys: `needSomething`, `viewAll`, `myNeeds`, `myWork`, `newMessages(int)` — translated in all 6 locales.
- **Push→go fixes for the new structure**: `feed_page.dart` profile-completion "Go" now `context.go` (switches to You tab); `profile_page.dart` self-referencing `AppRoutes.profile` tiles/actions now `context.go` (reset to hub) instead of pushing a nested copy; `create_need_page.dart` published-state "Open chat"/"View task" now `context.push` so back returns to the publish screen.
- **Tests**: `app_shell_contract_test.dart` updated (Need Something/Explore/You labels; rail no longer takes counts). Full suite: 190 passed; `flutter analyze` clean. No web/`tsc` changes.

### Welcome Intent Prompt + First-Run Role Selection (Aug 9 complete)
- **First-run "Who are you?" card** (`welcome_widgets.dart` `_WhoAreYouCard`, line ~1203): shows on AI home when no role intent has been chosen (and not dismissed). Three options via `MobileOnboardingIntent` (`findHelp` → `/app/create-need`, `earnNearby`/`businessSetup` → `/app/provider-launchpad`), plus a "Not now" dismiss. Both actions persist through `onboarding_handoff.dart` — extended with the intent enum + `MobileOnboardingIntentDetails` (storage key `serviq_onboarding_intent`, `fromStorageValue`, display labels, destination routes), `readIntentChosen`/`readIntentPromptDismissed` flags, `selectIntent()`/`dismissIntentPrompt()`, and Analytics events `home_first_engagement`/`home_intent_chosen`.
- **Sign-up prefill** (`sign_up_page.dart`, `_IntentSelector`): after onboarding, the sign-up page reads the handoff store and preselects the matching "What brings you to ServiQ?" option, so the funnel is remembered end-to-end.
- **New l10n keys** (6 locales): `whatBringsYou`, `findHelp`, `earnNearby`, `setUpMyBusiness`, `notNow`, `welcomeIntentTitle`/`welcomeIntentSubtitle` for the card.
- **Tests**: 2 new widget tests (`welcome intent prompt guides first-run role selection` via a minimal GoRouter with dummy `createNeed`/`launchpad` routes + `MemoryOnboardingHandoffStore` override; `welcome intent prompt dismisses with Not now`); handoff unit tests extended. Full suite: **195 passed**; `flutter analyze` clean.

### DB Backup Workflow Hardening (Aug 9)
- `.github/workflows/backup-db.yml` now fetches `scripts/backup-db.sh` from the repo at `${{ github.ref_name }}` before running it (no more server-side script drift), and passes `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_DEFAULT_REGION`/`BACKUP_S3_BUCKET` through as explicit env vars (with defaults) instead of relying on ambient env.
- `scripts/backup-db.sh`: dropped `--no-progress` from the `aws s3 rm` cleanup call (cleaner log output). Validated YAML parses.

### Release-Readiness Sweep (Aug 9 complete)
- **Public landing offline banner** (11.5): `OfflineBanner` added to `MarketplaceLandingPage` (public `/`) inside `SafeArea` using the same Column pattern as AppShell.
- **iOS photo-library string** (11.2): `NSPhotoLibraryUsageDescription` added to `Info.plist` (covers older iOS + direct photo access).
- **Android <12 branded splash** (11.3): both `launch_background.xml` files now render `@color/brand_dark` (#0F172A) + centered `@mipmap/ic_launcher`; new `values/colors.xml`. Android 12+ auto-shows brand icon. (AAPT quirk: raw hex in `android:drawable` is invalid — must reference a `@color/` resource.)
- **Prod config fails fast on missing Firebase keys**: `AppConfig._requireProductionFirebaseConfig` throws at startup in `APP_ENV=production` builds if any `FIREBASE_*` dart-define is missing (asserts are stripped in release, so this is a runtime throw). Fixes silent loss of Crashlytics/Analytics/FCM in release.
- **Release build verified**: `flutter build apk --release` compiles and v2-signs with the ServiQ cert (CN=ServiQ; `jarsigner` says "unsigned" but that only reflects v1 — use `apksigner verify --print-certs`). Prod-mode APK built with the full dart-define set and verified (strings in `libapp.so` show `https://supabase.serviqapp.com`/`https://www.serviqapp.com`/`production`). Artifact: `mobile/release/apk/serviq-mobile-1.0.0-20260809-release-verify-prod.apk`.
- **RELEASE BUILD COMMAND** (also in docs/serviq-technical-architecture.md): `flutter build apk --release --dart-define=APP_ENV=production --dart-define=SUPABASE_URL=https://supabase.serviqapp.com --dart-define=SUPABASE_ANON_KEY=... --dart-define=API_BASE_URL=https://www.serviqapp.com --dart-define=FIREBASE_API_KEY=... --dart-define=FIREBASE_PROJECT_ID=... --dart-define=FIREBASE_MESSAGING_SENDER_ID=... --dart-define=FIREBASE_ANDROID_APP_ID=... --dart-define=FIREBASE_IOS_APP_ID=...` (values live in the gitignored `mobile/config/local.json`). Dev/emulator builds rely on the bundled `config/local.json`; production mode deliberately does NOT read it.
- **LAUNCH-BLOCKING FINDING (3.8)**: live server runs nginx (Caddy TLS `scripts/setup-ec2-tls.sh` NOT applied); `supabase.serviqapp.com`/`realtime.serviqapp.com` have NO DNS records; Supabase is only reachable at cleartext `http://54.253.40.174:8000`. The release manifest has `usesCleartextTraffic="false"`, so a production mobile build cannot reach Supabase until TLS + DNS are provisioned. Sentry DSN (1.10) still needs a manual Vercel dashboard check (no CLI/token locally).
- **On-device Firebase verification (item 7, Aug 9)**: debug APK on emulator-5554 confirms Firebase init, Crashlytics plugin registration, `app_open_mobile` (`firebase_ready: true`), and FCM token retrieval (`ServiQ: FCM token=...`). Fixed a cold-start race: the first `screen=home_welcome` fired before Firebase init and was dropped (`[core/no-app]`) — `welcome_page.dart` now awaits `appFirebaseProvider.future` before tracking; `app.dart` `app_open_mobile` init timeout raised 10s→30s (first cold start after install exceeded 10s, falsely logging `firebase_ready:false`). **New finding**: Supabase Realtime websocket returns **503** on the dev endpoint `http://54.253.40.174:8000/realtime/v1/websocket` (app retries with correct backoff; root cause is part of 3.8 — verify after TLS/Kong fix). Crashlytics **upload** still unverified (needs `ENABLE_TEST_CRASH=true` signed build + signed-in test account).
- **Local API QA (item 8, Aug 9)**: started `npm run dev` (`scripts/dev_server.sh`, port 3000) — health 200, `/api/ai/prompt` works end-to-end vs live data (moderation + Gemini orchestration + provider match). **Fixed P1**: `/api/ai/prompt/stream` imported bare `google` from `@ai-sdk/google` (reads `GOOGLE_GENERATIVE_AI_API_KEY`, never set — only `GOOGLE_GEMINI_API_KEY` exists) so web AI chat always fell back to keyword text; now uses `getModel` from `lib/ai/provider.ts`. **Finding**: Gemini free-tier daily quota exhausted (`RESOURCE_EXHAUSTED`, limit 0/day) — AI degrades to keyword fallback; paid tier is a [Founder] decision. Findings logged in `mobile/release/friction_log.md` (MQ-101..104).
- **Monitoring + backups (item 9, Aug 9)**: added `.github/workflows/uptime-check.yml` (every 15 min: `www.serviqapp.com` 200, `/api/health` 200, Kong `http://54.253.40.174:8000/` 401; opens/closes labeled `uptime` GitHub issue) and `.github/workflows/backup-verify.yml` (daily 02:30: newest S3 backup <27h old and >1MB, Slack on failure). New `docs/DB_OPERATIONS.md` (RPO 24h, RTO 2h, restore-drill checklist). **Founder list**: `docs/FOUNDER_ACTION_LIST.md` compiled (#10).
- **Tests**: full suite 195 passed; `flutter analyze` clean. No web/`tsc` changes.

### Information-Architecture Cleanup Pass (Aug 13 complete)
- **`docs/IA_MENTAL_MODEL.md` created**: 3-tab mental model (Need Something | Explore | You) with ownership rules, what each tab shows, and the "who can post" matrix.
- **Profile hub role duplication FIXED**: the `_ProfileHero` previously rendered the role label twice (once as the subtitle under the name, once as a glass pill). Hero now shows name + headline only; role stays as a single pill. Hero name bumped `headlineSmall`→`headlineMedium` for stronger primary hierarchy.
- **Profile account card**: name-in-sentence copy removed ("<name> is your ServiQ identity" → "Your ServiQ identity") so name changes don't leave stale grammar.
- **Chat thread header consolidated**: was name + full address as subtitle AND a location chip with the same full address. Now `ProfileAvatarTile` subtitle shows a compact `_areaPreview` (last 2 comma segments, ≤30 chars) and the location chip is a tappable `_HeaderLocationChip` that opens a full-address modal bottom sheet. Verified on-device: full address "Tower-2, GOLD COAST, Ff 28, Biharipur Village, Crossings Republik, Ghaziabad" → chip "Crossings Republik, Ghaziabad" → tap → sheet with full address.
- **Explore "View all N providers" now opens `/app/search?browse=1`** (auto-loads all providers with featured sort) instead of a bare search page. Verified `search_page.dart` handles the `browse=1` param.
- **Onboarding sheet persistence ROOT-CAUSED**: `resolveSignedInLandingRoute` kept `hasStoredHandoff` true forever (`completeAuthHandoff(clearStoredRoute: false)` writes the intent destination as `lastRoute` and nothing ever cleared it), so a signed-in `findHelp` user was redirected to `/app/create-need` on EVERY cold start. Fixed with `OnboardingHandoffController.consumeStoredHandoff()` — `app_router.dart` clears the stored route once a signed-in landing redirect is served (skipped while `pendingAuthMethod != null`), so the funnel fires once per session and returning users land on their normal home. Unit tests added; verified on-device that a cold start lands on home (no create-need bounce).
- **Seeker onboarding no longer writes a "Active on ServiQ — here to find help nearby." placeholder bio**; empty bios show the pending-copy hint in the public preview instead.
- **Pluralization sweep** (count==1 correctness): profile listings hub tile + Services/Products subtitles, people/feed `workLabel` (jobs/leads/posts/needs), provider profile reviews stat, control page review captions, marketplace landing review stat, profile trust tile + reviews cards, `discoveryViewAllProviders` l10n_en ("View 1 provider"), and chat `_InboxDashboardHeader` quote/task threads. New shared `AppFormatters.pluralize(count, singular, {plural})` in `app_formatters.dart`.
- **Chat conversation preview now reads `metadata`**: image-only messages (empty `content`, `metadata.imageUrl` set) render a "Photo" preview instead of "Start the conversation". Display names now prefer `full_name` over the often-stale `name` column (`profiles` select adds `full_name`), matching the web's `full_name || name` convention.
- **Chat bubble density**: removed the duplicate timestamp (bubbles showed absolute time AND "Sent/Received 5m ago"), removed the dead `if (isLatestMine || true)` wrapper, deleted the `isLatestMine` plumbing/`_messageStatusLabel`, and simplified `_MineBubble` footer to time + ✓. Fixed a width→height regression in the footer spacer during the cleanup.
- **Profile hub section titles now use the shared `SectionHeader`** (was a byte-identical private `_HubSectionTitle`).
- **RouteErrorPage polish**: takes the failed `location` (from `state.uri`) and shows a "Retry · <path>" TextButton when the failed location isn't root, so deep links are recoverable. New `test/route_error_page_test.dart` (3 widget tests: branded copy + no raw error leak, retry-only-for-concrete-location, retry navigation via a real GoRouter).
- **Tests**: full suite **200 passed** (195 + 2 onboarding-handoff + 3 route-error); `flutter analyze` clean. On-device smoke: home boots, profile hub hero/pills, chat header chip + sheet. No web/`tsc` changes.

### Visual Redesign Pass — Home Greeting/Inbox/Work, Avatar System, Profile Dedupe (Aug 14 complete)
- **New shared `AppAvatar`** (`mobile/lib/shared/components/app_avatar.dart`, exported from `design_system.dart`): single avatar primitive — `CachedNetworkImage` photo when `avatarUrl` present, otherwise a **deterministic color-per-name initials circle** (8-tone mid-dark palette, white w700 text) instead of flat grey `CircleAvatar`+letter. Optional online-status dot. Registered in the barrel; **13 remaining `CircleAvatar` sites swapped** (feed card creator, chat `_ConversationTile`, `ProfileAvatarTile`, `provider_card`, discovery `_NearbyProviderTile`, search/map result tiles, people cards, connections rows, quote comparison, marketplace landing sheet, profile hub hero + public preview). `setup_page` checklist number badge intentionally kept (not a person avatar). Dead `_avatarInitial`/`_initials`/`_avatarFallback` helpers removed.
- **Home top bar**: the 3 separate bordered icon boxes → one **pill-cluster** (`_AppBarActionCluster`): search | bell | chat with 1px vertical dividers and `CountBadge` unread dots on bell (`unreadNotificationCountProvider`) and chat (unread sum of `chatConversationsProvider`). Verified on-device: notifications shows live "8" badge.
- **Greeting handle bug FIXED**: `_resolveViewerName`'s email-base fallback produced "Good afternoon, Dixit4119". Now `_resolveGreetingName(profileSnapshotProvider)` uses the verified profile full name (then account display name) and **rejects handle-lookalike single tokens** (letters+digits, e.g. `Dixit4119`) → falls back to nameless "Good afternoon". Verified on-device.
- **Inbox section REMOVED from home** (was greeting → inbox rows with raw-handle names "kushagrajuly1207" and duplicated "I can help today." previews + grey letter avatars). Chat lives in the top-bar cluster badge; conversation list still full-page at `/app/chat`. `_InboxHomeSection`/`_InboxHomeRow`/`_homeAvatarInitial` deleted.
- **Work section zero-state**: shows whenever `taskSnapshot` is loaded; when 0 needs + 0 work renders an invitation card ("Nothing in motion yet" + "Post your first need" → `createNeed`, "Browse my tasks" → tasks) instead of bare "My needs 0 / My work 0". Active state tiles redesigned to vertical (icon badge, `titleLarge` w900 count, label) with "View all" action.
- **Feed "Real Estate" duplicate FIXED** (`feed_card.dart`): `_PreviewFallback` rendered `item.category` text AND `_OverlayPill` rendered the category again when the thumbnail errored → fallback is now icon-only; single category pill remains. Verified on-device (one "Real Estate").
- **Profile hero dedupe**: `_ProfileHero` glass pills for "% complete" and "trust score" removed — those stats already live in `_HubSummaryGrid` MetricTiles (Profile/Live offers/Trust/Availability). Hero keeps role + location pills. Hero + public-preview avatars now `AppAvatar` inside the existing gradient ring. Verified on-device.
- **Explore tab**: audited on-device (Discover title, AI bar, search entry, Popular Services chips, "Nearby providers / View all 315", Open map) — no changes needed beyond the avatar unification (tiles now show "RR"/"SR"/"RS"/"RW" colored initials). Greeting at `headlineMedium` vs page titles `headlineSmall`/`titleLarge` keeps the type-scale hierarchy.
- **Tests**: full suite **200 passed**; `flutter analyze` clean. On-device verification (emulator-5554, uiautomator semantics): home greeting/badge/Work zero-state/feed dup, Explore provider tiles, You hero pills + summary grid, Chat conversation avatars. No web/`tsc` changes.

### 7-Fix Sweep + Explore Web-Alignment Pass (Aug 14 complete)
- **FAB collision FIXED** (`app_shell.dart`): `AppShell` → `ConsumerStatefulWidget`; NotificationListener tracks `scrollDelta` — FAB hides on scroll-down (`delta>0`), shows on scroll-up, force-visible at top (`pixels<16`); `IgnorePointer(Key('post-need-fab-gate'))` + `AnimatedScale`. Verified on-device: FAB bounds collapse `[859,1922][859,1922]` on scroll-down → full on scroll-up.
- **Feed card density + garbled-name root cause**: `feed_card.dart` description now `maxLines:1`; heavy 2x2 TrustSnapshot grid replaced with `_TrustStrip`/`_TrustChip` light chips (maxWidth 150, distinct muted color for "New to reviews"); `_TrustSnapshotTile` value 2-line globally. Garbled display names root-caused to raw `profiles.name` (e.g. `PRADIPKUMARGARG`, camelCase) + one giant record (`kushagrajuly1207`); fixed via `cleanPersonName` sanitizer.
- **Name sanitizer** (`lib/profile/nameSanitize.ts` + Dart port `AppFormatters.cleanPersonName`): fires only on camelCase / case-variant-duplicate / cross-casing-substring; drops short tokens, giant tokens, dedupes, capitalizes; >80 chars pass through. Applied server-side (`communityData.ts`, `getProfileDisplayName`, `providers-by-category`, `ai/prompt`) + mobile (`people_snapshot`, `chat_repository`, `locality_providers_screen`). `mobile/test/app_formatters_clean_name_test.dart` (4 tests). Preserves "AquaRepublik RO Service (Crossing Republik)", "BrightFixIndia", "McDonald", "R.K. AC,Washing Machine & Fridge Repair Shop".
- **Test-account flagging (§4)**: `supabase/migrations/20260814000000_test_account_flagging_and_name_hygiene.sql` (applied live: `is_test` column + index, 10 accounts flagged) + server filters in `communityData.ts`, `providers-by-category`, `ai/prompt`, `top-matches`, `leads/score`, `leads/ai-match`, `intentMatching.ts`. `tsc --noEmit` clean.
- **Search-nearby loading skeletons (§5)**: `_NearbyLoading`/`_ZonesLoading` in `discovery_page.dart` use shared `LoadingShimmer` (previously static grey placeholders). Verified on-device.
- **Trusted-card boundary (§6)**: two real RenderFlex overflows found+fixed — `welcome_page.dart` activity sheet (5-6 ListTiles > max sheet height → wrapped in `SingleChildScrollView`) and `ai_prompt_bar.dart` "Browse results/Post requirement" Row (→ `Wrap`). On-device: full 7-item sheet opens with 0 overflows.
- **Explore tab == WebApp home (trailing note)**: user chose "Explore tab → web layout". `discovery_page.dart` now mirrors the web landing's section order: Discover hero + AI bar + search entry → **How ServiQ Works** (3-step dismissible `_HowItWorksCard`, mirrors LandingPageClient) → Popular Services chips → **"N providers near you"** count line (`discoveryProvidersNearYou`) + map/tiles → **CTAs** (`_CtaSection`: "Looking for services?"→search browse, "Are you a service provider?"→provider-launchpad) → Explore zones. 15 new l10n keys in all 6 locales (reusing web `landing.*` translations where they exist). Verified on-device: How It Works card + Dismiss persists, count "313 providers near you", CTAs, 0 overflows. `mobile/test/discovery_page_test.dart` (3 tests: section order, dismiss, singular count).
- **Tests**: full suite **209 passed**; `flutter analyze` clean; `tsc --noEmit` clean. On-device verification (emulator-5554): home greeting handle-rejection, feed card single category + trust strip, FAB hide/show, actions sheet, profile hub dedupe, search empty sheet, Explore web-layout.

### Supabase HTTPS Endpoint + Realtime Fix (3.8, Aug 14 complete)
- **LAUNCH-BLOCKING 3.8 CLOSED**: production mobile builds now reach Supabase over HTTPS. The EC2 nginx already terminates TLS for `www.serviqapp.com` (Let's Encrypt) and proxies `/auth/v1`, `/rest/v1`, `/storage/v1`, `/realtime/v1` → Kong `127.0.0.1:8000` (realtime with websocket upgrade headers), so **no DNS records or new certs were needed** — the fix was pointing `SUPABASE_URL=https://www.serviqapp.com` (the Supabase client appends `/rest/v1`, `/auth/v1`, `/storage/v1`, `/realtime/v1/websocket` to the base URL).
- **Realtime 503 root-caused + fixed**: the `supabase-realtime` container (image `supabase/realtime:v2.76.5`) was NEVER running — Kong returned 503 for `/realtime/v1/*`. Started on EC2 with `cd /home/ec2-user/supabase && docker-compose up -d realtime` (host docker has no compose v2 plugin; use `docker-compose` v5.1.4). Container now healthy, replication slot + publication created, websocket upgrades **101** over HTTPS (was 503).
- **Verified on-device** (release APK `mobile/release/apk/serviq-mobile-1.0.0-20260814-release-verify-https.apk`, sha256 `6b64a683...`, emulator-5554): `ServiQ mobile: starting Supabase bootstrap for www.serviqapp.com` → bootstrap completed with no errors; REST 401s (Kong alive); raw websocket handshake over HTTPS = 101; cleartext `http://54.253.40.174:8000` no longer present in `libapp.so`. FCM token + realtime subscription still require a signed-in session (push to the release-verify on-device pass).
- **Docs updated**: `LAUNCH_CHECKLIST.md` (3.3/3.8 ✅, top-blockers list renumbered — Supabase HTTPS removed, featured placements now #1), `SUPABASE_HTTPS_RUNBOOK.md` (marked DONE with the actual fix; original subdomain plan kept as optional; noted `scripts/Caddyfile` realtime→4000 is stale — realtime is only reachable via Kong:8000), `serviq-technical-architecture.md` + `app_config.dart` error text (build commands now use `https://www.serviqapp.com`), `DB_OPERATIONS.md` + `.github/workflows/uptime-check.yml` (Kong check now `https://www.serviqapp.com/rest/v1/` expect 401), `FOUNDER_ACTION_LIST.md` (3.8 struck). `flutter analyze` clean; YAML parses.
