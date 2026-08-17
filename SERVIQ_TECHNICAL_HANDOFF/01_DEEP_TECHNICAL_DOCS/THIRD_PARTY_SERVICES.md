# ServiQ Third-Party Services

## 1. Supabase

### 1.1 Overview
Self-hosted Supabase on AWS EC2 (not Supabase Cloud). All Supabase components run in Docker containers.

### 1.2 Components

| Component | Purpose | Port | Container |
|-----------|---------|------|-----------|
| GoTrue | Auth (JWT, OTP, OAuth) | 9999 | supabase-auth |
| PostgREST | REST API for Postgres | 3000 | supabase-rest |
| Kong | API Gateway | 8000 | supabase-kong |
| Postgres | Database | 5432 | supabase-db |
| Realtime | WebSocket subscriptions | 4000 | supabase-realtime |
| Storage | File uploads/downloads | 5000 | supabase-storage |
| Meta | Schema management | 8080 | supabase-meta |

### 1.3 Connection Details
```
Production URL: https://www.serviqapp.com (nginx proxies to Kong:8000)
Direct EC2: http://54.253.40.174:8000 (cleartext, internal only)
Supabase URL env: https://www.serviqapp.com (client appends /rest/v1, /auth/v1, etc.)
```

### 1.4 Key Configuration
- **Auth:** Email OTP, magic link, Google OAuth, phone SMS
- **Storage:** 5 public buckets (post-media, profile-avatars, listing-images, review-photos, chat-media)
- **Realtime:** 33 tables in publication for live updates
- **RLS:** Enabled on all tables with comprehensive policies

---

## 2. Razorpay

### 2.1 Integration Points

| Feature | API | Route |
|---------|-----|-------|
| Create order | `POST /orders` | `/api/payment/create-order` |
| Verify payment | HMAC signature | `/api/payment/verify` |
| Refund | `POST /payments/:id/refund` | `lib/server/razorpay.ts` |
| Subscriptions | `POST /subscriptions` | `/api/subscriptions/*` |
| Webhooks | Signature verification | `/api/webhooks/razorpay` |

### 2.2 Environment Variables
```
RAZORPAY_KEY_ID=rzp_test_xxx (or rzp_live_xxx)
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
RAZORPAY_MODE=test|live
```

### 2.3 Safety Guards
- **Key mode check:** `isRazorpayConfigured()` refuses to use live key in test mode and vice versa
- **HMAC verification:** Timing-safe comparison for webhook signatures
- **Idempotency:** Double-refund prevention via payment status check

### 2.4 Webhook Events Handled
- `payment.captured` → Mark order as paid, trigger fulfillment
- `payment.failed` → Mark order as payment_failed, notify user
- `subscription.activated` → Activate subscription
- `subscription.deactivated` → Deactivate subscription
- `refund.created` → Update payment record

---

## 3. Google Gemini

### 3.1 Integration
- **File:** `lib/ai/provider.ts`
- **SDK:** `@ai-sdk/google` (Vercel AI SDK)
- **Model:** `gemini-2.0-flash` (default)
- **API Key:** `GOOGLE_GEMINI_API_KEY`

### 3.2 Use Cases

| Use Case | Function | Input | Output |
|----------|----------|-------|--------|
| Intent parsing | `parseIntentBest()` | User query | ParsedIntent |
| AI response | `generateTextResponse()` | Query + context | Response text |
| Quote drafting | `draftQuote()` | Help request details | Quote amount + description |
| Content moderation | Not used (keyword-based) | - | - |
| Pricing insights | `generatePricingInsights()` | Category + market data | Price recommendations |
| Launchpad generation | `generateLaunchpad()` | Business description | Listing drafts |

### 3.3 Fallback
- **When:** Quota exhausted, timeout, network error
- **To:** Keyword-based regex parser (`lib/ai/intentParser.ts`)
- **Degradation:** No semantic understanding, exact category matches only

### 3.4 Quota
- **Free tier:** 0 requests/day (exhausted as of Aug 2026)
- **Paid tier:** Available but requires billing setup (founder decision)

---

## 4. Firebase

### 4.1 Components Used

| Component | Purpose | Status |
|-----------|---------|--------|
| FCM | Push notifications (mobile) | Active |
| Analytics | Event tracking | Active |
| Crashlytics | Crash reporting (mobile) | Active |
| Performance | Performance monitoring | Active |
| Remote Config | Feature flags (mobile) | Not integrated |

### 4.2 Mobile Configuration
```dart
// Firebase options (from dart-define in release builds)
FIREBASE_API_KEY=xxx
FIREBASE_PROJECT_ID=xxx
FIREBASE_MESSAGING_SENDER_ID=xxx
FIREBASE_ANDROID_APP_ID=xxx
FIREBASE_IOS_APP_ID=xxx
```

