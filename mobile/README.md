# ServiQ Mobile

Flutter app for the ServiQ customer and provider experience.

## What Exists Right Now

- App shell with bottom navigation: Feed, Inbox, Tasks, Profile
- Mobile setup screen with environment status
- Supabase bootstrap for auth and session management
- Mobile auth with email OTP, Google via Supabase OAuth, and in-app password setup
- Authenticated feed client calling the existing Next.js route at `/api/community/feed`
- Intentional card layouts for media-rich vs text-only feed posts

## Architecture

- Flutter app: Android and iOS client
- Supabase direct from mobile: auth, session, realtime-ready client
- Next.js APIs from mobile: feed and privileged workflows
- OpenAI: server-side only

## Step-By-Step Setup

1. Install Flutter.
2. Install Android Studio and/or Xcode.
3. Open the platform tool once so the SDK install completes.
4. Create and boot one simulator or emulator.
5. Start the local Next.js app from the repo root with `npm run dev`.
6. Sync the mobile config and run Flutter.

Open Android Studio once and install:
   - Android SDK
   - Android Emulator
   - Android SDK Command-line Tools
 
## Recommended Local Run

The repo already keeps the public Supabase values in the root `.env.local`. The helper scripts reuse those values, write `mobile/config/local.json` for debug IDE launches, and pass matching Flutter dart defines.

macOS / Linux:

```bash
bash scripts/run-mobile.sh
```

Android emulator override:

```bash
bash scripts/run-mobile.sh --device emulator-5554 --api-base-url http://10.0.2.2:3000
```

Sync config only, then launch from your IDE:

```bash
bash scripts/run-mobile.sh --sync-only
```

Windows PowerShell:

```powershell
.\scripts\run-mobile-android.ps1
```

Windows PowerShell sync-only:

```powershell
.\scripts\run-mobile-android.ps1 -SyncOnly
```

If your laptop sits behind corporate HTTPS inspection and Android shows
`CERTIFICATE_VERIFY_FAILED`, set this in the repo root `.env.local` before
running the PowerShell helper:

```text
MOBILE_ALLOW_BAD_CERTIFICATES=1
```

That flag is debug-only and only relaxes TLS validation for the configured
mobile hosts. It is meant for local emulator development on managed networks.

## Important Auth Note

The mobile app uses the Supabase Flutter client directly for sign-in.

Your current web route at `/api/auth/send-link` only accepts `http/https` callbacks back to `/auth/callback`, so it is not the correct native mobile sign-in path yet. That is why this app sends auth through Supabase directly with a native redirect URL like:

```text
serviq://auth-callback
```

This repo now registers that callback in Android and iOS project settings. Make sure Supabase Authentication -> Additional Redirect URLs includes the exact same callback.

If you want true email OTP in the mobile flow, make sure the Supabase email template includes `{{ .Token }}` so users receive a code they can type into the app. Google sign-in also uses the same callback when returning from the browser.
## Manual Dart-Define Fallback

```bash
flutter run \
  --dart-define=APP_ENV=development \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY \
  --dart-define=API_BASE_URL=http://localhost:3000 \
  --dart-define=AUTH_REDIRECT_SCHEME=serviq \
  --dart-define=AUTH_REDIRECT_HOST=auth-callback
```

For Android emulators, replace `http://localhost:3000` with `http://10.0.2.2:3000`.

## Verification Commands

```powershell
flutter analyze --no-pub
flutter test --no-pub test/widget_test.dart
```

## Next Product Work

1. Verify the native auth callback flow on a real Android device and later on iOS/macOS.
2. Connect realtime inbox and chat threads.
3. Expand the mobile task board with requester-side completion and decline flows.
4. Add the 2-step mobile composer for needs, services, and products.
5. Integrate push notifications with Firebase.
