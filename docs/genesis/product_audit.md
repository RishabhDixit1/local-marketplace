# ServiQ Product Audit

> **Date**: July 30, 2026
> **Status**: Pre-revenue. Zero transactions. Zero active providers. Zero revenue.
> **Target**: Noida pilot (Sector 12-22, Crossings Republik), Delhi NCR expansion

---

## 1. Executive Summary

ServiQ is a hyperlocal services marketplace (plumbers, electricians, AC repair, cleaning, etc.) targeting Delhi NCR. It has two full client applications (Next.js web + Flutter mobile), a mature Flutter design system, an AI layer built on Google Gemini, and a complex domain model spanning 40+ mobile features and 30+ web dashboard routes.

**The fundamental problem**: ServiQ is a marketplace with no marketplace dynamics. There are zero completed transactions, zero active providers beyond test seeds, and zero revenue. The platform is fully built but never launched to real users. Every transactional feature (orders, payments, quotes, reviews, subscriptions, payouts, invoices, disputes) exists in production-ready code but has never been exercised with real data.

The product has a severe **feature-to-usage gap**: 62.5% of Flutter features (25 of 40) carry warning status, 12.5% (5 of 40) are outright premature. The web dashboard layout is a 1,139-line monolith managing 30+ routes. The information architecture suffers from overlapping concepts: _needs_, _posts_, _orders_, _tasks_, _help requests_, _quotes_, _deals_, and _bookings_ describe the same underlying workflow at different stages.

**What works**: Chat is the best-engineered feature with realtime messaging, typing indicators, read receipts, and media attachments. The Flutter design system is mature with tokens, 7 core primitives, and 17+ migrated pages. The AI intent parsing pipeline (9 files) successfully demonstrates intent classification, provider matching, and quote drafting.

**The path forward requires**: (1) removing/killing zero-usage features to reduce maintenance drag, (2) seeding real data in one locality to create trust signals, (3) consolidating multiple overlapping concepts into a unified mental model, (4) making AI the primary interaction surface rather than an add-on, and (5) launching with 20 real providers and a target of 10 real transactions before expanding.

---

## 2. Product Vision Statement

> Connecting people with human-centered services near you.

A hyperlocal marketplace where consumers find trusted local providers (plumbers, electricians, AC repair, cleaning, etc.) and providers build their digital presence, get leads, and transact. The vision extends beyond a mere listing directory into an operating system for neighborhood commerce — AI-driven need matching, realtime chat, end-to-end order lifecycle, provider growth tools, and trust systems.

### North Star

Every neighborhood has a digital pulse. A resident thinks "my AC broke" and within minutes has a trusted, verified, nearby provider with transparent pricing, real-time tracking, and a guaranteed experience. Providers manage their entire business — leads, orders, payouts, analytics, reputation — from a single dashboard. The neighborhood builds collective trust through reviews, referrals, and community interactions.

### Current Reality vs Vision

| Dimension | Vision | Current |
|-----------|--------|---------|
| Active transactions | Thousands/month | 0 |
| Active providers | Hundreds per locality | 0 (test seeds only) |
| Trust signals | Reviews, badges, completion rates | Zero reviews, zero completed jobs |
| AI adoption | Primary user interface | 4 fragmented entry points, unclear adoption |
| Revenue | Commissions + subscriptions + ads | Rs 0 |
| Market validation | Proven in 10+ localities | Noida pilot not yet launched |

---

## 3. Feature Inventory

### 3.1 Flutter Mobile Features (40 modules)

| # | Feature | Files | Est LOC | Health | Usage | Notes |
|---|---------|-------|---------|--------|-------|-------|
| 1 | admin | 3 | ~400 | ❌ | Zero | No RLS admin role check |
| 2 | ai_prompt | 2 | ~200 | ⚠️ | Unknown | Thin wrapper; most logic in shared |
| 3 | analytics | 3 | ~500 | ⚠️ | Zero | Provider-facing, no real data |
| 4 | auth | 12 | ~1,500 | ✅ | Critical | Email OTP, magic link, Google/Apple |
| 5 | availability | 3 | ~400 | ✅ | Zero | Well-structured, unused |
| 6 | blocking | 5 | ~350 | ⚠️ | Zero | Over-engineered for MVP |
| 7 | bookings | 3 | ~350 | ⚠️ | Zero | Duplicates order concepts |
| 8 | cart | 4 | ~500 | ⚠️ | Zero | Separate from order flow |
| 9 | chat | 3 | ~8,000 | ✅ | Low | Best-engineered feature |
| 10 | connections | 3 | ~600 | ⚠️ | Zero | Unclear value prop |
| 11 | control | 1 | ~300 | ❌ | Zero | God page, no structure |
| 12 | disputes | 3 | ~400 | ⚠️ | Zero | Premature for zero transactions |
| 13 | feed | 4 | ~2,500 | ✅ | Low | Solid paginated feed |
| 14 | invoices | 4 | ~500 | ⚠️ | Zero | Premature |
| 15 | listings | 1 | ~300 | ⚠️ | Zero | Single monolithic detail page |
| 16 | marketplace | 3 | ~2,500 | ⚠️ | Zero | Overlaps with search + feed |
| 17 | notifications | 3 | ~600 | ✅ | Low | Realtime push + in-app |
| 18 | onboarding | 1 | ~200 | ⚠️ | Low | Only seeker; provider missing |
| 19 | orders | 7 | ~2,000 | ✅ | Zero | 11-state workflow, zero usage |
| 20 | payments | 3 | ~400 | ✅ | Zero | Razorpay integration |
| 21 | payouts | 5 | ~500 | ⚠️ | Zero | Premature |
| 22 | people | 3 | ~600 | ⚠️ | Zero | Overlaps with search |
| 23 | post_create | 2 | ~4,500 | ⚠️ | Zero | 81KB monolithic create_need page |
| 24 | profile | 3 | ~3,500 | ⚠️ | Low | Too many responsibilities |
| 25 | promotions | 3 | ~400 | ⚠️ | Zero | Premature |
| 26 | provider | 11 | ~4,000 | ⚠️ | Zero | Scattered across 11 files |
| 27 | public_profile | 1 | ~200 | ⚠️ | Zero | Thin |
| 28 | quotes | 5 | ~4,000 | ✅ | Zero | Well-structured, zero usage |
| 29 | referrals | 3 | ~400 | ⚠️ | Zero | Premature |
| 30 | reporting | 3 | ~300 | ❌ | Zero | Premature |
| 31 | reviews | 3 | ~400 | ✅ | Zero | Clean implementation |
| 32 | saved | 1 | ~200 | ⚠️ | Zero | Thin |
| 33 | search | 4 | ~2,500 | ✅ | Low | Good implementation |
| 34 | settings | 4 | ~600 | ✅ | Low | Clean |
| 35 | subscriptions | 3 | ~400 | ⚠️ | Zero | Premature |
| 36 | task_post | 2 | ~300 | ⚠️ | Zero | Overlaps with post_create |
| 37 | tasks | 4 | ~1,500 | ⚠️ | Zero | Overlaps with orders |
| 38 | verification | 3 | ~400 | ⚠️ | Zero | KYC flow, zero usage |
| 39 | welcome | 3 | ~5,000 | ⚠️ | Low | Huge, overlaps with feed |
| 40 | workspaces | 4 | ~800 | ❌ | Zero | Premature |

