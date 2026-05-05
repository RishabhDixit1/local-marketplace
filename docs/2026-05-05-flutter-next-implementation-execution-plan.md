# Flutter Next Implementation Execution Plan

Date: 2026-05-05  
Scope: ServiQ Flutter mobile app styling, UI/UX, screen logic, navigation behavior, reliability, and release readiness.

## Goal

Move the Flutter app from "feature-present" to "mobile-first and launchable":

- consistent ServiQ visual language across every screen
- clear customer/provider/business journeys
- polished home, explore, people, profile, cart, checkout, task, chat, and notification flows
- resilient async/error/empty states
- testable behavior for money-loop and trust-loop paths

This plan builds on:

- [`docs/2026-05-03-flutter-webapp-parity-premium-plan.md`](2026-05-03-flutter-webapp-parity-premium-plan.md)
- [`docs/2026-05-04-phase-0-parity-inventory.md`](2026-05-04-phase-0-parity-inventory.md)

## Current App Baseline

Already present:

- Flutter app under `mobile/`
- app shell with bottom navigation and authenticated routing
- sign-in, setup, welcome, explore, people, tasks, chat, profile, saved, notifications
- provider onboarding, launchpad, launchpad review, listings, provider profile
- create need, quote room, checkout, orders, order detail
- Riverpod, GoRouter, Supabase, Next.js mobile API client, Razorpay, Firebase Messaging/Analytics/Crashlytics
- initial design tokens and ServiQ design-system primitives
- widget/unit tests for shell contracts, auth/onboarding, launchpad, profile responsiveness, and notification models

Primary risk:

- the app has many surfaces, but visual hierarchy, navigation intent, state recovery, and workflow continuity are not yet consistently strong across all of them.

## Execution Principles

1. Work in vertical slices, not scattered polish.
2. Every slice must improve a real user loop: find help, earn nearby, set up business, chat/quote/pay, or track work.
3. Design-system work must immediately land on real screens.
4. No screen ships without loading, empty, error, refresh, and offline-ish recovery behavior.
5. Important flows need widget tests or repository tests before they are considered done.
6. Keep Flutter mobile-native where it is better than web parity, but document the difference.

## Phase 1: Visual System Completion

Objective: make every core screen feel like one app.

Files:

- `mobile/lib/core/theme/design_tokens.dart`
- `mobile/lib/core/theme/app_theme.dart`
- `mobile/lib/core/design_system/*`
- `mobile/lib/shared/components/*`
- `mobile/lib/shared/widgets/*`

Tasks:

- finish hardcoded color/spacing/radius sweep across `mobile/lib`
- standardize section headers, card titles, chips, status pills, metric tiles, buttons, banners, and bottom sheets
- introduce missing primitives:
  - `ServiqTopBar`
  - `ServiqBottomSheet`
  - `ServiqActionBar`
  - `TrustSnapshot`
  - `ServiqStepper`
  - `ServiqToast` or snackbar helper
- normalize touch targets to at least `AppTouchTargets.minimum`
- verify 320, 390, 430 logical widths for the main shell and dense cards

Acceptance:

- no random one-off visual language on core screens
- text remains readable at larger accessibility text sizes
- bottom nav, FAB, sheets, and cards do not overlap
- `flutter analyze --no-pub` and `flutter test --no-pub` pass

## Phase 2: Home, Explore, And People Rebuild

Objective: make discovery fast, trustworthy, and actionable.

Files:

- `mobile/lib/features/welcome/presentation/welcome_page.dart`
- `mobile/lib/features/feed/presentation/feed_page.dart`
- `mobile/lib/features/people/presentation/people_page.dart`
- `mobile/lib/shared/components/feed_card.dart`
- `mobile/lib/shared/components/provider_card.dart`
- `mobile/lib/features/feed/data/feed_interactions_repository.dart`
- `mobile/lib/features/people/data/people_repository.dart`

Tasks:

- rebuild welcome as a mobile command surface:
  - recommended next action
  - nearby trusted providers
  - urgent needs
  - saved/recent activity entry
  - provider/business setup nudge when relevant
