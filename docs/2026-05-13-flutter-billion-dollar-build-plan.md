# ServiQ Flutter Mobile - Billion Dollar Startup Grade Build Plan

**Date**: 2026-05-13
**Status**: Execution Plan
**Scope**: Complete mobile app UI/UX polish, feature parity with web, and production readiness

---

## Vision

Transform the ServiQ Flutter app from a functional prototype into a polished, production-grade mobile experience that feels like the primary product—not a thin wrapper around the web app. Every screen should guide users to the next action, build trust, and feel native to iOS and Android.

**Target Quality Gates**:
- First screen after sign-in shows live data within 2 seconds
- No blank core tabs under any condition (loading, empty, error states)
- Every card has one clear job and primary action
- Profile is a clickable command center with sub-pages
- Business AI setup is a real control surface with progress tracking
- Cart → Checkout → Order flow is seamless and trustworthy
- Bottom navigation feels native, polished, with proper badges and hierarchy

---

## Phase 1: Foundation & Polish (Week 1-2)

### 1.1 Design System Enhancement

**Objective**: Establish a consistent, premium visual language across the app.

**Actions**:
- [ ] Audit and refine `design_tokens.dart` - ensure spacing, colors, and typography align with billion-dollar app standards
- [ ] Add dark mode support with proper token mapping
- [ ] Create `ServiQButton` component variants: primary, secondary, ghost, destructive, loading
- [ ] Create `ServiQCard` component with elevation, border radius, and content slot variants
- [ ] Create `ServiQBottomSheet` with drag indicator, snap points, and backdrop
- [ ] Create `ServiQShimmer` for skeleton loading states across all list screens
- [ ] Implement `ServiQEmptyState` component with illustration, title, subtitle, and CTA
- [ ] Add error boundary component for graceful failure handling
- [ ] Create `ServiQAvatar` with fallback, verification badge, and online indicator
- [ ] Add consistent loading indicators (spinner vs shimmer vs progress bar)

**Files to create/modify**:
- `mobile/lib/core/design_system/`
- `mobile/lib/core/theme/design_tokens.dart`

---

### 1.2 Bottom Navigation Overhaul

**Objective**: Transform generic bottom nav into polished, hierarchical navigation.

**Actions**:
- [ ] Redesign `main_bottom_nav.dart` with custom paint or flutter's `NavigationBar`
- [ ] Add animated icon transitions (scale + color)
- [ ] Implement badge system for: Inbox unread count, Tasks requiring action, Orders pending
- [ ] Add haptic feedback on tab switch
- [ ] Implement safe area handling for notched devices
- [ ] Add floating action button context (FAB) that changes based on current tab
  - Home: "Post Need" quick action
  - People: "Search" icon
  - Work: "Create Task" or "View Quotes"
  - Inbox: "New Message"
  - Profile: "Edit" or "Settings"
- [ ] Add indicator dot for "new" or "unread" content

**Files to modify**:
- `mobile/lib/app/presentation/main_bottom_nav.dart`
- `mobile/lib/app/presentation/app_shell.dart`

---

### 1.3 Core Tab Loading States

**Objective**: Ensure no blank tabs ever—handle loading, empty, and error gracefully.

**Actions**:
- [ ] Implement `AsyncValueWidget` wrapper for all async data in tabs
- [ ] Add shimmer placeholders for:
  - Home feed cards (3-5 items)
  - People provider cards (list skeleton)
  - Work task cards (kanban column skeletons)
  - Inbox conversation list
  - Profile info sections
- [ ] Create polished empty states with:
  - Custom illustrations (use placeholder SVGs or icons)
  - Actionable CTAs ("No providers yet → Explore feeds", "No messages → Start a conversation")
  - Clear explanation of why it's empty
- [ ] Add retry buttons with exponential backoff for error states
- [ ] Implement "last known good state" caching to show stale data while refreshing

**Files to modify**:
- `mobile/lib/features/feed/presentation/feed_page.dart`
- `mobile/lib/features/people/presentation/people_page.dart`
- `mobile/lib/features/tasks/presentation/tasks_page.dart`
- `mobile/lib/features/chat/presentation/chat_page.dart`
- `mobile/lib/features/profile/presentation/profile_page.dart`