**Summary**: Healthy (✅) 10 (25%), Warning (⚠️) 25 (62.5%), Unhealthy (❌) 5 (12.5%)

### 3.2 Web Dashboard Features (30+ route groups)

| Feature | Route | Est LOC | Usage | Notes |
|---------|-------|---------|-------|-------|
| Welcome/Home | `/dashboard` | ~542 | Low | Landing after login |
| Analytics | `/dashboard/analytics` | ~500 | Zero | No data to display |
| Availability | `/dashboard/availability` | ~400 | Zero | |
| Bookings | `/dashboard/bookings` | ~350 | Zero | Duplicates orders |
| Boosts | `/dashboard/boosts` | ~400 | Zero | Premature |
| Campaigns | `/dashboard/campaigns` | ~400 | Zero | Premature |
| Chat | `/dashboard/chat` | ~500 | Low | Realtime messaging |
| Compare | `/dashboard/compare` | ~300 | Zero | Quote comparison |
| Create | `/dashboard/create` | ~400 | Zero | Create need/post |
| Create Post | `/dashboard/create_post` | ~400 | Zero | |
| Deal Room | `/dashboard/deal-room` | ~300 | Zero | |
| Invoices | `/dashboard/invoices` | ~400 | Zero | |
| Launchpad | `/dashboard/launchpad` | ~500 | Zero | AI business profile generation |
| Leads | `/dashboard/leads` | ~300 | Zero | |
| Listings | `/dashboard/listings` | ~400 | Zero | |
| Notifications | `/dashboard/notifications` | ~300 | Low | |
| Orders | `/dashboard/orders` | ~500 | Zero | |
| Payouts | `/dashboard/payouts` | ~400 | Zero | |
| People | `/dashboard/people` | ~500 | Zero | Provider discovery |
| Posts | `/dashboard/posts` | ~300 | Zero | |
| Profile | `/dashboard/profile` | ~600 | Low | |
| Providers | `/dashboard/providers` | ~500 | Zero | |
| Referrals | `/dashboard/referrals` | ~400 | Zero | |
| Saved | `/dashboard/saved` | ~200 | Zero | |
| Settings | `/dashboard/settings` | ~400 | Low | |
| Subscriptions | `/dashboard/subscriptions` | ~400 | Zero | |
| Tasks | `/dashboard/tasks` | ~500 | Zero | |
| Tests (A/B) | `/dashboard/tests` | ~200 | Zero | |
| Verification | `/dashboard/verification` | ~400 | Zero | KYC |
| Workspaces | `/dashboard/workspaces` | ~400 | Zero | |
| Admin | `/dashboard/admin` | ~500 | Zero | Not secured |

### 3.3 API Endpoint Groups (58+ groups, ~120 routes)

| Category | Endpoints | Usage | Health |
|----------|-----------|-------|--------|
| Auth | 4 | Critical | ✅ |
| Orders | 7 | Zero | ✅ Well-structured |
| Payment | 3 | Zero | ✅ Razorpay integrated |
| Quotes | 8 | Zero | ⚠️ |
| Profile | 4 | Low | ✅ |
| Provider | 10 | Zero | ⚠️ |
| Upload | 4 | Low | ✅ |
| Admin | 11 | Zero | ❌ Premature |
| Cron | 9 | Zero | ❌ Premature |
| Chat | 2 | Low | ✅ |
| Notifications | 3 | Low | ✅ |
| AI | 4 | Unknown | ⚠️ |
| Community | 3 | Zero | ❌ |
| Market | 3 | Zero | ❌ |
| Launchpad | 3 | Zero | ❌ |
| Reviews | 3 | Zero | ⚠️ |
| Subscriptions | 5 | Zero | ❌ |
| Invoices | 3 | Zero | ❌ |
| Workspaces | 8 | Zero | ❌ |
| Verification | 4 | Zero | ❌ |
| Connections | 2 | Zero | ⚠️ |
| Referrals | 4 | Zero | ❌ |
| Webhooks | 1 | Not tested | ⚠️ |
| Other | 20+ | Mostly zero | Various |

### 3.4 Feature Platform Matrix

| Feature | Web | Mobile | API | Usage |
|---------|-----|--------|-----|-------|
| Auth (OTP, magic link, OAuth) | ✅ | ✅ | ✅ | Critical |
| Search + Filters | ✅ | ✅ | ✅ | Low |
| Feed/Browse | ✅ | ✅ | ✅ | Low |
| Profile Management | ✅ | ✅ | ✅ | Low |
| Public Business Page | ✅ | ✅ | ✅ | Zero |
| Chat (realtime) | ✅ | ✅ | ✅ | Low |
| Orders (11-state workflow) | ✅ | ✅ | ✅ | Zero |
| Payments (Razorpay) | ✅ | ✅ | ✅ | Zero |
| Notifications (push/SMS/WhatsApp) | ✅ | ✅ | ✅ | Low |
| Quotes + Deal Room | ✅ | ✅ | ✅ | Zero |
| Quote Comparison | ✅ | ✅ | ✅ | Zero |
| Checkout | ✅ | ✅ | ✅ | Zero |
| Provider Tools (listings, analytics) | ✅ | ✅ | ✅ | Zero |
| Provider Launchpad (AI) | ✅ | ✅ | ✅ | Zero |
| Payouts | ✅ | ✅ | ✅ | Zero |
| Subscriptions | ✅ | ✅ | ✅ | Zero |
| Boosts / Promotions | ✅ | ✅ | ✅ | Zero |
| Campaigns | ✅ | — | ✅ | Zero |
| Workspaces (teams/branches) | ✅ | ✅ | ✅ | Zero |
| Verification / KYC | ✅ | ✅ | ✅ | Zero |
| Reviews | ✅ | ✅ | ✅ | Zero |
| Disputes | — | ✅ | ✅ | Zero |
| Reporting | — | ✅ | ✅ | Zero |
| Blocking | — | ✅ | ✅ | Zero |
| Referrals + Leaderboard | ✅ | ✅ | ✅ | Zero |
| Invoices | ✅ | ✅ | ✅ | Zero |
| Availability | ✅ | ✅ | ✅ | Zero |
| Bookings | ✅ | ✅ | ✅ | Zero |
| Connections | ✅ | ✅ | ✅ | Zero |
| Admin Panel | ✅ | ✅ | ✅ | Zero |
| Analytics Dashboard | ✅ | ✅ | ✅ | Zero |
| Saved Items | ✅ | ✅ | ✅ | Zero |
| AI Prompt / Intent | ✅ | ✅ | ✅ | Unknown |
| Map Discovery | — | ✅ | ✅ | Zero |
| Cart | ✅ | ✅ | ✅ | Zero |
| Onboarding (seeker) | ✅ | ✅ | ✅ | Low |
| Onboarding (provider) | ✅ | ✅ | ✅ | Zero |
| Market Zones | ✅ | — | ✅ | Zero |
| Control Panel (mobile) | — | ✅ | — | Zero |
| Emergency/Urgent | — | — | — | Missing |
| Multi-language | Partial | ✅ (6 locales) | — | Flutter only |
| Offline support | — | ✅ (partial) | — | Queue not functional |

