# Flutter WebApp-Parity Premium Rebuild Plan

Date: 2026-05-03
Scope: ServiQ Flutter mobile app UI/UX, onboarding, Business AI, profile, cards,
cart, checkout, orders, tasks, and release polish.

## Why This Plan Exists

The Flutter app now has many core routes and backend contracts, but it still
feels like a functional mobile port rather than the mobile-first version of the
WebApp. The WebApp has stronger product framing, richer provider/profile
surfaces, Business AI setup, better marketplace cards, cart/store flows, and a
more complete task/order history loop.

The next phase should not be another scattered set of fixes. It should be a
deliberate mobile rebuild around the WebApp product model, translated into
native mobile patterns.

## Product North Star

ServiQ mobile should open as a trusted local commerce engine:

- New users immediately understand: find help, earn nearby, or set up a business.
- Providers can become marketplace-ready through Business AI without needing
  desktop.
- Customers can discover, compare, chat, cart, checkout, and track history from
  one phone flow.
- Every card clearly explains trust, distance, price, status, and next action.
- The app feels branded, calm, premium, and operational, not generic Material UI.

## Current Flutter Gaps

| Area | Flutter Today | WebApp / Desired State | Gap |
| --- | --- | --- | --- |
| Login | Functional auth screens | Branded first impression with clear value and paths | Needs premium landing/login and first-time routing |
| First-time onboarding | Basic setup/provider onboarding pages | Clear role/intent setup and marketplace readiness | Needs customer/provider/business onboarding flow |
| Business AI | Provider launchpad exists but feels like a form | Web Launchpad has identity, offerings, location, publish framing | Needs Business AI surface, stepper, AI review, generated output polish |
| Colors/theme | Green-heavy, generic tokens | Web brand feels sharper with richer status colors and trust hierarchy | Needs new mobile design tokens and component system |
| Profile | Dense tabbed profile page | Public profile, edit profile, store, trust, work history, quick actions | Needs split View Profile / Edit Profile / Business Setup model |
| Home cards | Functional post/listing cards | Web cards have richer action model, trust metadata, save/share, reasons | Needs premium mobile card redesign |
| People cards | Directory cards are compact and plain | Web provider cards use cover, avatar, presence, trust snapshot, actions | Needs provider card visual rebuild |
| Cart | Direct checkout route only | Web storefront supports add to cart and buy now | Needs mobile cart state, cart sheet, checkout summary |
| Checkout | Basic direct checkout | Should support cart, payment trust copy, recoverable failures | Needs cart-first checkout and stronger payment states |
| Tasks/history | Tasks/orders exist but feel workflow-ish | Needs unified history across needs, quotes, carts, orders, provider leads | Needs task tab information architecture redesign |
| Trust/safety | Some trust signals exist | Needs report/block, verification meaning, privacy copy, review states | Needs trust layer visible across cards/profile/chat/checkout |

## Build Order

### Phase 0: UI/UX Inventory And WebApp Parity Map

Goal: establish the exact target before redesigning.

**Canonical inventory (screens, API matrix, money-loop script, exit checklist):**
[`docs/2026-05-04-phase-0-parity-inventory.md`](2026-05-04-phase-0-parity-inventory.md).

Deliverables:

- Screenshot Flutter screens at 320, 390, and 430 widths:
  - Sign in
  - Welcome/Home
  - Search
  - People
  - Provider profile
  - Profile
  - Provider onboarding
  - Business AI / Launchpad
  - Provider listings
  - Create Need
  - Chat
  - Quote Room
  - Checkout
  - Orders
  - Tasks
  - Notifications
- Screenshot equivalent WebApp surfaces:
  - `/`
  - `/dashboard/welcome`
  - `/dashboard/people`
  - `/dashboard/launchpad`
  - `/dashboard/launchpad/review`
  - `/dashboard/profile`
  - `/profile/[slug]`
  - `/checkout`
  - `/dashboard/tasks`
  - `/dashboard/provider/listings`
- Create a component parity table:
  - Web component
  - Flutter equivalent
  - Keep / redesign / missing
  - Priority

Files to inspect:

