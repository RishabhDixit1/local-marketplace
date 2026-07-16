# Mobile Status Refresh — 2026-07-15

**Date:** 2026-07-15 (audit-only, zero files modified)
**Auditor:** opencode (read-only)
**Context:** Cold-start jank fixes were applied earlier tonight. Web app has since had nav restructure, post card improvements, market view improvements, and dashboard loading state. This doc reconciles mobile against both.

---

## Part A — Performance Status

### A.1 Fix Status Table

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | `AppConfig.load()` blocks `runApp()` | **FIXED** | `main.dart:28-32` — now uses synchronous `AppConfig.fromEnvironment()`. Full load deferred to `_startBootstrap()` at `main.dart:110-122`. |
| 2 | Feed screen uses `ListView(children:...)` | **FIXED** | `feed_page.dart:601` — main feed now uses `ListView.builder`. `_ExploreFeedLane` at `feed_page.dart:1100` also uses `ListView.builder` with `shrinkWrap: true`. |
| 3 | Welcome screen uses `SliverChildListDelegate.fixed` | **FIXED** | `welcome_page.dart:712-717` — now uses `SliverChildBuilderDelegate` with lazy builder. |
| 4 | SecureStorage sequential reads (3× 100-500ms) | **NOT FIXED** | No pre-warm/prefetch found. `_startBootstrap()` still calls `AppBootstrap.initialize()` which runs `Supabase.initialize()` → 3 sequential `FlutterSecureStorage` reads. `local_storage.dart:6,38` wraps `FlutterSecureStorage` with no optimization. |
| 5 | All performance data from `--debug` mode | **NOT FIXED** | `scripts/run-mobile.sh:164` still runs bare `flutter run` — no `--profile` or `--release` flag. Debug mode significantly overstates jank (JIT, assert checks, debug bridges). |

### A.2 Newly Discovered Performance Issues

| # | Issue | File:Line | Severity | Detail |
|---|-------|-----------|----------|--------|
| N1 | People page: `ListView(children: [...])` anti-pattern | `people_page.dart:383-586` | **HIGH** | Outer `ListView` wraps a `Column` that builds ALL filtered provider cards eagerly via `...filtered.map()` at line 561. With many providers, every card is built off-screen. Not covered by original audit. |
| N2 | Explore lanes use `Column` with spread for marketplace sections | `feed_page.dart:1014-1059` | **MEDIUM** | `_ExploreMarketplaceLanes` builds a `Column` with spread children (`urgentRequests`, `recommendedPeople`, `nearbyRequests`). Each sub-lane uses `ListView.builder` with `shrinkWrap: true` + `NeverScrollableScrollPhysics` — child list is pre-materialized before being passed to the builder, defeating lazy construction. |
| N3 | Market zones screen: `Column` for zone listings | `market_zones_screen.dart:90,143,175` | **LOW** | Uses nested `Column` widgets for zone type tabs. Typically small item counts; low impact. |
| N4 | Order detail page: `Wrap` + `List.generate` for media/timeline | `order_detail_page.dart:1189,1217` | **LOW** | `Wrap` builds all delivery photos eagerly; `List.generate` builds all timeline steps. Item counts are typically small (< 10). |

### A.3 Build Mode Analysis

| Check | Finding |
|-------|---------|
| Run script default mode | Debug (`scripts/run-mobile.sh:164` — bare `flutter run`) |
| `--profile` flag ever used? | **No** — no evidence in scripts, docs, or git history |
| `--release` flag ever used? | **No** — `build.gradle.kts` has release signing config (lines 52-68) but requires keystore setup |
| Debug-mode overhead | JIT compilation, assert checks, debug platform channel bridges — all significantly inflate frame times vs. release |
| Recommendation | Run `flutter run --profile` before any further performance work. Current numbers are not representative of real-device performance. |

### A.4 Performance Summary

- **3 of 5 originally-flagged issues are fixed** (AppConfig defer, feed ListView.builder, welcome SliverChildBuilderDelegate)
- **2 issues remain unfixed** (SecureStorage pre-warm, profile mode testing)
- **1 newly-discovered high-severity issue** (People page `ListView(children:...)`)
- **No screen was tested in profile mode** — all performance data is from debug, which is the single biggest methodological gap

---

## Part B — Feature/UX Parity

### B.1 Current Web Nav Structure (post-restructure)

The web dashboard was recently restructured. Key changes vs. the state when the parity docs were written:

