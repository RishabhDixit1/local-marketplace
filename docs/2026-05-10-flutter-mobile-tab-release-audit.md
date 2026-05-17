# Flutter Mobile Tab And Release Audit

Date: 2026-05-10

## Current Verification

- `flutter doctor -v`: no local tooling issues. Android SDK, Xcode, CocoaPods, emulator, and network checks are healthy.
- `flutter analyze --no-pub`: passes.
- `flutter test --no-pub`: passes.
- Existing Android APKs in `mobile/release/apk/` are universal APKs with `arm64-v8a`, `armeabi-v7a`, and `x86_64`.
- Existing Android APKs are signed with the Android debug certificate, not a stable release keystore.
- Existing Android APK metadata: package `com.serviq.serviq_mobile`, version `1.0.0+1`, min SDK 24, target SDK 36.
- Existing iOS archive in `mobile/release/ios/Runner.xcarchive` is unsigned. It has no team or signing identity, so it cannot be installed on iPhones or shared as a working IPA yet.

## 2026-05-10 Implementation Update

- Added `scripts/setup-mobile-android-keystore.sh` for local ignored release keystore generation.
- Added `scripts/build-mobile-android-release.sh` for repeatable signed APK/AAB builds with physical-device-safe API URLs.
- Updated Android Gradle release signing so release builds no longer fall back to the Android debug certificate.
- Generated a local ignored release keystore and `mobile/android/key.properties`.
- Built and verified a signed internal QA APK:
  - `mobile/release/apk/serviq-mobile-1.0.0-2026051010-internal-qa-20260510-1045.apk`
  - signing certificate DN: `CN=ServiQ, OU=Mobile, O=ServiQ, L=Bengaluru, ST=Karnataka, C=IN`
  - package `com.serviq.serviq_mobile`, version `1.0.0`, versionCode `2026051010`, min SDK 24, target SDK 36.
- Simplified Home's first screen with compact actions for Post Need, Find People, Work, and Inbox.
- Moved Home's attention board lower so the first viewport is less crowded.
- Updated Profile top actions to Business AI, Edit Profile, Inbox, and Orders.
- Renamed remaining "Deal room" user-facing labels to "Quote room."

Still blocked by external setup:
- Android physical-device install has not been run because no physical Android phones are connected.
- iOS signing/TestFlight still requires Apple Developer team access and a connected iPhone.

## Highest Priority Order

1. Fix tester distribution first.
   - Create a stable Android release keystore and stop shipping debug-signed release APKs.
   - Build Android test artifacts with production/staging `API_BASE_URL`, Supabase, Firebase, and Razorpay configuration supplied by dart defines.
   - Set up Apple Developer signing, archive with a real team/profile, and distribute iOS through TestFlight or Ad Hoc.

2. Run real-device smoke QA before changing more UI.
   - Fresh install, sign in, Home load, People load, Work load, Inbox load, You/Profile load.
   - Record device model, OS version, account, build checksum, and exact failure in `mobile/release/friction_log.md`.
   - Capture whether the failure is blank screen, setup screen, sign-in loop, API error, timeout, crash, or wrong route.

3. Declutter only the five core tabs.
   - Avoid adding new features until the customer/provider money loops pass.
   - Move secondary controls into sheets or the You/Profile command hub.
   - Keep first-screen actions tied to Post Need, Find People, Work, Inbox, Business setup, and Profile readiness.

4. Fix P0/P1 tab-loading problems.
   - Prioritize crashes, auth lockout, broken API config, blank tabs, broken deep links, and unusable primary actions.
   - Treat visual clutter as P2 unless it blocks a core action.

## Tab-By-Tab Findings

### Tab 1: Home

Current:
- Home is `WelcomePage`, with live marketplace summaries, surface tabs, feed cards, provider suggestions, readiness prompts, and shortcuts.
- It already has refresh, loading, error, empty, save, hide, report, share, and reply paths.

Problems:
- It feels crowded because it tries to be dashboard, feed, marketplace guidance, and provider/business prompt at once.
- Business AI setup appears as a prompt instead of a persistent primary command.
- If Home does not load on a real device, the likely causes are auth/session, Supabase bootstrap, API base URL, or `/api/community/feed`.

Next:
- Simplify the first viewport to one primary recommendation plus three compact actions: Post Need, Find People, Work/Inbox.
- Keep only one feed/provider preview block visible before scroll.
- Move Business AI setup to You/Profile as the persistent entry point, with only a small Home nudge when readiness is low.

### Tab 2: People

Current:
- People has search, provider cards, discovery summary, compare mode, and advanced filters inside a bottom sheet.
- Tests already cover that filters moved out of the main page.

