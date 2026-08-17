# ServiQ Authentication & Authorization

## 1. Supabase Auth Integration

ServiQ uses Supabase Auth (GoTrue) for all authentication. Seven sign-in methods are supported:

### 1.1 Email OTP Code
- **Flow:** User enters email → `auth.signInWithOtp({ email })` → 6-digit code sent via email
- **Mobile:** Uses Supabase Flutter SDK `supabase.auth.signInWithOtp(email: email)`
- **Web:** Uses `supabase.auth.signInWithOtp({ email })` from `@supabase/ssr`
- **OTP storage:** `otp_codes` table with 5-minute TTL, max 3 attempts
- **Rate limit:** 5 OTP requests per email per 60 seconds

### 1.2 Magic Link
- **Flow:** User enters email → `auth.signInWithOtp({ email, options: { redirectTo } })` → Supabase sends magic link email
- **Web API route:** `POST /api/auth/send-link` triggers `supabase.auth.admin.generateLink()`
- **Verification:** `GET /api/auth/verify-link?token=xxx&type=magiclink` → sets session cookie
- **Redirect:** After verification, user is redirected to `/dashboard`

### 1.3 Google OAuth
- **Flow:** User clicks "Continue with Google" → redirects to Google consent → callback to `/api/auth/google/callback`
- **Server route:** `GET /api/auth/google` initiates, `GET /api/auth/google/callback` handles callback
- **Session:** After OAuth, Supabase creates/links user, sets session cookie
- **Profile sync:** On first login, Google name/photo are synced to `profiles` table

### 1.4 Apple Sign-In
- **Flow:** Apple OAuth via Supabase (configured in Supabase dashboard)
- **Mobile only:** Uses `supabase.auth.signInWithApple()` from Flutter SDK
- **Web:** Not implemented (Apple JS SDK not integrated)

### 1.5 Password Sign-In
- **Flow:** Email + password → `auth.signInWithPassword({ email, password })`
- **Mobile:** `supabase.auth.signInWithPassword(email: email, password: password)`
- **Web:** Same API
- **Note:** Password sign-up available but not primary flow (OTP is preferred)

### 1.6 Password Sign-Up
- **Flow:** Email + password + name → `auth.signUp({ email, password, options: { data: { full_name } } })`
- **Profile creation:** On signup, a trigger (`profiles_auto_insert`) creates a row in `profiles` table
- **Email confirmation:** Supabase sends confirmation email (configurable)

### 1.7 Phone SMS OTP
- **Flow:** Phone number → `auth.signInWithOtp({ phone })` → SMS code
- **Twilio:** SMS delivery via Twilio (`lib/server/sms.ts`)
- **Rate limit:** 3 OTP requests per phone per 60 seconds
- **Mobile:** Primary verification method for providers

---

## 2. Session Management

### 2.1 JWT Tokens
- **Access token:** Short-lived (1 hour), signed by Supabase GoTrue
- **Refresh token:** Long-lived (30 days), stored securely
- **Token format:** Standard JWT with `sub` (user ID), `email`, `aud` ("authenticated"), `role` ("authenticated")

### 2.2 Refresh Flow
- **Web:** Supabase SSR client handles refresh automatically via `@supabase/ssr`
- **Mobile:** `supabase.auth.onAuthStateChange()` listener triggers refresh
- **Server:** `requireRequestAuth()` in `lib/server/requestAuth.ts` validates token via GoTrue with 5-second timeout
- **Fallback:** If GoTrue is unreachable, falls back to local JWT verification using `SERVIQ_INTERNAL_PUSH_KEY` (HS256)

### 2.3 Local Auth Tokens
- **Purpose:** Fallback when GoTrue is unreachable (EC2 network issues)
- **Implementation:** `lib/server/customAuth.ts`
- **Signing:** HS256 with `SERVIQ_INTERNAL_PUSH_KEY` env var
- **Expiry:** 7 days (`SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60`)
- **Cookie:** Base64url-encoded JSON in Supabase auth cookie name (`sb-<project-ref>-auth-token`)
- **Security:** Tokens are server-side only, never exposed to client

### 2.4 Session Cookie
- **Name:** `sb-<supabase-project-ref>-auth-token` (via `getSupabaseAuthCookieName()`)
- **Flags:** `httpOnly: true`, `sameSite: "lax"`, `path: "/"`
- **Content:** Base64url-encoded JSON with `access_token`, `refresh_token`, `user` object
- **Max age:** 7 days

---

## 3. Server-Side Auth

### 3.1 Supabase Server Client
- **File:** `lib/server/supabaseClients.ts`
- **Three client types:**
  1. **Anon server client:** `createSupabaseAnonServerClient()` — for unauthenticated operations
  2. **User server client:** `createSupabaseUserServerClient(accessToken)` — for user-context operations (RLS applies)
  3. **Admin client:** `createSupabaseAdminClient()` — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS

### 3.2 Request Auth Middleware
- **File:** `lib/server/requestAuth.ts`
- **`requireRequestAuth(request)`:**
  1. Extracts Bearer token from `Authorization` header
  2. Calls `supabase.auth.getUser(accessToken)` with 5-second timeout
  3. Falls back to local JWT verification if GoTrue fails
  4. Checks `profiles.is_suspended` — returns 403 if suspended
  5. Returns `{ userId, email, accessToken, user }`

### 3.3 Admin Auth
- **`requireAdminAuth(request)`:**
  1. Calls `requireRequestAuth()` first
  2. Checks `isAdminEmail(email)` against `ADMIN_EMAIL_ALLOWLIST` env var
  3. Falls back to checking `profiles.is_admin = true` in database
  4. Returns 403 if neither check passes

### 3.4 Cron Auth
- **`verifyCronSecret(request)`:**
  1. Reads `x-cron-secret` header
  2. Compares to `CRON_SECRET` env var (constant-time comparison)
  3. Returns boolean

---

## 4. Mobile Auth

### 4.1 Supabase Flutter SDK
- **Initialization:** `Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey)`
- **Storage:** `FlutterSecureStorage` for tokens (encrypted on-device)
- **Pre-warm:** `FlutterSecureStorage` is pre-warmed during app init for faster Supabase bootstrap
- **Session refresh:** `supabase.auth.onAuthStateChange()` listener
- **Timeout:** 8-second session refresh timeout to prevent hung cold starts

### 4.2 Token Storage
- **Key:** `serviq_supabase_auth_token`
- **Encryption:** iOS Keychain / Android Keystore (via FlutterSecureStorage)
- **Refresh:** Automatic via Supabase Flutter SDK
- **Logout:** `supabase.auth.signOut()` clears all stored tokens

### 4.3 Offline Auth
- **Cached session:** Last valid session stored in FlutterSecureStorage
- **Offline behavior:** App shows cached data, network calls fail fast
- **Reconnection:** On connectivity restore, session refresh attempted

---

## 5. RLS Authorization Model

### 5.1 RLS-First Design
All database tables have Row Level Security enabled. RLS policies enforce access control at the database level, making authorization immune to API-layer bugs.

### 5.2 Policy Patterns
```sql
-- Own-user policy (most common)
CREATE POLICY "users_can_read_own_profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Conversation participant policy
CREATE POLICY "participants_can_read_messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = messages.conversation_id
      AND user_id = auth.uid()
    )
  );

-- Public read policy
CREATE POLICY "anyone_can_read_public_profiles" ON profiles
  FOR SELECT USING (true);

-- Admin-only policy
CREATE POLICY "admins_can_do_anything" ON profiles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = true
    )
  );
```

### 5.3 Service Role Bypass
- Admin client (`SUPABASE_SERVICE_ROLE_KEY`) bypasses all RLS
- Used for: background jobs, cron tasks, admin operations, user suspension checks
- **Never exposed to client-side code**

---

## 6. Admin Authorization

### 6.1 Admin Flag
- **Column:** `profiles.is_admin` (boolean, default false)
- **Set by:** Admin API route or direct database update
- **Check:** `requireAdminAuth()` in API routes + RLS policies for admin-only tables

### 6.2 Email Allowlist
- **Env var:** `ADMIN_EMAIL_ALLOWLIST` (comma-separated emails)
- **Priority:** Email allowlist is checked first, then `is_admin` flag
- **Use case:** Emergency admin access when DB is unreachable

### 6.3 Admin RLS Policies
```sql
-- Admins can read all profiles
CREATE POLICY "admins_read_all_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can update any profile
CREATE POLICY "admins_update_any_profile" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

---

## 7. API Key / Service Role Usage

### 7.1 Environment Variables
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...  (public, used in NEXT_PUBLIC_*)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (secret, server-side only)
```

### 7.2 Usage Rules
- **`SUPABASE_ANON_KEY`:** Safe for client-side (Next.js `NEXT_PUBLIC_*` prefix)
- **`SUPABASE_SERVICE_ROLE_KEY`:** Server-side only, never in client bundles
- **Admin client:** Created via `createSupabaseAdminClient()` which uses service role key
- **User client:** Created via `createSupabaseUserServerClient(token)` which uses anon key + user token

### 7.3 Security Guarantees
- Service role key is only in `lib/server/supabaseClients.ts`
- All server routes import from `lib/server/` (never from `lib/supabase.ts` which is client-side)
- RLS policies ensure even if service role key leaks, data access is controlled
- Environment variables are never logged or included in error messages
