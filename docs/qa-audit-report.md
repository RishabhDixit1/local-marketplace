# ServiQ Full QA Audit — Findings Report

**Date:** 2026-06-28
**Scope:** Next.js web app + Flutter mobile app (Android/iOS), self-hosted Supabase backend on EC2
**Method:** Read-only code audit. No files were modified.

---

## Summary

| Severity | Count |
|---|---|
| **Critical** | 4 |
| **High** | 12 |
| **Medium** | 30 |
| **Low** | 18 |
| **Total** | **64 findings** |

**Code Health:** `tsc --noEmit` = 0 errors, `dart analyze` = 0 issues, ESLint = clean.

---

## 1. AUTH & ONBOARDING

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 1.1 | `lib/server/otpStore.ts` | 8 | **Critical** | OTP store is in-memory `Map` — breaks in serverless/Vercel where multiple instances serve requests | Migrate OTP storage to Supabase `rate_limits` table or Redis |
| 1.2 | `lib/kyc/provider.ts` | 18 | **Critical** | Default KYC provider is `MockKycProvider` that always returns verified=true on format-valid input | Ensure `setKycProvider` is called with a real provider in production entry points |
| 1.3 | `lib/server/customAuth.ts` | 100 | **Critical** | Session cookie set with `httpOnly: false` — readable by JavaScript, XSS-exposed | Set `httpOnly: true` on auth cookie |
| 1.4 | `app/api/auth/verify-link/route.ts` | 52-68 | **High** | Admin `createUser` bypasses sign-up restrictions — any email can be provisioned via service role | Rate-limit user creation and require email domain allowlist check |
| 1.5 | `lib/server/customAuth.ts` | 15 | **High** | Local JWT expiry is ~400 days (34560000s) — stolen token valid for over a year | Reduce to 7 days (604800s) with refresh mechanism |
| 1.6 | `app/api/auth/send-link/route.ts` | 85 | **High** | Rate limit key is `null` for anonymous requests — first 5 requests globally exhaust the budget | Use IP address or session-derived key instead of `null` |
| 1.7 | `lib/server/requestAuth.ts` | 77-92 | **High** | Suspension check skipped when `admin` client is null (env vars missing) — suspended users get through | Fall back to anon-client RPC call to check suspension |
| 1.8 | `app/api/auth/verify-link/route.ts` | 26 | **Medium** | No CSRF on GET endpoint — malicious `<img>` tag could trigger OTP verification for attacker's email | Require POST-only or add CSRF token to verify endpoint |
| 1.9 | `app/auth/set-password/page.tsx` | 39 | **Medium** | Web requires 6-char minimum password; mobile requires 8 chars with letter+number — policy mismatch | Align both to 8-char minimum with complexity requirements |
| 1.10 | `app/api/auth/send-link/route.ts` | 36 | **Medium** | Basic email regex allows non-standard TLDs and misses RFC validation | Use a proper email validation library |
| 1.11 | `app/auth/callback/page.tsx` | 58-62 | **Medium** | `onAuthStateChange` listener registered but never unsubscribed on unmount | Store `subscription` ref and call `.unsubscribe()` in cleanup |
| 1.12 | `app/onboarding/provider/layout.tsx` | — | **Medium** | Provider onboarding pages have no middleware auth guard — renders for unauthenticated users | Add auth check in layout or redirect to sign-in |
| 1.13 | `lib/profile/client.ts` | 47-54 | **Medium** | Profile bootstrap silently adds userId to `bootstrappedUserIds` even when ALL upsert variants fail | Only mark as bootstrapped after successful profile upsert |
| 1.14 | `mobile/lib/features/auth/data/onboarding_handoff.dart` | 91-93 | **Medium** | `OnboardingHandoffStore` defaults to in-memory (not SharedPreferences) — state lost on app restart | Change default provider to `SharedPreferencesOnboardingHandoffStore` |
| 1.15 | `app/api/auth/google/callback/route.ts` | 72-73 | **Medium** | Error redirect hardcodes `https://www.serviq.in` — breaks in local dev | Use `request.url` origin or `NEXT_PUBLIC_SITE_URL` |
| 1.16 | `mobile/lib/core/auth/mobile_auth_service.dart` | 274-275 | **Medium** | Phone OTP auto-creates accounts via `shouldCreateUser: true` for ANY phone number | Require explicit sign-up before allowing phone OTP login |
| 1.17 | `app/auth/callback/page.tsx` | 42-44 | **Low** | Referral code redemption PATCH is fire-and-forget with `.catch(() => {})` — silent failures | Log the error and increment a retry counter |
| 1.18 | `supabase/config.toml` | 177, 221 | **Low** | `minimum_password_length = 6`, `enable_confirmations = false`, `password_requirements = ""` | Set min length to 8, enable confirmations, require letter+number |

