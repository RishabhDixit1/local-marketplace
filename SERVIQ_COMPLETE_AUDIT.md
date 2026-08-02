# ServiQ Genesis — Complete Product Audit & Reimagination

> **Author**: Founding Principal Product Designer, UX Architect, Flutter Staff Engineer, System Architect, AI Product Strategist
> 
> **Date**: July 30, 2026
> 
> **Status**: Pre-revenue. Zero transactions. Zero active providers. Zero revenue.
> 
> **Mandate**: Evolve from "marketplace MVP" to "Operating System for Every Neighborhood."

---

# Phase 1 — Discovery: Complete Audit

## 1.1 Product Map

### What exists

| Layer | Coverage | Quality |
|---|---|---|
| **Landing (Web)** | Hero + search + category grid + CTA. Seasonal themes (monsoon). | ⭐⭐⭐ Polished, good UX |
| **Search (Web)** | Full-text search, category filter, rating sort, provider cards | ⭐⭐⭐ Good, paginated |
| **Market (Web)** | Zone-based locality browsing (Crossing Republik et al.) | ⭐⭐ Feature-complete, zero usage |
| **Dashboard (Web)** | 1139-line layout with sidebar nav + mobile bottom nav | ⭐⭐ Functional but bloated |
| **Chat (Web + Flutter)** | Full realtime messaging, images, read receipts, typing indicators | ⭐⭐⭐⭐ Best-in-app feature |
| **Quotes/Deal Room (Web + Flutter)** | Quote creation, AI drafting, comparison view, deal room | ⭐⭐⭐ Built well, zero usage |
| **Orders (Web + Flutter)** | 11-state workflow, Razorpay integration, COD | ⭐⭐⭐ Feature-complete |
| **Feed (Flutter)** | Paginated card feed with scope filtering, saves, interactions | ⭐⭐⭐⭐ Well engineered |
| **Notifications (Both)** | Realtime push + in-app, grouped, filterable | ⭐⭐⭐ Good implementation |
| **AI Prompt (Both)** | Gemini-powered intent parsing, search, matching, orchestration | ⭐⭐ Fragmented but promising |
| **AI Launchpad (Web)** | Provider profile generation from 7 questions | ⭐⭐ Built, zero usage |
| **Provider Tools (Both)** | Listings, analytics, payouts, subscriptions, boosts, workspaces | ⭐⭐ Feature-rich, overwhelming |
| **Design System (Flutter)** | Tokens, surfaces, chrome, pills, buttons, scaffolds | ⭐⭐⭐⭐⭐ Mature token system |
| **Design System (Web)** | Tailwind CSS variables + light/dark theme | ⭐⭐ Good foundation, inconsistent usage |
| **Auth (Both)** | Email OTP, magic link, Google/Apple OAuth, password | ⭐⭐⭐ Solid |
| **Onboarding (Both)** | Seeker category selection, provider launchpad wizard | ⭐⭐ Fragmented across platforms |

## 1.2 Feature Inventory — 40 Flutter Feature Modules

| # | Feature | Files | LOC (est) | Health | Issues |
|---|---------|-------|-----------|--------|--------|
| 1 | admin | 3 | ~400 | ⚠️ | No RLS filtering by admin role |
| 2 | ai_prompt | 2 | ~200 | ⚠️ | Thin, most logic in shared/widgets |
| 3 | analytics | 3 | ~500 | ⚠️ | Provider-facing, no real data |
| 4 | auth | 12 | ~1500 | ✅ | Well structured |
| 5 | availability | 3 | ~400 | ✅ | Clean |
| 6 | blocking | 5 | ~350 | ⚠️ | Over-engineered for MVP |
| 7 | bookings | 3 | ~350 | ⚠️ | Duplicates order concepts |
| 8 | cart | 4 | ~500 | ⚠️ | Separate from order flow |
| 9 | chat | 3 | ~8000 | ✅ | Best-engineered feature |
| 10 | connections | 3 | ~600 | ⚠️ | Unclear value prop |
| 11 | control | 1 | ~300 | ❌ | God page, no structure |
| 12 | disputes | 3 | ~400 | ⚠️ | Premature for zero transactions |
| 13 | feed | 4 | ~2500 | ✅ | Solid engineering |
| 14 | invoices | 4 | ~500 | ⚠️ | Premature |
| 15 | listings | 1 | ~300 | ⚠️ | Single monolithic detail page |
| 16 | marketplace | 3 | ~2500 | ⚠️ | Overlapping with search + feed |
| 17 | notifications | 3 | ~600 | ✅ | Good |
| 18 | onboarding | 1 | ~200 | ⚠️ | Only seeker, provider missing |
| 19 | orders | 7 | ~2000 | ✅ | Well structured |
| 20 | payments | 3 | ~400 | ✅ | Clean |
| 21 | payouts | 5 | ~500 | ⚠️ | Premature for zero transactions |
| 22 | people | 3 | ~600 | ⚠️ | Overlaps with search |
| 23 | post_create | 2 | ~4500 | ⚠️ | Monstrous create_need page (81KB) |
| 24 | profile | 3 | ~3500 | ⚠️ | Role-based, too many responsibilities |
| 25 | promotions | 3 | ~400 | ⚠️ | Premature |
| 26 | provider | 11 | ~4000 | ⚠️ | Scattered across 11 files |
| 27 | public_profile | 1 | ~200 | ⚠️ | Thin |
| 28 | quotes | 5 | ~4000 | ✅ | Well structured, zero usage |
| 29 | referrals | 3 | ~400 | ⚠️ | Premature |
| 30 | reporting | 3 | ~300 | ❌ | Premature |
| 31 | reviews | 3 | ~400 | ✅ | Clean |
| 32 | saved | 1 | ~200 | ⚠️ | Thin |
| 33 | search | 4 | ~2500 | ✅ | Good |
| 34 | settings | 4 | ~600 | ✅ | Clean |
| 35 | subscriptions | 3 | ~400 | ⚠️ | Premature |
| 36 | task_post | 2 | ~300 | ⚠️ | Overlaps with post_create |
| 37 | tasks | 4 | ~1500 | ⚠️ | Overlaps with orders |
| 38 | verification | 3 | ~400 | ⚠️ | KYC flow, zero usage |
| 39 | welcome | 3 | ~5000 | ⚠️ | Huge, overlaps with feed |
| 40 | workspaces | 4 | ~800 | ❌ | Premature, zero usage |

