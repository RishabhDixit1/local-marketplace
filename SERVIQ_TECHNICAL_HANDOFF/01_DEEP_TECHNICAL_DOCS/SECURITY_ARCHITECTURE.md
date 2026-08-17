# ServiQ Security Architecture

## 1. RLS-First Authorization

### 1.1 Design Principle
Every database table has Row Level Security (RLS) enabled. Authorization is enforced at the database level, not just the API layer. This means:
- Even if an API route has a bug, RLS prevents unauthorized data access
- Service role client bypasses RLS (intentional, for admin operations)
- All user-context queries go through RLS policies

### 1.2 Policy Types
1. **Own-user:** `auth.uid() = user_id` (most common)
2. **Conversation participant:** EXISTS check on `conversation_participants`
3. **Connection-gated:** EXISTS check on `connection_requests` with status = 'accepted'
4. **Admin-only:** `profiles.is_admin = true`
5. **Public-read:** `true` (no filter)
6. **Provider-owner:** `provider_id = auth.uid()`
7. **Composite key:** Multiple column checks (e.g., `requester_id` OR `recipient_id`)

---

## 2. Rate Limiting

### 2.1 Implementation
- **File:** `lib/server/rateLimit.ts`
- **Three-tier fallback:** Redis → Postgres → In-memory
- **Atomic upsert:** Prevents race conditions on concurrent requests

### 2.2 Rate Limit Configs
```typescript
const DEFAULT_CONFIG = { windowSeconds: 60, maxRequests: 30 };
const AUTH_ROUTE_CONFIG = { windowSeconds: 60, maxRequests: 10 };
const WRITE_ROUTE_CONFIG = { windowSeconds: 60, maxRequests: 20 };
```

### 2.3 Storage Schema
```sql
CREATE TABLE rate_limits (
  key text PRIMARY KEY,           -- "ratelimit:{identifier}:{route}"
  request_count integer NOT NULL DEFAULT 1,
  window_start integer NOT NULL,  -- Unix timestamp
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rate_limits_cleanup ON rate_limits(window_start);
```

### 2.4 Cleanup
- **Cron:** `cleanup_expired_rate_limits()` removes entries older than 2x window
- **In-memory:** Cleanup timer runs every 60 seconds, removes entries > 120s old

### 2.5 Response
```json
{
  "ok": false,
  "code": "RATE_LIMITED",
  "message": "Too many requests. Try again in 30 seconds."
}
```
Headers: `Retry-After: 30`, `X-RateLimit-Reset: <unix_timestamp>`

---

## 3. Content Moderation

### 3.1 AI Moderation
- **File:** `lib/ai/contentModeration.ts`
- **Checks:**
  - Profanity (12-word blocklist, strict/relaxed modes)
  - Phone number detection (regex pattern)
  - Email address detection (regex pattern)
  - URL-only messages (blocked)
  - Repetitive spam (5+ repeated characters)
  - Query length limit (1000 chars in strict mode)

### 3.2 Moderation Response
```typescript
type ModerationResult = {
  safe: boolean;
  reason?: string;        // "profanity", "phone number", etc.
  sanitized?: string;     // Redacted version of input
};
```

### 3.3 Application Points
- AI prompt endpoints (`/api/ai/prompt`)
- Chat messages (`/api/chat/messages`)
- Post publishing (`/api/posts/publish`)
- Need publishing (`/api/needs/publish`)
- Review submission

### 3.4 Listing Moderation
- **File:** `lib/server/fileValidation.ts`
- **Checks:** File type, file size, content-type validation
- **Admin review:** `admin_listings` table for moderation queue

---

## 4. HMAC Verification

### 4.1 Razorpay Webhooks
- **File:** `app/api/webhooks/razorpay/route.ts`
- **Verification:** HMAC SHA256 signature comparison
- **Timing-safe:** Uses `crypto.timingSafeEqual()` to prevent timing attacks
- **Header:** `X-Razorpay-Signature`

### 4.2 Verification Flow
```typescript
const crypto = require('crypto');

function verifyRazorpaySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 4.3 HMAC Secret
- **Env var:** `RAZORPAY_WEBHOOK_SECRET`
- **Never logged** or included in error messages
- **Rotation:** Update env var + Razorpay dashboard simultaneously

---

## 5. Idempotency Guards

### 5.1 Double-Refund Prevention
- **File:** `app/api/orders/[id]/route.ts`
- **Pattern:** Check if order already has a refund before creating one
- **Database:** `payments` table tracks refund status

### 5.2 Implementation
```typescript
// Before processing cancellation refund:
const { data: existingRefund } = await db
  .from('payments')
  .select('id, refund_id')
  .eq('order_id', orderId)
  .not('refund_id', 'is', null)
  .maybeSingle();

if (existingRefund) {
  return { ok: true, message: 'Refund already processed' };
}

// Process refund...
```

### 5.3 Background Job Double-Processing
- **File:** `lib/server/backgroundJobs.ts`
- **Pattern:** Atomic claim via `UPDATE ... WHERE status = 'pending'`
- **Verification:** Re-read status after claim to confirm ownership
- **Effect:** Prevents multiple instances from processing same job

---

## 6. Input Validation

### 6.1 Server-Side Validation
All API routes validate input before processing:
```typescript
// Example from /api/needs/publish
const { title, description, category } = body;