---

## 2. ROUTING & NAVIGATION

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 2.1 | `docker-compose.yml` | 1-11 | **High** | YAML syntax error — `restart: unless-stopped` is indented under `volumes:` instead of under `redis:` service | Move `restart` under the `redis:` service block |
| 2.2 | `app/dashboard/components/DashboardHero.tsx` | 64 | **Medium** | "View Market" hardcodes `/market/crossing-republik` — won't work if the market slug changes | Derive market slug from config or user's locality |
| 2.3 | `app/dashboard/layout.tsx` | 102 | **Medium** | "Providers" side nav links to `/dashboard/providers` but the name overlaps with "Market" tab — confusing navigation | Add aria-label differentiation or rename secondary nav items |
| 2.4 | `app/dashboard/components/GlobalMapView.tsx` | 203-250 | **Medium** | `getAreaItems()` (society/market pins) was emptied to return `[]` but function not removed | Remove unused function or wire it to real data |
| 2.5 | `app/market/[society]/[category]/page.tsx` | 136-151 | **Low** | Only has "Browse Providers" and "View All Categories" — no "View Market" link unlike other market pages | Add a "View Market" link to `/market/crossing-republik` |
| 2.6 | `app/components/landing/LandingPageClient.tsx` | 530 | **Low** | Hardcoded society list for "Covering" line — will go stale as new societies join | Fetch society list from DB or locality table |
| 2.7 | `app/dashboard/components/DashboardHero.tsx` | 59 | **Low** | "Covering: Mahagun Mascot, ... and 12+ areas" is hardcoded | Fetch covering areas from localities table |

---

## 3. BOOKING / ORDER LIFECYCLE

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 3.1 | `app/api/orders/[id]/route.ts` | 91-333 | **Critical** | Cancellation after payment (`paid`/`in_progress`) has no Razorpay refund call — provider keeps funds | Add Razorpay refund API call when cancelling paid orders |
| 3.2 | `app/api/admin/orders/route.ts` | 133-151 | **High** | Admin "refund" action only sets `payment_status: "refunded"` in metadata — no Razorpay refund API call | Add `POST /api/refunds` call with correct amount |
| 3.3 | `app/api/admin/disputes/route.ts` | 106-123 | **High** | Dispute resolution for consumer zeroes fees but never calls Razorpay refund | Call Razorpay refund API on dispute resolution for consumer |
| 3.4 | `app/api/orders/[id]/route.ts` | 218-253 | **Medium** | Duplicate commission/payout logic exists in both `orders/[id]/route.ts` and `delivery/route.ts` — can create duplicate payouts | Add idempotency check or consolidate into one trigger |
| 3.5 | `app/api/bookings/[id]/cancel/route.ts` | 52-58 | **Medium** | Booking cancellation only updates `booking_slots.status` — doesn't propagate to parent order or release funds | Update parent order status and trigger refund if paid |
| 3.6 | `app/api/orders/route.ts` | 268-277 | **Medium** | Client can set `payment_status`, `razorpay_order_id`, `razorpay_payment_id` on order creation without server verification | Strip these fields from client input; only set server-side after verification |
| 3.7 | `app/api/cron/auto-payouts/route.ts` | 67-84 | **High** | Auto-payout cron marks payouts "completed" in DB without calling Razorpay transfer API — no actual money moves | Add Razorpay payout API call or disable and document as admin-only |
| 3.8 | `app/api/orders/[id]/route.ts` | 204-253 | **Medium** | Order completion fires fire-and-forget commission/payout creation with no rollback on failure | Make payout creation await-able and roll back order status on failure |
| 3.9 | `app/api/bookings/[id]/reschedule/route.ts` | 66 | **Low** | Old booking slots marked "rescheduled" with no TTL/cleanup — could accumulate stale records | Add a scheduled cleanup or set explicit expiry timestamp |

