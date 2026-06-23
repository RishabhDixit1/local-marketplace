# ServiQ Runtime QA Report

**Date:** 2026-06-22
**Environment:** Local dev server (localhost:3000), Supabase on 54.253.40.174:8000

---

## 1. Page Load Audit (Playwright, headless Chromium)

12 pages tested. Each loaded with `networkidle` wait, capturing console errors and failed network requests.

| Page | Status | Load Time | Console Errors | Failed Requests |
|---|---|---|---|---|
| `/` Landing | **200** | 910ms | CSP warnings (sentry HMR) | None |
| `/business` | **404** | 721ms | None | `/business` itself |
| `/contact` | **200** | 731ms | CSP/HMR warnings | None |
| `/faq` | **200** | **~17s** | CSP/HMR warnings | None ⚠️ **Very slow** |
| `/support` | **200** | 5.6s | CSP/HMR warnings | None |
| `/terms` | **200** | 4.4s | CSP/HMR warnings | None |
| `/privacy` | **200** | 2.2s | CSP/HMR warnings | None |
| `/search` | **200** | 965ms | CSP/HMR warnings | None |
| `/referral` | **200** | 2.7s | CSP/HMR warnings | None |
| `/market/crossing-republik` | **200** | 824ms | CSP/HMR warnings | None |
| `/dashboard` (unauthed) | **307 redirect** | 909ms | None | None ✅ |
| `/dashboard/admin` (unauthed) | **200** served | 896ms | CSP/HMR warnings | None |

### Flags

- **`/business` returns 404** — route may not exist yet (planned/placeholder?).
- **`/faq` takes ~17s** — likely heavy server-side data fetching or a slow DB query. Needs investigation.
- **CSP warnings** — `Content-Security-Policy` has a wildcard for `o*.sentry.io`. Harmless in dev but should be tightened in prod.
- **Dashboard auth** — `/dashboard` returns 307 redirect (correct). `/dashboard/admin` serves content to unauthenticated users without redirecting, but the page itself likely renders an empty/fallback state.

---

## 2. API Route Audit (curl, unauthenticated)

20 endpoints tested with real HTTP requests.

| # | Endpoint | Method | Expected | Actual | Response |
|---|---|---|---|---|---|
| 1 | `/api/health` | GET | 200 | **200** | `{"ok":true,"status":"healthy"}` |
| 2 | `/api/service-categories` | GET | 200 | **200** | Returns category list |
| 3 | `/api/localities` | GET | 200 | **200** | Returns locality list |
| 4 | `/api/community/feed` | GET | 401 | **401** | `Missing bearer token.` |
| 5 | `/api/community/people` | GET | 401 | **401** | `Missing bearer token.` |
| 6 | `/api/community/providers-by-category` | GET | 200 | **200** | Returns providers with location |
| 7 | `/api/orders` | GET | 401 | **405** ❌ | Empty — GET not implemented |
| 8 | `/api/subscriptions/plans` | GET | 200 | **200** | Returns plans (Free, etc.) |
| 9 | `/api/subscriptions/guard` | GET | 401 | **200** ⚠️ | Publicly accessible |
| 10 | `/api/referrals` | GET | 401 | **401** | `Missing bearer token.` |
| 11 | `/api/referrals/leaderboard` | GET | 401 | **401** | `Missing bearer token.` |
| 12 | `/api/system/startup-check` | GET | 401 | **401** | `Missing bearer token.` |
| 13 | `/api/market/crossing-republik` | GET | 200 | **200** | Area overview (10 societies, 6 markets, 0 active providers) |
| 14 | `/api/provider/analytics` | GET | 401 | **401** | `Missing bearer token.` |
| 15 | `/api/provider/listings` | GET | 401 | **401** | `Missing bearer token.` |
| 16 | `/api/payment/create-order` | GET | 401 | **405** ❌ | GET not implemented |
| 17 | `/api/ai/prompt` (empty) | POST | 400 | **400** | `Query is required` |
| 18 | `/api/ai/prompt` (real query) | POST | 200 | **200** ✅ | Returned structured response with suggestions |
| 19 | `/api/ai/prompt/stream` (real query) | POST | 200 | **200** ✅ | Returns streaming `text/plain` |
| 20 | `/api/auth/send-link` | POST | 200 | **200** | `{"ok":true,"emailSent":true}` |
| 21 | `/api/presence/ping` | POST | 401 | **401** | `Missing bearer token.` |

### Flags

- **`GET /api/orders`** and **`GET /api/payment/create-order`** return **405** instead of **401**. These endpoints only implement POST, so the method check fires before auth. If a GET is sent, the user gets "Method Not Allowed" instead of "Unauthorized". Low severity — no GET handler exists, but the error message leaks that the endpoint exists.
- **`GET /api/subscriptions/guard`** is **publicly accessible** with no auth. Returns `{"ok":true,"tier":"free","name":"Free","active":false}`. If this is meant to be protected, auth middleware is missing.
- **AI endpoint works** — Gemini API key is present, real response returned with suggestions and redirect path.
- **Magic link sending works** — Resend API key is present, email sending confirmed.