### Summary
- **Healthy (✅)**: 10 features (25%)
- **Warning (⚠️)**: 25 features (62.5%)
- **Unhealthy (❌)**: 5 features (12.5%)

## 1.3 Web API Inventory — 58 Endpoint Groups

| Category | Endpoints | Usage | Health |
|----------|-----------|-------|--------|
| Auth | 4 | ⭐ Critical | ✅ |
| Orders | 7 | ⭐ Critical | ✅ |
| Payment | 3 | ⭐ Critical | ✅ |
| Quotes | 8 | Zero usage | ⚠️ |
| Profile | 4 | Medium | ✅ |
| Provider | 10 | Low | ⚠️ |
| Upload | 4 | Low | ✅ |
| Admin | 11 | Zero usage | ❌ Premature |
| Cron | 9 | Zero usage | ❌ Premature |
| Chat | 2 | Low | ✅ |
| Notifications | 3 | Low | ✅ |
| AI | 4 | Low | ⚠️ |
| Community | 3 | Zero usage | ❌ |
| Market | 3 | Zero usage | ❌ |
| Launchpad | 3 | Zero usage | ❌ |
| Reviews | 3 | Zero usage | ⚠️ |
| Subscriptions | 5 | Zero usage | ❌ |
| Invoices | 3 | Zero usage | ❌ |
| Workspaces | 8 | Zero usage | ❌ |
| Verification | 4 | Zero usage | ❌ |
| Connections | 2 | Zero usage | ⚠️ |
| Referrals | 4 | Zero usage | ❌ |
| Webhooks | 1 | Not tested | ⚠️ |
| Other | 20+ | Mostly zero | Various |

## 1.4 Screen Inventory — Flutter Routes

| Route | Widget | Tab | State |
|-------|--------|-----|-------|
| `/` | MarketplaceLandingPage | - | ⚠️ Splash + redirect |
| `/setup` | SetupPage | - | ✅ |
| `/sign-in` | LoginPage | - | ✅ |
| `/sign-up` | SignUpPage | - | ✅ |
| `/forgot-password` | ForgotPasswordPage | - | ✅ |
| `/onboarding` | OnboardingWalkthroughPage | - | ✅ |
| `/app/create-need` | CreateNeedPage | - | ⚠️ 81KB page |
| `/app/search` | SearchPage | - | ✅ |
| `/app/map` | MapDiscoveryPage | - | ⚠️ Low usage |
| `/app/notifications` | NotificationsPage | - | ✅ |
| `/app/public-business` | PublicBusinessPage | - | ⚠️ Thin |
| `/app/profile/settings` | SettingsPage | - | ✅ |
| `/app/seeker-onboarding` | SeekerOnboardingPage | - | ⚠️ Only seeker |
| `/app/provider-onboarding` | ProviderOnboardingPage | - | ⚠️ Only provider |
| `/app/provider-launchpad` | ProviderLaunchpadPage | - | ⚠️ Zero usage |
| `/app/provider-listings` | ProviderListingsPage | - | ⚠️ |
| `/app/payouts` | PayoutsPage | - | ❌ Premature |
| `/app/transactions` | TransactionsPage | - | ❌ Premature |
| `/app/referrals` | ReferralsPage | - | ❌ Premature |
| `/app/verification` | VerificationPage | - | ❌ Premature |
| `/app/analytics` | AnalyticsPage | - | ❌ No data |
| `/app/availability` | AvailabilityPage | - | ⚠️ |
| `/app/bookings` | BookingsPage | - | ⚠️ Duplicates orders |
| `/app/workspaces` | WorkspacesPage | - | ❌ Premature |
| `/app/workspaces/:id` | WorkspaceDetailPage | - | ❌ |
| `/app/orders` | OrdersPage | - | ✅ |
| `/app/orders/:id` | OrderDetailPage | - | ✅ |
| `/app/provider-orders` | ProviderOrdersPage | - | ⚠️ Separate from orders |
| `/app/provider-leads` | ProviderLeadsPage | - | ⚠️ |
| `/app/provider-boosts` | ProviderBoostsPage | - | ❌ |
| `/app/provider-subscriptions` | ProviderSubscriptionsPage | - | ❌ |
| `/app/invoices` | InvoicesPage | - | ❌ |
| `/app/invoices/:id` | InvoiceDetailPage | - | ❌ |
| `/app/connections` | ConnectionsPage | - | ⚠️ |
| `/app/admin` | AdminPage | - | ❌ Unsecured |
| `/app/checkout` | CheckoutPage | - | ⚠️ |
| `/app/saved` | SavedFeedPage | - | ⚠️ |
| `/app/listings/:id` | ListingDetailPage | - | ⚠️ |
| `/app/quote` | QuoteRoomPage | - | ⚠️ Zero usage |
| `/app/quote-comparison` | QuoteComparisonPage | - | ⚠️ |
| `/app/profile` | ProfilePage | - | ⚠️ |
| `/app/people` | PeoplePage | - | ⚠️ |
| `/app/provider/:id` | ProviderProfilePage | - | ⚠️ |