- redesign feed cards with:
  - clear type label: need, service, product, provider
  - price/budget, distance/location, trust/status, creator, saved state
  - primary CTA plus compact secondary actions
  - hide/report flows that are easy but not noisy
- redesign provider cards with:
  - avatar/cover fallback
  - availability/presence
  - rating/trust/completion snapshot
  - services preview
  - connect/chat/open profile actions
- align saved interactions with the new saved hub route

Acceptance:

- a user can understand each card in under 3 seconds
- save/share/hide/report/chat/open actions work and recover on failure
- People screen has a clear reason to contact a provider
- add tests for card action mapping and critical widget states

## Phase 3: Auth, Onboarding, And First-Run Routing

Objective: make first open intentional instead of dashboard-shaped.

Files:

- `mobile/lib/features/auth/presentation/sign_in_page.dart`
- `mobile/lib/features/auth/presentation/setup_page.dart`
- `mobile/lib/features/auth/data/onboarding_handoff.dart`
- `mobile/lib/app/router/app_router.dart`
- `mobile/lib/features/profile/data/profile_repository.dart`

Tasks:

- tighten sign-in copy, trust strip, intent selector, and recovery states
- after auth, route by intent and profile readiness:
  - customer: welcome or create need
  - provider: provider onboarding or launchpad
  - business: launchpad
- add readiness banner from profile/account data
- persist and clear handoff state predictably
- ensure app resumes to the right route after browser auth, push notification taps, and cold start

Acceptance:

- new users never land on a confusing empty surface
- returning users go to their useful surface
- handoff state survives restart and clears after success
- tests cover route resolution for signed-out, signed-in, setup-required, and handoff states

## Phase 4: Profile, Provider, And Business Setup

Objective: turn profile from a form area into a command center.

Files:

- `mobile/lib/features/profile/presentation/profile_page.dart`
- `mobile/lib/features/profile/data/profile_repository.dart`
- `mobile/lib/features/provider/presentation/provider_onboarding_page.dart`
- `mobile/lib/features/provider/presentation/provider_launchpad_page.dart`
- `mobile/lib/features/provider/presentation/provider_launchpad_review_page.dart`
- `mobile/lib/features/provider/presentation/provider_listings_page.dart`
- `mobile/lib/features/provider/presentation/provider_profile_page.dart`
- `mobile/lib/features/provider/data/*`

Tasks:

- split profile into practical sections:
  - public identity
  - trust/readiness
  - saved/history shortcuts
  - business setup
  - settings/support
- make launchpad feel like Business AI:
  - progress stepper
  - generated business identity
  - offerings review
  - location/service area
  - publish checklist
- improve provider listings:
  - add/edit image, price, stock/availability, pause/resume
  - clearer validation and upload recovery
- make provider profile useful from People and feed cards

Acceptance:

- provider can go from incomplete profile to published listing without guessing
- profile shows the next best action based on readiness
- image/listing failures do not trap the user
- widget tests cover launchpad stepper, review, and listing empty/error states

## Phase 5: Cart, Checkout, Orders, And Money Loop

Objective: make the commerce path dependable.

Files:

- `mobile/lib/features/cart/application/cart_notifier.dart`
- `mobile/lib/features/cart/presentation/cart_sheet.dart`
- `mobile/lib/features/orders/presentation/checkout_page.dart`
- `mobile/lib/features/orders/presentation/orders_page.dart`
- `mobile/lib/features/orders/presentation/order_detail_page.dart`
- `mobile/lib/features/orders/data/order_repository.dart`
- `mobile/lib/features/orders/domain/order_models.dart`

Tasks:

- make cart sheet visible from storefront/provider/feed flows
- support add to cart, buy now, remove, quantity where relevant, and provider grouping if needed
- improve checkout summary:
  - item/provider details
  - payment method
  - fees/status copy
  - failure recovery
- harden Razorpay/COD order creation and verification states
- redesign orders list/detail as a timeline:
  - placed
  - accepted
  - payment
  - in progress
  - completed/cancelled
