# Mobile App Implementation Plan

## Goal

Build a Flutter mobile app for Android and iOS while keeping the current stack:

- Flutter for the customer/provider app
- Next.js for web, admin, ops, and secure server APIs
- Supabase for auth, database, realtime, storage, and RLS
- OpenAI only on the server
- Push notifications plus in-app notifications

This plan is designed for a first-time mobile build and assumes the current machine is Windows.

Important:

- Android development can start on Windows.
- iOS development and iOS release builds require macOS later.

## Architecture

```text
Flutter app
  -> Supabase client SDK for safe auth, realtime, and policy-protected reads
  -> Next.js API routes for privileged workflows

Next.js server layer
  -> validation
  -> moderation
  -> AI orchestration
  -> privileged write flows
  -> push token registration and notification orchestration

Supabase
  -> Auth
  -> Postgres
  -> Realtime
  -> Storage
  -> RLS policies
```

## Product Scope For MVP

The mobile MVP should not try to ship every web feature immediately.

Phase 1 mobile scope:

- Sign in / sign up
- Feed
- Post details
- Create request
- Media upload
- Chat
- Provider lead inbox
- Express interest / withdraw
- Notifications
- Profile

Keep web-first for now:

- Admin / ops
- Analytics-heavy screens
- Complex listing management
- Internal moderation tools

## Repo Plan

Keep mobile inside this repo first for speed:

```text
mobile/
  lib/
    app/
    core/
      api/
      auth/
      config/
      notifications/
      supabase/
      theme/
    features/
      auth/
      feed/
      post_create/
      chat/
      tasks/
      profile/
```

Why same repo first:

- Faster backend/mobile coordination
- Easier reuse of API knowledge
- Easier staged rollout while contracts are still changing

## Data Ownership Rules

Flutter can use Supabase directly for:

- Auth and session restore
- Realtime subscriptions
- In-app notification reads
- Safe profile reads
- Policy-protected chat reads and writes

Flutter must call Next.js APIs for:

- Aggregated feed views
- Publish workflows
- Need interest state changes
- Quote creation and sending
- Payments
- Moderation
- AI features
- Privileged workflows
- Push token registration

## Recommended Flutter Stack

- `supabase_flutter`
- `flutter_riverpod`
- `go_router`
- `freezed`
- `json_serializable`
- `dio` or `http`
- `cached_network_image`
- `image_picker`
- `firebase_core`
- `firebase_messaging`
- `firebase_crashlytics`
- `firebase_analytics`
- `firebase_performance`

## Implementation Phases

### Phase 0: Environment Setup

Outcome:

- Flutter works locally
- Android emulator works
- Project can run a blank Flutter app

Steps:

1. Install Flutter SDK on Windows.
2. Install Android Studio.
3. During Android Studio setup, install:
   - Android SDK
   - Android SDK Platform
   - Android Emulator
   - Android SDK Command-line Tools
4. Add Flutter to PATH.
5. Run `flutter doctor`.
6. Create one Android emulator and boot it.
7. Confirm `flutter doctor` is mostly green.

Notes:

- Do not block on iOS now.
- We will add macOS and iOS signing later.

### Phase 1: Project Scaffolding

Outcome:

- `mobile/` app exists
- environments are wired
- auth and API clients are initialized

Steps:

1. Create Flutter app in `mobile/`.
2. Add package dependencies.
3. Create `dev`, `staging`, and `prod` config.
4. Add Supabase initialization.
5. Add API client for Next.js route calls.
6. Add route/navigation shell.
7. Add theme tokens and shared UI primitives.

### Phase 2: Authentication

Outcome:

- User can sign in and stay signed in
- deep links work

Steps:

1. Implement email / OTP auth with Supabase.
2. Configure deep links.
3. Add session restore on app launch.
4. Add sign out.
5. Gate app routes by auth state.

### Phase 3: Feed and Detail Screens

Outcome:

- Customer/provider can browse the feed reliably

Steps:

1. Call server feed endpoints from Flutter.
2. Build feed card UI for:
   - text-only posts
   - media posts
   - needs
   - services
   - products
3. Build detail screen.
4. Add save/share/report hooks later if needed.

### Phase 4: Composer

Outcome:

- User can create a request from mobile

Steps:

1. Recreate the two-step composer flow.
2. Use server-validated media upload route.
3. Add image picker and preview.
4. Add location capture.
5. Submit through the existing publish routes.

### Phase 5: Chat and Provider Workflow

Outcome:

- Providers can respond fast
- customers can continue conversations in-app

Steps:

1. Build conversation list.
2. Build message thread.
3. Add realtime subscription.
4. Add provider lead inbox.
5. Add express interest, withdraw, and reopen flows.
6. Add quote entry points.

### Phase 6: Notifications

Outcome:

- Push drives re-engagement

Steps:

1. Set up Firebase project.
2. Add FCM to Flutter app.
3. Store device tokens server-side.
4. Trigger push from server workflows.
5. Add in-app notification center.
6. Add deep links from push into exact screens.

### Phase 7: Quality and Release

Outcome:

- stable internal beta

Steps:

1. Add Crashlytics.
2. Add Analytics events.
3. Add Performance Monitoring.
4. Test auth, chat, media, push, and offline recovery.
5. Release Android internal testing build.
6. Prepare iOS build on macOS.

## What You Need To Do Personally

These are the pieces only you or your team can finish:

### Accounts and Access

- Confirm Supabase project access
- Create or confirm Firebase project ownership
- Create Apple Developer account later for iOS release
- Create Google Play Console account later for Android release

### Product Decisions

- Final app name
- Android package name
- iOS bundle identifier
- App icon
- Splash screen
- Push notification copy style
- Which web features are mobile MVP vs later

### Infrastructure Decisions

- Decide the API base domains for:
  - dev
  - staging
  - production
- Decide deep link domain
- Decide if staging uses a separate Supabase project

## Retention Focus

The app will improve retention only if these loops are fast:

Provider retention loop:

- new lead arrives
- push lands instantly
- provider opens app
- replies or sends interest quickly

Customer retention loop:

- customer posts need
- sees provider response quickly
- can continue chat without friction
- gets order/progress updates without checking manually

Track these from day 1:

- D1 / D7 / D30 retention
- push opt-in rate
- first response time
- provider lead-to-interest conversion
- interest-to-quote conversion
- repeat request rate
- crash-free sessions
- app startup time

## Risks To Avoid

- Building mobile UI before backend contracts are stable
- Letting Flutter call privileged flows directly
- Delaying push notifications too long
- Shipping without analytics and crash monitoring
- Trying to perfect both Android and iOS at the same time
- Trying to match full web parity in v1

## Beginner-Friendly First Steps

Do only these first:

1. Install Flutter on Windows.
2. Install Android Studio with SDK + emulator.
3. Run `flutter doctor`.
4. Tell me the full output.

After that, I will guide you through:

1. creating the `mobile/` app,
2. connecting Supabase,
3. running the first emulator build,
4. building the auth flow.

## What I Should Do Next In This Repo

After your environment is ready, the next implementation tasks on my side should be:

1. Scaffold `mobile/` Flutter app.
2. Create environment config structure.
3. Add Supabase client bootstrap.
4. Add auth shell and protected routes.
5. Define server API contract map for mobile.
6. Build the first 3 screens:
   - splash / auth gate
   - sign in
   - feed