### Bottom Nav (4 tabs)
| # | Tab | Default | Alternate |
|---|-----|---------|-----------|
| 0 | Home | WelcomePage | FeedPage (explore) |
| 1 | Market | MarketZonesScreen | - |
| 2 | Work | TasksPage | - |
| 3 | Inbox | ChatPage | - |

## 1.5 Component Inventory — Shared Components

### Flutter Shared Components (19 + 8 = 27 files)
- `app_buttons.dart` — 320 lines, 4 button variants
- `app_text_field.dart` — 86 lines, standardized input
- `app_search_field.dart` — 45 lines
- `feed_card.dart` — 627 lines, complex feed card
- `provider_card.dart` — 615 lines, dual variants
- `marketplace_provider_card.dart` — 251 lines
- `marketplace_guidance.dart` — 326 lines
- `nameplate_card.dart` — 98 lines
- `premium_primitives.dart` — 357 lines
- `ai_prompt_bar.dart` — 569 lines, floating + inline AI

**Duplication problem**: `empty_state_view.dart` and `empty_state.dart` (shared/components vs shared/widgets). Same for `error_state_view.dart` / `error_state.dart`, `section_header.dart` / `section_header.dart`. These are two parallel shared component directories.

### Web Components (sparse)
- `AppFooter.tsx` — only top-level shared component
- Remaining components in `app/components/` (co-located)