---

## 4. Screen Inventory

### 4.1 Web Screens / Routes

**Public Pages**:

| Route | Page | State | Notes |
|-------|------|-------|-------|
| `/` | Landing Page | ✅ | Hero + search + categories + CTAs |
| `/market` | Market Zones | ⚠️ | Locality-based browsing, zero usage |
| `/market/[locality]` | Locality Page | ⚠️ | Provider discovery per zone |
| `/search` | Search Results | ✅ | Full-text + filters + pagination |
| `/business/[slug]` | Business Page | ⚠️ | Public profile |
| `/profile/[slug]` | Public Profile | ⚠️ | Tabs: marketplace, store, reviews, about |
| `/auth/*` | Auth Pages | ✅ | Login, signup, password reset |
| `/onboarding/*` | Onboarding | ⚠️ | Seeker + provider flows |
| `/checkout` | Checkout | ⚠️ | Razorpay integration |
| `/orders/[id]` | Order Detail | ⚠️ | Zero usage |
| `/referral/[code]` | Referral Landing | ⚠️ | |
| `/faq`, `/support`, `/privacy`, `/terms`, `/legal`, `/contact`, `/docs` | Static Pages | ✅ | |

**Dashboard Pages** (authenticated, inside `/dashboard/*`):

| Route | Sidebar Group | State | Notes |
|-------|--------------|-------|-------|
| `/dashboard` | Home (tab) | ⚠️ | Main feed/welcome |
| `/dashboard/tasks` | Home (tab) | ⚠️ | Task board |
| `/dashboard/people` | Connect | ⚠️ | Geo-based provider search |
| `/dashboard/providers` | Connect | ⚠️ | Provider directory |
| `/dashboard/chat` | Connect | ✅ | Realtime messaging |
| `/dashboard/orders` | Commerce | ⚠️ | Zero usage |
| `/dashboard/listings` | Commerce | ⚠️ | Zero usage |
| `/dashboard/bookings` | Commerce | ⚠️ | Zero usage |
| `/dashboard/analytics` | Growth | ❌ | No data |
| `/dashboard/boosts` | Growth | ❌ | Zero usage |
| `/dashboard/campaigns` | Growth | ❌ | Zero usage, mobile missing |
| `/dashboard/leads` | Growth | ⚠️ | Early stage |
| `/dashboard/referrals` | Growth | ❌ | Zero usage |
| `/dashboard/referrals/leaderboard` | Growth | ❌ | Zero usage |
| `/dashboard/payouts` | Money | ❌ | Zero usage |
| `/dashboard/invoices` | Money | ❌ | Zero usage |
| `/dashboard/subscriptions` | Money | ❌ | Zero usage |
| `/dashboard/notifications` | Account | ✅ | |
| `/dashboard/availability` | Account | ⚠️ | Zero usage |
| `/dashboard/verification` | Account | ❌ | Zero usage |
| `/dashboard/workspaces` | Account | ❌ | Zero usage |
| `/dashboard/launchpad` | Account | ❌ | Zero usage |
| `/dashboard/tests` | Platform | ❌ | A/B test infra |
| `/dashboard/admin` | — | ❌ | No admin role RLS |
| `/dashboard/profile` | — | ⚠️ | |
| `/dashboard/saved` | — | ⚠️ | |
| `/dashboard/compare` | — | ⚠️ | Quote comparison |
| `/dashboard/create` | — | ⚠️ | Create post/need |
| `/dashboard/deal-room/[orderId]` | — | ❌ | Zero usage |

### 4.2 Flutter Mobile Screens (~42 routes)

| Route | Widget | State | Notes |
|-------|--------|-------|-------|
| `/` | MarketplaceLandingPage | ⚠️ | Splash + redirect |
| `/setup` | SetupPage | ✅ | |
| `/sign-in` | LoginPage | ✅ | |
| `/sign-up` | SignUpPage | ✅ | |
| `/forgot-password` | ForgotPasswordPage | ✅ | |
| `/onboarding` | OnboardingWalkthroughPage | ✅ | |
| `/app/create-need` | CreateNeedPage | ⚠️ | 81KB monolith |
| `/app/search` | SearchPage | ✅ | |
| `/app/map` | MapDiscoveryPage | ⚠️ | Low usage |
| `/app/notifications` | NotificationsPage | ✅ | |
| `/app/public-business` | PublicBusinessPage | ⚠️ | Thin |
| `/app/profile/settings` | SettingsPage | ✅ | Theme, locale |
| `/app/seeker-onboarding` | SeekerOnboardingPage | ⚠️ | Seeker only |
| `/app/provider-onboarding` | ProviderOnboardingPage | ⚠️ | Provider only |
| `/app/provider-launchpad` | ProviderLaunchpadPage | ⚠️ | Zero usage |
| `/app/provider-listings` | ProviderListingsPage | ⚠️ | |
| `/app/payouts` | PayoutsPage | ❌ | Premature |
| `/app/transactions` | TransactionsPage | ❌ | Premature |
| `/app/referrals` | ReferralsPage | ❌ | Premature |
| `/app/verification` | VerificationPage | ❌ | Premature |
| `/app/analytics` | AnalyticsPage | ❌ | No data |
| `/app/availability` | AvailabilityPage | ⚠️ | |
| `/app/bookings` | BookingsPage | ⚠️ | Duplicates orders |
| `/app/workspaces` | WorkspacesPage | ❌ | Premature |
| `/app/workspaces/:id` | WorkspaceDetailPage | ❌ | |
| `/app/orders` | OrdersPage | ✅ | |
| `/app/orders/:id` | OrderDetailPage | ✅ | |
| `/app/provider-orders` | ProviderOrdersPage | ⚠️ | Separate from orders |
| `/app/provider-leads` | ProviderLeadsPage | ⚠️ | |
| `/app/provider-boosts` | ProviderBoostsPage | ❌ | |
| `/app/provider-subscriptions` | ProviderSubscriptionsPage | ❌ | |
| `/app/invoices` | InvoicesPage | ❌ | |
| `/app/invoices/:id` | InvoiceDetailPage | ❌ | |
| `/app/connections` | ConnectionsPage | ⚠️ | |
| `/app/admin` | AdminPage | ❌ | Unsecured |
| `/app/checkout` | CheckoutPage | ⚠️ | |
| `/app/saved` | SavedFeedPage | ⚠️ | |
| `/app/listings/:id` | ListingDetailPage | ⚠️ | |
| `/app/quote` | QuoteRoomPage | ⚠️ | Zero usage |
| `/app/quote-comparison` | QuoteComparisonPage | ⚠️ | |
| `/app/profile` | ProfilePage | ⚠️ | |
| `/app/people` | PeoplePage | ⚠️ | |
| `/app/provider/:id` | ProviderProfilePage | ⚠️ | |

