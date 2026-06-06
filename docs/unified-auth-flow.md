# Unified Auth Flow — Email + OTP Code

Both the **Next.js web app** and the **Flutter mobile app** use the same authentication mechanism: enter your email, receive an 8-digit code, and verify it to sign in.

## Architecture

```
User enters email
    │
    ▼
POST /api/auth/send-link  (custom Next.js API route)
    │
    ├── GoTrue admin.generate_link(type: "magiclink") → hashed_token + email_otp
    │
    └── Resend API sends email with:
        • "Sign In" button (magic link fallback)
        • 8-digit OTP code
    │
    ▼
User enters OTP code
    │
    ▼
supabase.auth.verifyOtp({ email, token, type: "magiclink" })
    │
    ▼
Session created → User redirected to dashboard (web) or profile (mobile)
```

### Why this approach

- **Phone OTP blocked** until DLT registration completes; email OTP is the temporary unified method.
- **Resend** is the sole working email provider (AWS SES not production-configured).
- Custom `/api/auth/send-link` route bypasses Supabase SMTP and uses Resend directly.
- GoTrue's `admin.generate_link()` generates the token + OTP; both web and mobile verify via `verifyOtp` with `type: "magiclink"`.

## Components

### Backend

| File | Purpose |
|---|---|
| `app/api/auth/send-link/route.ts` | Generates magic-link token via GoTrue admin API, sends email via Resend (or SES fallback). Returns `{ ok, emailSent, actionLink?, emailOtp? }`. |
| `app/api/auth/callback/route.ts` | Handles magic-link OAuth callback (when user clicks "Sign In" in email). |
| `app/api/mobile/account/route.ts` | Returns authenticated user's profile bundle (profile, sections, services, etc.). Requires Supabase session token. |

### Web App (Next.js)

| File | Purpose |
|---|---|
| `app/page.tsx` | Landing page with "Sign In" button → auth modal → email input → OTP verification. Uses `supabase.auth.verifyOtp()` with `type: "magiclink"`. `completeAuth()` handles post-login redirect. |
| `lib/supabase.ts` | Creates and caches the Supabase JS client (anon key from env). |
| `lib/profile/client.ts` | `ensureProfileForUser()` creates a local profile if missing; `resolveCurrentProfileDestination()` determines redirect target. |

### Mobile App (Flutter)

| File | Purpose |
|---|---|
| `mobile/lib/core/auth/mobile_auth_service.dart` | `sendEmailCode()` calls `POST /api/auth/send-link` (not Supabase native OTP). `verifyEmailCode()` calls `verifyOTP(type: OtpType.magiclink)`. |
| `mobile/lib/core/api/mobile_api_client.dart` | HTTP client that constructs API requests to the Next.js backend at `API_BASE_URL`. Adds Supabase Bearer token for authenticated requests. |
| `mobile/lib/features/auth/presentation/notifiers/auth_notifier.dart` | `AuthNotifier` manages `AuthFormState` (loading, error, OTP-sent flags). `sendEmailOtp()` and `verifyEmailOtp()` delegate to `MobileAuthService`. |
| `mobile/lib/features/auth/presentation/pages/login_page.dart` | Login UI with Email (default), Phone, Password tabs. Email tab: enter email → receive code → enter code → submit. |
| `mobile/lib/features/profile/data/profile_repository.dart` | `fetchProfile()` calls `GET /api/mobile/account` with the Supabase session. Returns `ProfileBundle`. |
| `mobile/lib/features/auth/data/onboarding_handoff.dart` | Determines `postAuthDestination` — where the user goes after login (market zones, home, etc.). |
| `mobile/lib/app/router/app_router.dart` | GoRouter config with auth‑redirect guards. Uses Supabase session from `appBootstrapProvider`. |

## Auth Flow Detail

### Step 1: Send Code

**Web** (`app/page.tsx`):
```
sendEmailLink()
  └── fetch("POST /api/auth/send-link", { email })
      └── On success → setOtpStep(true) → show OTP input
      └── On fallback → setMagicLinkData({ actionLink, emailOtp })
```