if (!title || typeof title !== 'string' || title.trim().length < 3) {
  return NextResponse.json({ ok: false, message: 'Title is required (min 3 chars)' }, { status: 400 });
}

if (!description || typeof description !== 'string' || description.trim().length < 10) {
  return NextResponse.json({ ok: false, message: 'Description is required (min 10 chars)' }, { status: 400 });
}
```

### 6.2 Validation Patterns
- **Required fields:** Check presence + type + minimum length
- **Email:** Regex validation + Supabase auth validation
- **Phone:** Digit count validation (10-15 digits)
- **UUID:** Format validation for entity IDs
- **Numbers:** `Number.isFinite()` checks
- **Enums:** Whitelist validation for status values

### 6.3 SQL Injection Prevention
- All queries use Supabase client (parameterized queries)
- No raw SQL with user input
- RPC functions use parameterized inputs

---

## 7. CORS Configuration

### 7.1 Next.js Config
```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Access-Control-Allow-Origin',
    value: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.serviqapp.com',
  },
  {
    key: 'Access-Control-Allow-Methods',
    value: 'GET, POST, PUT, DELETE, OPTIONS',
  },
  {
    key: 'Access-Control-Allow-Headers',
    value: 'Content-Type, Authorization, X-Cron-Secret',
  },
];
```

### 7.2 API Route CORS
```typescript
// Individual routes can override:
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
```

---

## 8. CSP Headers

### 8.1 Content Security Policy
```typescript
// next.config.js
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://*.supabase.co data: blob:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co https://api.stripe.com;
  frame-src 'self' https://js.stripe.com;
`;
```

### 8.2 Additional Security Headers
```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

---

## 9. Secret Management

### 9.1 Environment Variables
All secrets stored in environment variables, never in code:

| Variable | Purpose | Location |
|----------|---------|----------|
| `SUPABASE_URL` | Supabase project URL | Server |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Server + Client (NEXT_PUBLIC_*) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin key | Server only |
| `RAZORPAY_KEY_ID` | Razorpay public key | Server + Client |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key | Server only |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature verification | Server only |
| `GOOGLE_GEMINI_API_KEY` | Gemini AI API key | Server only |
| `TWILIO_ACCOUNT_SID` | Twilio account | Server only |
| `TWILIO_AUTH_TOKEN` | Twilio auth | Server only |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase admin | Server only |
| `SERVIQ_INTERNAL_PUSH_KEY` | Local JWT signing | Server only |
| `CRON_SECRET` | Cron endpoint auth | Server only |
| `ADMIN_EMAIL_ALLOWLIST` | Admin email list | Server only |

### 9.2 Security Rules
- **Never log** secret values
- **Never include** in error messages
- **Never commit** to git (`.env.local` in `.gitignore`)
- **Rotate** periodically (especially after team changes)
- **Minimum privilege:** Service role key only used where RLS bypass is needed

### 9.3 Client-Side Exposure
Only `NEXT_PUBLIC_*` variables are exposed to client:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_FIREBASE_*` (Firebase client config)

---

## 10. User Suspension & Blocking

### 10.1 User Suspension
```sql
ALTER TABLE profiles ADD COLUMN is_suspended boolean DEFAULT false;

-- Suspended users:
-- - Cannot authenticate (requestAuth returns 403)
-- - Cannot create content
-- - Cannot send messages
-- - Profile hidden from search
-- - Existing orders continue (graceful degradation)
```

### 10.2 Suspension Check
```typescript
// lib/server/requestAuth.ts
const { data: profile } = await admin
  .from('profiles')
  .select('is_suspended')
  .eq('id', data.user.id)
  .maybeSingle();

if (profile?.is_suspended === true) {
  return { ok: false, status: 403, message: 'Account suspended.' };
}
```

### 10.3 User Blocking
```sql
CREATE TABLE blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
```

### 10.4 Block Effects
- **Chat:** Blocked users cannot send messages to each other
- **Connections:** Blocked users cannot send connection requests
- **Profiles:** Blocked users' profiles are hidden from each other
- **Search:** Blocked users excluded from search results
- **Notifications:** Blocked users' notifications suppressed

### 10.5 Block Check
```typescript
// lib/server/chatGuards.ts
async function isBlocked(db: SupabaseClient, userId: string, targetId: string): Promise<boolean> {
  const { data } = await db
    .from('blocked_users')
    .select('id')
    .or(`and(blocker_id.eq.${userId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${userId})`)
    .maybeSingle();
  
  return !!data;
}
```

### 10.6 Test Account Flagging
```sql
ALTER TABLE profiles ADD COLUMN is_test boolean DEFAULT false;
CREATE INDEX idx_profiles_is_test ON profiles(is_test) WHERE is_test = true;

-- Test accounts:
-- - Excluded from search results
-- - Excluded from AI matching
-- - Excluded from community feed
-- - Flagged via admin API
-- - 10 accounts flagged in production
```