| Element | Old Web | Current Web |
|---------|---------|-------------|
| **Mobile bottom nav** | (varied) | `baseNavigationTabs`: Market, My Work, Explore + "More" overflow |
| **Profile access** | Separate tab/route | **User avatar icon** (`<User>` in header, line 903-924) that opens a dropdown menu with "View Public Profile" / "Complete Profile" / Logout |
| **Dashboard loading** | Basic spinner | **Polished skeleton state** — animated spinner + pulse cards (`layout.tsx:590-613`) |
| **Post card layout** | (prior) | Improved visual hierarchy with trust, urgency, price, distance |
| **Market view** | (prior) | Improved zone card layout with better spacing |

**Web mobile bottom nav items** (from `MobileBottomNav.tsx:40-63`):
1. Home (`/`)
2. Explore Markets (`/market`)
3. Dashboard (`/dashboard`) — auth-only
4. Sign In (`/login`) — guest-only
5. List Business (`/onboarding/provider/locality`) — CTA

**Note:** Web mobile bottom nav has **NO Profile tab**. Profile is accessed exclusively via the header avatar icon.

### B.2 Current Mobile Nav Structure

**Flutter bottom nav items** (from `main_bottom_nav.dart:158-186`):
1. **Home** (`/app/welcome`)
2. **People** (`/app/people`)
3. **Work** (`/app/tasks`)
4. **Inbox** (`/app/chat`)
5. **You** (`/app/profile`) — dedicated Profile tab with `Icons.person_outline_rounded`

**Critical divergence:** Mobile still has a dedicated **"You" (Profile) bottom nav tab**, while web has moved Profile to a header avatar icon. Mobile does NOT have a "Market" or "Explore" tab — that content lives within the Home/Welcome screen.

### B.3 Parity Status Table — From Phase-0 Inventory (`2026-05-04-phase-0-parity-inventory.md`)

| Screen | Previous Stance | Current Status | Notes |
|--------|----------------|----------------|-------|
| `/app/welcome` vs `/dashboard/welcome` | Partial | **PARTIALLY DONE** | Welcome page exists with hero, greeting, task/chat counts. Uses `SliverChildBuilderDelegate`. Missing: dashboard-style loading skeleton, zone pills, Market AI integration. |
| `/app/explore` vs `/dashboard` | Partial | **PARTIALLY DONE** | FeedPage with `ListView.builder`. Missing: polished card density matching improved web cards, dashboard hero layout. |
| `/app/people` vs `/dashboard/people` | Partial | **NOT DONE** | PeoplePage has search/filter/compare. **Performance regression**: `ListView(children:...)` anti-pattern (see A.2 N1). Missing: connect/save flows, presence indicators matching web. |
| `/app/tasks` vs `/dashboard/tasks` | Partial | **NOT DONE** | TasksPage exists. Missing: unified Inbox/Active/Orders/Quotes/History IA, map overlay (web has `LiveTaskOverlay`). |
| `/app/chat` vs `/dashboard/chat` | Partial | **PARTIALLY DONE** | ChatPage with `ListView.builder` for conversations. Missing: composer polish parity. |
| `/app/profile` vs dashboard profile | Partial | **PARTIALLY DONE** | ProfilePage exists. Missing: separate View Profile / Edit Profile / Business Setup split, public profile preview, profile readiness panel. |
| `/app/orders` vs `/dashboard/orders` | Partial | **PARTIALLY DONE** | OrdersPage + OrderDetailPage exist. Missing: provider lens integration, cart-first checkout. |
| `/app/checkout` vs `/checkout` | Partial | **PARTIALLY DONE** | CheckoutPage exists with Razorpay. Missing: cart state (add/remove/quantity), cart sheet, order summary, same-provider cart enforcement. |
| `/app/provider-launchpad` vs launchpad | Partial | **PARTIALLY DONE** | LaunchpadPage exists but described as "too form-like." Missing: stepper flow, AI-generated output review, publish result screen. |
| `/app/provider-listings` vs listings | Partial | **PARTIALLY DONE** | ProviderListingsPage exists. |
| `/app/market` vs `/market` | N/A (web-only) | **DONE (mobile has own route)** | `MarketZonesScreen` with TabController (Societies/Markets/Supply Areas/Upcoming). Different UX pattern from web but functional. |

### B.4 Parity Status Table — From Premium Plan (`2026-05-03-flutter-webapp-parity-premium-plan.md`)

