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
- Tech: Next.js 16 (App Router), React 19, Flutter 3.11, Supabase (Auth/Postgres/Realtime/RLS), Razorpay payments, Sentry monitoring.
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
