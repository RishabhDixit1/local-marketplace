# ServiQ Flutter Billion Dollar Startup Grade UI/UX Dev Plan

Date: 2026-05-08
Owner: Product + Engineering
Status: Proposed execution plan
Scope: Flutter mobile app UI/UX, information architecture, data loading, marketplace flows, and release readiness

## Goal

Make the Flutter app feel like the primary ServiQ product, not a thin mobile
version of the web app. The app should open into useful live data, guide users
to the next action quickly, and make provider setup, inbox, work, cart, and
checkout feel complete, polished, and trustworthy.

The target is startup-grade quality:

- Clear first screen after sign-in.
- No blank core tabs.
- Less clutter on each tab.
- Every card has a clear job and primary action.
- Profile is a clickable command center, not a text info page.
- Business AI setup is a real control surface.
- Data shown in mobile matches the database and web product.
- Work, cart, checkout, quotes, and orders form one reliable money loop.

## Current Product Problems To Fix

1. Inbox tab can look empty
   - The bottom tab opens `ChatPage`, but the current zero state is too quiet.
   - If `chatConversationsProvider` returns an empty list or fails silently, the
     screen can appear as only a title and bottom nav.
   - The tab is named Inbox, while code and previous UI copy still carry
     "chat" or "deal room" concepts.

2. Other tabs are too cluttered
   - Home, People, Work, and You have dense surfaces competing for attention.
   - Filters, chips, summaries, and action cards are often stacked together.
   - Users need fewer decisions per screen and clearer drill-down pages.

3. Bottom nav needs stronger hierarchy
   - The current nav works, but it feels generic and cramped.
   - Badge, selected state, and primary action placement need more polish.
   - The FAB is useful, but it should feel intentional and contextual.

4. You/Profile is too much like a text information page
   - Profile has sections, but they are inline content blocks.
   - Users expect clickable pages: Edit Profile, Public Profile, Business
     Control, Listings, Trust, Payments, Settings, Help.
   - Profile should feel like an account and business cockpit.

5. Business AI setup needs a proper Control surface
   - `AppRoutes.control` exists, but no real route is wired in the shell.
   - Business AI setup is reachable through Profile/Launchpad, but not as a
     durable control center.
   - Providers need one place to see setup progress, listings, leads, trust,
     quote readiness, and next recommended actions.

6. Mobile is not loading all database-backed data
   - Mobile uses a mix of Next.js APIs and direct Supabase queries.
   - Key repositories rely on mobile-specific payloads:
     - `FeedRepository` -> `/api/community/feed`
     - `PeopleRepository` -> `/api/community/people`
     - `ProfileRepository` -> `/api/mobile/account`
     - `TaskRepository` -> Supabase `orders` + `/api/tasks/help-requests`
     - `ChatRepository` -> conversation/message APIs and Supabase realtime
   - Missing fields, auth header issues, RLS gaps, endpoint drift, and mapper
     defaults can all make the app look incomplete.

7. Work tab needs both UI and logic improvement
   - Current lane + role filters are functional but visually heavy.
   - Work needs a simple "What needs attention now?" top layer.
   - Each task should open a detail page with timeline, quote, payment, chat,
     proof, and next action.

8. Cards, cart, checkout, and order paths need conversion polish
   - Feed/provider cards need clearer CTAs and less noisy metadata.
   - Cart sheet is basic and needs stronger item, quantity, subtotal, and trust
     treatment.
   - Checkout needs a stepped flow, payment clarity, recoverability, and order
     confirmation polish.

## Product North Star

ServiQ mobile should feel like a local marketplace operating system.

For customers:

- Find trusted local help.
- Post a need.
- Chat and receive quotes.
- Checkout safely.
- Track work to completion.

For providers:

- Set up the business with AI guidance.
- Publish services/products.
- Receive leads.
- Quote fast.
- Fulfill work and manage orders.

## Information Architecture Decision

Keep five bottom tabs, but make each tab sharper:

1. Home
   - Personalized local feed and next best action.
   - Primary action: Post Need.
   - Secondary actions: Search, Saved, Orders.

2. People
   - Provider discovery, search, categories, filters in sheets.
   - Primary action: open provider or message.