## 1.6 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTS                              │
├──────────────────────────┬──────────────────────────────────┤
│   WEB (Next.js 16)       │   MOBILE (Flutter 3.41)         │
│   React 19, Tailwind 4   │   Riverpod, go_router           │
│   Client Components 👑    │   Design System ✅              │
│   Server Components ✅   │   40 features ⚠️                │
├─────────────┬────────────┴──────┬───────────────────────────┤
│             │                   │                           │
│    Landing / Public            │      Authenticated          │
│    ├── Landing page            │      ├── Dashboard (Web)    │
│    ├── Search                  │      ├── Feed (Flutter)     │
│    ├── Business pages          │      ├── Chat (Both)        │
│    ├── Profile pages           │      ├── Orders (Both)      │
│    └── Auth                    │      ├── Provider Tools     │
│                                │      └── Admin              │
├───────────────────────────────┴─────────────────────────────┤
│                     API LAYER (Next.js)                     │
│                  58 endpoint groups ~120 routes              │
├───────────────┬───────────────────┬─────────────────────────┤
│               │                   │                         │
│   SUPABASE    │    FIREBASE       │    RAZORPAY             │
│   Auth        │    Push           │    Orders               │
│   Postgres    │    Analytics      │    Payments             │
│   Realtime    │    Crashlytics    │    Payouts              │
│   RLS         │    Performance    │    Verification         │
│               │                   │                         │
├───────────────┴───────────────────┴─────────────────────────┤
│                     AI LAYER (Google Gemini)                │
│   Intent Parser → Intent Matching → Decision Engine →       │
│   Orchestrator → Search/Matching → Quote Drafting           │
│   Launchpad Generation → Content Moderation                 │
└─────────────────────────────────────────────────────────────┘
```

## 1.7 Technical Debt

### Critical Issues

1. **Zero-usage features create maintenance drag**: 20+ API endpoint groups, 15+ Flutter features, 10+ web pages with zero usage. Every feature requires testing, type-checking, and cognitive load — with zero validation.

2. **Duplicate shared component directories**: `shared/components/` AND `shared/widgets/` in Flutter contain overlapping primitives (`empty_state_view.dart` vs `empty_state.dart`, `error_state_view.dart` vs `error_state.dart`, `section_header.dart` vs `section_header.dart`).

3. **Monolithic pages**: `create_need_page.dart` (81KB), `chat_page.dart` (~75KB), `welcome_page.dart` (~58KB), `profile_page.dart` (~57KB), `quote_room_page.dart` (~58KB). These should be 15-25KB max.

4. **Web dashboard layout is 1139 lines**: One file managing sidebar, mobile nav, notifications, profile context, AI prompt, cart, onboarding guard, and multiple providers. Extreme coupling.

5. **Two Googles**: Firebase (push, analytics, crashlytics, performance) + Google Gemini (AI). No consolidation strategy.

6. **API duplication**: Both `supabase.ts` (browser) and `supabaseServer.ts` (server) duplicate client creation logic. `mobile_api_client.dart` is a third implementation.

7. **RLS gaps**: `setup_all.sql` shows RLS for 8 tables but many tables lack policies. Admin page has no admin role check.

8. **Order status 11 states**: `orderWorkflow.ts` defines `new_lead → quoted → accepted → paid → in_progress → completed → closed` with branching paths. Complex for zero orders.

### Moderate Issues

9. **Feature flags infrastructure exists but only 3 files**: Good pattern, but un-used.

10. **AI system is fragmented**: `intentParser.ts`, `intentMatching.ts`, `decisionEngine.ts`, `orchestrator.ts`, `matching.ts`, `quoteDrafting.ts` — these overlap. IntentParser does keyword matching AND LLM parsing. Orchestrator duplicates some matching logic.

11. **Offline queue is non-functional**: `offline_sync_manager.dart` enqueues operations but `_execute()` doesn't actually sync to a real queue endpoint. `OfflineOperation` has an enum but the execution is placeholder.

12. **Firebase on web is client-only**: Push notifications on web use Supabase directly but claim Firebase. The `firebase-messaging` integration on web appears unused.

13. **Profile concept overloaded**: `profiles` table has 40+ columns (name, role, location, services, availability, phone, website, avatar_url, latitude, longitude, etc.). Inconsistent with `display_name` vs `name` column usage.

### Minor Issues

14. **Magic strings**: Category names, status values, route paths used as strings instead of constants in many places.

15. **No E2E tests for critical flows**: Playwright tests check smoke/auth but not complete order→payment→review flow.

16. **16 parallel Dart test files but no coverage target**: Flutter tests exist but no coverage threshold or CI enforcement.

17. **`disputes`, `reporting` features built pre-revenue**: Zero transactions means zero disputes. Premature feature.

18. **Two concurrently-maintained migration bundles**: `supabase/migrations/` AND `supabase/new-migrations-bundle.sql` AND `supabase/pending-migrations-bundle.sql` AND root `supabase-migrations-bundle.sql`. Migration chaos.

## 1.8 UX Problems

### Critical UX Issues

1. **"What am I supposed to do here?"**: First-time users on both web and mobile are greeted with too many options. Landing page has hero, search bar, categories, social proof, sign-up CTA, and more. Dashboard has sidebar with 6 groups × 2-5 items each. The welcome page has 6 cards.

2. **Provider vs Seeker confusion**: The app tries to serve both sides from the same navigation. A seeker sees "Listings, Bookings, Payouts" in their sidebar. A provider sees "Saved Items, Orders" that don't apply.

3. **Overlapping concepts**: 
   - "Help Requests" vs "Posts" vs "Needs" vs "Tasks" vs "Orders" — these are the same thing at different stages
   - "Market" vs "Search" vs "Explore" vs "Feed" — multiple ways to discover providers
   - "Quotes" vs "Deal Room" vs "Orders" — quote is an order phase, not a separate concept
   - "Bookings" vs "Orders" vs "Tasks" — three different pages for managing work

4. **Zero state everywhere**: Since there are zero transactions, EVERY list page shows empty states. The app looks like a ghost town.

5. **AI feels bolted on**: AI prompt bar, floating AI button, dashboard prompt bar, market AI bar — four different AI entry points with different UX patterns.

6. **Navigation has no hierarchy**: 40+ routes in Flutter, 66+ pages on web. Users are 1-2 taps away from anything, but the path to the right thing is unclear.

### Moderate UX Issues

7. **Onboarding is split**: Seeker onboarding and provider onboarding are separate flows but don't connect. A user who signs up as seeker must re-onboard to become a provider.

8. **Chat is the best feature but buried**: Chat lives in tab 4 of the bottom nav and has limited discoverability. Users who need immediate help should start in chat, not search.

9. **Quote flow is confusing**: Create a need → providers respond → quotes come in → compare quotes → accept → order. That's 5+ steps before work starts. For "my AC broke" this feels bureaucratic.

10. **Launchpad is invisible**: The AI launchpad is hidden in dashboard navigation under Account group. Most providers won't find it.

11. **Search and AI compete**: The search page has keyword search with filters. The AI has intent parsing with suggestions. They produce different results. Which should users use?

12. **Mobile vs Web parity gaps**: Some features exist only on mobile (feed, map discovery, saved feed) while others only on web (launchpad, deal room, comparison).

## 1.9 Performance Problems

1. **No lazy loading in several Flutter pages**: `welcome_page.dart` renders everything at once.
2. **No image optimization strategy**: Web uses remote patterns but no next/Image in many places.
3. **Supabase queries without pagination limits**: Several queries in `intentMatching.ts` use `.limit(MAX_CANDIDATES)` but some API routes have no limit.
4. **Framer Motion on every page transition**: The dashboard layout uses `PageTransition` wrapper that adds animation overhead on every route change.
5. **Firebase on every boot**: `AppFirebase.initialize()` runs on every cold start even for anonymous users. Adds ~1-2s.
6. **8-second bootstrap timeout**: The Flutter app has an 8-second bootstrap timeout which is generous. Could be faster.
7. **No bundle splitting strategy**: The web app loads all dashboard features at once via the 1139-line layout.

## 1.10 Accessibility

1. **Flutter**: Semantic labels added to feed icons, chat back button, feed card images (noted in AGENTS.md). Partial coverage.
2. **Web**: `role="alert"` on login errors (added recently). No systematic accessibility review.
3. **Color contrast**: Dark mode CSS variables were recently fixed. Light mode not audited.
4. **Keyboard navigation**: Search page has keyboard support. AI bar has ArrowDown/Up navigation. No comprehensive keyboard audit.
5. **Screen reader support**: Missing `aria-label` on icon buttons, missing `role` on dynamic content.
6. **Touch targets**: `AppTouchTargets` defined at 48px minimum in Flutter design tokens. Not all widgets respect this.

## 1.11 Design System Health

### Flutter Design System ✅
- 7 core primitives: `ServiqSurface`, `ServiqScaffold`, `ServiqTopBar`, `ServiqPills`, `ServiqChrome`, `ServiqAsyncState`, `ServiqRecoveryBanner`
- 442 lines of design tokens: colors (80+), spacing (8 tiers), radii, shadows, gradients, breakpoints
- 830-line AppTheme with light + dark, Google Fonts
- Primitive components: buttons (4 variants), text field, search, cards, chips, pills, trust badges
- 17 pages migrated to ServiqScaffold/ServiqTopBar
- 200+ token replacements done

**Gaps**: No dialog primitive, no data table, no form primitives beyond text field, no stepper indicator, no progress tracker, no onboarding wizard shell, no media/image components, no map styling tokens.

### Web Design System ❌
- Tailwind CSS variables for light/dark themes (690 lines globals.css)
- No component library — everything is ad-hoc Tailwind classes
- No button component — each page styles its own buttons
- No card component
- No dialog/modal component
- Tremor is listed as dependency but barely used
- Inconsistent: some pages use `bg-slate-900`, others use `var(--brand-900)`, others use `bg-[var(--ink-950)]`

## 1.12 AI Readiness

### What exists
- **Intent Parser**: Keyword matching (28 categories) + LLM fallback (Gemini)
- **Intent Matching**: Provider scoring (category fit, distance, availability, trust, reviews)
- **Decision Engine**: Loop classification (direct_booking vs requirement_post)
- **Orchestrator**: Routes intents to search, buy, post, sell, inventory, orders
- **AI Matching**: LLM-based provider-request scoring with fallback
- **Quote Drafting**: LLM generates line items with local pricing
- **Content Moderation**: Profanity, phone, email, spam detection
- **Launchpad Generator**: Full business profile generation
- **Multiple AI entry points**: MarketAiFloating, AiPromptBar, DashboardPromptBar, AiFloatingAssistant

### Problems

1. **Fragmented architecture**: 9 files in `lib/ai/` with overlapping responsibilities. IntentParser does both keyword + LLM. Orchestrator duplicates decision logic.

2. **No prompt management**: Prompts are hardcoded in each file. No prompt versioning, no prompt templates, no A/B testing.

3. **No AI observability**: No tracking of intent parse success rate, match accuracy, user satisfaction, fallback rate.

4. **No personalization**: The AI doesn't learn from user behavior. Every query is treated as a first interaction.

5. **LLM dependency without fallback strategy**: If Gemini is down, the keyword matcher kicks in (which works), but there's no graceful degradation communication to users.

6. **No streaming in Flutter AI**: Web AI has streaming (`/api/ai/prompt/stream`). Flutter uses a single POST with loading spinner. No progressive rendering.

7. **Four AI entry points confuse users**: MarketAiFloating (FAB), AiPromptBar (chat page inline), DashboardPromptBar (dashboard), AiFloatingAssistant (floating). Users don't know which to use.

8. **No intent feedback loop**: When AI routes to wrong action, there's no way for users to correct it. No "did you mean X?" or edit intent.

9. **Hinglish support is keyword-only**: The intent parser has Hindi keywords but LLM prompt doesn't ask for Hinglish handling explicitly enough.

10. **Quote drafting doesn't consider actual catalog**: The LLM generates prices without checking provider's existing catalog or market rates.

## 1.13 Scalability Concerns

### Architecture Scalability

1. **Single Supabase instance**: No read replicas, no connection pooling strategy, no query routing. One Postgres instance handles realtime, auth, storage, and business queries.

2. **Next.js API routes on Vercel**: Serverless functions have cold starts and 10s timeout. No dedicated API server.

3. **No Redis for session/cache**: Redis is mentioned in docker-compose.yml and `lib/cache/` exists with Redis-in-memory fallback, but deployment doesn't use it. Redis in docker-compose is unused in production.

4. **No CDN strategy**: Static assets served from Vercel edge but no explicit CDN for images/uploads.

5. **No message queue**: Background jobs run in Next.js API routes (cron endpoints). No SQS/Bull/Redis queue for async processing.

6. **No database sharding or partitioning**: All data in single Postgres. Growing to millions of rows will hit query performance issues.

7. **Realtime scales to 500 connections**: The realtime architecture in docs mentions 50 current / 500 target. This is a hard limit.

### Information Architecture Scalability

8. **Current IA collapses at scale**: "Category → Business → Listing → Booking" works for 100 providers. At 10,000 providers in 100 cities, this breaks.

9. **No locality hierarchy**: Localities table exists but doesn't enforce hierarchy (city → zone → sector → locality → building).

10. **Search doesn't scale with listings**: Current search does DB text search with ilike. At 100K listings, this will be slow. No full-text search index strategy across text columns.

## 1.14 Missing Features

### Critical Gaps

1. **No marketplace network effects**: No way for providers to refer other providers. No consumer community features. No viral loops.

2. **No offline-first for web**: Flutter has offline queue + cache. Web has nothing for offline resilience.

3. **No real-time tracking**: No order tracking map, no provider-live-tracking, no ETA feature.

4. **No provider scheduling**: Providers can set "available" but can't manage time slots, block days, or set recurring availability.

5. **No multi-language support in web**: Flutter has 6 locales. Web has i18n infrastructure (messages dir, locale context, t() function) but no actual translations deployed.

6. **No service categories in database**: `categories.dart` in Flutter is a static list. Web has hardcoded categories in multiple places. No database-backed category taxonomy.

### Moderate Gaps

7. **No review system for seekers**: Providers can't review consumers. No dual-sided reputation.

8. **No provider discovery via map on web**: Flutter has `MapDiscoveryPage` but web has no map-based provider discovery.

9. **No emergency service flow**: Users need "I need help RIGHT NOW" with automatic matching, fast-track notification, and priority listing.

10. **No subscriptions monetization**: Subscription plans exist in code but zero subscribers. No gating of premium features.

11. **No community features**: No locality-specific groups, no events, no marketplace buzz feed, no "what's happening in your area".

12. **No bulk/package services**: Providers can't offer package deals (e.g., "Deep cleaning + AC service + pest control — ₹2,999").

---

# Phase 2 — Product Understanding

## 2.1 What ServiQ Is Today

ServiQ is a **pre-revenue, feature-rich MVP** of a hyperlocal services marketplace targeting Delhi NCR. It has:

- **Two full applications** (Web + Flutter mobile) with overlapping but not identical features
- **A mature design system** on Flutter with tokens, primitives, and migration history
- **An AI layer** spanning intent parsing, matching, orchestration, quote drafting, and profile generation
- **A complex domain model** with overlapping concepts (needs/posts/orders/tasks/help-requests/quotes)
- **Zero real usage** — every transactional feature has never been used
- **A business model** designed for transaction commissions, subscriptions, boosts, and launchpad fees

## 2.2 What Users Can Do Today

1. Browse the landing page and search for services
2. Sign up / log in via email OTP, magic link, Google, or Apple
3. Complete seeker onboarding (select interest categories)
4. Complete provider onboarding (locality, services, availability)
5. View and manage their profile
6. Search for providers by category, location, rating
7. View provider/business public profiles
8. Post a "need" (help request)
9. Chat with other users (best feature)
10. Create and compare quotes (unused)
11. Place orders and make payments (Razorpay, COD)
12. Manage order workflow through 11 states
13. Access provider tools: analytics, payouts, listings, subscriptions, boosts, workspaces
14. Receive push notifications
15. Access AI-powered search and suggestions
16. Launchpad for AI-generated business profiles (unused)

## 2.3 What Providers Can Do Today

1. Create a business profile (name, location, category, services)
2. Set availability and service radius
3. Accept/receive quotes and leads
4. Manage orders and communicate with clients
5. View basic analytics
6. Create service listings and product catalog
7. Manage payouts and invoices
8. Purchase subscriptions and boosts
9. Manage workspaces (multi-location or team)
10. Get verified (KYC)
11. Refer other providers

## 2.4 The Core Problem

**ServiQ is a marketplace with no marketplace dynamics.** 

There are:
- **Zero transactions** → no trust signals, no reviews, no completed jobs data
- **Zero active providers** → providers listed are demo seeds only
- **Zero revenue** → business model is entirely theoretical
- **0 completed transactions** → matching algorithm has never been tested with real data

The platform is **built but not launched.**

## 2.5 Friction Points

| # | Friction | Severity | Root Cause |
|---|----------|----------|------------|
| 1 | "What do I do here?" | Critical | No clear first-action pathway. Too many options. |
| 2 | Provider/seeker role switching | High | Once you pick a role, you're locked in. Can't be both. |
| 3 | Empty states everywhere | High | Zero data means zero trust signals, zero social proof. |
| 4 | Concept overload | High | Needs/posts/orders/tasks/quotes/deals are confusing. |
| 5 | Feature discovery | High | 40+ features buried in navigation. Users won't find them. |
| 6 | AI entry point confusion | Medium | 4 AI buttons with different UX. |
| 7 | Quote flow is heavy | Medium | 5+ steps before work starts. Too bureaucratic. |
| 8 | Mobile/web parity | Medium | Different features on each platform. |
| 9 | Profile fragmentation | Medium | Web profile ≠ mobile profile ≠ business page. |
| 10 | Feed vs search vs market | Medium | Three ways to find providers. Which is canonical? |

## 2.6 What Feels Dead Instead of Alive

1. **Dashboard**: Empty graphs, zero stats, "Welcome" page with static links.
2. **Market page**: Shows zones but none have real data beyond demo seeds.
3. **Notifications**: Fires for demo data only. No real activity.
4. **Analytics**: Beautiful charts with zero data points.
5. **Provider tools**: Launchpad, deals, quotes, subscriptions — all unused.
6. **People page**: Shows demo providers but no real interactions.
7. **Feed**: Static seeded content. No real-time activity.
8. **Search results**: Returns demo providers only.
9. **Business profiles**: Well-designed but no reviews, no recent jobs.

---

# Phase 3 — Product Reimagination

## 3.1 First Principles

**Principle 1: People think in intent, not categories.**
- "My AC stopped working" → not "I need Category > Electrical > AC Repair"
- "I need food" → not "I need to browse Restaurant > Cuisine > Dinner"
- "I need work today" → not "I need Category > Jobs > Plumber"

**Principle 2: Trust is the currency.**
- Users don't care about features. They care "will this person show up, do good work, and not overcharge me?"
- Zero transactions = zero trust = zero usage. This is the existential problem.

**Principle 3: The neighborhood IS the platform.**
- People trust recommendations from neighbors more than algorithms
- The local hardware store owner knows more reliable plumbers than any app
- WhatsApp groups already serve this purpose — we need to be BETTER than WhatsApp, not replace it

**Principle 4: Micro-tasks are the wedge.**
- Small jobs (₹50-₹500) that Urban Company ignores — fix a tap, install a switch, deliver groceries
- These happen DAILY in every neighborhood
- Building trust through micro-tasks unlocks larger jobs

**Principle 5: AI is the interface, not a feature.**
- The primary way users interact with ServiQ should be natural language
- AI should orchestrate everything behind the scenes
- The UI should feel like a conversation, not like an ERP system

**Principle 6: Dead features are worse than missing features.**
- 20+ zero-usage API endpoints create maintenance drag and cognitive overhead
- A focused app with 5 features beats a bloated app with 40 features

## 3.2 New Mental Model

### Current:
```
Categories → Businesses → Listings → Booking
```

### Reimagined:
```
Intent → Understanding → AI Orchestration → Fulfillment
                                              ├── People (providers, neighbors, businesses)
                                              ├── Products (local inventory, marketplace)
                                              ├── Services (AC repair, plumbing, etc.)
                                              └── Communities (events, groups, knowledge)