- Web:
  - `app/dashboard/welcome/page.tsx`
  - `app/dashboard/components/posts/FeedCard.tsx`
  - `app/dashboard/people/components/ProviderCard.tsx`
  - `app/dashboard/launchpad/page.tsx`
  - `app/dashboard/launchpad/review/page.tsx`
  - `app/components/profile/PublicProfileStoreTab.tsx`
  - `app/components/profile/PublicProfileActions.tsx`
  - `app/dashboard/tasks/page.tsx`
- Flutter:
  - `mobile/lib/features/welcome/presentation/welcome_page.dart`
  - `mobile/lib/features/feed/presentation/feed_page.dart`
  - `mobile/lib/shared/components/feed_card.dart`
  - `mobile/lib/shared/components/provider_card.dart`
  - `mobile/lib/features/provider/presentation/provider_launchpad_page.dart`
  - `mobile/lib/features/profile/presentation/profile_page.dart`
  - `mobile/lib/features/orders/presentation/checkout_page.dart`
  - `mobile/lib/features/tasks/presentation/tasks_page.dart`

Acceptance bar:

- We can point to every screen and say whether it is WebApp parity, mobile-native
  improvement, or intentionally different.
- No major visual rebuild starts without a reference target.

### Phase 1: Premium Mobile Design System Refresh

Goal: replace the generic Flutter look with a real ServiQ mobile design language.

Deliverables:

- New token set:
  - brand colors
  - role colors for request/service/product/order/trust/warning/danger
  - surface colors
  - borders/shadows
  - typography scale
  - spacing scale
  - card/button/input radius rules
- Component primitives:
  - `ServiqScaffold`
  - `ServiqTopBar`
  - `ServiqSurface`
  - `ServiqActionBar`
  - `ServiqBottomSheet`
  - `TrustSnapshot`
  - `StatusPill`
  - `LocationPill`
  - `PricePill`
  - `AsyncStateView`
  - `PremiumEmptyState`
  - `InlineRecoveryBanner`
- Update old shared components to use tokens instead of one-off colors.

Primary files:

- `mobile/lib/core/theme/design_tokens.dart`
- `mobile/lib/core/theme/app_theme.dart`
- `mobile/lib/shared/components/*`
- `mobile/lib/core/widgets/section_card.dart`

Design direction:

- Less generic green.
- More precise, marketplace-grade palette:
  - deep brand ink
  - clear trust blue
  - warm commerce/accent
  - calm success
  - restrained urgent/error
- Cards should feel operational and scannable, not decorative.
- Keep mobile touch targets large and layouts stable.

Acceptance bar:

- Every core screen uses the same tokens.
- No major screen has hardcoded random colors except intentional semantic colors.
- Text scale 160% does not break shell, cards, or primary forms.

### Phase 2: Login And First-Time Onboarding

Goal: make the first app open feel intentional and product-led.

Deliverables:

- New login first page:
  - branded ServiQ identity
  - one-line product promise
  - clear auth paths: email code, Google, email/password where available
  - trust/privacy copy
  - loading/error states that feel premium
- First-time onboarding after auth:
  - choose intent:
    - Find help
    - Earn nearby
    - Set up my business
  - collect minimum profile data:
    - name
    - locality
    - role intent
    - notification opt-in after explaining value
  - route user to right surface:
    - customer -> Home/Create Need
    - provider -> Provider Setup
    - business -> Business AI
- Progress persistence:
  - user can leave and resume onboarding
  - setup state appears in Profile

Primary files:

- `mobile/lib/features/auth/presentation/sign_in_page.dart`
- `mobile/lib/features/auth/presentation/setup_page.dart`
- `mobile/lib/features/profile/data/profile_repository.dart`
- `mobile/lib/app/router/app_router.dart`

Potential new files:

- `mobile/lib/features/onboarding/presentation/intent_onboarding_page.dart`
- `mobile/lib/features/onboarding/data/onboarding_repository.dart`
- `mobile/lib/features/onboarding/domain/onboarding_state.dart`

Acceptance bar:

- A new user never lands in a confusing empty dashboard.
- Provider/business users are deliberately moved toward Business AI setup.
- Customer users can post a need within one or two taps after onboarding.

### Phase 3: Business AI Setup / Launchpad Parity

Goal: bring the WebApp Business AI setup into Flutter as a first-class mobile flow.

Current Flutter page exists, but it is too form-like. It should feel like a
guided AI setup product.