---

## Phase 2: Home Tab Refinement (Week 2-3)

### 2.1 Welcome Page (Home) Polish

**Objective**: Simplify first viewport, reduce clutter, guide to primary actions.

**Actions**:
- [ ] Implement "compact actions" row at top: Post Need, Find People, Work, Inbox (as per 2026-05-10 audit)
- [ ] Move attention/activity board below fold with smooth scroll
- [ ] Add "Business AI" prompt as a small nudge (not prominent) when profile readiness is low
- [ ] Implement pull-to-refresh with custom indicator
- [ ] Add "live" dot indicator showing real-time data status
- [ ] Simplify feed card to show: avatar, name, title, price, rating, one action button
- [ ] Add horizontal scroll for "Providers near you" section
- [ ] Implement "save" and "hide" gestures on cards with undo snackbar
- [ ] Add "share" sheet with native share sheet integration

**Files to modify**:
- `mobile/lib/features/welcome/presentation/welcome_page.dart`

---

### 2.2 Feed Card Redesign

**Objective**: Every card has one clear job and primary action.

**Actions**:
- [ ] Redesign feed card layout:
  ```
  [Avatar] [Name] [Verified]  [Price]
          [Title]
          [Category tag] [Location]
  [    Primary Action Button    ]
  [Secondary: Save | Hide | Share]
  ```
- [ ] Add "trust signals" micro-component: rating stars, response time, repeat hire count
- [ ] Implement lazy image loading with blur placeholder
- [ ] Add tap zones: card body → detail, button → action, avatar → profile
- [ ] Implement swipe actions: left = hide, right = save
- [ ] Add "reported" state after hide action

---

## Phase 3: People Tab Enhancement (Week 3)

### 3.1 Provider Discovery Polish

**Objective**: Make People tab feel like a premium discovery experience.

**Actions**:
- [ ] Implement search with debounce (300ms) and recent searches
- [ ] Redesign filter sheet with:
  - Category multi-select chips
  - Distance slider (1km, 5km, 10km, 25km, 50km)
  - Price range picker
  - Rating filter (4+, 4.5+, 5.0)
  - Availability toggle
  - "Apply" and "Reset" buttons
- [ ] Redesign provider card:
  - Compact: Avatar, Name, Top service, Rating, Distance, Quick actions
  - Expanded: Full bio, portfolio carousel, reviews, response time
- [ ] Add "compare" mode (select up to 3 providers to compare side-by-side)
- [ ] Implement "nearby" toggle with geolocation
- [ ] Add "View on map" action that opens native maps
- [ ] Implement pull-to-refresh and infinite scroll pagination

**Files to modify**:
- `mobile/lib/features/people/presentation/people_page.dart`
- `mobile/lib/features/people/data/`

---

## Phase 4: Work Tab Simplification (Week 3-4)

### 4.1 Tasks/Orders Dashboard

**Objective**: Make Work tab feel like a command center, not a board inside a board.

**Actions**:
- [ ] Implement "What needs attention now?" hero section with primary action
- [ ] Redesign lane structure:
  - **Needs Action** (primary): Tasks requiring user input
  - **In Progress**: Active tasks being worked on
  - **Pending**: Awaiting others (quotes, payments)
  - **Completed**: Finished tasks
- [ ] Move role/lane filters into bottom sheet (as per 2026-05-10 audit)
- [ ] Add "Quick actions" floating button per lane
- [ ] Implement task card redesign:
  - Status indicator (color coded)
  - Title, provider/consumer name, price
  - Timeline/deadline with countdown
  - Quote status badge
  - Next action button
- [ ] Add "Swipe to complete" for task actions
- [ ] Implement "focus mode" via deep link to specific task with detail view
- [ ] Add partial failure recovery (orders load but help requests fail, show available data)

**Files to modify**:
- `mobile/lib/features/tasks/presentation/tasks_page.dart`
- `mobile/lib/features/tasks/domain/`

---

### 4.2 Order Detail Page Enhancement

**Objective**: Make order detail a complete cockpit for task management.