3. Work
   - Active tasks, requests, quotes, orders, and fulfillment.
   - Primary action: resolve the next work step.

4. Inbox
   - Conversation threads, quote follow-ups, provider/customer messages.
   - Primary action: reply or open active thread.

5. You
   - Account, public profile, business control, trust, settings.
   - Primary action changes by role:
     - customer: complete profile or view orders
     - provider: open Business Control

Business Control should be a first-class route from You and provider prompts.
It can become a provider-mode bottom tab later if provider usage proves it
deserves that slot.

## Phase 0: Data And UX Audit

Timeline: 1 to 2 days

Goal: Prove exactly why tabs look blank or incomplete before redesigning.

Tasks:

- Add a temporary mobile debug diagnostics screen behind development builds:
  - current user id
  - API base URL
  - Supabase host
  - auth session status
  - last successful fetch per repository
  - failed endpoint, status code, and mapped message
- Create a mobile data contract inventory:
  - Home/feed expected fields
  - People/provider expected fields
  - Inbox/conversation expected fields
  - Profile/account expected fields
  - Work/task/order expected fields
  - Checkout/order expected fields
- Compare mobile payloads against web payloads and database schema.
- Add seeded staging data checklist:
  - one customer
  - one provider
  - one published service
  - one published product
  - one open help request
  - one conversation
  - one quote
  - one COD order
  - one Razorpay test order
- Capture before screenshots at 320, 390, and 430 logical widths:
  - Home
  - People
  - Work
  - Inbox
  - You
  - Business AI setup
  - Cart
  - Checkout

Acceptance criteria:

- We can explain every blank or sparse screen as either empty data, failed
  endpoint, RLS/auth issue, missing mobile mapper field, or UI empty-state gap.
- A signed-in test account shows deterministic data in all five tabs.
- Debug information never ships in production builds.

Primary files:

- `mobile/lib/core/api/mobile_api_client.dart`
- `mobile/lib/core/supabase/app_bootstrap.dart`
- `mobile/lib/features/feed/data/feed_repository.dart`
- `mobile/lib/features/people/data/people_repository.dart`
- `mobile/lib/features/chat/data/chat_repository.dart`
- `mobile/lib/features/profile/data/profile_repository.dart`
- `mobile/lib/features/tasks/data/task_repository.dart`

## Phase 1: App Shell And Navigation Polish

Timeline: 2 to 3 days

Goal: Make the app feel calmer and more premium before rebuilding individual
tabs.

Tasks:

- Redesign `MainBottomNav`:
  - larger tap targets
  - clearer selected state
  - calmer badge placement
  - stronger icon/label contrast
  - remove cramped top indicator if it competes with labels
- Introduce a shared mobile app bar pattern:
  - title
  - optional subtitle
  - one primary icon action
  - one overflow menu only where needed
- Make FAB contextual:
  - Home/People: Post Need
  - Work: New request or open active task action
  - Inbox: New message only when supported
  - You: hidden, because profile actions should be cards/tiles
- Add a consistent page scaffold:
  - 16 px horizontal padding on dense screens
  - bottom nav safe padding
  - no nested cards inside cards
  - sections become full-width bands or simple lists
- Standardize loading, empty, error, and offline states.

Acceptance criteria:

- Bottom nav text and badges do not overlap at 320 width.
- Primary action does not hide checkout/work/chat controls.
- All tabs have a visible loaded, loading, error, and empty state.
- App shell tests cover selected tab labels and badge rendering.

Primary files:

- `mobile/lib/app/presentation/app_shell.dart`
- `mobile/lib/app/presentation/main_bottom_nav.dart`
- `mobile/lib/core/design_system/*`
- `mobile/lib/shared/components/*`

## Phase 2: Inbox Tab Complete Rebuild

Timeline: 3 to 4 days

Goal: Inbox must never look blank. It should feel like the user's deal and
message command center.

Tasks:

- Rename internal concepts consistently:
  - UI tab: Inbox
  - thread detail: Conversation
  - quote/payment context: Deal room inside a thread, not the whole tab
- Add a real Inbox dashboard when no conversation is selected:
  - unread summary
  - active quote follow-ups
  - active task conversations
  - recent providers/customers
  - "Post a Need" and "Find providers" CTAs for empty state