Deliverables:

- Rename/frame as `Business AI Setup` where appropriate.
- Stepper flow:
  - Identity
  - Services / products
  - Location / availability
  - AI generated profile
  - Review and publish
- Mobile-native input controls:
  - category chips instead of plain text where possible
  - service/product selector
  - tone selector
  - service area picker
  - GPS helper with readable-location requirement
  - hours/availability presets
- AI output review:
  - generated storefront headline
  - generated bio
  - generated service cards
  - generated product cards
  - pricing notes
  - FAQ or trust copy if backend supports it
- Publish result:
  - profile readiness score
  - services/products created
  - next actions: manage listings, preview profile, share profile

Primary files:

- `mobile/lib/features/provider/presentation/provider_launchpad_page.dart`
- `mobile/lib/features/provider/domain/launchpad_models.dart`
- `mobile/lib/features/provider/data/launchpad_repository.dart`
- `mobile/lib/features/provider/presentation/provider_onboarding_page.dart`
- `app/dashboard/launchpad/page.tsx` as reference
- `app/dashboard/launchpad/review/page.tsx` as reference

Acceptance bar:

- A provider can complete Business AI setup on mobile without desktop.
- The flow feels guided, not like a long form.
- Generated output is editable before publish.
- Publish creates visible profile/listing updates.

### Phase 4: Profile, View Profile, And Edit Profile Rebuild

Goal: make Profile a command center, not a dense account page.

Deliverables:

- Profile hub split into clear actions:
  - View public profile
  - Edit profile
  - Business AI setup
  - Manage services/products
  - Orders/history
  - Trust and verification
  - Settings
- Public profile preview in Flutter:
  - avatar/cover
  - headline
  - location privacy
  - trust score
  - services/products
  - reviews/history
  - chat/request quote actions
- Edit profile flow:
  - full-screen editor
  - avatar/cover upload
  - name/headline/bio/location/contact
  - preview before save
  - profile completion changes visible immediately
- Provider onboarding section:
  - readiness checklist
  - Business AI CTA
  - listing gaps
  - trust gaps

Primary files:

- `mobile/lib/features/profile/presentation/profile_page.dart`
- `mobile/lib/features/provider/presentation/provider_profile_page.dart`
- `mobile/lib/features/provider/presentation/provider_onboarding_page.dart`
- `mobile/lib/features/profile/domain/mobile_profile_snapshot.dart`
- `mobile/lib/features/profile/data/profile_repository.dart`

Potential new files:

- `mobile/lib/features/profile/presentation/edit_profile_page.dart`
- `mobile/lib/features/profile/presentation/public_profile_preview_page.dart`
- `mobile/lib/features/profile/presentation/profile_readiness_panel.dart`

Acceptance bar:

- Users understand the difference between private account, public profile, and
  business setup.
- Editing profile is not hidden in a weak tab.
- Provider readiness is obvious and actionable.

### Phase 5: Home And People Cards Premium Rebuild

Goal: make marketplace cards look and behave like premium conversion surfaces.

Deliverables:

- New Home card variants:
  - request card
  - service card
  - product card
  - provider card
  - empty/skeleton states
- Card content model:
  - title
  - owner/provider
  - avatar/cover/media
  - distance/locality
  - status/urgency
  - price/budget
  - trust snapshot
  - reason surfaced
  - save/share/more
  - primary action
  - secondary action
- People provider card rebuild:
  - cover strip or image
  - avatar and presence
  - verified/review/response/job stats
  - tags
  - connect/message/view profile
  - save/share
- Compact and full variants:
  - compact list card for search results
  - rich card for People/Home

Primary files:

- `mobile/lib/shared/components/feed_card.dart`
- `mobile/lib/shared/components/request_card.dart`
- `mobile/lib/shared/components/provider_card.dart`
- `mobile/lib/features/welcome/presentation/welcome_page.dart`
- `mobile/lib/features/feed/presentation/feed_page.dart`
- `mobile/lib/features/people/presentation/people_page.dart`

Web references:

- `app/dashboard/components/posts/FeedCard.tsx`
- `app/dashboard/people/components/ProviderCard.tsx`
- `app/dashboard/welcome/page.tsx`

Acceptance bar:

- Cards no longer look like generic list cards.
- A user can understand who, what, where, how much, trust, and next action in
  under three seconds.