| Phase | Planned Goal | Status | Evidence |
|-------|-------------|--------|----------|
| **Phase 1: Design System** | Token refresh, shared primitives | **FULLY DONE** | `design_tokens.dart`, `app_theme.dart`, `ServiqSurface`, `ServiqAsyncBody`, `ServiqRecoveryBanner`, `ServiqStatusPill`/`ServiqLocationPill`/`ServiqPricePill` all implemented. Per Phase-0 inventory update (line 186-204). |
| **Phase 2: Auth & Onboarding** | Branded login, intent onboarding | **PARTIALLY DONE** | `sign_in_page.dart` has branded lockup, intent selector, resume handoff (`sign_in_page.dart:27-28`). `OnboardingWalkthroughPage` exists. Missing: `/api/mobile/account`-driven readiness banner, post-auth route polish. |
| **Phase 3: Business AI / Launchpad** | Stepper flow, AI output review, publish | **NOT DONE** | `provider_launchpad_page.dart` exists but is "too form-like." No stepper, no AI review screen, no generated output editor. Plan envisioned category chips, service selector, GPS helper, hours presets. |
| **Phase 4: Profile Command Center** | Split View/Edit/Business, readiness panel | **NOT DONE** | `profile_page.dart` exists as single dense page. No separate `edit_profile_page.dart`, no `public_profile_preview_page.dart`, no `profile_readiness_panel.dart`. Profile redirects `profileEdit` → `profile` and `profileTrust` → `profile` (router lines 196-202). |
| **Phase 5: Cards Premium Rebuild** | Premium card redesign, trust hierarchy | **PARTIALLY DONE** | `feed_card.dart` uses design tokens, `ServiqStatusPill`, `TrustSnapshot` (line 125-134). Missing: cover image priority, reason-surfaced model, compact vs rich variants, provider card cover strip with presence. |
| **Phase 6: Cart, Checkout, Orders** | Cart state, cart sheet, cart-first checkout | **PARTIALLY DONE** | `cartProvider` exists (referenced at `feed_page.dart:563`). `CheckoutPage` exists. Missing: cart bottom sheet, cart count badge in shell, add-to-cart/storefront actions, cart persistence across restart, order summary with provider grouping. |
| **Phase 7: Tasks Tab IA** | Unified Inbox/Active/Orders/Quotes/History | **NOT DONE** | `tasks_page.dart` exists. No evidence of the 5-section IA (Inbox/Active/Orders/Quotes/History). No task source badges, no timeline view, no deep links to Chat/QuoteRoom/OrderDetail from task cards. |
| **Phase 8: Create Need Polish** | AI assist, preview, success state | **PARTIALLY DONE** | `create_need_page.dart` exists. Missing: AI title/category assist, preview before post, matches-notified success count, Chat/Tasks deep links on success. |
| **Phase 9: Trust & Safety** | Report/block, verification, payment trust | **PARTIALLY DONE** | `blocked_users_page.dart` exists. `dispute_sheet.dart` referenced in `order_detail_page.dart:17`. Trust tokens on feed cards. Missing: verification explanation surfaces, payment trust copy (Razorpay handoff, COD risk), rate limit surfacing. |
| **Phase 10: Analytics & QA** | Analytics events, crashlytics, tests | **PARTIALLY DONE** | `analytics_service.dart` exists, analytics page exists. `flutter analyze` likely passes per Flutter convention. Missing: comprehensive widget tests for narrow widths, Firebase DebugView funnel proof. |

### B.5 Cross-Reference: Mobile vs. Current Web Structure

| Web Feature | Mobile Equivalent | Match? |
|-------------|-------------------|--------|
| **Nav: Market in bottom/primary nav** | No dedicated Market tab — Market zones accessed via route | **NO** — mobile Home serves as "market" conceptually, but no explicit Market browsing tab |
| **Nav: Profile via avatar icon in header** | Profile is a full "You" bottom nav tab | **NO** — mobile still uses OLD pattern (dedicated tab) |
| **Dashboard loading skeleton** (animated pulse cards) | `_BootstrapLoadingApp` with branded gradient + progress bar | **PARTIAL** — mobile has polished loading state but different design (text-heavy vs skeleton cards) |
| **Post card: trust, urgency, price, distance hierarchy** | Feed card has type pills, status pills, title, description, meta pills, trust snapshot | **PARTIAL** — mobile has trust + urgency + status but lacks prominent price/distance positioning |
| **Dashboard hero zone pills** | No equivalent — welcome page has hero section but no zone pill navigation | **NO** |
| **Dashboard prompt bar / Market AI** | No equivalent | **NO** |
| **Create post modal overlay** | Create post is a full-page route (`/app/create-need`) | **DIFFERENT PATTERN** — functional but not the overlay UX |
| **Cart drawer (slide-out)** | Cart is a bottom sheet (`showServiqCartSheet`) | **DIFFERENT PATTERN** — functional |
| **More overflow menu (mobile web)** | No overflow — all items in bottom nav or accessible via app bar | **N/A** — different paradigm |
| **Desktop sidebar nav** | Navigation rail for wide screens (`MainNavigationRail`) | **ALIGNED** — both use collapsible side nav for wider viewports |