- Improve empty state:
  - show a visual action panel, not a small text card
  - explain what will appear here
  - include buttons: Post Need, Browse People, Refresh
- Add failure state:
  - endpoint status
  - retry
  - "Check connection" message
- Add conversations search only after there are conversations.
- Add thread preview rows:
  - avatar
  - name
  - role/provider badge
  - last message
  - quote/task/order status chip
  - unread badge
  - time
- Add thread detail polish:
  - sticky composer
  - attachment preview
  - quick actions: Quote, View Work, View Order
  - message grouping by day
  - clear sent/failed states
- Add realtime invalidation reliability:
  - refresh conversation list when messages insert
  - mark read when thread opens
  - handle cold notification tap into thread

Acceptance criteria:

- Inbox with zero conversations still looks intentional and actionable.
- Inbox with failed data shows a recovery state, not a blank page.
- Inbox with seeded conversation shows thread rows and opens detail.
- Notification tap routes into the right conversation from cold app state.

Primary files:

- `mobile/lib/features/chat/presentation/chat_page.dart`
- `mobile/lib/features/chat/data/chat_repository.dart`
- `mobile/lib/features/chat/domain/chat_models.dart`
- `mobile/lib/app/router/app_router.dart`
- `mobile/test/widget_test.dart`

## Phase 3: You/Profile Into A Clickable Hub

Timeline: 4 to 5 days

Goal: Replace the text-heavy profile page with a clickable account and business
hub.

New You hub layout:

- Header:
  - avatar
  - name
  - role
  - location
  - trust status
  - profile completion
- Top actions:
  - Public Profile
  - Edit Profile
  - Business Control
  - Orders
- Clickable tiles:
  - Business AI Setup
  - Listings
  - Leads and Inbox
  - Quotes
  - Payments and Orders
  - Trust and Verification
  - Saved
  - Notifications
  - Settings
  - Help and Safety
- Secondary account area:
  - password setup
  - Google link
  - sign out

Route plan:

- `/app/profile` -> You hub
- `/app/profile/public` -> public profile preview
- `/app/profile/edit` -> edit profile form
- `/app/profile/trust` -> trust and verification
- `/app/profile/settings` -> settings and auth controls
- `/app/control` -> Business Control
- Existing provider routes remain:
  - `/app/provider-launchpad`
  - `/app/provider-listings`
  - `/app/provider-launchpad-review`

Tasks:

- Wire missing profile subroutes in `app_router.dart`.
- Move current inline profile sections into separate page widgets.
- Replace `ChoiceChip` section switcher with tappable hub tiles.
- Add role-aware content:
  - customer sees orders, saved, help history
  - provider sees control, listings, quote readiness, trust
- Add profile preview as a real page with share/open actions.
- Make edit profile feel like a form flow, not a section inside a long page.

Acceptance criteria:

- You tab has at least 8 clickable destinations.
- No section chip rail is needed for core navigation.
- Profile edit, public preview, business control, listings, trust, settings all
  have direct routes and browser/back-stack behavior.
- Widget tests assert the major tiles exist.

Primary files:

- `mobile/lib/features/profile/presentation/profile_page.dart`
- `mobile/lib/features/provider/presentation/provider_launchpad_page.dart`
- `mobile/lib/features/provider/presentation/provider_listings_page.dart`
- `mobile/lib/app/router/app_router.dart`
- `mobile/lib/core/constants/app_routes.dart`

## Phase 4: Business Control And AI Setup

Timeline: 4 to 6 days

Goal: Make provider setup and business management feel like a serious operating
dashboard.

Business Control sections:

- Setup progress
  - profile basics
  - services
  - products
  - pricing
  - proof/trust
  - availability
- AI actions
  - generate business description
  - improve service titles
  - suggest pricing
  - generate quote template
  - identify missing trust proof
- Listings control
  - active services
  - active products
  - paused items
  - stock warnings
- Lead control
  - new leads
  - unanswered messages
  - quotes pending
  - orders needing action
- Trust control
  - verification state
  - ratings/reviews
  - response time
  - completion rate
- Revenue control
  - orders this week
  - pending payment
  - completed work
  - COD due

Tasks:

- Build `ControlPage` at `/app/control`.
- Reuse provider launchpad data but present it as an ongoing dashboard.
- Add provider readiness model if current payload is not enough.
- Add "Next best action" recommendation:
  - finish setup
  - add first listing
  - reply to lead
  - send quote
  - update fulfillment
- Keep AI server-side:
  - mobile calls existing Next.js API routes
  - no OpenAI keys in Flutter
- Add tests for provider role and non-provider role.

Acceptance criteria:

- Provider can open Business Control from You in one tap.
- Provider sees setup state, listings, leads, quote readiness, and next action.
- Customer/non-provider sees a conversion path into provider onboarding.
- No AI secret is exposed in mobile code or APK.

Primary files:

- `mobile/lib/features/provider/presentation/provider_onboarding_page.dart`
- `mobile/lib/features/provider/presentation/provider_launchpad_page.dart`
- `mobile/lib/features/profile/presentation/profile_page.dart`
- New: `mobile/lib/features/control/presentation/control_page.dart`
- New: `mobile/lib/features/control/data/control_repository.dart`

## Phase 5: Database Loading And Mobile API Parity

Timeline: 5 to 7 days

Goal: Every mobile tab should load complete, current database-backed data.

Tasks:

- Add or stabilize mobile aggregate endpoints:
  - `/api/mobile/home`
  - `/api/mobile/inbox`
  - `/api/mobile/work`
  - `/api/mobile/account`
  - `/api/mobile/control`
  - `/api/mobile/checkout/context`
- Keep feed and people endpoints if they already match web parity.
- Define typed response contracts in TypeScript and Dart.
- Add mobile route contract tests:
  - authenticated request succeeds
  - unauthenticated request returns 401
  - required fields are present
  - empty state payload is explicit
- Fix mobile mappers to avoid hiding missing fields with generic placeholders.
- Audit RLS policies for mobile direct Supabase reads:
  - orders
  - messages
  - conversations
  - help requests
  - listings
  - profiles
  - notifications
- Add cache and refresh strategy:
  - stale while refresh on app open
  - pull to refresh on every tab
  - realtime invalidation for messages, tasks, notifications, profile/listings
- Add analytics around data completeness:
  - tab_loaded
  - tab_empty
  - tab_error
  - endpoint_latency

Acceptance criteria:

- Fresh signed-in app loads all five tabs using seeded staging data.
- Every endpoint failure maps to a visible recovery UI.
- Mobile and web show the same core provider, listing, task, order, and profile
  facts for the same account.
- Contract tests fail when the backend stops returning a required mobile field.

Primary files:

- `app/api/mobile/*`
- `app/api/community/*`
- `app/api/tasks/*`
- `mobile/lib/core/api/mobile_api_client.dart`
- `mobile/lib/features/*/data/*_repository.dart`
- `tests/unit/*routes*.test.ts`
- `mobile/test/*`

## Phase 6: Work Tab UI And Logic Rebuild

Timeline: 5 to 7 days

Goal: Work should answer one question immediately: "What needs my attention
now?"

New Work tab layout:

- Top summary:
  - Needs action
  - Active
  - Waiting
  - Done
- Primary list:
  - next action tasks first
  - quote pending tasks
  - active fulfillment tasks
  - payment/order follow-up
- Filters move into a bottom sheet:
  - role: customer/provider/all
  - type: request/order/quote
  - status
  - date
- Task detail page:
  - title
  - role
  - provider/customer
  - status timeline
  - quote panel
  - payment panel
  - chat button
  - order detail button
  - proof/notes
  - primary action
- Inline task cards:
  - one primary action
  - one secondary action
  - no dense chip stack

Logic tasks:

- Normalize order/help-request/quote status into one mobile work state.
- Add a status state machine:
  - new lead
  - quote pending
  - accepted
  - travel started
  - work started
  - completed
  - cancelled
  - payment pending
  - closed
- Add quote awareness to task mapping.
- Add order payment state to task mapping.
- Add focused routing for notification taps and post success.
- Add optimistic UI for safe status changes.

Acceptance criteria:

- Work tab is useful with 0, 1, 10, and 100 tasks.
- A task with a quote opens a detail page with quote context.
- A task with an order opens order/payment context.
- Provider and customer roles see appropriate primary actions.
- Notification tap lands on the correct task detail.