**Actions**:
- [ ] Redesign order detail with sections:
  - Header: Order ID, status, timeline
  - Parties: Consumer + Provider info with quick chat
  - Item: Service/product details with images
  - Payment: Amount, method, status, receipt download
  - Timeline: Status history with timestamps
  - Actions: Available actions based on status
- [ ] Add "Message" quick action button
- [ ] Add "Request modification" action
- [ ] Add "Submit proof" action with image upload
- [ ] Add "Rate experience" action after completion
- [ ] Implement "timeline" visual with connected dots

**Files to modify**:
- `mobile/lib/features/orders/presentation/order_detail_page.dart`

---

## Phase 5: Inbox/Chat Upgrade (Week 4)

### 5.1 Conversation List Polish

**Objective**: Make inbox feel alive and actionable, not empty or quiet.

**Actions**:
- [ ] Redesign conversation list item:
  ```
  [Avatar] [Name] [Time] [Unread badge]
          [Last message preview...]
          [Context: "Re: Plumbing quote" | "Order #123" | "Task: Fix tap"]
  ```
- [ ] Add "Online" indicator for active contacts
- [ ] Implement "typing..." indicator in list
- [ ] Add search within conversations
- [ ] Add "Archive" and "Mute" swipe actions
- [ ] Implement "Mark all read" action
- [ ] Redesign empty state to be helpful, not silent

**Files to modify**:
- `mobile/lib/features/chat/presentation/chat_page.dart`

---

### 5.2 Chat Thread Enhancement

**Objective**: Make chat feel native and trustworthy.

**Actions**:
- [ ] Redesign message bubble with:
  - Sent: right-aligned, primary color
  - Received: left-aligned, surface color
  - Timestamp below bubble
  - Read receipt indicator (checkmarks)
- [ ] Add "Message actions" (long press): copy, reply, delete (own messages)
- [ ] Implement "context bar" showing related task/order/quote
- [ ] Add "Quick replies" suggestions based on context
- [ ] Add "Send location" action
- [ ] Add "Image attachment" with camera/gallery options
- [ ] Implement "scroll to latest" FAB when scrolled up
- [ ] Add "Typing..." indicator received
- [ ] Add "Online/Last seen" status in header
- [ ] Implement "Block user" and "Report" in header menu

---

### 5.3 Quote Room Special Handling

**Objective**: Make quote room feel like a deal workspace, not generic chat.

**Actions**:
- [ ] Redesign quote room header: shows request title, status, price range
- [ ] Add "Quote summary" card at top showing:
  - Request details
  - Your quote (if sent)
  - Their quote (if received)
  - Negotiation history
- [ ] Add structured "Send quote" action with:
  - Price input
  - Timeline estimate
  - Message
  - Attachments
- [ ] Add "Accept/Reject" quick actions when receiving quote
- [ ] Add "Counter-offer" flow
- [ ] Add "Create order from quote" action

**Files to modify**:
- `mobile/lib/features/quotes/presentation/quote_room_page.dart`

---

## Phase 6: Profile Command Center (Week 5)

### 6.1 Profile Page Transformation

**Objective**: Transform Profile from text info page to clickable command center.

**Actions**:
- [ ] Redesign profile header:
  - Cover image (tap to change)
  - Avatar with verification badge
  - Name, tagline, location
  - "Edit" and "Share" actions
- [ ] Create sub-page navigation grid:
  ```
  [Public Profile] [Edit Profile]
  [My Listings]    [Saved Items]
  [Trust & Reviews][Payment Methods]
  [Settings]       [Help & Support]
  ```
- [ ] Add "Business AI" prominent entry (per 2026-05-10 audit)
- [ ] Add "Orders" quick access
- [ ] Add "Messages" quick access
- [ ] Redesign stats section: completed jobs, rating, member since, response time
- [ ] Implement "profile completeness" progress indicator

**Files to modify**:
- `mobile/lib/features/profile/presentation/profile_page.dart`

---

### 6.2 Public Profile View

**Objective**: Create shareable, trustworthy public profile view.

**Actions**:
- [ ] Implement public profile page with:
  - Cover image
  - Avatar, name, tagline, location, verified badges
  - About section
  - Services/Expertise with pricing
  - Portfolio/Gallery
  - Reviews (with rating breakdown)
  - Response time, repeat hire rate
  - "Contact" CTA button
  - "Report" option