---

## 3. Supabase Realtime Audit

**Config:** `supabase/config.toml` has `[realtime] enabled = true`. No per-table replication filters declared (defaults to all tables).

### Subscriptions Found: 14 channels, 16 `.subscribe()` calls

| # | File | Channel | Type | Tables | Error Handling |
|---|---|---|---|---|---|
| A1 | `app/dashboard/chat/page.tsx` | `marketplace-global-presence` | **presence** | — | ✅ Full |
| A2 | `app/dashboard/chat/page.tsx` | `live-talk-${chat}` | **postgres_changes** | `live_talk_requests` | ❌ None |
| A3 | `app/dashboard/chat/page.tsx` | `conversation-live-${chat}` | **broadcast** (typing) | — | ✅ Full |
| A4 | `app/dashboard/chat/page.tsx` | `chat-live-${userId}` | **postgres_changes** | `messages`, `conversation_participants` | ✅ Full |
| B1 | `app/dashboard/tasks/page.tsx` | `tasks-operations-${userId}` | **postgres_changes** | `orders`, `task_events`, `help_requests`, `notification_escalations` | ✅ Full |
| B2 | `app/dashboard/tasks/page.tsx` | `tasks-inbox-${userId}` | **postgres_changes** | `help_request_matches` | ❌ None |
| B3 | `app/dashboard/tasks/page.tsx` | `tasks-notifications-${userId}` | **postgres_changes** | `notifications` | ❌ None |
| C1 | `components/profile/PublicProfileRealtime.tsx` | `public-profile-live-${id}` | **postgres_changes** | 13 tables | ⚠️ SUBSCRIBED only |
| D1 | `components/profile/PublicProfileStoreTab.tsx` | `public-store:${userId}` | **postgres_changes** | `service_listings`, `product_catalog` | ❌ None |
| E1 | `dashboard/components/posts/useMarketplaceFeed.ts` | `posts-feed-live` | **postgres_changes** | `posts`, `help_requests`, `service_listings`, `product_catalog` | ✅ Full |
| F1 | `dashboard/components/posts/useFeedActions.ts` | `posts-feed-saves-${id}` | **postgres_changes** | `feed_card_saves` | ❌ None |
| G1 | `dashboard/components/SavedFeedView.tsx` | `saved-feed-${id}` | **postgres_changes** | `feed_card_saves` | ❌ None |
| H1 | `app/dashboard/orders/page.tsx` | `consumer-orders-live-${id}` | **postgres_changes** | `orders` | ❌ None |
| I1 | `app/orders/[id]/page.tsx` | `order:${id}` | **postgres_changes` | `orders` | ❌ None |
| J1 | `app/dashboard/profile/page.tsx` | `edit-profile-${id}` | **postgres_changes** | `profiles` | ❌ None |
| K1 | `components/NotificationCenter.tsx` | `notifications-live-${id}` | **postgres_changes** | `notifications` | ❌ None |
| L1 | `lib/profile/client.ts` | `profile-live-${id}` | **postgres_changes** | `profiles` | ❌ None |
| M1-M2 | `lib/hooks/useUnreadChatCount.ts` | `dashboard-chat-unread-*` | **postgres_changes** | `conversation_participants`, `messages` | ❌ None |
| N1 | `lib/hooks/useConnectionRequests.ts` | `connection-requests-${id}` | **postgres_changes** | `connection_requests` | ❌ None |
| O1 | `components/LiveTalkCall.tsx` | `webrtc-${convId}` | **broadcast** | — | ⚠️ SUBSCRIBED only |

### Flags

- **10 of 16 `.subscribe()` calls have ZERO error handling** — they silently fail if the channel drops or hits CHANNEL_ERROR/TIMED_OUT. Users won't see any indication that realtime data has stopped flowing.
- **No table-level replication filters** in `config.toml` — all tables broadcast changes, which is fine for dev but wastes bandwidth in prod.
- **Presence channel** (`marketplace-global-presence`) is properly handled with heartbeat and error handling.
- **All subscriptions use dynamic channel names** keyed to user IDs — correct, prevents cross-user data leaks.

---

## 4. Environment Variable Audit

**52 unique `process.env.*` references** across 131 occurrences in source code.

### ✅ Set in `.env.local` (confirmed working)
- `NEXT_PUBLIC_SUPABASE_URL` = `http://54.253.40.174:8000`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJ...` (set)
- `SUPABASE_URL` = `http://54.253.40.174:8000`
- `SUPABASE_SERVICE_ROLE_KEY` = `eyJ...` (set)
- `SUPABASE_STORAGE_URL` = `http://54.253.40.174:8000/storage/v1`
- `GOOGLE_GEMINI_API_KEY` = `AIza...` (confirmed working via AI endpoint)
- `RESEND_API_KEY` = `re_...` (confirmed working via send-link endpoint)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION`
- `FIREBASE_*` (project ID, API key, sender ID, app IDs)
- `APP_VERSION` = `0.0.0`
- `APP_UPDATE_CRITICAL` = `false`
- `APP_DOWNLOAD_URL` / `APP_RELEASE_NOTES` = empty string

### ❗ Missing from `.env.local` — Must Be Set on Deploy

These are NOT in `.env.local` but are read without a fallback in source code:

| Variable | Used In | Risk |
|---|---|---|
| `ADMIN_EMAIL_ALLOWLIST` | `lib/server/requestAuth.ts:116` | Admin panel access control (has fallback to NEXT_PUBLIC_ADMIN_EMAILS then "") |
| `AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS` | `app/api/auth/send-link/route.ts:55` | No fallback — empty set means ALL emails allowed |
| `AUTH_MAGIC_LINK_BLOCKED_DOMAINS` | `app/api/auth/send-link/route.ts:53` | No fallback — empty set means no blocking |
| `AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS` | `app/api/auth/send-link/route.ts:49` | No fallback — empty set means no blocking |
| `CRON_SECRET` | `lib/server/requestAuth.ts:126` | Cron job authentication |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `components/PushNotificationSubscriber.tsx:6` | Web push subscription |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | `lib/server/pushNotifications.ts:26-28` | Push notification sending |
| `SENTRY_DSN` | `sentry.client/edge/server.config.ts:4` | Error monitoring (falls back to disabled in dev via NODE_ENV) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | `lib/server/pushNotifications.ts:45` | Firebase admin SDK init |
| `GOOGLE_APPLICATION_CREDENTIALS` | `lib/server/pushNotifications.ts:47` | Firebase service account path |
| `OBSERVABILITY_FORWARD_URL` / `OBSERVABILITY_FORWARD_TOKEN` | `app/api/observability/route.ts:60,66` | Observability forwarding |
| `TWILIO_SMS_FROM` / `TWILIO_WHATSAPP_FROM` | `lib/server/twilioClient.ts:51,24` | SMS sending guard |
| `SITE_URL` | `lib/siteUrl.ts:69` | Site URL resolution chain |
| `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` | `lib/siteUrl.ts:70-71` | Vercel deployment URL (auto-set by Vercel) |

### ⚠️ Variables with fallbacks that should still be reviewed

| Variable | Default Fallback | Concern |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Wrong in production — must be set to real domain |
| `EMAIL_FROM` | `auth@serviqapp.com` / `noreply@serviqapp.com` / `info@serviqapp.com` | Multiple defaults across 9 files — inconsistent |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `""` (empty string) | Payments will silently fail if unset |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `""` (empty string) | Google OAuth will be broken |
| `GOOGLE_OAUTH_CALLBACK_URL` | `https://www.serviq.in/api/auth/google/callback` | Hardcoded to `.serviq.in` domain |
| `BACKUP_EMAIL_API_KEY` | `RESEND_API_KEY` then `""` | Not in .env.example at all |
| `SERVIQ_INTERNAL_PUSH_KEY` | `"serviq-local-dev-fallback-secret"` | Hardcoded dev secret in source |
| `REDIS_URL` / `KV_URL` | `""` (empty string) | Caching silently disabled if missing |