### 4.3 Server Configuration
```
FIREBASE_SERVICE_ACCOUNT_JSON=xxx (JSON string)
FIREBASE_PROJECT_ID=xxx
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### 4.4 Analytics Events
- `app_open_mobile` — App launched
- `screen_view` — Screen navigated
- `home_first_engagement` — First interaction on home
- `home_intent_chosen` — Role intent selected
- `ai_query_sent` — AI search query

### 4.5 Crashlytics
- `FlutterError.onError` → records Flutter errors
- `runZonedGuarded` → records async errors
- `PlatformDispatcher.onError` → records platform errors
- **Note:** Only works in release builds (`!kDebugMode`)

---

## 5. Sentry

### 5.1 Web Error Tracking
- **SDK:** `@sentry/nextjs`
- **DSN:** Configured via `SENTRY_DSN` env var
- **Features:** Error capture, performance monitoring, release tracking

### 5.2 Integration Points
```typescript
// lib/server/errorHandler.ts
Sentry.captureException(error, {
  tags: { route: context.route, action: context.action },
  user: { id: context.userId },
  extra: context.metadata,
});

// lib/server/rateLimit.ts
Sentry.captureException(err, {
  tags: { feature: 'rate-limit' },
  extra: { key },
});
```

### 5.3 Environment
- **Production:** Enabled (`NODE_ENV === 'production'`)
- **Development:** Disabled
- **Sample rate:** 100% for errors, 10% for performance

---

## 6. Twilio

### 6.1 SMS
- **File:** `lib/server/sms.ts`
- **Client:** `twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)`
- **Messaging Service:** `TWILIO_MESSAGING_SERVICE_SID`
- **Use cases:** OTP delivery, order updates, review reminders

### 6.2 WhatsApp (Partial)
- **File:** `lib/server/twilioClient.ts`
- **API:** `sendWhatsApp(phone, message)`
- **Status:** Schema exists, templates defined, sending partially implemented
- **Templates:** 10 events × 2 roles (consumer/provider)

### 6.3 Environment Variables
```
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_MESSAGING_SERVICE_SID=xxx
```

---

## 7. SendGrid

### 7.1 Email Service
- **File:** `lib/email.ts`, `lib/emailConfig.ts`
- **Purpose:** Transactional emails (OTP, magic link, weekly digest, review reminders)
- **Templates:** Minimal — mostly plain text with Supabase-generated emails

### 7.2 Limitations
- Limited template coverage (most emails from Supabase GoTrue)
- No custom email templates for marketing
- Backup provider: `lib/server/backupEmailProvider.ts`

---

## 8. WhatsApp Business API

### 8.1 Status
- **Schema:** `user_settings.whatsapp_notifications` column exists
- **Templates:** 10 event templates in `lib/server/whatsappNotifications.ts`
- **Sending:** Via Twilio WhatsApp API
- **Implementation:** Partial — schema + templates exist, not fully wired

### 8.2 Events Planned
```typescript
type NotificationEvent =
  | "help_request_match" | "new_quote" | "quote_accepted"
  | "order_confirmed" | "order_in_progress" | "order_completed"
  | "order_cancelled" | "payment_received" | "new_review" | "new_message";
```

---

## 9. Vercel

### 9.1 Web Hosting
- **Framework:** Next.js 16 (App Router)
- **Deployment:** Automatic from `main` branch
- **Domain:** `www.serviqapp.com`
- **SSL:** Automatic via Vercel

### 9.2 Configuration
- **Build command:** `npm run build`
- **Node.js version:** 20.x
- **Environment variables:** Set in Vercel dashboard
- **Edge functions:** Not used (standard serverless)

### 9.3 Limitations
- No edge runtime (all routes are Node.js runtime)
- Cold start on serverless functions (~200ms)
- No persistent connections (WebSocket via Supabase Realtime)

---

## 10. AWS EC2

### 10.1 Instance
- **Type:** t3.medium (or similar)
- **OS:** Amazon Linux 2
- **Region:** ap-southeast-1 (Singapore)
- **IP:** 54.253.40.174

### 10.2 Services Running
- **Supabase:** All components (Docker Compose)
- **Nginx:** Reverse proxy + TLS termination
- **Docker:** Container runtime

### 10.3 Nginx Configuration
```
www.serviqapp.com → :3000 (Next.js, Vercel handles this)
supabase.serviqapp.com → Kong:8000 (not configured yet)
Realtime → Kong:8000 (websocket upgrade headers)
```

### 10.4 TLS
- **Let's Encrypt** certificates for `www.serviqapp.com`
- **Auto-renewal** via certbot
- **Caddy TLS** script exists but NOT applied (`scripts/setup-ec2-tls.sh`)

---

## 11. S3

### 11.1 Backup Storage
- **Bucket:** Configured via `BACKUP_S3_BUCKET` env var
- **Workflow:** `.github/workflows/backup-db.yml`
- **Schedule:** Daily at 02:30 UTC
- **Retention:** 30 days
- **Verification:** `.github/workflows/backup-verify.yml` checks newest backup < 27h old

### 11.2 Backup Process
```bash
# scripts/backup-db.sh
pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://$BACKUP_S3_BUCKET/backups/$(date +%Y%m%d).sql.gz
# Cleanup: remove backups older than 30 days
```

### 11.3 Restore Process
```bash
aws s3 cp s3://$BACKUP_S3_BUCKET/backups/20260815.sql.gz /tmp/restore.sql.gz
gunzip /tmp/restore.sql.gz
psql $DATABASE_URL < /tmp/restore.sql
```