- [ ] Add share sheet with deep link to profile
- [ ] Add "Save" action to follow provider

---

### 6.3 Settings Page

**Objective**: Create comprehensive settings with proper grouping.

**Actions**:
- [ ] Implement settings with groups:
  - **Account**: Email, Phone, Password, Delete account
  - **Notifications**: Push, Email, SMS preferences
  - **Privacy**: Profile visibility, Data sharing
  - **Appearance**: Theme, Language
  - **Payments**: Default method, Billing history
  - **Legal**: Terms, Privacy, Refund policy
  - **About**: Version, Rate app, Share, Contact
- [ ] Add "Logged in as" indicator
- [ ] Add confirmation dialogs for destructive actions

---

## Phase 7: Business AI Control Center (Week 5-6)

### 7.1 Provider Launchpad Enhancement

**Objective**: Make Business AI a real control surface, not just a prompt.

**Actions**:
- [ ] Wire up `AppRoutes.control` properly in shell (was missing per 2026-05-08 doc)
- [ ] Redesign control page with:
  - **Setup Progress**: Visual progress bar with checklist
    - [ ] Profile complete
    - [ ] Business info verified
    - [ ] First listing published
    - [ ] Payment method added
    - [ ] Trust badges earned
  - **Quick Stats**: Today's views, leads, quotes, revenue
  - **Lead Feed**: Recent inquiries with accept/reject actions
  - **Listings Management**: Active, Draft, Archived tabs
  - **Quote Room**: Pending, Sent, Accepted, Lost
  - **Trust Panel**: Reviews, ratings, badges
  - **Recommended Actions**: AI-suggested next steps

**Files to modify**:
- `mobile/lib/features/provider/presentation/provider_launchpad_page.dart`
- `mobile/lib/features/control/presentation/control_page.dart`

---

### 7.2 Provider Onboarding Flow

**Objective**: Make provider setup feel guided and achievable.

**Actions**:
- [ ] Redesign onboarding with steps:
  1. **Welcome**: Value proposition, what to expect
  2. **Category Selection**: What type of services
  3. **Profile Setup**: Name, tagline, bio, photos
  4. **Service Details**: What you offer, pricing
  5. **Location**: Service area radius, address
  6. **Verification**: ID, skills, portfolio
  7. **Payment**: How you'll get paid
  8. **Launch**: Confirm and go live
- [ ] Add progress indicator
- [ ] Add "Save for later" at each step
- [ ] Add validation with helpful error messages
- [ ] Add "Skip" option with reminder later

---

### 7.3 Listings Management

**Objective**: Make listing management feel powerful but simple.

**Actions**:
- [ ] Implement listings page with:
  - Tabs: Active, Draft, Archived
  - List view with thumbnail, title, price, status badge
  - Quick actions: Edit, Pause, Delete, Duplicate
  - "Add new listing" FAB
- [ ] Create listing editor with:
  - Title, description
  - Category, subcategory
  - Pricing (fixed/starting from/negotiable)
  - Images (up to 5, drag to reorder)
  - Availability schedule
  - Location/Service area
  - FAQs
- [ ] Add "Preview" mode before publish

---

## Phase 8: Cart & Checkout Flow (Week 6)

### 8.1 Cart Sheet Enhancement

**Objective**: Make cart feel trustworthy and actionable.

**Actions**:
- [ ] Redesign cart sheet:
  - Item thumbnail, title, provider name
  - Quantity selector
  - Price (unit and subtotal)
  - Remove item swipe action
  - Subtotal at bottom
  - "Proceed to checkout" CTA
- [ ] Add "Seller notes" text field
- [ ] Add "Apply coupon" field
- [ ] Implement cart persistence across sessions
- [ ] Add "Price breakdown" expansion

**Files to modify**:
- `mobile/lib/features/cart/`

---

### 8.2 Checkout Flow Redesign

**Objective**: Create stepped checkout with clarity and recoverability.

**Actions**:
- [ ] Implement stepped checkout flow:
  - **Step 1: Review Items**: Cart summary, edit quantities
  - **Step 2: Delivery**: Address selection/entry, time slot
  - **Step 3: Payment**: Method selection, promo code, price summary
  - **Step 4: Confirm**: Final review, T&C acceptance, place order