---

## 4. CHAT (REALTIME)

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 4.1 | `app/dashboard/chat/page.tsx` | 846-924 | **Medium** | Realtime subscription listens to ALL inserts on `messages` table with no conversation filter — every user sees all message events | Add `filter: "conversation_id=in.(...)"` with user's conversation IDs |
| 4.2 | `next.config.ts` | 207-210 | **Medium** | Supabase Realtime rewrite uses REST API origin — WebSocket path may not match behind Kong | Verify `origin` resolves to correct WSS endpoint; add explicit path rewrite |
| 4.3 | `app/dashboard/chat/page.tsx` | 668-718 | **Medium** | Single global presence channel for all users — doesn't scale; each user receives all presence events | Implement per-conversation or per-region presence channels |
| 4.4 | `app/dashboard/chat/page.tsx` | 699-705 | **Low** | Presence heartbeat runs every 30s even when no chat is selected | Only start heartbeat when conversation is active |
| 4.5 | `lib/realtime.ts` | 8-42 | **Info** (positive) | Exponential backoff with jitter for Realtime subscriptions is well-implemented | — |

---

## 5. PAYMENTS (RAZORPAY ESCROW)

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 5.1 | `app/api/admin/orders/route.ts` | 133-151 | **Critical** | Admin refund does not call Razorpay refund API — money stays in platform account (duplicate of 3.2) | Add Razorpay refund API call with amount and order reference |
| 5.2 | `app/api/admin/disputes/route.ts` | 106-123 | **Critical** | Dispute resolution for consumer does not call Razorpay refund (duplicate of 3.3) | Add Razorpay refund API call |
| 5.3 | `app/api/payment/release-funds/route.ts` | 6-51 | **High** | `POST /api/payment/release-funds` has NO auth middleware — any unauthenticated caller can trigger | Add `requireRequestAuth` or `verifyCronSecret` |
| 5.4 | `app/api/cron/auto-payouts/route.ts` | 13-96 | **High** | Cron route has NO `verifyCronSecret()` — attacker who discovers URL can trigger auto-payouts | Add `verifyCronSecret()` check at handler entry |
| 5.5 | `app/api/webhooks/razorpay/route.ts` | 264-278 | **Medium** | Webhook updates for payouts may silently fail if DB record doesn't exist yet (race with payout creation) | Add retry/queue or create payout record on webhook if missing |
| 5.6 | `app/api/orders/route.ts` | 268-277 | **Medium** | Client can set `razorpay_payment_id` before server verification — can fake payment metadata | Strip Razorpay fields from client payload |
| 5.7 | `app/api/referrals/payout/route.ts` | 46-51 | **Low** | Referral payouts inserted as "pending" with no Razorpay API call — rely on admin manual transfer | Wire referral payouts through Razorpay Payouts API |
| 5.8 | `lib/server/razorpay.ts` | 3-7 | **Low** | No test/live key toggle — could accidentally charge live cards during development | Add `RAZORPAY_MODE` env var and validate key pair |

---