```

### The core loop:
```
1. User expresses intent (text, voice, tap)
2. AI understands (classifies, disambiguates, enriches)
3. AI orchestrates (matches, proposes, executes)
4. User confirms or refines
5. Fulfillment happens
6. Trust is built
7. Loop repeats with better context
```

## 3.3 New Information Architecture

### Level 1 — Neighborhood
The city/zone/locality. The user's world.

### Level 2 — What's Happening
Live feed of activity in the neighborhood: new providers, new needs, completed jobs, community posts. Makes the app feel alive.

### Level 3 — What You Need
AI-first intent resolution. Speak or type what you need. AI figures out the rest.

### Level 4 — Who Can Help
People, businesses, and communities matched to the user's intent. Filtered by trust, distance, availability, and fit.

### Level 5 — Making It Happen
Chat → Quote → Payment → Work → Review. All in one fluid experience. Not five separate features.

### Level 6 — Trust & Reputation
Portable reputation that follows you across neighborhoods. Reviews, verified badges, completion rates, response times.

## 3.4 Navigation Reimagined

### Current (4-tab bottom nav):
```
Home | Market | Work | Inbox
```

### Proposed (3-mode navigation):

**Mode 1: Need Something** (default for new users)
```
[AI Input] — "What do you need?"
Results: People | Services | Products | Businesses
Actions: Chat | Book | Buy
```

**Mode 2: Providing Something** (activated when user has provider role)
```
Dashboard: My Services | My Customers | My Earnings
```

**Mode 3: Exploring** (discovery mode)
```
Nearby | Feed | Map | Communities | Events
```

### Key changes:
- Remove Home/Market/Work/Inbox tabs — they're confusing
- Make AI the default landing for authenticated users
- Collapse 40+ routes into ~12 core experiences
- Every screen should answer: "What can I do here?" and "Where do I go next?"

## 3.5 Feature Consolidation

### Merge these concepts:

| Current Concepts | Consolidated To |
|-----------------|-----------------|
| Orders, Tasks, Help Requests, Needs | All one entity: **Work Items** |
| Quotes, Deal Room, Comparison | One concept: **Proposals** |
| Services, Products, Listings | One concept: **Offerings** |
| Market, Search, Map, Feed, Explore | One concept: **Discovery** |
| People, Connections, Providers | One concept: **Neighborhood** |
| Notifications, Alerts, Inbox | One concept: **Activity** |
| Profile, Settings, Account, Workspaces | One concept: **You** |
| Boosts, Campaigns, Subscriptions | One concept: **Growth** |

### Kill these (for now):
- Invoices (zero transactions = zero invoices)
- Workspaces (zero providers = zero teams)
- Admin panel (no data to admin)
- Referrals (premature without active users)
- Disputes (zero transactions = zero disputes)
- Blocking (premature)
- Reporting (premature)
- Subscriptions (build demand first)

## 3.6 Trust-First Design

Since the existential problem is zero trust (zero transactions), every design decision must answer:

**"Why should I trust this platform?"**

Strategies:
1. **Show the neighborhood is real**: Real-time activity feed (X people used ServiQ today in your area)
2. **Show providers are real**: Verified phone, profile completeness, response time, photos of work
3. **Show payments are safe**: Escrow, refund policy, Razorpay branding
4. **Show help is available**: Chat support, clear dispute process, FAQs
5. **Start with micro-tasks**: Small, low-risk transactions (₹50-₹500) build trust for larger ones
6. **Use AI to reduce risk**: AI-scored matches, transparent reasoning ("Why this provider?")

## 3.7 AI-First Architecture

### Current:
```
User → UI → Search → Results → Manual Selection → Chat → Quote → Order → Payment → Work
```

### Reimagined:
```
User → AI → Intent Understanding 
         → Match Candidates 
         → Ranked Results (with reasoning)
         → User Confirmation (or refinement)
         → Chat (if needed) 
         → Payment (escrow)
         → Work (+ AI tracking)
         → Review + Trust Update
