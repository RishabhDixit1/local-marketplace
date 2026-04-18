# ServiQ Mobile Premium Upgrade Plan

## Audit Summary

### Current app entry and startup

- Flutter entry is [`mobile/lib/main.dart`](../mobile/lib/main.dart)
- Startup bootstraps `AppConfig`, optional debug TLS overrides, and Supabase through `AppBootstrap`
- App root is [`mobile/lib/app/app.dart`](../mobile/lib/app/app.dart)

### Navigation and route guards

- Routing uses `go_router` in [`mobile/lib/app/router/app_router.dart`](../mobile/lib/app/router/app_router.dart)
- Existing routes:
  - `/setup`
  - `/sign-in`
  - `/app/welcome`
  - `/app/explore`
  - `/app/people`
  - `/app/tasks`
  - `/app/profile`
  - `/app/create`
- Auth-aware redirect logic already exists and should be preserved

### State management

- `flutter_riverpod` is the active state layer
- Current state is mostly `FutureProvider` + page-local widget state
- Realtime invalidation is implemented per-page with manual Supabase channels
- There is no shared async-state UI abstraction yet

### Models and repositories

- The app already has typed Dart models for feed, people, tasks, and profile snapshots
- Repositories exist but are inconsistent:
  - `feed`, `profile`, `people`, `tasks`, `post_create`
- API handling is thin and duplicated
- Domain models are feature-local, which is fine, but repeated formatting and mapping logic should move into shared/core helpers where it improves reuse

### API and backend integration

- Mobile currently uses:
  - Supabase Flutter directly for auth and realtime
  - Next.js API routes for privileged workflows
- Working contracts already in use:
  - `/api/community/feed`
  - `/api/community/people`
  - `/api/mobile/account`
  - `/api/tasks/help-requests`
  - `/api/tasks/progress`
  - `/api/orders/:id`
  - `/api/needs/status`
  - `/api/needs/publish`
- Existing backend contracts also exist for chat:
  - `/api/chat/direct`
  - `/api/chat/messages`
- Notifications and chat data can also be read directly from Supabase tables already used by the web app

### Theme system

- Current theme is a single file: [`mobile/lib/core/theme/app_theme.dart`](../mobile/lib/core/theme/app_theme.dart)
- Good start, but design tokens are not formalized
- Many pages still hardcode colors, gradients, pills, borders, spacing, and loading/error states

### Repeated UI patterns and current gaps

- Repeated:
  - hero gradients
  - stat pills
  - metadata pills
  - card padding and borders
  - loading cards
  - empty/error cards
- Missing or incomplete:
  - reusable buttons and search field primitives
  - skeleton loaders
  - centralized error mapping
  - chat experience
  - notifications experience
  - search/discovery screen
  - provider onboarding surface
  - premium bottom navigation treatment
  - cross-feature trust badges and locality cues

### Screens needing the biggest upgrade

- Welcome/Home: functional but still MVP copy/layout
- Explore: good raw data, needs premium hierarchy and actions
- People: useful data but not yet a real provider discovery experience
- Tasks: useful workflow, needs better segmentation and state treatment
- Profile: rich data, but visually dense and missing clearer trust/onboarding framing
- Create Request: works, needs stronger form UX, preview, and success framing
- Inbox/Chat: still placeholder
- Notifications: not present in mobile shell

## Upgrade Strategy

### Phase A: foundation first

1. Add a real mobile design system:
   - color roles
   - spacing, radius, elevation, typography tokens
   - shared surfaces and buttons
2. Introduce shared async UI primitives:
   - loading shimmer
   - empty state
   - error state
   - section header
   - metric tile
   - trust badge
3. Centralize:
   - app errors
   - error-to-message mapping
   - formatting helpers
   - logging and analytics placeholders

### Phase B: shell and architecture cleanup

1. Keep Riverpod + go_router
2. Add better shared layout primitives and app shell
3. Add route constants and safer auth-aware navigation helpers
4. Reuse one API client provider instead of recreating clients repeatedly

### Phase C: core product surfaces

1. Upgrade Home into a true local discovery screen
2. Add Search/Discovery as a first-class screen
3. Upgrade Explore feed cards and action rows
4. Upgrade People into a provider directory with trust-first cards
5. Upgrade Create Request into a polished structured composer
6. Upgrade Profile into trust + readiness + activity

### Phase D: missing but existing-contract features

1. Implement mobile Notifications using the existing `notifications` table
2. Implement mobile Chat using:
   - `conversation_participants`
   - `messages`
   - `profiles`
   - `/api/chat/direct`
   - `/api/chat/messages`

### Phase E: quality

1. Add focused widget and unit tests for new shared primitives and key flows
2. Run `flutter analyze`
3. Run `flutter test`

## Implementation Constraints

- Preserve current working auth, feed, people, tasks, profile, and request-posting flows
- Keep the app runnable after each major step
- Prefer incremental refactors over large file churn
- Reuse existing backend contracts and Supabase tables rather than inventing mobile-only data paths