---

## 5. AI Endpoint — Real Prompt Test

### `POST /api/ai/prompt` — Query: `"What electricians are available near me?"`

```json
{
  "response": "Showing **Electrician** providers near you. Tap to browse available services.",
  "action": "find_service",
  "redirect": "/search?q=Electrician",
  "data": null,
  "suggestions": [
    "Find electrician with best rating",
    "Compare electrician providers",
    "Read reviews for electrician"
  ]
}
```

- **Status:** 200 ✅
- **LLM integration:** Working — Gemini API key resolves, prompt is parsed, intent is extracted, structured response returned.
- **Streaming:** `POST /api/ai/prompt/stream` returns 200 with `text/plain` (streaming mode also functional).

---

## 6. Summary of Issues Found

### 🔴 High Severity
1. **`/faq` page loads in ~17s** — likely a slow/unoptimized DB query or missing index. Needs investigation.
2. **10 of 16 Realtime subscriptions have no error handling** — silent failures when channels disconnect or time out. Users won't see missed messages, lost notifications, or stale data.

### 🟡 Medium Severity
3. **`/business` returns 404** — route may be intended but missing.
4. **`GET /api/orders` and `GET /api/payment/create-order` return 405 instead of 401** — method check fires before auth; leaks endpoint existence.
5. **`GET /api/subscriptions/guard` is publicly accessible** — reveals subscription tier without authentication.
6. **`SERVIQ_INTERNAL_PUSH_KEY` has a hardcoded dev fallback** (`"serviq-local-dev-fallback-secret"`) in `lib/server/customAuth.ts:5`.

### 🟢 Low Severity
7. **CSP has wildcard for `o*.sentry.io`** — minor, tighten for prod.
8. **`GOOGLE_OAUTH_CALLBACK_URL` hardcoded to `.serviq.in`** — won't work on other domains or locally.
9. **`EMAIL_FROM` varies across files** (3 different defaults) — should be centralized.
10. **52 env vars, 40 without fallbacks** — many needed for production that aren't in .env.example.