---

## 5. User Flows

### 5.1 Consumer Flow

```
Landing Page ──→ Browse Categories ──→ Search Providers
     │                                      │
     │                                      ▼
     ├──→ Sign In / Sign Up ──→ View Provider Profile
     │         │                    │
     │         ▼                    ├──→ Chat with Provider
     │    Onboarding                ├──→ Post a Need / Request Quote
     │    (seeker)                  ├──→ Receive Quotes → Compare → Accept
     │                              └──→ Place Order → Payment (Razorpay/COD)
     │                                       │
     └───────────────────────────────────────┤
                                       Order Lifecycle:
                                       Paid → In Progress → Completed
                                            │              │
                                       Chat / Track    Leave Review
```

**Current State**: The flow is fully built but every step past "Browse/Search" routes to zero data. A consumer can complete the entire journey end-to-end but no real provider will respond, no real payment will process, and no real work will happen.

### 5.2 Provider Flow

```
Sign Up ──→ Provider Onboarding ──→ Launchpad (AI profile gen)
     │                                     │
     │                                     ▼
     │    ┌──────────────────────────────────────────────┐
     │    │  Provider Dashboard                          │
     │    │  ├── Listings Management                     │
     │    │  ├── Availability & Service Radius           │
     │    │  ├── Leads Inbox                             │
     │    │  ├── Orders / Tasks                          │
     │    │  ├── Chat with Clients                       │
     │    │  ├── Analytics (views, leads, conversions)   │
     │    │  ├── Payouts & Wallet                        │
     │    │  ├── Subscription Plan (Free/Essential/Premium)│
     │    │  ├── Boosts & Campaigns                      │
     │    │  ├── Referrals                               │
     │    │  ├── Invoices                                │
     │    │  ├── Verification / KYC                      │
     │    │  ├── Workspaces (branches/team)              │
     │    │  └── Public Profile Preview                  │
     │    └──────────────────────────────────────────────┘
     │
     ▼
Receive Notification → View Lead/Quote Request → Respond with Quote
     → Chat with Client → Accept Order → Complete Work → Get Paid → Receive Review
```

**Current State**: Full tool suite exists. Zero providers have completed onboarding or used any tool. The Launchpad (AI profile generation from 7 questions) is built but has zero usage.

### 5.3 Business/Workspace Flow

```
Create Workspace → Add Branches (multi-location) → Add Team Members
     → Set Assignment Rules → Manage Listings per Branch
     → View Consolidated Analytics → Payouts per Branch
```

**Current State**: Entirely premature. Zero businesses, zero workspaces, zero branches. Built for a multi-location provider scenario that doesn't exist yet.

### 5.4 Admin Flow

```
Login → Admin Dashboard
     ├── Users (list, search, suspend)
     ├── Orders (view all, intervene)
     ├── Listings (approve/reject/moderation)
     ├── Disputes (review, resolve)
     ├── Payouts (approve, process, hold)
     ├── Verifications (approve KYC)
     ├── Feature Flags (toggle)
     ├── Promo Codes (create, manage)
     └── Stats (platform metrics)
```

**Current State**: Admin panel exists with full CRUD but no data to manage. No RLS role check on admin routes.

---

## 6. Navigation Maps

### 6.1 Web Navigation

**Top Navigation** (non-dashboard):
```
Landing Page | Search | Market (Zones) | Business Pages | Auth
```

**Dashboard Sidebar** (6 groups + top tabs):

```
┌─────────────────────────────────────┐
│  [Logo] ServiQ                      │
├─────────────────────────────────────┤
│  Home (tab)     │ My Work (tab)     │
│  Explore (tab)                      │
├─────────────────────────────────────┤
│  ─── Connect ───                   │
│  People   Providers   Chat         │
│  ─── Commerce ───                  │
│  Orders   Listings   Bookings      │
│  ─── Growth ───                   │
│  Analytics   Boosts   Campaigns    │
│  Leads   Referrals   Leaderboard   │
│  ─── Money ───                    │
│  Payouts   Invoices   Subscriptions│
│  ─── Account ───                  │
│  Notifications   Availability      │
│  Verification   Workspaces         │
│  Launchpad                         │
│  ─── Platform ───                 │
│  A/B Tests                         │
├─────────────────────────────────────┤
│  Admin (if applicable)              │
│  Profile | Settings | Logout        │
└─────────────────────────────────────┘
```

**Mobile Bottom Nav (Web)**:
```
Home (Feed/Create) | My Work | Explore
```

### 6.2 Flutter Mobile Navigation

**Bottom Nav (4 tabs)**:

| # | Tab | Default | Alternate |
|---|-----|---------|-----------|
| 0 | Home | WelcomePage | FeedPage (explore) |
| 1 | Market | MarketZonesScreen | — |
| 2 | Work | TasksPage | — |
| 3 | Inbox | ChatPage | — |

**Additional Entry Points**:
- Floating AI button (`MarketAiFloating`)
- AI Prompt Bar (chat page inline)
- Floating action button (create post)
- Notification bell (top bar)

### 6.3 Navigation Pain Points