**Mobile** (`auth_notifier.dart` → `mobile_auth_service.dart`):
```
sendEmailOtp()
  └── _authService.sendEmailCode(email)
      └── apiClient.postJson("/api/auth/send-link", { email })
          └── On success → otpSent = true → show OTP input
```

### Step 2: Verify Code

**Web** (`app/page.tsx`):
```
verifyOtpCode()
  └── supabase.auth.verifyOtp({ email, token: code, type: "magiclink" })
      └── On success → completeAuth(user) → router.replace(dashboard)
```

**Mobile** (`auth_notifier.dart` → `mobile_auth_service.dart`):
```
verifyEmailOtp()
  └── _authService.verifyEmailCode(email, code)
      └── _client.auth.verifyOTP(type: OtpType.magiclink)
          └── On success → context.go(postAuthDestination)
```

### Step 3: Fetch Profile (Mobile)

After login, `ProfileRepository.fetchProfile()` is called:
```
fetchProfile()
  └── GET /api/mobile/account (with Bearer Supabase session token)
      └── Returns: { profile, roleFamily, sections, services, products, ... }
```

The response is used by `profileSnapshotProvider` (Riverpod) to hydrate the Profile UI.

## Key Decisions

| Decision | Rationale |
|---|---|
| Use custom magic-link backend (Resend) instead of `supabase.auth.signInWithOtp({ email })` | Bypasses Supabase SMTP; Resend is the configured working provider |
| Verify OTP with `OtpType.magiclink` | The token is generated via `admin.generate_link({ type: "magiclink" })` — type must match |
| Share single `/api/auth/send-link` endpoint between web and mobile | Avoids maintaining separate email-sending paths |
| Return `{ ok: true, emailSent: true }` without OTP when email succeeds | OTP is sent in the email; client does verification via Supabase client SDK |
| Keep `magicLinkData` fallback UI in web app | Handles dev environments where no email provider is configured |

## Environment Variables

| Variable | Used By | Purpose |
|---|---|---|
| `RESEND_API_KEY` | `/api/auth/send-link` | Resend API key for sending email (production: `re_d3ZxiST2_...`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Web + Mobile | Supabase project URL (`https://www.serviqapp.com`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web + Mobile | Supabase anon key for client-side auth operations |
| `SUPABASE_SERVICE_ROLE_KEY` | `/api/auth/send-link` | Service role key for GoTrue admin API calls |
| `API_BASE_URL` (mobile) | `mobile/config/local.json` | Android emulator → host: `http://10.0.2.2:3000` |
| `AUTH_MAGIC_LINK_BLOCKED_RECIPIENTS` | `/api/auth/send-link` | Comma-separated blocked email addresses |
| `AUTH_MAGIC_LINK_ALLOWED_RECIPIENTS` | `/api/auth/send-link` | Comma-separated allowed addresses (empty = allow all) |

## Rate Limiting

- **Cooldown**: 60 seconds between magic-link requests per email (configured via `MAGIC_LINK_COOLDOWN_MS` in `app/api/auth/send-link/cooldown.ts`).
- **Global rate limit**: Applied via `applyRateLimit()` with `AUTH_ROUTE_CONFIG` in `lib/server/rateLimit.ts`.
- **Resend rate limits**: Resend imposes its own limits (typically 100 emails/day on free tier, higher on production).

## Testing Locally

1. Start the Next.js dev server: `npm run dev` (port 3000).
2. Build & install the Flutter app: `flutter build apk --debug && adb install -r build/app/outputs/flutter-apk/app-debug.apk`.
3. Open the app on the emulator (auto-launched or tap the icon).
4. Enter your email → check your inbox for the code → enter it on the login page.
5. After verification, the app navigates to the handoff destination and fetches the profile via `GET /api/mobile/account`.

For the web app: open `http://localhost:3000` → tap "Sign In" → enter email → enter the code from your email.

## Deprecated Code

The old `supabase.auth.signInWithOtp({ email })` pattern (native Supabase email OTP via Supabase SMTP) has been replaced. The only remaining `signInWithOtp` call is in `sendPhoneOtp()` for SMS-based phone verification, which is a separate feature (requires DLT registration for production).
