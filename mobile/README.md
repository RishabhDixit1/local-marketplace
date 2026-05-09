# ServiQ Mobile

Flutter app for the ServiQ customer and provider experience.

Business domain: https://www.serviqapp.com

## What Exists Right Now

- App shell with bottom navigation: Feed, Inbox, Tasks, Profile
- Mobile setup screen with environment status
- Supabase bootstrap for auth and session management
- Mobile auth with email OTP, Google via Supabase OAuth, and in-app password setup
- Authenticated feed client calling the existing Next.js route at `/api/community/feed`
- Intentional card layouts for media-rich vs text-only feed posts
- Provider launchpad and listing manager for profile publishing, services, products, images, price, stock, and pause/resume
- Deal room quote drafting/sending/acceptance from Tasks and Chat
- Mobile checkout and order detail flows with COD/Razorpay SDK handoff, payment verification, payment status, and fulfillment notes
- Firebase Messaging token registration, notification tap routing, Crashlytics, and Firebase Analytics hooks
- Mobile CI workflow for Flutter analyze and tests

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

## Android Setup

### 1. Install Android tooling

Install Android Studio, then open:

```text
Android Studio -> Settings -> Languages & Frameworks -> Android SDK
```

Install:

- Android SDK Platform
- Android SDK Platform-Tools
- Android SDK Command-line Tools
- Android Emulator

Then accept licenses:

```bash
cd mobile
flutter doctor --android-licenses
flutter doctor
```

### 2. Create or start an emulator

In Android Studio:

```text
Tools -> Device Manager -> Create Device
```

Pick a recent Pixel profile and a recent Android image. Start it, then confirm Flutter sees it:

```bash
flutter devices
```

The default helper script expects:

```text
emulator-5554
```

If your emulator id is different, pass it with `--device`.

### 3. Run the app on an Android emulator

From the repo root, start the web/API server:

```bash
npm run dev
```

In another terminal:

```bash
bash scripts/run-mobile.sh --device emulator-5554 --api-base-url http://10.0.2.2:3000
```

Important: `10.0.2.2` is Android emulator-only. It means "the host laptop" from inside the emulator. Do not build APKs for real phones with `10.0.2.2`.

### 4. Run the app on a physical Android phone

On the phone:

1. Enable Developer Options.
2. Enable USB debugging.
3. Connect the phone by USB.
4. Trust the computer when Android asks.

Then:

```bash
flutter devices
bash scripts/run-mobile.sh --device <android-device-id> --api-base-url https://www.serviqapp.com
```

If you need to test against your local laptop server from a phone, use your laptop LAN IP instead of `10.0.2.2`, for example:

```bash
bash scripts/run-mobile.sh --device <android-device-id> --api-base-url http://192.168.1.25:3000
```

The laptop and phone must be on the same Wi-Fi, and the local server must be reachable from the phone.

### 5. Android auth redirect setup

The native mobile callback is:

```text
serviq://auth-callback
```

Add it in Supabase:

```text
Supabase Dashboard -> Authentication -> URL Configuration -> Redirect URLs
```

Also keep the web callback:

```text
https://www.serviqapp.com/auth/callback
```

### 6. Firebase on Android

Firebase is optional for basic local app loading. For push notifications, Crashlytics, and Analytics, add:

```text
mobile/android/app/google-services.json
```

When that file exists, the Android Gradle build applies Google Services and Crashlytics plugins. Keep real Firebase config files out of public commits unless the team has agreed they are safe for this repo.

### 7. Android release signing

For internal testing, Flutter can build an installable APK without a release keystore. For Play Store or wider distribution, create a release keystore and configure:

```text
mobile/android/key.properties
```

Start from:

```bash
cp android/key.properties.example android/key.properties
```

Example shape:

```properties
storePassword=replace-with-keystore-password
keyPassword=replace-with-key-password
keyAlias=serviq-release
storeFile=../release/serviq-release.keystore
```

Keep the real keystore and passwords out of git.

### 8. Build a shareable Android APK

Use the production business domain when building an APK for testers:

```bash
cd mobile
set -a
source ../.env.local
set +a
flutter build apk --release \
  --dart-define=APP_ENV=production \
  --dart-define=SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}" \
  --dart-define=SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --dart-define=API_BASE_URL="https://www.serviqapp.com" \
  --dart-define=AUTH_REDIRECT_SCHEME=serviq \
  --dart-define=AUTH_REDIRECT_HOST=auth-callback \
  --dart-define=ALLOW_BAD_CERTIFICATES=false
```

Output from the `mobile/` directory:

```text
build/app/outputs/flutter-apk/app-release.apk
```

From the repo root, the same file is `mobile/build/app/outputs/flutter-apk/app-release.apk`.

Optional handoff copy:

```bash
mkdir -p release/apk
cp build/app/outputs/flutter-apk/app-release.apk release/apk/serviq-mobile-$(date +%Y%m%d-%H%M).apk
shasum -a 256 release/apk/*.apk > release/apk/SHA256SUMS.txt
```

Only send the `.apk` file to Android testers. The checksum file is only for verification.

### 9. Install an APK manually

With ADB:

```bash
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

Or send the APK through a trusted channel. On the phone, Android may ask the tester to allow installs from that source.

If an older APK was signed with a different key, Android may refuse the update. For test devices only, uninstall the previous app first and install the new APK again.
 
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

For physical Android phones and shareable APKs, use `https://www.serviqapp.com` or another reachable deployed API URL.

Firebase can be supplied either with normal platform files
(`android/app/google-services.json` and `ios/Runner/GoogleService-Info.plist`)
or with dart defines:

```bash
flutter run \
  --dart-define=FIREBASE_API_KEY=... \
  --dart-define=FIREBASE_PROJECT_ID=... \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=... \
  --dart-define=FIREBASE_ANDROID_APP_ID=... \
  --dart-define=FIREBASE_IOS_APP_ID=...
```

## Verification Commands

```powershell
flutter analyze --no-pub
flutter test --no-pub
```

## Next Product Work

1. Treat `release/staging_scope_freeze.md` as the beta feature boundary.
2. Run `release/qa_checklist.md` on real Android and iOS devices.
3. Track every blocker or friction point in `release/friction_log.md`.
4. Fix only issues that block the frozen money loops, trust/safety, analytics,
   reliability, or release readiness.
5. Add production Firebase project files and release signing secrets outside git.
6. Capture final store screenshots after staging QA passes.