- connect order detail to chat, quote, provider, and task where available

Acceptance:

- manual money-loop passes on Android emulator and one real device
- order id is consistent across checkout, orders, detail, and tasks
- failed payment/order verification has a retry path
- repository tests cover order creation/verification mapping

## Phase 6: Tasks, Chat, Quotes, And Work Continuity

Objective: make work feel connected across surfaces.

Files:

- `mobile/lib/features/tasks/presentation/tasks_page.dart`
- `mobile/lib/features/tasks/presentation/task_board_components.dart`
- `mobile/lib/features/tasks/data/task_repository.dart`
- `mobile/lib/features/chat/presentation/chat_page.dart`
- `mobile/lib/features/chat/data/chat_repository.dart`
- `mobile/lib/features/quotes/presentation/quote_room_page.dart`
- `mobile/lib/features/quotes/data/quote_repository.dart`

Tasks:

- redesign task board tabs and task cards for scanability
- add task focus behavior from deep links and notifications
- show related chat/order/quote actions on task detail areas
- improve chat empty/thread/loading/error states
- make quote room clearly explain draft, sent, accepted, rejected, and expired states
- add optimistic send/retry behavior where safe

Acceptance:

- user can move from task to chat to quote/order and back without losing context
- notification deep links open the correct task/chat surface
- failed sends and quote actions are recoverable
- tests cover task focus routing and quote state rendering

## Phase 7: Saved, Notifications, Search, And Retention

Objective: make the app worth returning to.

Files:

- `mobile/lib/features/saved/presentation/saved_feed_page.dart`
- `mobile/lib/features/notifications/presentation/notifications_page.dart`
- `mobile/lib/features/notifications/data/notification_repository.dart`
- `mobile/lib/features/search/presentation/search_page.dart`
- `mobile/lib/core/firebase/mobile_push_notifications.dart`

Tasks:

- turn saved into a real library:
  - saved providers
  - saved needs/posts
  - saved products/services
  - continue actions
- group notifications by type and recency
- ensure notification taps route into focused surfaces
- improve search:
  - recent searches
  - provider/category chips
  - empty and no-results recovery
- add lightweight analytics events for save, search, notification open, and return actions

Acceptance:

- saved items can be opened and removed reliably
- notification taps work from foreground, background, and cold start where platform support allows
- search is usable on 320 width
- analytics names are consistent and documented

## Phase 8: Release Hardening

Objective: make the app shippable.

Files:

- `mobile/README.md`
- `mobile/test/*`
- `mobile/android/*`
- `mobile/ios/*`
- release docs under `mobile/release/` if present

Tasks:

- run full QA matrix on Android and iOS
- capture screenshots for 320, 390, 430 widths and real devices
- audit permissions, deep links, Firebase config, crash reporting, and release signing
- test poor network and app resume behavior
- check accessibility:
  - contrast
  - text scale
  - tap targets
  - labels for icon-only actions
- prepare store-ready known issues list

Acceptance:

- `flutter analyze --no-pub`
- `flutter test --no-pub`
- manual money-loop pass
- auth/login pass
- provider publish pass
- push/deep-link smoke pass
- no P0/P1 issues open

## Suggested Implementation Order

Sprint 1:

1. finish visual-system sweep
2. rebuild `feed_card.dart` and `provider_card.dart`
3. apply cards to Welcome, Explore, People
4. add tests for card action behavior

Sprint 2:

1. first-run routing polish
2. profile command center
3. launchpad review and publish polish
4. provider listing recovery states

Sprint 3:

1. cart sheet and checkout polish
2. order timeline
3. task/chat/quote continuity
4. money-loop QA

Sprint 4:

1. saved hub
2. notifications routing
3. search improvements
4. release hardening and screenshots

## Definition Of Done For Each Slice

- design tokens used instead of ad hoc styling
- loading, empty, error, refresh, and success states implemented
- analytics event added when action matters
- behavior verified on at least one compact width
- relevant widget/repository tests added or updated
- `flutter analyze --no-pub` and `flutter test --no-pub` pass