Problems:
- Still visually dense when result cards carry too many badges/signals.
- Loading depends on `/api/community/people`; a bad API URL or signed-out session will make the tab fail.

Next:
- Keep the filter sheet pattern.
- Trim provider card metadata on compact widths to name, trust/availability, top service, and message/profile actions.
- During QA, log whether failures are API errors, empty data, or slow loading.

### Tab 3: Work

Current:
- Work has next-action hero, role/lane filtering in a sheet, task cards, deep-link focus support, quote room, and order links.
- Tests already cover that lane controls are behind filters.

Problems:
- It can still feel like a board inside a board: next-action hero, summary, lanes, role filters, task cards, details.
- It depends on both Supabase `orders` and Next `/api/tasks/help-requests`, so partial backend failures can break the tab.

Next:
- Make the default Work view "Needs action" only, with secondary lanes behind the filter sheet.
- Add a stronger partial-failure recovery path if orders load but help requests fail, or vice versa.
- Real-device test notification taps into Work from cold, background, and foreground states.

### Tab 4: Inbox

Current:
- Inbox route exists as the bottom tab and uses `ChatPage`.
- The main header now says Inbox, with grouped conversations and helpful empty/error states.

Problems:
- Some thread actions still use "Deal room" language, while the tab says Inbox and the quote screen says Deal room.
- Chat conversations load directly from Supabase tables, so missing RLS, missing session, or schema drift can look like "Inbox not loading."

Next:
- Rename user-facing "Deal room" labels to "Quote room" or "Quote & order" for consistency.
- Add a compact retry banner when conversation metadata partially fails.
- Real-device test direct chat from People, task-linked chat, and notification-linked chat.

### Tab 5: You / Profile

Current:
- Profile is now a command hub with top actions, metrics, business/account tiles, readiness, account info, and sign out.
- Existing tests cover 320/430 width and 160% text scale.

Problems:
- It is less broken than before, but still has many command tiles.
- The top action cluster currently prioritizes Public Profile, Edit Profile, Control/Business, and Orders; Inbox is lower in the hub.

Next:
- Make the top action cluster: Business AI/Control, Edit Profile, Inbox, Orders.
- Keep Public Profile, Saved, Trust, Notifications, and Settings as secondary hub tiles.
- Use You/Profile as the permanent home for Business AI setup instead of repeating that prompt heavily in Home.

## Android Distribution Fixes

Most likely reasons the APK does not run on other Android devices:

- The shipped APKs are debug-signed. If a tester has an older APK signed with another key, Android will reject update install until the old app is uninstalled.
- The app requires Android SDK 24 or newer. Android 6 or older cannot install it.
- Release config must be supplied by dart defines. Real phones cannot use emulator-only URLs like `10.0.2.2`.
- If the APK opens but tabs fail, the backend URL, Supabase redirect, auth session, or Firebase/Razorpay staging config may be wrong.

Next Android steps:

1. Create `mobile/android/key.properties` from `mobile/android/key.properties.example`.
2. Generate or store a stable release keystore outside git.
3. Build a signed internal APK/AAB with production or staging URLs.
4. Bump build number for every tester build.
5. Verify signature with `apksigner verify --print-certs`.
6. Install on a clean Android 360dp phone and a larger Android phone.
7. Log every failure in `mobile/release/friction_log.md`.

## iOS IPA / TestFlight Setup

APK files never run on iOS. iOS needs a signed `.ipa` or TestFlight build.

Next iOS steps:

1. Join or access the Apple Developer account.
2. Register bundle ID `com.serviq.serviqMobile`.
3. Add capabilities needed for the app, especially Push Notifications if FCM is required.
4. Add iOS Firebase config through dart defines or `GoogleService-Info.plist`.
5. In Xcode, open `mobile/ios/Runner.xcworkspace`.
6. Select Runner, choose the Apple Team, enable automatic signing for development.
7. Run on one connected iPhone first.
8. Archive with a distribution profile.
9. Upload to TestFlight for internal testers, or export an Ad Hoc IPA for registered device UDIDs.

## Immediate Implementation Queue

1. Create a signed Android tester build and verify it installs on two physical Android phones.
2. Set up iOS signing and get one physical iPhone running from Xcode.
3. Run the five-tab smoke checklist on both platforms.
4. Rename "Deal room" surfaces to consistent quote language.
5. Simplify Profile top actions so Business AI, Edit Profile, Inbox, and Orders are immediately visible.
6. Simplify Home first viewport and reduce repeated marketplace/business prompts.
7. Add partial-loading recovery to Work and Inbox if real-device QA shows backend/schema-specific tab failures.