Primary files:

- `mobile/lib/features/tasks/presentation/tasks_page.dart`
- `mobile/lib/features/tasks/presentation/task_board_components.dart`
- `mobile/lib/features/tasks/data/task_repository.dart`
- `mobile/lib/features/tasks/domain/task_snapshot.dart`
- `mobile/lib/features/orders/*`
- `mobile/lib/features/quotes/*`

## Phase 7: Cards, Cart, Checkout, Orders

Timeline: 6 to 8 days

Goal: Marketplace cards and checkout should feel conversion-ready and safe.

Card system:

- Create card variants:
  - provider card
  - service card
  - product card
  - need/request card
  - quote card
  - order card
  - conversation preview card
- Each card must have:
  - clear title
  - trust cue
  - price or budget when relevant
  - location/time context
  - one primary CTA
  - one overflow action
- Remove noisy metadata from compact cards.
- Move secondary details into detail pages or bottom sheets.
- Add skeletons that match final dimensions.

Cart:

- Replace basic sheet with a polished cart flow:
  - item image/icon
  - provider grouping
  - quantity stepper with stable width
  - stock/availability warning
  - subtotal
  - delivery/onsite fulfillment note
  - clear remove action
  - sticky checkout button
- Add cart persistence if not already stable enough for app relaunch.
- Add cart badge or entry point where product discovery occurs.

Checkout:

- Convert checkout into clear steps:
  1. Review
  2. Address/fulfillment
  3. Payment
  4. Confirmation
- Improve payment method cards:
  - COD explanation
  - Razorpay explanation
  - safe payment note
- Add recoverability:
  - payment cancelled
  - payment failed
  - verification incomplete
  - order created but payment pending
- Add order confirmation page:
  - order id
  - provider/customer
  - next step
  - open Work
  - open Inbox

Orders:

- Add order list and detail polish:
  - lifecycle timeline
  - payment status
  - fulfillment status
  - provider/customer contact
  - proof/notes
  - support/report action

Acceptance criteria:

- A user can go from provider/product card to cart to checkout to order detail.
- Failed/cancelled payment never leaves the user confused.
- Cart and checkout fit 320 width and 160 percent text scale.
- Cards do not resize unexpectedly when badges or CTAs change.

Primary files:

- `mobile/lib/shared/components/feed_card.dart`
- `mobile/lib/shared/components/provider_card.dart`
- `mobile/lib/features/cart/*`
- `mobile/lib/features/orders/*`
- `mobile/lib/features/feed/*`
- `mobile/lib/features/people/*`

## Phase 8: Premium Visual Polish And Accessibility

Timeline: 4 to 6 days

Goal: Make the app look expensive, calm, and usable on real devices.

Tasks:

- Establish final visual rules:
  - restrained color palette
  - consistent spacing scale
  - consistent card radius
  - no nested cards
  - no giant text inside compact panels
  - no overlapping badges, CTAs, or nav
- Create a typography pass:
  - screen titles
  - section titles
  - card titles
  - metadata labels
  - button labels
- Add image treatment:
  - provider avatars
  - listing thumbnails
  - fallback initials
  - stable aspect ratios
- Add accessibility pass:
  - TalkBack labels
  - 44 px minimum tap targets
  - text scale 160 percent
  - keyboard open layouts
  - color contrast
- Add microinteraction pass:
  - haptics only for meaningful actions
  - loading transitions
  - optimistic state feedback
  - success/error toasts

Acceptance criteria:

- Screenshots at 320, 390, and 430 widths look intentional.
- Text scale at 160 percent does not block primary actions.
- TalkBack announces tab names, badges, primary buttons, task status, payment
  status, and message state.
- UI does not rely only on color to communicate state.

## Phase 9: Verification, Release Candidate, And Beta

Timeline: 3 to 5 days

Tasks:

- Run:
  - `flutter analyze --no-pub`
  - `flutter test --no-pub`
  - Android emulator smoke
  - physical Android install
- Add targeted widget tests:
  - Inbox empty state
  - Inbox seeded list
  - You hub tiles
  - Control provider state
  - Work needs-action state
  - Cart and checkout text scale