- [ ] Add "Saved addresses" quick selection
- [ ] Add "Add new address" inline form
- [ ] Implement payment method selection:
  - Card (Razorpay integration)
  - UPI
  - Cash on delivery (if applicable)
  - Wallet (if applicable)
- [ ] Add price breakdown: item total, delivery, taxes, discount, total
- [ ] Add "Order placed" confirmation with:
  - Order ID
  - Summary
  - Expected timeline
  - Track order CTA
  - Continue shopping CTA

**Files to modify**:
- `mobile/lib/features/orders/presentation/checkout_page.dart`

---

### 8.3 Order Tracking

**Objective**: Make order tracking feel live and reassuring.

**Actions**:
- [ ] Implement order tracking page with:
  - Order status timeline (visual stepper)
  - Current status highlight
  - Next expected action
  - Provider/Consumer info
  - Item details
  - Payment details
  - "Message" quick action
  - "Need help?" support option
- [ ] Add push notification triggers for status changes
- [ ] Add "Share tracking" action

---

## Phase 9: Search & Discovery (Week 6-7)

### 9.1 Global Search Enhancement

**Objective**: Make search feel powerful and helpful.

**Actions**:
- [ ] Redesign search page with:
  - Recent searches (local storage)
  - Popular searches
  - Category quick access
  - Results grouped by type (Providers, Services, Tasks)
- [ ] Implement search suggestions with debounce
- [ ] Add filter chips after search
- [ ] Add "Search near me" toggle
- [ ] Add voice search option (if platform supports)
- [ ] Implement search history with clear option

**Files to modify**:
- `mobile/lib/features/search/presentation/search_page.dart`

---

### 9.2 Deep Linking Support

**Objective**: Make app handle external links gracefully.

**Actions**:
- [ ] Implement handling for:
  - `serviqapp.com/p/{providerId}` - Public profile
  - `serviqapp.com/t/{taskId}` - Task detail
  - `serviqapp.com/o/{orderId}` - Order detail
  - `serviqapp.com/q/{quoteId}` - Quote room
  - `serviqapp.com/l/{listingId}` - Listing detail
- [ ] Add "Share content" with proper URL scheme
- [ ] Implement "Open in app" for universal links

---

## Phase 10: Trust & Safety (Week 7)

### 10.1 Verification & Badges

**Objective**: Build trust through visible verification.

**Actions**:
- [ ] Implement verification badges:
  - Email verified
  - Phone verified
  - Identity verified
  - Skills verified
  - Payment verified
- [ ] Add badge display on profile and cards
- [ ] Add "What this means" tooltip

---

### 10.2 Review System

**Objective**: Make reviews trustworthy and actionable.

**Actions**:
- [ ] Implement review display:
  - Overall rating (stars + number)
  - Rating breakdown (5 bars)
  - Review list with filters (recent, with photos, by category)
  - "Rate this experience" for completed orders
- [ ] Add review composer:
  - Star rating (1-5)
  - Category ratings (quality, communication, value)
  - Written review (min 10 chars)
  - Photo attachments (optional)
  - "Would recommend" toggle

---

### 10.3 Safety Features

**Objective**: Add safety features for user protection.

**Actions**:
- [ ] Implement "Report" flow:
  - Category: Spam, Harassment, Unsafe, Misleading, Other
  - Description field
  - Evidence attachment
  - Submit confirmation
- [ ] Add "Block user" in chat header
- [ ] Add "Safety tips" in onboarding
- [ ] Add emergency contact access in profile

---

## Phase 11: Performance & Reliability (Week 7-8)

### 11.1 Performance Optimization

**Objective**: Make app feel instant under all conditions.

**Actions**:
- [ ] Implement image caching with `cached_network_image`
- [ ] Add lazy loading for lists (pagination)
- [ ] Implement skeleton screens for all async content
- [ ] Add "offline mode" indicator
- [ ] Optimize bundle size (tree shaking, code splitting)
- [ ] Add performance monitoring (Firebase Performance)

---

### 11.2 Error Handling & Recovery

**Objective**: Make failures graceful and recoverable.