1. **26 sidebar items** (web) overwhelm users — no prioritization by role or usage
2. **40+ Flutter routes** with no hierarchy — everything is 1-2 taps away but the path to the right thing is unclear
3. **Duplicate discovery paths**: Market (tab) vs Search (page) vs Explore (tab) vs Feed (default) — four ways to find providers
4. **Provider vs seeker not separated**: Both sides see the same navigation. Seekers see "Payouts, Workplaces, Listings." Providers see "Saved Items."
5. **4 AI entry points**: Floating button, dashboard prompt bar, chat inline bar, AI as search — users don't know which to use
6. **Chat buried in tab 4**: The best feature has limited discoverability

---

## 7. Information Architecture Analysis

### 7.1 Current IA Structure

```
Level 1: Platform
├── Public (Landing, Search, Business Pages, Auth, Static Pages)
└── Authenticated
    ├── Web Dashboard (30+ routes, 6 sidebar groups)
    └── Mobile App (4 bottom tabs, 40+ feature modules)

Level 2: Domain Concepts
├── Discovery
│   ├── Feed (posts, needs, activity)
│   ├── Search (keyword + filters)
│   ├── Market Zones (locality-based)
│   ├── Map Discovery (mobile only)
│   └── People (provider directory)
├── Transactions
│   ├── Needs / Help Requests
│   ├── Quotes (draft, compare, accept)
│   ├── Deal Room (negotiation)
│   ├── Orders (11-state workflow)
│   ├── Tasks (overlaps with orders)
│   ├── Bookings (overlaps with orders)
│   └── Checkout (Razorpay, COD)
├── Communication
│   ├── Chat (realtime messaging)
│   ├── Notifications (push, SMS, WhatsApp)
│   └── Connections
├── Provider Tools
│   ├── Launchpad (AI profile generation)
│   ├── Listings Management
│   ├── Leads
│   ├── Analytics
│   ├── Payouts
│   ├── Invoices
│   ├── Subscriptions
│   ├── Boosts / Campaigns
│   ├── Workspaces (branches, team)
│   ├── Availability
│   └── Verification / KYC
├── Trust
│   ├── Reviews
│   ├── Disputes
│   ├── Reporting
│   ├── Blocking
│   └── Verification Badges
└── Account
    ├── Profile
    ├── Settings
    ├── Saved Items
    ├── Referrals
    └── Admin (if applicable)
```

### 7.2 Concept Overlap Analysis

| Concepts | Overlap | Recommended Consolidation |
|----------|---------|--------------------------|
| Posts, Needs, Help Requests, Tasks, Orders, Bookings | All describe work at different stages | **Work Items** — unified lifecycle |
| Quotes, Deal Room, Quote Comparison | All describe pricing negotiation | **Proposals** — one concept |
| Market, Search, Map, Feed, Explore | All describe discovery | **Discovery** — one entry point |
| People, Connections, Providers | All describe the neighborhood | **Neighborhood** |
| Notifications, Alerts, Inbox | All describe activity | **Activity** |
| Profile, Settings, Account, Workspaces | All describe identity | **You** |
| Boosts, Campaigns, Subscriptions | All describe growth | **Growth** |
| Disputes, Reporting, Blocking | All describe safety | **Safety** (premature) |

### 7.3 Conceptual Model Assessment

The current IA organizes around **what providers sell** (categories → businesses → listings → booking). A healthier model would organize around **what consumers need** (intent → understanding → AI orchestration → fulfillment).

The system has 6+ different nouns for a single real-world concept: _a piece of work that needs doing_. This creates confusion at every touchpoint — naming in navigation, URLs, notifications, and the domain model itself.

### 7.4 Locality & Geography

| Element | Status |
|---------|--------|
| Localities table | Exists |
| City/zone/sector/locality/building hierarchy | Not enforced |
| Geo-based search | ✅ Latitude/longitude + radius |
| Map-based discovery | Flutter only, web missing |
| Market zones (locality pages) | Built, zero usage |
| Neighborhood-specific features | None beyond market zones |

---

## 8. Business Model Breakdown

### 8.1 Revenue Streams

| Stream | Model | Price | Status |
|--------|-------|-------|--------|
| Transaction Commission | % of job value | 12% | Not proven — 0 transactions |
| Provider Subscription (Essential) | Monthly | Rs 299 | Not proven — 0 subscribers |
| Provider Subscription (Premium) | Monthly | Rs 999 | Not proven — 0 subscribers |
| AI Launchpad | One-time | Rs 499 | Not proven — 0 users |
| Priority Boosts | Per post | Rs 25 | Not proven — 0 usage |
| Featured Placements | Per period | Variable | Not proven — 0 usage |

### 8.2 Business Model Assessment

