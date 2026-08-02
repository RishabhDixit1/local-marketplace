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