## 6. SECURITY

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 6.1 | `.env.local` | all | **CRITICAL** | Live secrets committed to repo: `SUPABASE_SERVICE_ROLE_KEY`, `AWS_ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`, `FIREBASE_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `RESEND_API_KEY` | Rotate ALL keys immediately; add `.env.local` to `.gitignore`; remove from git history |
| 6.2 | `lib/server/requestAuth.ts` | 126-132 | **High** | When `CRON_SECRET` is unset, logs warning and returns `true` — all cron routes become unprotected | Throw an error or refuse to start when `CRON_SECRET` is missing |
| 6.3 | `app/api/upload/post-media/route.ts` | 48 | **Medium** | File upload validates MIME type from browser only — no magic-byte content inspection | Add `file-type` or `magic-bytes` package to verify actual content |
| 6.4 | `app/api/upload/listing-image/route.ts` | 32 | **Medium** | Same MIME-only validation as 6.3 | Add magic-byte content verification |
| 6.5 | `app/api/upload/quote-media/route.ts` | 49 | **Medium** | Same MIME-only validation as 6.3 | Add magic-byte content verification |
| 6.6 | `app/api/verification/documents/route.ts` | 37 | **Medium** | KYC doc upload uses `upsert: true` with predictable path — can overwrite approved documents | Remove `upsert` or add versioning; randomize file paths |
| 6.7 | `lib/server/requestAuth.ts` | 116 | **Medium** | Admin email allowlist falls back to `NEXT_PUBLIC_ADMIN_EMAILS` — admin emails leak to client-side bundle | Remove `NEXT_PUBLIC_` fallback; use only server-side env var |
| 6.8 | `lib/server/customAuth.ts` | 17 | **Medium** | Local JWT uses HS256 symmetric key — anyone with `SERVIQ_INTERNAL_PUSH_KEY` can forge tokens | Use RS256 or rotate key frequently |
| 6.9 | `vercel.json` | 37-56 | **Low** | `/api/auth/callback` CORS allows `Access-Control-Allow-Origin: *` | Scope to known origins (production domain + staging) |
| 6.10 | `app/api/auth/verify-link/route.ts` | 30 | **Low** | Auth cookie set as non-`httpOnly` (uses config from `customAuth.ts:100`) | Set `httpOnly: true` (see 1.3) |
| 6.11 | `supabase/config.toml` | 221 | **Low** | `enable_confirmations = false` — users can sign in without verifying email | Enable email confirmations for production |
| 6.12 | `next.config.ts` | 104-116 | **Low** | CSP allows `unsafe-eval` and `unsafe-inline` (required by Next.js) | Acceptable for framework; monitor for removal in future Next.js versions |

---

## 7. CROSS-PLATFORM PARITY

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 7.1 | `mobile/lib/features/blocking/` | — | **Medium** | Blocked users management (page + provider + repository) exists on mobile only — no web equivalent | Add blocked users page to web dashboard |
| 7.2 | `mobile/lib/core/network/` | — | **Medium** | Offline queue + sync manager + connectivity service exists on mobile only — web has no offline support | Add Service Worker + IndexedDB offline queue for web |
| 7.3 | `app/dashboard/tests/` | — | **Medium** | A/B tests dashboard exists on web only — no mobile equivalent | Add A/B test management to mobile admin |
| 7.4 | `app/dashboard/campaigns/` | — | **Medium** | Campaign management pages exist on web only | Add campaign management to mobile provider dashboard |
| 7.5 | `app/api/cron/` (7 routes) | — | **Medium** | All cron job routes are web-only — mobile has no equivalent background task scheduling | Add Flutter background fetch for mobile equivalent tasks |
| 7.6 | `app/api/webhooks/razorpay/route.ts` | — | **Medium** | Razorpay webhook is web-only — mobile has no webhook processing | Mobile uses Razorpay Flutter SDK in-app; ensure parity for refund callbacks |
| 7.7 | `app/legal/`, `app/contact/`, `app/terms/` | — | **Low** | Static legal/contact pages exist on web only — mobile has no equivalent | Add links to web-hosted versions or implement in mobile |
| 7.8 | `mobile/lib/shared/components/` vs `widgets/` | — | **Low** | Mobile has two overlapping directories (`components/` and `widgets/`) with duplicated patterns | Consolidate into one directory |
| 7.9 | Password policy | (see 1.9) | **Medium** | Web requires 6+ chars; mobile requires 8+ chars with letters+numbers | Align both to same policy |
| 7.10 | Auth flows | (see 1.14, 1.16) | **Medium** | Mobile has Phone OTP, Google, Apple sign-in — web only has email OTP | Add social sign-in options to web |

---

## 8. CODE HEALTH

| # | File | Line | Severity | Finding | Suggested Fix |
|---|---|---|---|---|---|
| 8.1 | — | — | **Info** | `npx tsc --noEmit` — **0 errors** | — |
| 8.2 | — | — | **Info** | `cd mobile && dart analyze` — **0 issues found** | — |
| 8.3 | — | — | **Info** | `npx next build` — timed out after 5 min (likely network-dependent); ESLint passed with no output | Run full build in CI to confirm |
| 8.4 | `docker-compose.yml` | 1-11 | **High** | YAML syntax error — `redis` service incorrectly structured (see 2.1) | Restructure to proper YAML hierarchy |
| 8.5 | `next.config.ts` | 167 | **Medium** | `images.unoptimized: true` globally disables Next.js image optimization | Remove unless there's a specific reason (e.g., Sharp dependency conflict) |
| 8.6 | `tsconfig.json` | 37-39 | **Low** | Includes `.next-dev/types/**/*.ts` (dev build artifacts) | Add `.next-dev` to exclude |
| 8.7 | `package.json` | — | **Low** | No `packageManager` field — CI may use different npm/pnpm version | Add `"packageManager": "npm@11"` or pin via `engines` |
| 8.8 | `mobile/lib/shared/components/` vs `widgets/` | — | **Low** | Two directories with overlapping concerns (see 7.8) | Consolidate |
| 8.9 | No shared types between web and mobile | — | **Low** | Web types (`lib/`) and mobile models (`mobile/lib/models/`) are duplicated independently | Generate shared types from Supabase schema or maintain a shared package |

---

## Recommended Priority Order

### P0 — Immediate (act today)
1. **Rotate all leaked credentials** (6.1) — `.env.local` committed with live AWS keys, Supabase service role, Firebase API key, Gemini API key, Resend API key
2. **Fix 4 Critical auth issues** (1.1, 1.2, 1.3) — in-memory OTP store breaks in serverless, mock KYC always passes, XSS-readable auth cookie
3. **Escrow leaks** (3.1-3.3, 5.1-5.2) — cancellations and admin refunds don't call Razorpay refund API

### P1 — This week
4. **Unprotected endpoints** (5.3-5.4, 6.2) — `release-funds` and `auto-payouts` have no auth; cron routes unprotected when secret unset
5. **Auto-payout stub** (3.7) — cron marks payouts complete without calling Razorpay

### P2 — This sprint
6. **Chat privacy & scaling** (4.1-4.3) — unfiltered message subscription leaks event data, global presence channel won't scale
7. **docker-compose YAML** (2.1, 8.4) — syntax error breaks deployment config
8. **Client-side payment metadata** (3.6, 5.6) — client can set `payment_status` on order creation

### P3 — Next sprint
9. **Cross-platform gaps** (7.x) — blocked users, offline support, campaign management, A/B tests
10. **Upload validation** (6.3-6.6) — add magic-byte verification to all upload endpoints
11. **Auth hardening** (1.4-1.8) — rate limiting, CSRF, session expiry, suspension check

### P4 — Backlog
12. **Code health** (8.5-8.9) — image optimization, tsconfig cleanup, shared types, packageManager
13. **Hardcoded content** (2.6-2.7) — society lists, covering areas should come from DB
14. **Minor parity items** (7.7-7.8) — legal pages, component directory consolidation