**Strengths**:
- Multiple revenue streams diversify risk
- Tiered subscriptions create upgrade path for providers
- Transaction commission aligns with platform growth (12% is competitive with Urban Company's 20-25%)

**Weaknesses**:
- **No revenue model validated** — zero transactions means zero data on willingness to pay
- **Chicken-and-egg problem** — providers won't pay subscriptions without leads; consumers won't use without providers
- **12% commission needs volume** — at Rs 500 avg ticket, commission is Rs 60. Need hundreds of transactions/day for meaningful revenue
- **AI Launchpad pricing unclear** — Rs 499 one-time for an unused feature; value proposition not proven
- **Boosts at Rs 25/post** — too cheap to drive meaningful revenue, too expensive if no one sees the post
- **No marketplace dynamics** — can't test any pricing model without real users

**Recommendation**: Launch with free provider tier only. Validate demand-side first. Introduce subscription after proving provider lead generation value. Remove AI Launchpad pricing until feature is adopted.

### 8.3 Unit Economics (Projected)

| Metric | Assumption | At 100 txns/day | At 1,000 txns/day |
|--------|-----------|-----------------|-------------------|
| Avg ticket | Rs 800 | Rs 80,000 | Rs 800,000 |
| Commission (12%) | Rs 96/order | Rs 9,600/day | Rs 96,000/day |
| Monthly commission revenue | — | Rs 288,000 | Rs 2,880,000 |
| Essential subs at 20% providers | Rs 299 | — | Rs 179,400/month |
| Premium subs at 5% providers | Rs 999 | — | Rs 149,850/month |
| Boosts at 10/day | Rs 25 | Rs 250/day | Rs 250/day |

---

## 9. AI Usage Overview

### 9.1 AI Architecture

```
User Input
    │
    ▼
intentParser.ts ──→ Keyword matching (28 categories)
                 └──→ LLM fallback (Google Gemini)
                           │
                           ▼
              decisionEngine.ts ──→ Loop classification
                           │         (direct_booking vs requirement_post)
                           ▼
              orchestrator.ts ──→ Route to: search, buy, post, sell,
                                  inventory, orders
                           │
                    ┌──────┴──────┐
                    ▼              ▼
              matching.ts    quoteDrafting.ts
         (provider scoring)  (LLM line items)
                    │              │
                    └──────┬──────┘
                           ▼
                    contentModeration.ts
                 (profanity, spam, phone, email)
                           │
                           ▼
                    Response to User
```

### 9.2 AI Files Inventory

| File | Purpose | Health | Issues |
|------|---------|--------|--------|
| `intentParser.ts` | Keyword + LLM intent classification | ⚠️ | Does both keyword AND LLM; no separation of concerns |
| `intentMatching.ts` | Provider scoring (category, distance, availability, trust, reviews) | ⚠️ | Scoring weights not validated |
| `decisionEngine.ts` | Loop classification (direct booking vs post requirement) | ⚠️ | Binary decision with no confidence threshold |
| `orchestrator.ts` | Route intents to correct handler | ⚠️ | Duplicates decision logic |
| `matching.ts` | LLM-based provider-request scoring with fallback | ⚠️ | Overlaps with intentMatching |
| `quoteDrafting.ts` | LLM generates line items with local pricing | ⚠️ | Prices generated without catalog reference |
| `contentModeration.ts` | Profanity, phone, email, spam detection | ✅ | Clean implementation |
| `launchpad.ts` | Full business profile generation from 7 questions | ⚠️ | Zero usage |
| `provider.ts` | Provider-specific AI functions | ⚠️ | Thin |

### 9.3 AI Entry Points

| Entry Point | Platform | UX Pattern | Adoption |
|-------------|----------|------------|----------|
| `MarketAiFloating` | Web | Floating action button on market pages | Unknown |
| `AiPromptBar` | Web + Flutter | Inline prompt bar on chat page | Unknown |
| `DashboardPromptBar` | Web | Top-of-sidebar prompt input | Unknown |
| `AiFloatingAssistant` | Web | Floating assistant widget | Unknown |
| AI in Search | Web + Flutter | Intent parsing in search results | Unknown |

### 9.4 AI Readiness Assessment

**Strengths**:
- Full intent pipeline from classification → matching → orchestration → response
- Hybrid approach (keyword + LLM) provides fallback if Gemini is down
- Content moderation catches profanity, spam, and PII
- Quote drafting demonstrates LLM integration capability
- Hinglish/Hindi keyword support in intent parser

**Weaknesses**:
- **Fragmented architecture**: 9 files with overlapping responsibilities
- **No prompt management**: Prompts hardcoded in each file, no versioning or A/B testing
- **No observability**: No tracking of intent parse success rate, match accuracy, fallback rate
- **No personalization**: Every query treated as first interaction
- **No streaming in Flutter**: Web has streaming (`/api/ai/prompt/stream`), Flutter uses single POST
- **4 entry points confuse users**: Unclear which AI surface to use for what
- **No intent feedback loop**: Users can't correct or refine AI understanding
- **Quote drafting ignores catalog**: LLM generates prices without checking provider's actual pricing

### 9.5 AI Prompt Bar (Web + Mobile)

Both platforms have an AI prompt bar allowing natural language input. The web version has streaming responses; the mobile version uses a single POST. Adoption is unclear — the feature exists in the codebase but no usage analytics are available.

---

## 10. Trust Systems

### 10.1 Verification / KYC

| Feature | Status | Details |
|---------|--------|---------|
| Phone verification | ✅ | Via OTP during signup |
| Email verification | ✅ | Via magic link or OTP |
| ID verification (KYC) | Built, unused | `/app/verification` route exists |
| Badge system | Built, unused | Verified badge in trust system |
| Provider verification flow | Built, unused | Document upload, review, approval |
| Admin verification approval | Built, unused | Admin panel verification tab |

**Assessment**: KYC flow is fully built but has never processed a real verification. The `trust/` directory in `lib/` suggests a more comprehensive trust system was planned but not realized.

### 10.2 Reviews & Ratings

| Feature | Status | Details |
|---------|--------|---------|
| Consumer review of provider | ✅ | After order completion |
| Star rating | ✅ | 1-5 star scale |
| Review text | ✅ | With photos |
| Review moderation | — | Not implemented |
| Provider review of consumer | ❌ | Missing — no dual-sided reputation |
| Review aggregation | ✅ | Average rating on profile |

**Assessment**: Review system is cleanly implemented but has zero reviews. No mechanism for providers to review consumers (dual-sided reputation).

### 10.3 Trust Scores

Trust scoring infrastructure exists in `lib/trust/` but the exact implementation details are unclear from the audit. No trust scores are visible in the UI or used in ranking/matching.

### 10.4 Disputes & Reporting

| Feature | Status | Details |
|---------|--------|---------|
| Dispute creation | ✅ | Mobile only |
| Dispute resolution flow | ✅ | Tied to orders |
| User reporting | ✅ | Report inappropriate content/users |
| Report moderation | — | No automated triage |
| Blocking | ✅ | User-level blocking |

**Assessment**: Premature for zero transactions — disputes cannot exist without completed orders. Built speculatively.

### 10.5 Trust System Gaps

1. **Zero trust signals available**: No reviews, no completed jobs, no response times, no verification badges with real data
2. **No dual-sided reputation**: Providers cannot review consumers
3. **No neighborhood trust score**: Aggregate trust for a locality
4. **No AI-scored trust**: The matching algorithm has trust as a factor but no data to score
5. **No identity verification at scale**: KYC built but not enforced or promoted

---

## 11. Marketplace Systems

### 11.1 Demand Side (Consumers)

| Channel | Implementation | Usage |
|---------|---------------|-------|
| Search (keyword + category) | Full-text search with ilike, category filters, rating sort | Low |
| Feed (posts + needs) | Paginated card feed, scope filtering, saves | Low |
| Market Zones | Locality-specific browsing | Zero |
| Map Discovery (mobile) | Geo-based visual discovery | Zero |
| AI Intent Matching | Natural language → provider match | Unknown |
| Post a Need/Help Request | Form-based need creation | Zero |

**Assessment**: Multiple demand channels exist but none have organic traffic. The search works correctly but returns only demo seed data. No marketing or acquisition has been done.

### 11.2 Supply Side (Providers)

| Channel | Implementation | Usage |
|---------|---------------|-------|
| Manual provider creation | Profile form with services, location, availability | Zero |
| AI Launchpad | 7-question → full profile generation | Zero |
| Provider listings | Service catalog with pricing | Zero |
| Provider discovery (People tab) | Geo-based directory | Zero |

**Assessment**: Zero real providers. Demo seeds exist for development/testing but no organic supply.

### 11.3 Matching

| Method | Implementation | Usage |
|--------|---------------|-------|
| Keyword search | `services::text.ilike.%keyword%` | Zero real matches |
| AI intent matching | Category fit + distance + availability + trust + reviews | Zero real matches |
| Provider scoring | Weighted algorithm in `intentMatching.ts` | Never exercised |
| Geographic matching | Latitude/longitude + radius | Zero real matches |

**Assessment**: Matching algorithms exist but have never been tested with real data. The AI scoring weights (category fit, distance, availability, trust, reviews) are theoretical — no reviews or trust data exists to score.

### 11.4 Transactions

| Step | Implementation | Usage |
|------|---------------|-------|
| Quote creation | Draft → send → compare → accept | Zero |
| Deal Room | Negotiation space per order | Zero |
| Order creation | 11-state workflow | Zero |
| Payment | Razorpay + COD | Zero |
| Escrow | Not implemented | — |
| Order lifecycle | 11 states with branching paths | Zero |
| Completion/closure | Status transitions | Zero |

**Assessment**: The full transaction pipeline is built end-to-end but has zero completed transactions. The 11-state order workflow (`orderWorkflow.ts`) is complex for the current reality (zero orders).

---

## 12. Community Systems

### 12.1 Chat

Chat is the best-engineered feature in the application.

| Feature | Status | Notes |
|---------|--------|-------|
| Realtime messaging | ✅ | Supabase Realtime |
| Typing indicators | ✅ | |
| Read receipts | ✅ | |
| Media attachments | ✅ | Image picker + upload + display |
| Presence detection | ✅ | |
| Auto-reconnect with backoff | ✅ | Exponential, 5s-60s, 20 retries |
| Failed message retry | ✅ | |
| Message history pagination | ✅ | |
| Chat list / inbox | ✅ | |

**Assessment**: Chat is production-ready and genuinely well-engineered. Its main limitation is lack of users to talk to.

### 12.2 Connections

| Feature | Status | Notes |
|---------|--------|-------|
| User connections | Built, unused | Unclear value prop |
| Provider-consumer linking | Implicit via orders | — |
| Network graph | Not built | — |

**Assessment**: Connections feature exists but has unclear value. Users can connect but the purpose (networking? referrals? repeat business?) is not communicated.

### 12.3 Posts & Feed

| Feature | Status | Notes |
|---------|--------|-------|
| Feed cards | ✅ | Paginated, scope filtering, saves |
| Post creation | ✅ | Needs/posts with categories |
| Post status tracking | ✅ | |
| Feed interactions (saves, shares) | ✅ | |
| Feed scope filtering | ✅ | Near me, all, following |

**Assessment**: Feed is well-engineered on the mobile side. However, posts show only seeded content. No organic community activity exists.

### 12.4 Community Gaps

1. **No locality-specific groups or communities**
2. **No "Ask Your Neighborhood" Q&A**
3. **No community events or posts**
4. **No marketplace buzz feed** ("X people used ServiQ today in your area")
5. **No provider referral network** — providers can't refer other providers
6. **No consumer social features** — no sharing, no group buying, no neighborhood recommendations

---

## 13. Commerce Systems

### 13.1 Payments

| Component | Status | Details |
|-----------|--------|---------|
| Razorpay integration | ✅ | Full checkout flow |
| COD (Cash on Delivery) | ✅ | Alternative payment method |
| Payment verification | ✅ | HMAC timing-safe comparison |
| Webhook handling | ✅ | Razorpay webhooks |
| Refund processing | ✅ | Double-refund idempotency guard |
| Escrow | ❌ | Not implemented |

**Assessment**: Payment system is well-implemented with security best practices (HMAC verification, idempotency guard). Zero transactions have been processed.

### 13.2 Subscriptions

| Plan | Price | Features | Usage |
|------|-------|----------|-------|
| Free | Rs 0 | Basic profile, limited leads | Zero |
| Essential | Rs 299/month | Enhanced profile, more leads, analytics | Zero |
| Premium | Rs 999/month | Everything + priority support, featured placement | Zero |

**Assessment**: Subscription plans and billing infrastructure exist. No user has ever subscribed. No premium features are gated behind subscriptions in the current codebase.

### 13.3 Payouts

| Feature | Status | Details |
|---------|--------|-------|
| Provider payout processing | ✅ | Built but unused |
| Payout history | ✅ | |
| Payout status tracking | ✅ | |
| Wallet/banking integration | ✅ | Bank account linking |

**Assessment**: Full payout system built. Zero payouts processed. No real payout disbursement has occurred.

### 13.4 Promo Codes

| Feature | Status |
|---------|--------|
| Promo code creation (admin) | ✅ |
| Promo code redemption | ✅ |
| Discount application | ✅ |
| Promo code analytics | ❌ |

**Assessment**: Built but unused. Admin panel has promo code management.

### 13.5 Invoices

| Feature | Status |
|---------|--------|
| Invoice generation | ✅ |
| Invoice detail page | ✅ |
| Invoice list | ✅ |
| PDF generation | Not confirmed |

**Assessment**: Built but unused. Zero invoices generated.

---

## 14. Recommendations

### 14.1 Critical (Must Fix Before Launch)

| # | Recommendation | Rationale | Effort |
|---|--------------|-----------|--------|
| 1 | **Kill zero-usage features**: Remove or flag 20+ API endpoint groups, 15+ Flutter features, 10+ web pages with zero usage | Maintenance drag, cognitive overhead, false sense of completion | Medium |
| 2 | **Seed real data**: Create 50 real provider profiles in Crossing Republik, seed 100+ simulated completed transactions | Trust signals — without data the app looks dead | High |
| 3 | **Unify the mental model**: Merge Needs/Posts/Orders/Tasks/Bookings into "Work Items"; Quotes/Deal Room into "Proposals" | Eliminates concept overload that confuses every user | High |
| 4 | **Consolidate AI to one entry point**: Keep one AI prompt surface, kill the other 3 | Users don't know which AI to use; fragmentation dilutes the feature | Medium |
| 5 | **Get first real transaction**: Concierge-onboard 20 real providers in one locality, acquire first 10 consumers | Breaking the zero-transaction barrier is existential | Critical |

### 14.2 High Priority

| # | Recommendation | Rationale | Effort |
|---|--------------|-----------|--------|
| 6 | **Role-based navigation**: Hide provider tools from consumers, hide consumer features from providers | 26-item sidebar with irrelevant items for every user | Medium |
| 7 | **Simplify order workflow**: Reduce 11 states to 5-6 for MVP | 11 states is over-engineered for zero orders | Low |
| 8 | **Add AI observability**: Track intent parse success, match accuracy, user satisfaction, fallback rate | Cannot improve what you don't measure | Medium |
| 9 | **Split monolithic pages**: Refactor create_need_page (81KB), chat_page (~75KB), welcome_page (~58KB), profile_page (~57KB) | These are maintenance hazards and performance concerns | High |
| 10 | **Consolidate migration bundles**: 4 migration directories/files need unification | Migration chaos will cause deployment failures | Low |
| 11 | **Add RLS policies**: Secure admin routes, add missing RLS policies across tables | Security gap for any real deployment | Medium |
| 12 | **Default free tier only**: Remove subscription pricing until provider value is proven | Trying to charge before proving value will kill supply | Low |

### 14.3 Medium Priority

| # | Recommendation | Rationale | Effort |
|---|--------------|-----------|--------|
| 13 | **Remove duplicate shared/widgets**: Merge `shared/components` and `shared/widgets` in Flutter | Codebase hygiene | Low |
| 14 | **Fix offline queue**: `offline_sync_manager.dart` has placeholder `_execute()` | Feature is built but non-functional | Medium |
| 15 | **Add web map discovery**: Parity with Flutter's MapDiscoveryPage | Web lacks a key discovery mode | Medium |
| 16 | **Add streaming AI in Flutter**: Parity with web's `/api/ai/prompt/stream` | Mobile UX for AI is worse than web | Medium |
| 17 | **Add intent feedback loop**: Allow users to correct AI understanding | Without feedback, AI can't improve | Medium |
| 18 | **Add provider scheduling**: Time slots, blocked days, recurring availability | Basic provider tool that's missing | Medium |
| 19 | **Add emergency flow**: Fast-track matching for urgent requests | Key use case ("my AC broke NOW") | Medium |

### 14.4 Lower Priority (Phase 2+)

| # | Recommendation | Rationale | Effort |
|---|--------------|-----------|--------|
| 20 | **Web design system**: Build Button, Card, Input, Dialog, Badge primitives for web | Currently ad-hoc Tailwind inconsistent with Flutter | High |
| 21 | **Multi-language on web**: Flutter has 6 locales, web has infrastructure but no translations | Only half the app is localized | Medium |
| 22 | **Remove/consolidate premature features**: Disputes, Reporting, Blocking, Workspaces, Invoices, Campaigns | Built speculatively, zero usage | Medium |
| 23 | **Add provider review of consumers**: Dual-sided reputation | Missing trust signal | Low |
| 24 | **Add read replicas / connection pooling**: Supabase scaling prep | Not urgent at zero users | High |
| 25 | **Add Redis for caching**: Redis in docker-compose but unused in production | Performance optimization | Medium |

### 14.5 Product Strategy Recommendations

| # | Recommendation |
|---|--------------|
| 1 | **Launch in one locality only** (Crossings Republik) — hyperlocal focus creates density |
| 2 | **Start with free provider tier** — onboard providers without payment friction |
| 3 | **Concierge onboarding for first 20 providers** — hand-hold to ensure complete profiles |
| 4 | **Acquire first 10 consumers through WhatsApp/Telegram groups** — leverage existing neighborhood networks |
| 5 | **Focus on micro-tasks (Rs 50-500)** — low-risk transactions build trust for larger jobs |
| 6 | **Make chat the default landing for new users** — conversation is lower friction than search |
| 7 | **Remove all zero-state empty pages** — consolidate to fewer surfaces with meaningful content |
| 8 | **Add "X people used ServiQ today" counters** — social proof even with small numbers |
| 9 | **Remove subscription and boost pricing** — validate demand before monetizing supply |
| 10 | **Measure one metric: time-to-first-transaction** — everything else is secondary |

---

## Appendix A: Technical Debt Summary

| Category | Issue | Severity |
|----------|-------|----------|
| Architecture | 20+ zero-usage API endpoints create maintenance drag | Critical |
| Architecture | Two parallel shared component directories in Flutter | Critical |
| Architecture | 4 concurrent migration bundles create deployment risk | Critical |
| Performance | Monolithic pages (81KB, 75KB, 58KB, 57KB) | High |
| Performance | No lazy loading in several Flutter pages | High |
| Performance | No image optimization strategy on web | Medium |
| Security | RLS gaps on multiple tables | Critical |
| Security | Admin page has no admin role check | Critical |
| Security | No rate limiting on several API routes | High |
| UX | 1,139-line dashboard layout with extreme coupling | Critical |
| UX | Concept overload: 6+ nouns for "work that needs doing" | Critical |
| UX | Zero states everywhere (app looks like a ghost town) | Critical |
| UX | 4 AI entry points with different UX patterns | High |
| Data | `profiles` table has 40+ columns, inconsistent naming | Medium |
| Data | No database-backed category taxonomy (static lists) | Medium |
| Data | `display_name` vs `name` column inconsistency | Low |
| Infrastructure | Single Supabase instance with no read replicas | Medium |
| Infrastructure | Redis in docker-compose but unused in production | Medium |
| Infrastructure | No message queue for async processing | Medium |
| Testing | No E2E tests for critical order→payment→review flow | High |
| Testing | Flutter tests exist but no coverage threshold | Medium |

## Appendix B: Comparative Analysis

| Dimension | ServiQ | Urban Company | TaskRabbit | Thumbtack | Angi (Angie's List) |
|-----------|--------|---------------|------------|-----------|-------------------|
| Geographic focus | Delhi NCR (1 locality pilot) | Pan-India (50+ cities) | Global (US, UK, Canada) | US + Canada | US |
| Service model | Marketplace + provider tools | Managed marketplace | Bid-based tasks | Lead generation | Lead generation + reviews |
| AI integration | Intent parsing + matching + quote drafting | Limited AI search | Basic matching | Lead quality scoring | Basic |
| Provider tools | Launchpad, analytics, subscriptions, payouts | Limited (app-based) | Profile + calendar | Profile + leads only | Profile + leads |
| Transaction volume | 0 | Millions/month | Millions | Lead-based | Lead-based |
| Revenue model | Commission + subscriptions + boosts + launchpad | Commission (20-25%) | Service fee (15%) | Lead fees | Subscription + lead fees |
| Platform maturity | Pre-revenue MV | Market leader | Established | Established | Established |

## Appendix C: Usage Data

| Metric | Value | Source |
|--------|-------|--------|
| Total completed transactions | 0 | Platform data |
| Total revenue | Rs 0 | Platform data |
| Total active providers | 0 (test seeds only) | Platform data |
| Total registered users | Unknown (no analytics) | — |
| Play Store deployment | No | — |
| AI Launchpad usage | 0 | Business model doc |
| Quote Room / Deal Room usage | 0 | Business model doc |
| Total API calls (est) | Unknown | No observability |
| Test accounts | Unknown | — |

---

*End of Audit*