**Actions**:
- [ ] Implement comprehensive error boundaries
- [ ] Add retry mechanisms with exponential backoff
- [ ] Implement "last known good state" caching
- [ ] Add "Connection lost" banner with auto-reconnect
- [ ] Implement proper error messages (not just "Something went wrong")
- [ ] Add error reporting to crashlytics

---

### 11.3 Data Sync Strategy

**Objective**: Ensure mobile data matches database and web.

**Actions**:
- [ ] Audit all mobile API calls vs web endpoints
- [ ] Fix any field gaps or mapper mismatches
- [ ] Implement "pull to refresh" on all list screens
- [ ] Add "last synced" timestamp display
- [ ] Implement "sync in background" for non-critical data
- [ ] Fix auth header issues for protected endpoints

---

## Phase 12: Polish & Ship (Week 8)

### 12.1 Final UI Polish

**Objective**: Ensure billion-dollar feel through细节.

**Actions**:
- [ ] Add micro-animations:
  - Button press scale (0.95)
  - Card tap ripple
  - Page transitions (fade + slide)
  - Success checkmark animation
  - Loading spinner custom design
- [ ] Add haptic feedback for key actions
- [ ] Polish all icons (consistent stroke width)
- [ ] Ensure text is readable (contrast, size)
- [ ] Add "rate app" prompt after positive order completion
- [ ] Add "share app" option in settings

---

### 12.2 Testing & QA

**Objective**: Ensure ship quality through thorough testing.

**Actions**:
- [ ] Run all tests (`flutter test`)
- [ ] Run analyzer (`flutter analyze`)
- [ ] Build iOS for simulator
- [ ] Build Android for internal testing
- [ ] Conduct smoke tests on physical devices:
  - Sign in flow
  - Home load
  - People load
  - Work load
  - Inbox load
  - Profile load
  - Create need flow
  - Checkout flow
- [ ] Document any friction in `mobile/release/friction_log.md`

---

### 12.3 Release Preparation

**Objective**: Prepare for production release.

**Actions**:
- [ ] Update version to meaningful release (e.g., 1.0.0)
- [ ] Configure Firebase for production
- [ ] Configure Supabase for production
- [ ] Configure Razorpay for production
- [ ] Generate release build for Android
- [ ] Generate signed iOS archive (requires Apple Developer)
- [ ] Set up crashlytics symbol upload
- [ ] Configure app store listings

---

## Implementation Priority Order

### P0 - Must Ship (Week 1-4)
1. Design system polish (Phase 1.1)
2. Bottom nav overhaul (Phase 1.2)
3. Core tab loading states (Phase 1.3)
4. Home compact actions (Phase 2.1)
5. Feed card redesign (Phase 2.2)
6. Work tab simplification (Phase 4.1)
7. Profile command center (Phase 6.1)

### P1 - Important (Week 5-6)
8. Business AI control center (Phase 7.1)
9. Cart & checkout polish (Phase 8)
10. Chat enhancement (Phase 5)
11. Provider listings management (Phase 7.3)

### P2 - Nice to Have (Week 7-8)
12. Search enhancements (Phase 9)
13. Trust features (Phase 10)
14. Performance optimization (Phase 11)
15. Final polish (Phase 12)

---

## Dependencies & Notes

### Existing Assets to Leverage
- Web app components in `app/components/` for reference
- API endpoints in `app/api/` - ensure mobile parity
- Database schema in `supabase/migrations/`
- Design tokens in `mobile/lib/core/theme/design_tokens.dart`

### Technical Considerations
- Riverpod for state management (already in use)
- go_router for navigation (already in use)
- Supabase for backend (already integrated)
- Firebase for notifications + crashlytics (already integrated)
- Razorpay for payments (already integrated)

### Key Risks
- iOS signing requires Apple Developer account
- Some web features may need mobile-specific API endpoints
- Offline mode requires careful data sync strategy
- Performance on lower-end Android devices needs testing

---

## Success Metrics

- [ ] First contentful paint < 2 seconds
- [ ] No blank tabs under any condition
- [ ] All core flows (post need, find provider, checkout) functional
- [ ] Crash-free rate > 99%
- [ ] Play Store and App Store ready builds generated