### B.6 Features on Web with NO Mobile Equivalent

| Web Feature | Web Location | Mobile Status |
|-------------|-------------|---------------|
| **Dashboard prompt / AI bar** | `DashboardPromptContext.tsx` in header | **MISSING** — no AI interaction surface |
| **Market AI floating** | `MarketAiFloating` component | **MISSING** |
| **Campaigns management** | `/dashboard/campaigns` in secondary nav | **MISSING** |
| **A/B Tests** | `/dashboard/tests` in secondary nav | **MISSING** (admin feature) |
| **Referral Leaderboard** | `/dashboard/referrals/leaderboard` | **MISSING** — referrals page exists but no leaderboard |
| **Saved hub / library** | `/dashboard/saved` with dedicated view | **DEFERRED** — `SavedFeedPage` exists but limited per Phase-0 note |
| **Live task overlay / map** | `LiveTaskOverlay.tsx` | **PARTIAL** — `MapDiscoveryPage` exists but different UX |
| **Providers directory** (separate from People) | `/dashboard/providers` | **MISSING** — mobile People page covers this conceptually but web has separate route |
| **Workspaces** | `/dashboard/workspaces` | **PARTIAL** — `workspaces_page.dart` exists in mobile |
| **Invoices** | `/dashboard/invoices` | **PARTIAL** — `invoices_page.dart` exists in mobile |

---

## Prioritized Combined Findings

Ranked by user-facing impact, combining performance (Part A) and parity (Part B):

| Priority | Finding | Type | Impact | Effort |
|----------|---------|------|--------|--------|
| **P0** | People page `ListView(children:...)` builds all provider cards eagerly | Performance | HIGH — scrolls poorly with many providers | LOW — convert to `ListView.builder` |
| **P0** | All performance data from `--debug` mode; no `--profile` run exists | Methodology | HIGH — cannot trust any perf numbers until profile mode is tested | LOW — add `--profile` flag to run script |
| **P1** | SecureStorage sequential reads still not pre-warmed | Performance | HIGH — contributes to 334-frame skip on cold start | MEDIUM — requires splash-time prefetch design |
| **P1** | Mobile "You" tab vs. web avatar-based Profile pattern | Parity/UX | HIGH — mobile nav structure is stale vs. web restructure | MEDIUM — requires nav redesign |
| **P1** | No Market tab in mobile bottom nav (web has Explore Markets) | Parity/UX | HIGH — mobile users can't easily discover marketplace browsing | MEDIUM — requires nav restructuring |
| **P2** | People page lacks connect/save flows matching web | Parity | MEDIUM — core marketplace interaction gap | MEDIUM |
| **P2** | Tasks tab missing unified IA (Inbox/Active/Orders/Quotes/History) | Parity | MEDIUM — confusing task/order/quote discovery | HIGH |
| **P2** | Cart lacks add-to-cart, cart sheet, cart persistence | Parity | MEDIUM — commerce flow incomplete | HIGH |
| **P2** | No dashboard loading skeleton (pulse cards) matching web | Parity | MEDIUM — cold-start UX less polished than web | LOW |
| **P2** | Feed card missing prominent price/distance positioning | Parity | MEDIUM — key marketplace conversion signals deprioritized | LOW |
| **P3** | Business AI / Launchpad still form-like, no stepper | Parity | LOW-MED — provider onboarding friction | HIGH |
| **P3** | Profile page is dense single page, no Edit/View/Business split | Parity | LOW-MED — provider command center gap | HIGH |
| **P3** | Dashboard hero zone pills missing on mobile | Parity | LOW — zone discovery less prominent | MEDIUM |
| **P3** | No AI prompt bar / Market AI on mobile | Feature gap | LOW — mobile-first users miss AI assist | HIGH |
| **P4** | Explore lanes pre-materialize child lists despite `ListView.builder` | Performance | LOW — sub-lanes capped at 2-4 items | LOW |
| **P4** | Market zones screen uses Column (low item count) | Performance | LOW | N/A |
| **P4** | Campaigns/A/B Tests/Referral Leaderboard missing | Feature gap | LOW — admin/advanced features | MEDIUM |
| **P4** | Create need missing AI assist, preview, success deep links | Feature gap | LOW | MEDIUM |

---

## Verification

**Files modified during this audit: ZERO**

This document was written to `docs/2026-07-15-mobile-status-refresh.md` via the `Write` tool, which is the only file change. No source code was modified. `git diff --stat` on source directories would show only this new doc file.

```
$ git diff --stat
# Expected: empty for all paths except docs/2026-07-15-mobile-status-refresh.md (new file)
```