- Add backend route tests for mobile aggregate endpoints.
- Run real-device QA checklist:
  - auth
  - Home
  - People
  - Inbox
  - Work
  - You
  - Business Control
  - cart
  - checkout
  - orders
  - notifications
- Build a signed internal APK or Play internal test build.
- Record known issues in `mobile/release/friction_log.md`.

Acceptance criteria:

- No P0 or P1 open issues.
- All five tabs show useful states on seeded accounts.
- Customer money loop passes on Android.
- Provider money loop passes on Android.
- APK is signed with release keystore for wider distribution.

## Immediate Sprint 1 Recommendation

Timeline: 5 focused work days

Sprint goal: Fix the most visible confidence killers first.

Day 1:

- Add data diagnostics and seeded test account checklist.
- Fix Inbox blank/empty/error states.
- Add widget test for Inbox empty state.

Day 2:

- Polish bottom nav selected state, badge state, and FAB behavior.
- Reduce Home/People/Work top clutter by moving filters into sheets where easy.

Day 3:

- Convert You tab into clickable hub.
- Add direct routes for Edit Profile, Business Control, Listings, Trust, and
  Settings.

Day 4:

- Build first version of Business Control page.
- Surface setup progress, listings, leads, and next best action.

Day 5:

- Rework Work tab top layer:
  - next action summary
  - calmer filters
  - task detail route skeleton
- Run analyze, tests, emulator screenshots, and update friction log.

Sprint 1 acceptance:

- Inbox no longer appears blank in the screenshot scenario.
- You is a clickable hub, not a text section page.
- Business Control exists and is reachable.
- Work has a clearer next-action hierarchy.
- No regression in current Flutter tests.

## Priority Backlog

P0:

- Inbox blank or visually empty after sign-in.
- Authenticated data not loading for a tab.
- Checkout/order/payment corruption.
- App crash or protected route dead end.

P1:

- You tab not actionable enough.
- Business Control missing.
- Work primary action unclear.
- Cart/checkout failure states unclear.
- Notification deep link does not land on target.

P2:

- Cluttered filters and chip rails.
- Card metadata noise.
- Weak empty/loading states.
- Missing image fallbacks.
- Inconsistent labels between web and mobile.

P3:

- Cosmetic animation pass.
- Advanced provider analytics.
- Optional personalization.
- Store screenshot polish after core flow is stable.

## Data Contract Checklist By Tab

Home:

- current user
- local feed
- requests
- listings
- providers
- saved state
- unread count
- task count

People:

- provider id
- display name
- avatar
- category
- headline
- location
- rating/review count
- services/products
- availability
- trust labels

Work:

- task id
- source type
- role
- status
- progress stage
- quote state
- order id
- payment state
- provider/customer name
- next action
- notification target id

Inbox:

- conversation id
- participant id
- participant name
- participant role
- avatar
- last message
- unread count
- related task id
- related quote id
- related order id
- updated time

You:

- profile id
- display name
- avatar
- role
- profile completion
- provider readiness
- listings count
- trust status
- order/payment summary
- auth methods

Control:

- provider readiness
- launchpad draft
- published profile
- services
- products
- leads
- quotes pending
- orders needing action
- trust gaps
- next best action

Checkout:

- line items
- provider grouping
- quantity
- price
- stock/availability
- fulfillment method
- address
- payment method
- payment order id
- ServiQ order ids
- payment verification state

## Engineering Rules For This Work

- Keep changes vertical by flow where possible: data, domain, UI, tests.
- Avoid a visual-only rewrite before data states are reliable.
- Build empty/error/loading states as first-class components.
- Prefer route-level pages over long inline sections.
- Add tests around visible behavior, not just implementation details.
- Do not put AI secrets in the mobile app.
- Keep release APKs out of source commits after this checkpoint unless there is
  a deliberate release artifact policy.

## Definition Of Done For The Full Plan

- Five bottom tabs feel complete and intentional.
- Inbox, Work, You, Control, Cart, Checkout, and Orders have production-quality
  loaded, empty, loading, error, and offline states.
- Mobile data matches the web/database source of truth.
- Customer and provider money loops pass on seeded staging data.
- UI works at 320, 390, and 430 widths with 160 percent text scale.
- Analytics and Crashlytics cover the critical funnel.
- Release-signed Android build is ready for internal testers.