- 320px width still looks intentional.

### Phase 6: Mobile Cart, Storefront, Checkout, And Order History

Goal: close the commerce gap. Flutter needs cart-first local checkout, not only
direct checkout links.

Deliverables:

- Mobile cart state:
  - add item
  - remove item
  - update quantity
  - clear cart
  - replace cart with Buy Now
  - enforce same-provider cart if backend requires it
  - persist local cart across app restart
- Cart UI:
  - cart bottom sheet
  - cart count badge in shell/Profile/store
  - order summary
  - provider grouping
  - empty cart state
- Storefront actions:
  - Add to cart
  - Buy now
  - Chat provider
  - Request quote
- Checkout rebuild:
  - cart summary
  - address/meeting point
  - fulfillment method
  - COD/Razorpay trust copy
  - payment failure recovery
  - order created confirmation
- Order history:
  - orders visible inside Tasks tab and Orders page
  - customer purchase history
  - provider sales history
  - payment state and fulfillment state clearly separated

Primary files:

- `mobile/lib/features/orders/presentation/checkout_page.dart`
- `mobile/lib/features/orders/presentation/orders_page.dart`
- `mobile/lib/features/orders/presentation/order_detail_page.dart`
- `mobile/lib/features/tasks/presentation/tasks_page.dart`
- `mobile/lib/features/provider/presentation/provider_profile_page.dart`
- `mobile/lib/features/provider/presentation/provider_listings_page.dart`

Potential new files:

- `mobile/lib/features/cart/domain/cart_models.dart`
- `mobile/lib/features/cart/data/cart_controller.dart`
- `mobile/lib/features/cart/presentation/cart_sheet.dart`
- `mobile/lib/features/cart/presentation/cart_badge.dart`
- `mobile/lib/features/cart/presentation/cart_summary_card.dart`

Web reference:

- `app/components/profile/PublicProfileStoreTab.tsx`
- `app/components/store/CartContext.tsx`
- `app/checkout/page.tsx`
- `app/dashboard/orders/page.tsx`

Acceptance bar:

- User can add a service/product to cart, review it, checkout, and see history.
- Failed payment never leaves the user lost.
- Tasks tab shows order/task history in a way normal users understand.

### Phase 7: Tasks Tab Information Architecture Rebuild

Goal: make Tasks the source of truth for work, orders, quotes, and history.

Deliverables:

- New Tasks IA:
  - Inbox / Needs
  - Active
  - Orders
  - Quotes
  - History
- Customer view:
  - posted needs
  - provider responses
  - quotes received
  - orders purchased
  - completed history
- Provider view:
  - leads
  - quotes sent
  - orders to fulfill
  - completed jobs
- Task cards:
  - source badge: need/order/quote/chat
  - status
  - next action
  - payment/fulfillment state
  - timeline
  - deep links to Chat, Quote Room, Order Detail
- History:
  - completed/cancelled/expired grouped by date
  - readable audit trail

Primary files:

- `mobile/lib/features/tasks/presentation/tasks_page.dart`
- `mobile/lib/features/tasks/presentation/task_board_components.dart`
- `mobile/lib/features/tasks/domain/task_snapshot.dart`
- `mobile/lib/features/tasks/data/task_repository.dart`

Web reference:

- `app/dashboard/tasks/page.tsx`
- `app/dashboard/tasks/components/TaskBoardComponents.tsx`

Acceptance bar:

- Users do not have to know whether something is technically a task, quote, or
  order to find it.
- Every active item has a clear next action.
- History is visible and trusted.

### Phase 8: Create Need / Post Composer Polish

Goal: make posting a need feel fast, safe, and AI-native.

Deliverables:

- Composer modes:
  - urgent need
  - scheduled need
  - product/service request
- Better preview before post:
  - title
  - category
  - location privacy
  - media
  - budget
  - matching radius
  - who will see it
- AI assist if backend supports it:
  - improve title
  - suggest category
  - ask missing detail
  - generate provider-facing summary
- Success state:
  - matches/notified count
  - next steps
  - Chat/Tasks deep links

Primary files:

- `mobile/lib/features/post_create/presentation/create_need_page.dart`
- `mobile/lib/features/post_create/data/create_need_repository.dart`