```

### Key changes:
- AI is the **default** entry point, not an alternative
- AI provides **transparent reasoning** ("We matched you with Priya because...")
- AI **learns from every interaction** (what you accepted, rejected, ignored)
- AI is **proactive** ("Your AC was last serviced 6 months ago. Want to schedule?")

---

# Phase 4 — Execution Plan

## Phase 0: Kill the Dead Weight (Week 1-2)

### Remove zero-usage features:
1. API endpoints: Workspaces, Subscriptions, Invoices, Admin, Cron, Referrals, Campaigns, A/B Tests
2. Flutter features: admin, disputes, invoices, referrals, subscriptions, promotions, workspaces
3. Web pages: dashboard/tests, dashboard/campaigns, dashboard/referrals/leaderboard, dashboard/subscriptions

### Consolidate concepts:
1. Rename "Help Requests" → "Needs" everywhere
2. Merge Orders / Tasks → "Work Items"
3. Merge Quotes / Deal Room → "Proposals"

## Phase 1: Make It Alive (Week 3-6)

### Seed the neighborhood:
1. Create 50 real provider profiles in Crossing Republik (manual onboarding)
2. Seed 100+ completed transactions (demo data that looks real)
3. Seed reviews and ratings for every provider
4. Create real-time activity feed showing "X people used ServiQ today"

### Build the trust layer:
1. Provider verification badges (phone-verified, ID-verified)
2. Response time tracking and display
3. Photo-of-work galleries for completed jobs
4. "Neighborhood trust score" — aggregate rating for the locality

## Phase 2: AI Operating Layer (Week 7-10)

### Consolidate AI:
1. Single AI entry point (not 4)
2. Unify intentParser → orchestrator → matching into one pipeline
3. Add prompt management (versioned, template-based)
4. Add streaming responses in Flutter
5. Add intent feedback loop ("Was this helpful?")
6. Add AI observability (success rate, fallback rate, user satisfaction)

### Build proactive AI:
1. Seasonal suggestions ("Monsoon season — check your plumbing")
2. Repeat service reminders
3. "People near you also needed X"
4. AI triage for urgent requests

## Phase 3: Launch & Learn (Week 11-16)

### Marketing launch in Crossing Republik:
1. Onboard 20 real providers (concierge, free)
2. Get first 10 real transactions
3. Iterate based on real feedback
4. Measure: time-to-first-transaction, completion rate, repeat rate

### Build the feedback loop:
1. Every interaction improves matching
2. Provider response time → higher ranking
3. Completed jobs → trust score increase
4. Canceled/no-show → trust score decrease

## Phase 4: Neighborhood OS (Week 17-24)

### Community features:
1. Locality-specific groups
2. "Ask your neighborhood" Q&A
3. Community events and posts
4. Provider discovery via neighborhood map

### Growth features:
1. Referral program (after validation)
2. Provider subscription (after provider stickiness)
3. Premium placements (after demand-side growth)

---

# Appendix A: Design System Roadmap

## Flutter (already mature)
1. Add: Dialog primitive, Form shell, Progress stepper, Onboarding wizard, Media viewer
2. Fix: Remove duplicate shared/widgets directory, merge into shared/components
3. Standardize: All remaining raw Scaffold/AppBar → ServiqScaffold/ServiqTopBar

## Web (needs complete build)
1. Create: Button, Card, Input, Dialog, Badge, Chip, Toast, Skeleton primitives
2. Standardize: All ad-hoc Tailwind → primitives
3. Audit: Color tokens, spacing, typography consistency
4. Add: Dark mode (base exists, inconsistent coverage)

---

# Appendix B: Technical Debt Roadmap

## Immediate (Week 1-2)
- Remove zero-usage code (reversible, git-tracked)
- Delete duplicate shared/widgets directory
- Split monolithic pages (create_need, chat_page, welcome_page, profile_page)
- Consolidate migration bundles

## Short-term (Week 3-6)
- Add realtime load shedding for scale
- Implement proper offline sync in Flutter
- Add image optimization pipeline
- Unify Supabase client creation

## Medium-term (Week 7-12)
- Add read replicas or connection pooling for Supabase
- Deploy Redis for session and cache
- Implement message queue for background jobs
- Add full-text search indexes
- Implement proper AI observability

---

# Appendix C: Key Metrics to Track

| Metric | Current | Target (M1) | Target (M3) |
|--------|---------|-------------|-------------|
| Completed transactions | 0 | 1 | 10 |
| Active providers | 0 | 10 | 25 |
| Active consumers | 0 | 20 | 100 |
| Time to first transaction | N/A | <7 days | <24 hours |
| Provider response rate | N/A | >80% | >90% |
| Transaction completion rate | N/A | >70% | >80% |
| Repeat provider rate | N/A | N/A | >30% |
| AI query success rate | N/A | >70% | >85% |
| Average match score | N/A | N/A | >60/100 |

---

# Summary: The One-Page Strategy

**Problem**: ServiQ has built a comprehensive marketplace platform but has zero transactions, zero revenue, and zero active users. The app feels dead because there's no data, no trust, and no clear pathway to value.

**Root Cause**: Features were built without validation. The product tries to be everything to everyone (marketplace, task platform, community, booking app, provider OS) and ends up being nothing to anyone.

**Solution**: 
1. **Kill the dead weight** — remove unused features, consolidate overlapping concepts
2. **Make it alive** — seed data, build trust signals, show activity
3. **AI as operating layer** — consolidate AI, make it the primary interface, add feedback loops
4. **Launch small** — 1 locality, 20 providers, 10 transactions. Validate before expanding.

**Philosophy**: 
- Not "another marketplace"
- Not "Urban Company for small towns"
- **The online version of the physical neighborhood**
- Technology should be invisible
- The neighborhood should feel alive
- Trust is the only thing that matters
