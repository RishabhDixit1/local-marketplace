# ServiQ Genesis

> **The master document.** Who we are, how we think, what we build, and where we're going.
>
> *Last updated: July 2026 · Pre-launch*

---

## Table of Contents

1. [Mission & Vision](#1-mission--vision)
2. [Core Philosophy](#2-core-philosophy)
3. [Mental Models](#3-mental-models)
4. [Information Architecture](#4-information-architecture)
5. [Navigation Strategy](#5-navigation-strategy)
6. [Trust Architecture](#6-trust-architecture)
7. [Neighborhood Model](#7-neighborhood-model)
8. [AI Operating Layer](#8-ai-operating-layer)
9. [Commerce Layer](#9-commerce-layer)
10. [Communication Layer](#10-communication-layer)
11. [Growth Layer](#11-growth-layer)
12. [Community Layer](#12-community-layer)
13. [Scalability Strategy](#13-scalability-strategy)
14. [Technical Strategy](#14-technical-strategy)
15. [Design Language](#15-design-language)
16. [Engineering Principles](#16-engineering-principles)
17. [Release Strategy](#17-release-strategy)
18. [Migration Strategy](#18-migration-strategy)
19. [10-Year Vision](#19-10-year-vision)

---

## 1. Mission & Vision

### Mission
Connect every Indian neighborhood to trusted local service providers through an AI-powered platform that makes finding, hiring, and paying for services as simple as messaging a friend.

### Vision
Become the operating system for local services in India — the default way millions of households discover, trust, and transact with providers in their neighborhood.

### Who We Are
ServiQ is a hyperlocal services marketplace targeting Delhi NCR first, then India. We are pre-launch: zero transactions, zero revenue, zero active providers. Every system is built. None have been tested by real users. Our job is to cross that chasm.

### Why Now
India's local services market is fragmented, trustless, and offline. Urban Company proved demand at the premium end. WhatsApp groups and word-of-mouth handle the rest. Between them lies a vast middle — micro-tasks (Rs 50-500), same-day needs, neighborhood providers with no digital presence. That is our wedge.

---

## 2. Core Philosophy

### 2.1 Hyperlocal micro-tasks are the wedge
Big-ticket services (paint, renovation, deep cleaning) are high-consideration, low-frequency, and dominated by incumbents. Micro-tasks (Rs 50-500: fix a leak, assemble furniture, walk a dog, teach a guitar lesson) are high-frequency, low-commitment, and have no digital home. Win on micro-tasks, earn the right to expand.

### 2.2 Real-time matching based on geo-proximity
Providers near the consumer get matched first. Distance is the primary sort key for discovery. Latency from request to provider assignment should be measured in seconds, not hours. The platform must feel like hailing a ride, not hiring a contractor.

### 2.3 Trust is the product
In a market without digital trust, the platform must be the trust layer. Every provider is verified (at minimum Level 1). Every transaction builds a reputation that the provider owns and can carry. Reviews are verified (only transacting parties can review). Dispute resolution is fast and fair. Trust scores are transparent and explainable.

### 2.4 AI is an enabler, not a gimmick
AI should disappear into the experience — routing requests, drafting quotes, moderating content, suggesting prices, matching providers. Never a chatbot that pretends to be human. Never a feature that requires the user to "try AI." The measure of AI success is invisibility.

### 2.5 Network effects are the moat
Every new provider makes the platform more valuable for consumers. Every new consumer makes it more valuable for providers. Referrals, reviews, shared trust data, and neighborhood density create compounding defensibility. Linear growth is failure.

### 2.6 Dual-sided trust system
Consumers trust providers (verification, reviews, trust score). Providers trust consumers (payment guarantee, dispute protection, rating system). Both sides must feel safe transacting. Asymmetric trust is a leaky bucket.

### 2.7 Mobile-first, web-always
India's next billion users will transact on mobile. Flutter is the primary citizen. The web (Next.js) serves as the discovery and management companion — deeper analytics, provider dashboard, business admin. But the transaction loop (find, chat, book, pay) must be flawless on mobile.

### 2.8 Design consistency is a trust signal
A fragmented UI signals an unreliable service. Every pixel, every interaction, every transition must be intentional. The Flutter design system (tokens, components, patterns) is mature. The web must catch up. Users should not feel they switched platforms.

### 2.9 Offline is a feature, not an edge case
Indian connectivity is unreliable. The platform must work when the network doesn't — queue requests, cache profiles, defer media, sync on reconnect. Offline support is not a nicety; it is a requirement for the market.

### 2.10 Launch fast, iterate faster
We have built a full platform with zero users. Perfection is the enemy of learning. Launch Noida with the minimum that enables a complete transaction. Learn. Fix. Expand. The backlog is long; the runway is finite.

### 2.11 Data portability and provider empowerment
Providers own their reputation data. If a provider leaves ServiQ, their verified reviews and trust score should be portable. This is both ethical and strategic — it builds trust in the platform and reduces switching costs for providers who might otherwise fear lock-in.

### 2.12 One platform, multiple surfaces
The same backend serves consumers, providers, business owners, and admins. Permissions and views differ. The data model does not. Building four separate platforms would duplicate effort and fragment the ecosystem. A unified model with RLS-based access is the only way to scale engineering.

---

## 3. Mental Models

### The Ride-Hailing Model for Services
A user opens the app, describes a need, gets matched with a nearby provider, sees the provider's trust profile, agrees on a price, the provider arrives and completes the work, payment is handled automatically, both parties rate each other. The mental model is Uber, not Sulekha.

### The Trust Flywheel
Verified provider → transaction → review → higher trust score → more transactions → more reviews → platform becomes default trust layer. Each transaction strengthens the flywheel. The flywheel must be designed so that every party is incentived to participate.

### The Neighborhood Square
Each locality is its own micro-market. Providers serve their square. Consumers find providers who are walking distance away. The platform facilitates, curates, and protects each square. Growth is neighborhood-by-neighborhood, not city-by-city.

### AI as Middleware
AI sits between every user action and the database, routing, enriching, and validating. It is not a separate product. It is the layer that makes the product intelligent. The request → AI parse → match → quote → confirmation pipeline should feel like magic because AI handled the complexity.

### The Three-Transaction Test
Does the platform survive three transactions? The first: discovery and match. The second: booking and payment. The third: completion and review. If any of these three fails for any participant, the marketplace breaks. Every feature must be traceable to one of these three transactions.

### Pre-launch, Everything is a Hypothesis
No user has touched this platform. Every assumption about behavior, pricing, trust, and retention is unvalidated. Build to learn. Metrics before opinions. Dead features (Launchpad, Quote Room, Deal Room, Lead OS) are tuition — expensive but educational.

---

## 4. Information Architecture

### 4.1 Core Entity Model

```
User (consumers + providers + business owners + admins)
  ├── Profile (personal info, avatar, location, services[])
  ├── Trust (verification_level, trust_score, reviews_received)
  ├── Wallet (balance, payment methods, payout methods)
  └── Subscriptions (plan_tier, status, dates)

Service (what a provider offers)
  ├── Category (plumbing, tutoring, etc.)
  ├── Specific service within category (fix leaky tap, guitar lessons)
  ├── Price range (estimated or fixed)
  └── Coverage area (localities served)

Need (what a consumer wants)
  ├── Description (free text, AI-enriched)
  ├── Category + service mapping
  ├── Budget range
  ├── Location + service area
  ├── Urgency (standard, express, emergency)
  └── Status (open, matched, quoted, booked, completed, cancelled)

Order (a booked transaction)
  ├── Need reference
  ├── Provider + consumer
  ├── Price (negotiated or fixed)
  ├── Status flow: quoted → accepted → confirmed → in_progress → completed → (paid, reviewed)
  └── Payment reference + dispute status

Connection (recurring provider-consumer relationship)
  ├── Direction (consumer->provider or provider->consumer)
  ├── Status (pending, accepted, rejected, blocked)
  └── Context (how they connected)

Chat (communication thread)
  ├── Participants (order or connection scoped)
  ├── Messages (text, images, system events)
  └── Metadata (image attachments stored in unused jsonb column)

Review (post-transaction feedback)
  ├── Rating (1-5)
  ├── Text
  ├── Direction (consumer->provider, provider->consumer)
  └── Verified (only parties to the order)
```

### 4.2 Simplified Access Model

| Surface | Primary Actions | Auth Required |
|---------|----------------|---------------|
| Consumer App (Flutter) | Search, browse, post need, chat, book, pay, review, refer | Yes |
| Provider App (Flutter) | Manage services, receive requests, quote, chat, accept, complete, withdraw | Yes |
| Provider Web Dashboard | Analytics, availability, subscriptions, boosts, listings, invoices | Yes |
| Consumer Web | Browse services, manage orders, profile | Yes |
| Business Web (Future) | Multi-provider management, team scheduling, business analytics | Yes |
| Admin Panel (Web) | User management, moderation, disputes, campaigns, platform config | Yes (admin role) |

### 4.3 Terminology (Current State)

The platform has accumulated overlapping terminology. This is a known debt item.

| Term | Usage | Problem |
|------|-------|---------|
| Need / Task / Job | Consumer request for service | Three terms for the same concept |
| Quote / Offer / Proposal | Provider response to need | Three terms for the same concept |
| Order / Booking | Confirmed transaction | Used interchangeably |
| Connection / Follow | Recurring relationship | Unclear distinction |
| Launchpad / Lead OS | Dead AI features | Confuses the mental model |
| Boost / Featured / Campaign | Promotion mechanisms | Overlapping semantics |

**Target state:** Need → Quote → Order → Review. Eliminate: Task, Job, Offer, Proposal, Booking, Launchpad, Lead OS, Deal Room, Quote Room.

---

## 5. Navigation Strategy

### 5.1 Mobile Navigation (Flutter)

**Bottom Tab Bar (primary surfaces):**
1. **Home** — Feed of providers + discovery + AI search bar
2. **Orders** — Active and past orders with status filtering (All / Active / Completed / Cancelled)
3. **Chat** — Recent conversations (needs, orders, connections)
4. **Profile** — User profile, settings, trust information, referrals

**Provider Tools (conditionally visible):**
- Accessible via Profile hub when user has `provider` role
- Sectioned: Provider Tools, Orders & Payments, Communication & Trust, Account

### 5.2 Web Navigation (Next.js)

**Header navigation:**
- Logo → Home
- Browse Services
- Post a Need
- Orders
- Profile menu (dashboard link if provider)

**Provider Dashboard sidebar:**
- Overview
- Orders
- Services / Listings
- Availability
- Analytics
- Subscriptions
- Boosts / Promotions
- Payouts
- Invoices
- Referrals
- Settings

### 5.3 Navigation Principles
- Three taps to any screen (mobile)
- Two clicks to any screen (web)
- Contextual back navigation (never trap the user)
- Deep links for all shareable content (provider profile, order, listing)
- Guest browsing allowed (limited: browse services, view provider profiles, see pricing)
- Login required only for transaction actions (post need, chat, book, pay)

---

## 6. Trust Architecture

### 6.1 Verification Levels

| Level | Requirements | Badge | Privileges |
|-------|-------------|-------|------------|
| Level 0 - Unverified | Email + phone | None | Browse only |
| Level 1 - Basic | Selfie + ID proof (Aadhaar, PAN, DL) | ✅ Verified | Post needs, chat, receive orders |
| Level 2 - Enhanced | Level 1 + address verification + background check | ✅✅ Trusted | Higher trust score weight, priority matching |
| Level 3 - Premium | Level 2 + in-person verification + business registration | ✅✅✅ Premium | Featured placement eligibility, higher payout priority |

**Note:** L1 is the minimum for any transaction. L2+ unlocks platform benefits.

### 6.2 Trust Score

Composite score (0-1000) calculated from:
- Verification level (base: 100/200/300)
- Order completion rate (max: 200)
- Average review rating (max: 250)
- Number of completed orders (max: 100)
- Dispute history (penalty: -50 per disputed order lost)
- Account age (max: 50)
- Response time (max: 50)
- Review recency (decay over 90 days)

**Displayed as:** Score + label (Excellent 800+, Good 600+, Fair 400+, New <400)
**Both sides:** Providers have trust scores visible to consumers. Consumers have trust scores visible to providers.

### 6.3 Review System
- Only verified transaction participants can review
- Reviews are bidirectional (consumer reviews provider, provider reviews consumer)
- Ratings are 1-5 stars with optional text
- Provider can respond to a review (once)
- Fraudulent reviews can be flagged for admin moderation
- Review moderation SLA: 24 hours for flagged reviews

### 6.4 Dispute Resolution
- Dispute can be raised by either party within 7 days of order completion
- Both parties submit evidence (text, photos)
- AI-assisted triage: categorize dispute, suggest resolution
- Admin-mediated resolution with 48-hour SLA
- Resolution options: refund (full/partial), re-do, cancel with compensation
- Double-refund idempotency guard implemented (HMAC timing-safe comparison in payment verify endpoint)

### 6.5 Platform Enforcement
- **Block:** User can block another user (prevents all interaction)
- **Report:** Report inappropriate behavior or content (moderated by admin)
- **Suspend:** Admin action to temporarily disable an account
- **Ban:** Permanent account termination with data retention for compliance
- All enforcement actions are logged with timestamps and admin notes

### 6.6 Trust Portability
- Providers can export their verified reviews and trust score
- Machine-readable format (JSON) for portability
- Intended future: integration with other platforms via API

---

## 7. Neighborhood Model

### 7.1 Geography Hierarchy

```
City (Delhi NCR)
  ├── Zone (Noida, Gurgaon, Delhi, Ghaziabad, Faridabad)
  │   ├── Locality (Sector 62, Indirapuram, Connaught Place, etc.)
  │   │   ├── Provider coverage area (localities a provider serves)
  │   │   └── Consumer location (locality of the consumer)
```

### 7.2 Matching Algorithm (Current)

When a consumer posts a need:
1. AI parses the need → category + service + attributes + budget + urgency
2. System queries providers who serve the consumer's locality (or nearby)
3. Providers are ranked by: distance → trust score → response time → rating
4. Top N providers receive a notification (configurable, default 5)
5. Providers can view the need and respond with a quote
6. Consumer receives quotes and selects a provider

### 7.3 Locality Activation Strategy

1. **Seed:** Identify 3-5 high-density localities in Noida for pilot
2. **Recruit:** Concierge onboard 10-15 providers per locality (verified L1+)
3. **Launch:** Activate locality with seeded providers + demand generation
4. **Measure:** Track transaction volume per locality, provider density, consumer repeat rate
5. **Optimize:** Adjust provider-to-consumer ratio, service mix per locality
6. **Expand:** Next locality only when current locality shows healthy metrics

**Success metrics per locality:**
- Minimum 20 providers (L1+)
- Minimum 100 completed transactions/month
- Provider utilization rate > 40%
- Consumer repeat rate > 30%
- Average matching time < 5 minutes

### 7.4 Locality Market Zones

- Providers define their service area (list of localities they serve)
- Consumer's location determines which providers see their need
- Providers can set different pricing per locality (travel surcharge for distant localities)
- Consumers can browse providers by locality (map discovery view)

---

## 8. AI Operating Layer

### 8.1 Philosophy

AI is not a feature. AI is the platform's operating system — every request, every match, every quote, every moderation pass goes through AI. The user never "uses AI." They use ServiQ, which happens to be intelligent.

### 8.2 Current AI Capabilities

| Capability | Model | Fallback | Status |
|-----------|-------|----------|--------|
| Intent parsing (need → structured data) | Gemini 2.0 Flash | Heuristic regex parser | Live |
| Provider matching (need → provider rank) | Gemini 2.0 Flash | Geo + category filter | Live |
| Quote drafting (auto-generate provider response) | Gemini 2.0 Flash | Template | Live |
| Content moderation (messages, reviews, listings) | Gemini 2.0 Flash | Keyword filter | Live |
| Launchpad generation (dead feature) | Gemini 2.0 Flash | None | Built, unused |
| AI search (natural language → service results) | Gemini 2.0 Flash | SQL ilike query | Live |

### 8.3 AI Architecture

```
User Input
  └→ API Route (rate limited, auth checked)
       └→ AI Service Layer
            ├→ LLM Call (Gemini 2.0 Flash with system prompt)
            ├→ Structured output parser (JSON schema enforcement)
            ├→ Validation (business rules)
            ├→ Fallback (heuristic if LLM fails/times out)
            └→ Response (enriched, structured)
```

### 8.4 AI Gaps (Known)

- **No prompt logging** — cannot audit what was sent to LLM
- **No cost tracking** — cannot measure AI operational cost per transaction
- **No prompt versioning** — system prompts change in code, no management layer
- **No A/B testing** — cannot compare AI vs heuristic outcomes
- **No multi-model fallback** — single provider (Gemini), no graceful degradation
- **No latency monitoring** — cannot detect AI degradation
- **No hallucination detection** — cannot verify LLM output correctness

### 8.5 AI Roadmap Principles

- Always have a non-AI fallback (the platform must work without AI)
- Measure AI cost per transaction (target: < Rs 1 per AI interaction)
- Log every prompt and response (for debugging, improvement, compliance)
- A/B test every AI feature against heuristic baseline
- Version system prompts the same way you version code
- Monitor for drift (changing user behavior may require prompt updates)

---

## 9. Commerce Layer

### 9.1 Payment Architecture

| Component | Technology | Status |
|-----------|-----------|--------|
| Payment gateway | Razorpay | Live |
| Order flow | Custom orders API | Live |
| Refund handling | Custom with HMAC + idempotency | Live |
| Payouts | Razorpay x Settlements | Live |
| Promo codes | Custom | Live |
| Subscriptions | Custom (3 tiers) | Live |

### 9.2 Order-to-Payment Flow

```
Provider accepts need → Order created (status: quoted)
Consumer accepts quote → Order status: accepted
Payment collected → Order status: confirmed (funds held)
Work completed → Order status: completed
Release payment to provider → Order status: paid
Both parties review → Order status: reviewed
```

### 9.3 Subscription Tiers

| Tier | Price | Provider Benefits |
|-----|-------|-------------------|
| Free | Rs 0 | Basic listing, standard matching, 10% commission |
| Plus | Rs 199/mo | Priority matching, featured listing, 7% commission, basic analytics |
| Pro | Rs 499/mo | Top matching priority, verified badge, 5% commission, advanced analytics, promo credits |

**Target conversion:** 32% of active providers on paid plans by M12.

### 9.4 Marketplace Economics (Target)

| Metric | Y1 Target | Y2 Target | Y3 Target |
|--------|-----------|-----------|-----------|
| Gross Margin | 65% | 78% | 82% |
| Take Rate | 15-20% | 12-15% | 10-12% |
| Avg Order Value | Rs 450 | Rs 550 | Rs 650 |
| Provider Commission | 10-20% | 8-15% | 5-12% |

### 9.5 Payouts
- Provider payouts are processed via Razorpay settlements on a T+2 cycle
- Minimum payout amount: Rs 500
- Payout holds for disputed orders
- Refunds are deducted from pending payouts or wallet balance

### 9.6 Invoicing
- Auto-generated invoices for completed orders
- Provider can download invoice PDF
- GST-compliant invoices (when provider is GST registered)
- Invoice history in provider dashboard

---

## 10. Communication Layer

### 10.1 Chat Architecture

- Thread-based: each order or connection has its own chat thread
- Messages: text + image attachments (stored in `metadata` jsonb column on `messages` table)
- Real-time: Supabase Realtime subscriptions with exponential backoff reconnect (5s-60s, 20 retries)
- System messages: status changes, payment confirmations, dispute updates injected into chat
- Chat history: paginated, scroll-to-bottom on open, auto-scroll on new message

### 10.2 Notification Types

| Type | Channel | Priority | Use Case |
|------|---------|----------|----------|
| New need | Push + In-app | High | Provider gets new request |
| New quote | Push + In-app | High | Consumer gets a quote |
| Order update | Push + In-app | High | Status changes |
| Payment | Push + In-app | High | Payment confirmations |
| New message | Push + In-app | Medium | Chat messages |
| Review received | Push + In-app | Medium | Transaction completed |
| Dispute update | Push + In-app | High | Dispute progress |
| Subscription expiring | Push + In-app | Medium | Renewal reminder |
| Promotional | Push + In-app | Low | Campaigns, offers |

### 10.3 Offline Strategy
- Connectivity monitoring via connectivity_plus
- Offline banner displayed in app shell when offline
- Requests queued and retried on reconnect
- Cached data served from local storage when offline
- Images deferred when on slow connections

### 10.4 Real-time Resilience
- Exponential backoff: 5s → 10s → 20s → 40s → 60s (max)
- 20 retry attempts before giving up
- Automatic reconnect when connectivity restored
- Session refresh with 8-second timeout (prevents hung cold starts)
- FlutterSecureStorage pre-warm for faster Supabase init

---

## 11. Growth Layer

### 11.1 Acquisition Channels

| Channel | Stage | Investment | Expected CAC |
|---------|-------|------------|--------------|
| Provider concierge | Pre-launch | High | Rs 500/provider |
| Consumer referrals | Launch | Low | Rs 50/user |
| Social (Instagram + WhatsApp) | Launch | Medium | Rs 30/user |
| Local events / street teams | Pilot | Medium | Rs 100/user |
| Google Ads (service keywords) | M3+ | High | Rs 80/user |
| SEO (service + locality) | M6+ | Low | Organic |
| Provider referrals | M3+ | Low | Rs 100/provider |

### 11.2 Referral Program
- Both consumers and providers can refer
- Consumer referral: refer a friend, both get Rs 50 credit on first transaction
- Provider referral: refer a provider, get Rs 200 after new provider completes 5 orders
- Referral tracking via unique code or deep link
- Referral dashboard: track invites, conversions, rewards

### 11.3 Retention Loops

| Loop | Trigger | Frequency | Goal |
|------|---------|-----------|------|
| Need → Quote → Book | Consumer posts need | Per transaction | Convert need to order |
| Order → Review → Share | Order completed | Per transaction | Generate UGC + referrals |
| Provider → Payout → Subscribe | Payout received | Per payout | Convert to paid subscription |
| Browse → Connect → Re-order | Post-order | Weekly | Repeat purchase |
| Promo → Book | Promo code sent | Monthly | Re-activate dormant |

### 11.4 Campaign System
- Admin-created promotional campaigns
- Campaign types: discount codes, featured placement, seasonal offers
- Campaign targeting: by locality, by service category, by user segment
- Campaign analytics: redemption rate, incremental transactions, ROI

### 11.5 Boost / Featured Placements
- Providers can boost their listing in search results (paid)
- Featured placements on home feed (time-bound, location-targeted)
- Subscription tiers include free boost credits (Pro tier)

---

## 12. Community Layer

### 12.1 Connections Model
- Consumers can follow/save providers they like (connection)
- Providers can accept or reject connection requests
- Connected providers appear in quick-access list
- Recurring customers can re-order from connected providers without posting a new need
- Connection statuses: pending, accepted, rejected, blocked

### 12.2 Reviews as Social Proof
- Provider profile displays aggregate rating + review count + trust level
- Reviews visible on provider cards in feed
- Top reviewers (by count) get badges
- Review responses visible to all

### 12.3 Provider Empowerment
- Provider profile is the storefront: photos, services, description, trust badges
- Response metrics displayed: avg response time, completion rate, on-time rate
- Provider can showcase portfolio (photos of completed work)
- Provider can set custom availability (days, hours, service-specific)

---

## 13. Scalability Strategy

### 13.1 Technical Scalability

**Database:**
- Supabase Postgres (vertical scale first, read replicas for analytics queries)
- RLS offloads authorization to database layer
- Index strategy: cover all foreign keys, status filters, geo-queries
- Migration testing: all 63 migrations must be tested before production deployment

**API:**
- Rate limiting on all public endpoints (atomic upsert pattern)
- No API versioning yet (technical debt — introduces breaking change risk)
- Edge function offload for AI processing (compute-heavy)
- Response caching for static data (service catalog, localities)

**Real-time:**
- Supabase Realtime manages WebSocket connections
- Exponential backoff prevents thundering herd on reconnect
- Connection pool monitoring needed before launch

**File Storage:**
- Supabase Storage for images (profile photos, chat attachments, review photos)
- CDN caching for frequently accessed images
- Image compression on upload (defer if slow connection)

### 13.2 Business Scalability

**City expansion (multi-year):**
1. Delhi NCR (Year 1) — prove model, optimize playbook, build moat
2. Tier 1 cities (Year 2) — Mumbai, Bangalore, Hyderabad, Chennai, Pune, Kolkata
3. Tier 2 cities (Year 3+) — Lucknow, Jaipur, Ahmedabad, Chandigarh, Indore, Bhopal, Nagpur, Surat

**Playbook per city:**
- Locality seed: 3-5 neighborhoods, 10-15 providers each
- Concierge provider onboarding (high-touch, slow)
- Demand generation: referrals + local events + social + limited paid ads
- Metrics gate: locality healthy before expanding to next
- Regional manager: first hire per city, becomes city lead

**Scalability risks:**
- Provider quality dilution at scale
- Support cost per transaction rising as volume grows
- Fraud at scale (fake reviews, fake orders, payment fraud)
- Regulatory changes (GST for small providers, data localization)

---

## 14. Technical Strategy

### 14.1 Stack Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Mobile | Flutter 3.41 | Single codebase for Android + iOS, mature design system |
| Web | Next.js 16 + React 19 + Tailwind 4 | Full-stack SSR, top DX, massive ecosystem |
| State (Flutter) | Riverpod | Testable, scalable, no boilerplate |
| Navigation (Flutter) | go_router | Declarative, deep-link friendly |
| Backend | Supabase | Auth, Postgres, Realtime, RLS, Storage — one platform |
| AI | Gemini 2.0 Flash | Fast, cheap, good Hindi support |
| Payments | Razorpay | India-optimized, UPI native |
| Monitoring | Sentry | Error tracking + performance monitoring |
| Auth | Supabase Auth | Row-level security integration |

### 14.2 Architecture Patterns

**Flutter — Feature-first clean architecture:**
```
lib/
  features/
    <feature>/
      presentation/  (screens, widgets, providers)
      domain/        (models, repositories interfaces)
      data/          (repository implementations, data sources)
  shared/            (design system, common widgets, utils)
  core/              (config, routing, DI, network)
```

**Web — Next.js App Router:**
```
app/
  (routes)/
    <route>/page.tsx
  components/        (shared UI components)
  lib/               (utilities, API clients, AI services)
  hooks/             (shared hooks)
  styles/            (globals, CSS variables)
```

**API — Next.js API Routes:**
```
app/api/
  <resource>/
    route.ts         (CRUD, one file per resource)
  middleware.ts      (auth, rate limit, CSP headers)
```

### 14.3 Security
- CSP headers configured
- Rate limiting on all public endpoints (atomic upsert prevents race conditions)
- HMAC timing-safe comparison on payment verification
- Double-refund idempotency guard
- RLS enabled on all tables (no by-pass)
- Input sanitization on all user inputs
- Session management with 8-second timeout

### 14.4 Key Technical Debt
- Zero test coverage on Flutter
- Limited test coverage on web
- No shared types/SDK between web and mobile
- No API versioning
- Fragmented environment configuration (env vars spread across platforms)
- Dead features in codebase (Launchpad, Deal Room, Quote Room, Lead OS)
- `metadata` jsonb column on `messages` table used for image attachments (non-standard)
- Web has no formal design system component library (CSS variables exist, no component abstraction)

---

## 15. Design Language

### 15.1 Unified Philosophy

ServiQ should feel like one product, not two platforms. The mobile app and web dashboard must share:
- Color palette and semantic colors
- Typography scale and hierarchy
- Spacing rhythm
- Corner radii and elevation
- Iconography style
- Animation principles
- Component behavior patterns

**Current state:** Flutter has a mature design system with token-based components (`AppSpacing`, `AppRadii`, `AppTextField`, `ServiqScaffold`, `ServiqTopBar`, `AppPill`, `ServiqToast`). Web uses CSS variables for dark mode and basic theming but lacks a formal component library.

### 15.2 Flutter Design System (Mature)
- Token system: spacing, radii, colors, typography (defined in design tokens)
- Component library: `ServiqScaffold`, `ServiqTopBar`, `AppTextField`, `AppPill`, `ServiqToast`, `EmptyStateView`
- Shared primitive: `AppSpacing` (xs=8, sm=12, md=16, lg=20, xl=24, xxl=32, xxxl=40)
- Shared radii: `AppRadii` (xs=4, sm=6, md=8, lg=12, xl=16, pill=999)
- Dark mode: Full support via CSS variables + Flutter themes

### 15.3 Web Design System (Target)
- CSS custom properties for: colors, spacing, radii, typography, shadows
- React component library matching Flutter's `Serviq` components
- Dark mode via CSS variables (data-theme attribute)
- Token documentation in living style guide
- Figma ↔ Code token sync pipeline (not yet built)

### 15.4 Visual Principles
- **Clarity over cleverness.** Every UI element should be understandable without instruction.
- **Consistency over novelty.** Use established patterns. Users should feel at home.
- **Accessibility is non-negotiable.** WCAG 2.1 AA minimum. Color contrast, touch targets, labels, screen reader support.
- **Performance is a design concern.** Skeleton loading, progressive image loading, minimum frame drops.
- **Trust through polish.** A well-crafted UI signals a reliable service.

### 15.5 Accessibility Baseline
- All touch targets ≥ 44px (mobile)
- Color contrast ≥ 4.5:1 for text
- Semantic labels on all icons and interactive elements
- Roles announced for dynamic content (role="alert" on errors)
- Keyboard navigation (web)
- Font scaling support (mobile)

---

## 16. Engineering Principles

### 16.1 Code Quality
- **No code is final.** Every line can be improved. Ship it, learn, iterate.
- **Tests are not optional.** Untested code is assumed broken. Start with Flutter unit/widget tests.
- **Type everything.** TypeScript strict mode. Dart with sound null safety. No `any`, no `dynamic`.
- **Lint before commit.** ESLint for web, Flutter analyze for mobile. CI should enforce.

### 16.2 Architecture
- **Separation of concerns.** Presentation, domain, data layers stay separate.
- **Dependency inversion.** High-level modules don't depend on low-level modules. Both depend on abstractions.
- **Fail fast.** Catch errors at the boundary. Validate input. Return early.
- **Observability by default.** Every API call, every AI interaction, every error is logged.

### 16.3 Process
- **One feature, one PR.** Small, focused changes. No mega-PRs.
- **Write the test first** (when possible). TDD for bug fixes.
- **Document the "why".** Code explains what. Comments explain why. Prefer self-documenting code over comments.
- **Review with empathy.** Code review is teaching, not gatekeeping.

### 16.4 Platform-Specific

**Flutter:**
- Riverpod for all state management (no setState for complex state)
- go_router for navigation (no Navigator.push)
- No raw SnackBar — always `ServiqToast.show()`
- No raw TextField — always `AppTextField`
- No raw Scaffold/AppBar — always `ServiqScaffold`/`ServiqTopBar`

**Web:**
- Server components by default, client components only when necessary
- Tailwind for styling, CSS variables for tokens
- Form validation on both client and server
- API routes for all data access (no direct DB from client)

---

## 17. Release Strategy

### 17.1 Pre-Launch Phase (Current)
- All systems built. No real users.
- Tasks: concierge provider onboarding, Noida locality activation, payment flow end-to-end validation, trust baseline for first providers, testing coverage establishment.

### 17.2 Alpha Launch (Noida Pilot)
- **Scope:** 5 localities, 50-75 providers (L1+), 3-5 service categories
- **Invite-only:** Consumers join via referral code or concierge
- **Goal:** 100 completed transactions, end-to-end flow validation, trust system proof
- **Duration:** 4-6 weeks
- **Success criteria:** 80%+ transaction completion rate, < 5% dispute rate, NPS > 30

### 17.3 Beta Launch (Delhi NCR)
- **Scope:** Delhi NCR, 500+ providers, all service categories
- **Open signup:** Anyone can join (consumer), provider onboarding still concierge-assisted
- **Goal:** 1000 transactions/month, subscription activation
- **Duration:** 8-12 weeks after alpha
- **Success criteria:** Repeat purchase rate > 25%, provider retention > 60%, subscription conversion > 15%

### 17.4 Public Launch
- **Scope:** Delhi NCR, 2500+ providers, full marketing push
- **Self-serve provider onboarding** (gated by verification)
- **Goal:** 27K transactions/month by M12, Rs 29.9 Cr revenue
- **Success criteria:** Unit economics positive (excluding fixed costs), break-even by M9

### 17.5 Post-Launch Cadence
- **Weekly releases** during alpha/beta
- **Bi-weekly releases** post-launch
- **Hotfix:** as needed, within 4 hours for P0 issues
- **Feature flags** for risky changes
- **Dark launches** for infrastructure migrations

---

## 18. Migration Strategy

### 18.1 Principles
- **Backward compatibility** during transition periods
- **Feature flags** for all breaking changes
- **Gradual rollout:** 1% → 10% → 50% → 100% for significant changes
- **Rollback plan** before every deployment
- **Data migrations** are reversible (up/down scripts for all 63 migrations)

### 18.2 Known Migration Needs

| Migration | Risk | Strategy | Timeline |
|-----------|------|----------|----------|
| API versioning | High | URL prefix (/v1/, /v2/) with deprecation headers | Post-launch |
| Terminology cleanup | High | Database alias view + new columns, old columns deprecated | Post-launch |
| Web design system | Medium | Incremental component replacement, CSS variables first | Pre-launch |
| Shared types/SDK | Medium | Extract common types to NPM + pub packages | Post-launch |
| Env config consolidation | Low | Single env file per environment, CI validates | Pre-launch |
| Dead feature removal | Low | Feature flag disabled → code removal in next release | Ongoing |

### 18.3 Breaking Change Protocol
1. Announce deprecation with timeline (minimum 2 weeks notice for API consumers)
2. Ship old + new simultaneously
3. Monitor old usage (must drop below threshold before removal)
4. Remove old code
5. Document in changelog

---

## 19. 10-Year Vision

### Phase 1: Foundation (Year 1)
- Launch Delhi NCR
- 27K monthly transactions
- 2,500 active providers
- 800 paid subscribers
- Break-even
- Proven unit economics

### Phase 2: Expansion (Years 2-3)
- 6-8 Tier 1 cities
- 200K+ monthly transactions
- 15K+ active providers
- Multi-category leadership
- AI fully embedded in operations

### Phase 3: Platform (Years 4-5)
- 20+ cities (Tier 1 + Tier 2)
- 1M+ monthly transactions
- 50K+ active providers
- Local services OS — adjacent verticals (healthcare, education, home services)
- Provider empowerment platform (loans, insurance, training)

### Phase 4: Ecosystem (Years 6-10)
- Pan-India presence
- Trust data portability standard
- AI-first matching and operations across all cities
- B2B services + enterprise provider management
- Insurance/guarantee products for transactions
- Voice interface for next billion users
- Local services become organized, trusted, and digital-first

### The North Star
A domestic worker in Noida and a software engineer in Bangalore both use ServiQ daily — one to find work and build a career, the other to find help and build a home. The platform is invisible. The trust is implicit. The transaction is effortless. That is the world we are building.

---

*End of ServiQ Genesis. This document is living — update as the product evolves, but maintain the narrative coherence.*