Web reference:

- `app/components/CreatePostModal.tsx`

Acceptance bar:

- Posting a need feels faster and clearer than web on a phone.
- The user knows what happens after posting.

### Phase 9: Trust, Safety, And Marketplace Confidence

Goal: make the marketplace feel safe enough for real transactions.

Deliverables:

- Report/block flows:
  - provider profile
  - chat
  - feed cards
  - order detail
- Verification explanation:
  - what verified means
  - what new profile means
  - what approximate location means
- Payment trust:
  - Razorpay handoff copy
  - COD risk copy
  - no card storage note
- Privacy:
  - precise address only in checkout/order context
  - public cards show locality/approximate distance only
- Abuse controls:
  - rate limits surfaced in errors
  - duplicate post guidance
  - chat/report escalation

Acceptance bar:

- A new user can understand why a provider is trustworthy or still new.
- Sensitive data is not overexposed on public cards.
- Unsafe users/listings have a clear reporting path.

### Phase 10: Analytics, Reliability, And QA Automation

Goal: make the rebuild measurable and hard to regress.

Deliverables:

- Analytics events:
  - app open
  - onboarding intent selected
  - business AI started/saved/published
  - profile edit started/saved
  - card opened/saved/shared
  - add to cart
  - cart opened
  - checkout started
  - payment result
  - order completed
  - task next action tapped
- Crashlytics breadcrumbs:
  - auth
  - Business AI
  - upload
  - chat
  - quote
  - checkout/payment
  - realtime
- Tests:
  - design-system widget tests
  - onboarding route tests
  - cart controller unit tests
  - checkout state tests
  - task/history rendering tests
  - 320px/390px/430px widget stability tests

Acceptance bar:

- `flutter analyze --no-pub` passes.
- `flutter test --no-pub` passes.
- Core screens have widget coverage for narrow width and large text.
- Firebase DebugView can prove every major funnel step.

## Recommended Execution Sequence

### Sprint 1: Foundation And First Impression

1. UI inventory and parity map.
2. Design token refresh.
3. Shared premium components.
4. Login first page rebuild.
5. First-time intent onboarding.

Why first: every later screen depends on the visual system and first-time user
direction.

### Sprint 2: Business AI And Profile Command Center

1. Business AI setup stepper.
2. AI generated output review.
3. Profile hub rebuild.
4. Edit profile full-screen flow.
5. Provider readiness checklist.

Why second: supply onboarding is the marketplace bottleneck and currently feels
behind web.

### Sprint 3: Cards And Discovery

1. Home card redesign.
2. People provider card redesign.
3. Search result card redesign.
4. Provider profile preview polish.
5. Save/share/more action consistency.

Why third: marketplace conversion lives or dies on cards.

### Sprint 4: Cart, Checkout, Orders, Tasks History

1. Cart controller and cart sheet.
2. Storefront add-to-cart/buy-now actions.
3. Checkout rebuild.
4. Orders page polish.
5. Tasks tab IA rebuild with history.

Why fourth: commerce flows need the product shell and card actions in place.

### Sprint 5: Trust, Reliability, And Release Polish

1. Report/block/moderation surfaces.
2. Verification and location privacy copy.
3. Analytics and Crashlytics coverage.
4. Real-device responsive/accessibility pass.
5. Store screenshots and beta release checklist.

Why fifth: trust and release polish should harden the rebuilt flows.

## Non-Negotiable Design Rules

- Mobile should not copy desktop layouts directly.
- No screen should be a long generic form if a stepper or focused flow is more
  natural.
- Cards must expose the next action without making the user open details first.
- Trust signals must be specific, not decorative.
- Empty states must explain what to do next.
- Payment and order states must never be ambiguous.
- Provider onboarding should always point toward earning and profile readiness.
- Customer onboarding should always point toward posting a need or finding help.

## Immediate Next Task

Start with Sprint 1, Step 1:

Create the UI inventory and component parity map, then redesign the mobile theme
tokens and shared card/button/surface primitives before touching individual
screens.

The first actual implementation PR should be:

1. `design_tokens.dart` and `app_theme.dart` refresh.
2. New premium shared primitives.
3. Login first page rebuild using the new primitives.
4. Widget tests for 320px, 390px, 430px, and 160% text scale.
