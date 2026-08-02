# ServiQ Product Architecture — Phase 2

> Designed from first principles. Not a screen map. Not a feature list.
> This document defines *what ServiQ is* — its permanent identity, core domains,
> product layers, and the relationships between them.
>
> *Date: July 31, 2026*

---

## Table of Contents

1. [The Permanent Identity of ServiQ](#1-the-permanent-identity-of-serviq)
2. [Core Domains](#2-core-domains)
3. [Product Layers](#3-product-layers)
4. [Business Layers](#4-business-layers)
5. [The Product Hierarchy](#5-the-product-hierarchy)
6. [Concept Consolidation (What Dies, What Lives, Why)](#6-concept-consolidation)
7. [Domain Capabilities](#7-domain-capabilities)
8. [Ecosystems](#8-ecosystems)
9. [Scale Architecture](#9-scale-architecture)
10. [Architecture Rules](#10-architecture-rules)

---

## 1. The Permanent Identity of ServiQ

### What ServiQ Is

ServiQ is **trust infrastructure for Indian neighborhoods.**

It is not a marketplace. It is not a listing directory. It is not a booking platform. Those are *surfaces* — present-tense implementations of a deeper structure. The structure itself is this: an operating system that takes an unorganized, cash-based, word-of-mouth local services economy and transforms it into an organized, digital, trust-by-platform economy.

### What Never Changes

| Aspect | Permanent | Mutable |
|--------|-----------|---------|
| Purpose | Build trust in neighborhood commerce | Which services, which cities, which UI |
| Moat | Portable reputation + verified identity | Pricing model, commission rate |
| Differentiator | AI-invisible hyperlocal matching | Specific AI model, prompt strategy |
| Unit | The neighborhood | City expansion order |
| Core loop | Request → Quote → Order → Review | How many steps, which payment method |
| Trust model | Bidirectional, verified, cumulative | Verification level criteria |

### What ServiQ Is Not

- Not "Urban Company for micro-tasks" (UC is a managed marketplace; ServiQ is infrastructure)
- Not "TaskRabbit for India" (TaskRabbit is bid-based; ServiQ is intent → AI → match)
- Not "Justdial with reviews" (Justdial is a directory; ServiQ is a transaction platform)
- Not "whatsapp group digitized" (WhatsApp has no trust layer; trust is the product)

### The Three Transactions

Every feature, every screen, every API endpoint exists to serve one of three transactions:

1. **Discovery transaction:** Need finds provider (or provider finds need)
2. **Commerce transaction:** Work is priced, booked, paid, and completed
3. **Trust transaction:** Both parties review, reputation updates, trust compounds

If a feature cannot be traced to one of these three, it is either infrastructure (enabling one of the three) or premature (remove until a transaction requires it).

---

## 2. Core Domains

Ten domains. Every future feature must fit into exactly one. If a feature cannot be placed, the architecture is incomplete.

```
                      ┌──────────────────┐
                      │     KNOWLEDGE     │
                      │  (intelligence)   │
                      └────────┬─────────┘
                               │ feeds
┌──────────────────────────────────────────────────┐
│                    DISCOVERY                      │
│      (need → provider, provider → need)          │
└──────────────────────────────────────────────────┘
                               │ triggers
┌──────────────────────────────────────────────────┐
│                    COMMERCE                       │
│  (request → quote → order → payment → payout)    │
└──────────────────────────────────────────────────┘
                               │ mediated by
                    ┌──────────────────────┐
                    │    CONVERSATION       │
                    │  (chat, negotiate,    │
                    │   coordinate)         │
                    └──────────────────────┘
                               │ secured by
┌──────────────────────────────────────────────────┐
│                     TRUST                         │
│  (verify → review → score → dispute → protect)   │
└──────────────────────────────────────────────────┘
                               │ happens in
┌──────────────────────────────────────────────────┐
│                  NEIGHBORHOOD                     │
│  (locality, proximity, market zone)              │
└──────────────────────────────────────────────────┘
                               │ inhabited by
┌──────────────────────────────────────────────────┐
│                  FOUNDATION                       │
│     (identity, profile, auth, roles)             │
└──────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │              COMMUNITY                    │
    │  (relationships, referrals, social proof) │
    └──────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │               GROWTH                      │
    │  (subscriptions, boosts, campaigns)       │
    └──────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │             OPERATIONS                    │
    │  (admin, moderation, config, analytics)   │
    └──────────────────────────────────────────┘
```

### Domain Descriptions

| Domain | Purpose | Owns |
|--------|---------|------|
| **Foundation** | Who is in the system | Identity, authentication, profiles, roles, device management |
| **Neighborhood** | Where transactions happen | Localities, geography, proximity, coverage areas, market zones |
| **Trust** | Why transactions are safe | Verification, reviews, trust scores, disputes, blocking, guarantees |
| **Conversation** | How people coordinate | Chat, notifications, real-time events, offline messaging |
| **Discovery** | How needs find supply | Search, browse, feed, AI matching, service catalog, guest browsing |
| **Commerce** | How value exchanges | Requests, quotes, orders, payments, payouts, refunds, invoicing |
| **Knowledge** | What the system knows | Service catalog, market data, pricing intelligence, analytics, AI training data |
| **Community** | How the network grows | Relationships, referrals, social proof, neighborhood activity, sharing |
| **Growth** | How the platform scales | Subscriptions, boosts, campaigns, promo codes, loyalty, retention |
| **Operations** | How the platform runs | Admin, moderation, configuration, feature flags, monitoring, background jobs |

---

## 3. Product Layers

Each user interacts with a subset of domains based on their role. These are the surfaces, not the architecture.

### Consumer Layer (Mobile-first, web companion)

```
┌─────────────────────────────────────────────┐
│  CONSUMER EXPERIENCE                         │
│                                              │
│  Entry Points:                               │
│  AI Prompt Bar ("I need...") → Discovery     │
│  Browse/Search → Discovery                   │
│  Past Provider → Quick Re-order → Commerce   │
│  Notification → Order update → Conversation  │
│                                              │
│  Visible Domains: Foundation, Neighborhood,  │
│  Discovery, Commerce, Conversation, Trust,   │
│  Community, Knowledge (read-only prices)     │
└─────────────────────────────────────────────┘
```

### Provider Layer (Mobile + Web Dashboard)

```
┌─────────────────────────────────────────────┐
│  PROVIDER EXPERIENCE                         │
│                                              │
│  Entry Points:                               │
│  Incoming Request → Quote → Commerce         │
│  Dashboard → Analytics → Knowledge           │
│  Chat → Conversation                          │
│  Subscription → Growth                        │
│  Verification → Trust                         │
│                                              │
│  Visible Domains: Foundation, Neighborhood,  │
│  Commerce, Conversation, Trust, Knowledge,   │
│  Growth, Community (consumer referrals)       │
└─────────────────────────────────────────────┘
```

### Business Layer (Future — Web)

```
┌─────────────────────────────────────────────┐
│  BUSINESS EXPERIENCE                         │
│                                              │
│  Extends Provider with:                      │
│  Multi-provider management                   │
│  Team scheduling and dispatch                │
│  Consolidated analytics                      │
│  Role-based access within business           │
│  Contract/recurring service booking          │
│                                              │
│  Visible Domains: Everything in Provider +   │
│  Operations (team management)                │
└─────────────────────────────────────────────┘
```

### Admin Layer (Web)

```
┌─────────────────────────────────────────────┐
│  ADMIN EXPERIENCE                            │
│                                              │
│  Domains:                                     │
│  Operations (primary)                         │
│  Trust (verification approval, disputes)      │
│  Knowledge (platform analytics)               │
│  Growth (campaigns, promo codes)              │
│  Foundation (user management)                 │
└─────────────────────────────────────────────┘
```

---

## 4. Business Layers

These are not product surfces. They are the business model structure that the product serves.

### Layer 1: Infrastructure (Free, always)

The platform works without any payment from either side. This is the on-ramp.

- Public service catalog browsing
- Provider discovery and profile viewing
- Request posting
- Quote submission
- Chat
- Reviews and trust scores
- Basic matching (geo + category)

### Layer 2: Transaction (Per-event)

The platform earns when value exchanges.

- Commission on completed orders (12% target)
- Payment processing fee
- COD handling fee
- Refund processing fee (if applicable)

### Layer 3: Growth (Recurring)

Providers invest in their success on the platform.

- Subscription tiers (Free / Plus / Pro)
- Boost purchases (per-post visibility)
- Featured placements (time-bound promotion)
- Campaign participation (promotional events)

### Layer 4: Value-Add (Premium)

High-value services that unlock new capabilities.

- AI-powered pricing recommendations
- Automated quality assurance
- Provider loans and insurance (future)
- Training and certification (future)
- Trust data portability API (future)

---

## 5. The Product Hierarchy

Not a navigation tree. A dependency tree. Lower layers must exist for higher layers to function.

```
FOUNDATION
    │
    ▼
NEIGHBORHOOD ──── TRUST
    │                 │
    ▼                 ▼
CONVERSATION ──── DISCOVERY
    │                 │
    ▼                 ▼
    └──── COMMERCE ──┘
            │
            ▼
        KNOWLEDGE
            │
            ▼
    ┌───────┴───────┐
    ▼               ▼
COMMUNITY        GROWTH
    │               │
    └───────┬───────┘
            ▼
      OPERATIONS
```

### Dependency Rules

1. **Foundation** has no dependencies. It is the bedrock.
2. **Neighborhood** depends on Foundation (people need identities to be in a neighborhood).
3. **Trust** depends on Foundation (people need identities to have trust scores).
4. **Conversation** depends on Foundation + Trust (only trusted identities can converse).
5. **Discovery** depends on Neighborhood + Foundation + Trust (discovery is meaningless without geography, identity, and trust signals).
6. **Commerce** depends on Discovery + Conversation + Trust + Foundation (a transaction requires discovery, negotiation, trust, and identity).
7. **Knowledge** depends on Commerce (knowledge comes from transactions; without transactions, there is no data).
8. **Community** depends on Commerce + Trust (community forms around transactions; rating a provider you never hired is meaningless).
9. **Growth** depends on Commerce + Community (subscriptions and promotions require transactional value; referrals require community).
10. **Operations** depends on everything (operations manage the platform; without platform, nothing to operate).

### Architectural Insight

This dependency chain means ServiQ must launch with a **minimum viable set** of domains:

Pre-launch (seed): Foundation + Neighborhood + Trust + Conversation + Discovery + Commerce

Post-launch (activate): + Knowledge + Community + Growth

Scale (optimize): + Operations (full admin) + Business features

Operations (admin basics) must exist from day 1 but grows in complexity with the platform.

---

## 6. Concept Consolidation

### What Dies

| Dead Concept | Domain | Kill Reason | Replacement |
|---|---|---|---|
| Post (as a standalone concept) | Discovery | Overlaps completely with Service and Request | Service (provider side), Request (consumer side) |
| Help Request | Commerce | Same as Request, different name | Request |
| Task | Commerce | Same as Order, different name | Order |
| Job | Commerce | Same as Order, different name | Order |
| Booking | Commerce | Same as Order, different name | Order |
| Deal | Commerce | Same as Quote after acceptance | Quote → Order |
| Offer | Commerce | Same as Quote | Quote |
| Proposal | Commerce | Same as Quote | Quote |
| Listing (as distinct from Service) | Discovery | A listing IS a provider's Service | Service |
| Connection (as a relationship concept) | Community | Too vague; replaced by explicit states | Relationship |
| Launchpad | Growth | Zero usage, AI-generated profiles untrusted | Remove entirely |
| Lead OS | Growth | Zero usage, dead code | Remove entirely |
| Quote Room | Conversation | Same as Chat with structured context | Conversation + Quote |
| Deal Room | Conversation | Same as Chat with order context | Conversation + Order |
| Workspace (for solo providers) | Growth | Premature; only activate when team > 1 | Profile (solo) → Workspace (team) |

### What Lives

| Concept | Domain | Why It Stays |
|---|---|---|
| **User** | Foundation | Every participant is a User with a role |
| **Profile** | Foundation | Identity + reputation + contact |
| **Service** | Discovery | What a provider offers (canonical category + provider-specific) |
| **Request** | Commerce | What a consumer needs (free-form, AI-enriched) |
| **Quote** | Commerce | Provider's response to a Request (price + line items + timeline) |
| **Order** | Commerce | Confirmed transaction (the single source of truth for work) |
| **Review** | Trust | Bidirectional post-transaction feedback |
| **Verification** | Trust | Identity proofing levels (0-3) |
| **Trust Score** | Trust | Composite reputation (0-1000) |
| **Dispute** | Trust | Conflict resolution with financial hold |
| **Chat** | Conversation | Real-time thread scoped to Order or Relationship |
| **Notification** | Conversation | System events across all channels |
| **Relationship** | Community | Explicit state between two Users (follow, block, etc.) |
| **Referral** | Community | User-driven acquisition with rewards |
| **Subscription** | Growth | Provider recurring payment for benefits |
| **Boost** | Growth | One-time paid visibility |
| **Campaign** | Growth | Time-bound promotional event |
| **Promo Code** | Growth | Discount mechanism for demand stimulation |
| **Subscription Plan** | Growth | Tier definition (Free/Plus/Pro) |
| **Product** | Commerce | Physical goods (distinct from Services) |
| **Invoice** | Commerce | GST-compliant transaction record |
| **Payout** | Commerce | Provider settlement |

### The Final Vocabulary

| User sees | System calls | User does not see |
|-----------|-------------|-------------------|
| Find a Service | Discovery.search() | — |
| Tell us what you need | Commerce.createRequest() | Request |
| Get a Quote | Commerce.createQuote() | Quote |
| Confirm & Pay | Commerce.createOrder() | Order |
| Chat | Conversation.sendMessage() | Message |
| Reviews | Trust.createReview() | Review |
| Trust Badge | Trust.computeScore() | Trust Score, Verification Level |
| My Providers | Community.listRelationships() | Relationship |
| Invite a Friend | Community.createReferral() | Referral |
| Upgrade Plan | Growth.subscribe() | Subscription |
| Promote My Business | Growth.purchaseBoost() | Boost |

---

## 7. Domain Capabilities

### Foundation

| Capability | Description | Priority |
|---|---|---|
| Registration | Sign up via phone OTP, email magic link, Google/Apple OAuth | P0 |
| Profile Management | Name, photo, bio, contact info, services (providers) | P0 |
| Role Assignment | Consumer, Provider, Business, Admin (users can hold multiple) | P0 |
| Session Management | Auth tokens, refresh, expiration, device tracking | P0 |
| Profile Completion | Guided setup for new users, progress tracking | P1 |
| Multi-device | Seamless session across phone + web | P0 |
| Account Deletion | GDPR-style data deletion with compliance hold | P1 |
| Role-specific Views | Consumer sees consumer features; provider sees provider tools | P0 |

### Neighborhood

| Capability | Description | Priority |
|---|---|---|
| Locality Hierarchy | City → Zone → Locality → Building | P0 |
| Geo-location | Lat/lng from device, address resolution | P0 |
| Provider Coverage | Each provider defines which localities they serve | P0 |
| Proximity Search | Distance-based provider ranking within consumer's locality | P0 |
| Market Zone Health | Provider density, transaction volume, trust baseline per locality | P1 |
| Locality Activation | Tooling to seed and measure locality health | P1 |
| Travel Pricing | Provider can set different prices for different localities | P2 |
| Neighborhood Intelligence | Aggregate trust score, service demand patterns per locality | P2 |

### Trust

| Capability | Description | Priority |
|---|---|---|
| Verification Levels | L0 (browse), L1 (basic, transaction-ready), L2 (trusted), L3 (premium) | P0 |
| Document Upload & Verify | Selfie, ID proof (Aadhaar, PAN, DL), address proof | P0 |
| Trust Score | Composite 0-1000: verification + reviews + completion + age + disputes | P0 |
| Bidirectional Reviews | Consumer reviews provider, provider reviews consumer | P0 |
| Review Verification | Only transacting parties can review | P0 |
| Dispute Resolution | Create, submit evidence, admin-mediated, 48h SLA | P0 |
| Dispute Financial Hold | Hold payment until dispute resolved | P0 |
| User Blocking | Prevent all interaction between two users | P0 |
| User Reporting | Report inappropriate behavior/content to admin | P0 |
| Review Moderation | Flagged review review with 24h SLA | P1 |
| Buyer Protection Guarantee | "ServiQ Guaranteed" — auto-refund for no-show + credit | P1 |
| Trust Portability | Export verified reviews and trust score as JSON | P2 |
| Neighborhood Trust Score | Aggregate trust for a locality | P2 |
| AI Fraud Detection | Flag suspicious patterns (fake reviews, collusion, payment fraud) | P3 |

### Conversation

| Capability | Description | Priority |
|---|---|---|
| 1:1 Real-time Chat | Supabase Realtime with exponential backoff | P0 |
| Thread Scoping | Chat belongs to Order or Relationship | P0 |
| Text Messages | Send and receive text | P0 |
| Image Attachments | Upload and display images in chat | P0 |
| System Messages | Status changes, payment confirmations injected into chat | P0 |
| Push Notifications | FCM + Web Push for all event types | P0 |
| Notification Preferences | User opts in/out per notification type | P0 |
| Typing Indicators | Show when other party is typing | P0 |
| Read Receipts | Show when message was read | P0 |
| Offline Queuing | Queue messages when offline, send on reconnect | P1 |
| Message History | Paginated history with infinite scroll | P0 |
| Chat List/Inbox | Recent conversations sorted by last message | P0 |
| Quote in Chat | Structured quote card within conversation (replaces Quote Room) | P1 |
| Order Status in Chat | Order progress card within conversation (replaces Deal Room) | P1 |

### Discovery

| Capability | Description | Priority |
|---|---|---|
| Service Catalog | Canonical categories → services → providers | P0 |
| Full-text Search | Keyword search across services, providers, descriptions | P0 |
| AI Natural Language Search | "plumber near sector 62 who can come today" → results | P0 |
| Category Browsing | Grid of service categories → provider list | P0 |
| Provider Cards | Photo, name, service, trust badge, price range, distance | P0 |
| Guest Browsing | Browse catalog, see providers, view pricing without login | P1 |
| Feed/Browse Near You | Geo-ranked provider feed | P0 |
| Map Discovery | Visual provider discovery on map | P2 |
| Saved/Favorite Providers | Bookmark providers for quick access | P1 |
| Quick Re-order | Re-book past provider in 2 taps | P1 |
| Provider Comparison | Side-by-side provider comparison within a category | P2 |
| AI-powered Ranking | Personalized provider order based on history + preferences | P2 |

### Commerce

| Capability | Description | Priority |
|---|---|---|
| Request Creation | Consumer describes need (free text, AI structured) | P0 |
| AI Intent Enrichment | Parse request → category + service + budget + urgency + location | P0 |
| Provider Matching | Route request to relevant providers (geo + service + trust) | P0 |
| Quote Creation | Provider responds with price, line items, timeline | P0 |
| Quote Comparison | Consumer compares multiple quotes | P0 |
| Quote Acceptance | Consumer accepts quote → Order created | P0 |
| Order Workflow | quoted → accepted → confirmed → in_progress → completed → paid → reviewed | P0 |
| Payment Collection | Razorpay: UPI, cards, netbanking, wallet | P0 |
| COD | Cash on delivery option | P0 |
| Payment Hold | Hold funds until completion (basic escrow) | P0 |
| Payment Release | Release to provider on completion | P0 |
| Refund | Full or partial with idempotency guard | P0 |
| Payout | Provider settlement (T+2 cycle, minimum Rs 500) | P0 |
| Commission Deduction | Platform fee deducted at payout | P0 |
| Promo Code Application | Discount at checkout | P1 |
| Invoicing | GST-compliant auto-generated invoice | P1 |
| Quick Re-order API | Reuse last request's attributes to create new order | P1 |
| Product Commerce | Physical goods with separate flow (distinct from services) | P2 |
| Subscription Billing | Recurring subscription payment via Razorpay | P1 |
| Boost Purchase | One-time payment for visibility | P1 |

### Knowledge

| Capability | Description | Priority |
|---|---|---|
| Service Catalog Management | Admin manages canonical categories and services | P0 |
| Market Pricing Data | Aggregate quote data → average prices per service per locality | P1 |
| Provider Analytics | Views, leads, conversion rate, earnings, ratings | P1 |
| Platform Analytics | Transactions, revenue, active users, provider density | P1 |
| Intent Parsing Training Data | Logged queries with corrections for model improvement | P1 |
| Review Insights | Sentiment trends, common praise/complaint themes | P2 |
| Demand Forecasting | Predict service demand by season, locality | P3 |
| Competitive Pricing Intel | Suggest provider pricing based on market data | P3 |
| Neighborhood Health Dashboard | Provider density, txn volume, trust baseline per locality | P2 |

### Community

| Capability | Description | Priority |
|---|---|---|
| User Relationships | Explicit state: following, blocked, none | P1 |
| Consumer Referral | Refer a consumer, both get credit on first order | P1 |
| Provider Referral | Refer a provider, get reward after 5 orders | P2 |
| Referral Dashboard | Track invites, conversions, rewards | P1 |
| Referral Leaderboard | Top referrers ranked | P2 |
| Before/After Sharing | Shareable card from completed order | P2 |
| Neighborhood Activity Feed | "5 people used ServiQ today in your area" | P2 |
| Review Responses | Provider can respond to a review (once) | P1 |
| Trust Badge Display | Verification badges, review count, trust score visible everywhere | P0 |
| Top Reviewer Badges | Badges for users who contribute many reviews | P2 |

### Growth

| Capability | Description | Priority |
|---|---|---|
| Subscription Plans | Free / Plus (Rs 199) / Pro (Rs 499) tiers | P1 |
| Subscription Management | Upgrade, downgrade, cancel, billing history | P1 |
| Priority Matching | Plus/Pro providers ranked higher in matching | P1 |
| Commission Rate Override | Lower commission for paid subscribers | P1 |
| Boost Purchases | Pay for visibility in search/feed | P1 |
| Campaign Management (Admin) | Create, target, launch promotional campaigns | P2 |
| Campaign Analytics | Redemption rate, incremental transactions, ROI | P2 |
| Seasonal Campaign Playbook | Templates: Diwali, monsoon, summer, winter | P2 |
| Promo Code Management | Create, set limits, track usage | P1 |
| Re-engagement Campaigns | Win-back dormant users via notifications | P2 |
| Loyalty Program | Tiered rewards for repeat consumers (future) | P3 |
| Provider Reactivation | Campaigns for churned providers | P2 |

### AI (Cross-cutting Operating System)

AI does not own features. AI infuses every other domain with intelligence.

| AI Capability | Domain Served | Description | Priority |
|---|---|---|---|
| Intent Parsing | Discovery | Natural language → structured request (service, location, budget, urgency) | P0 |
| Provider Matching | Discovery | Score and rank providers by fit (service, geo, trust, history, subscription) | P0 |
| Quote Drafting | Commerce | Generate quote line items from request + provider catalog | P1 |
| Content Moderation | Trust | Detect profanity, spam, PII, phone numbers in all user-generated content | P0 |
| Feed Ranking | Discovery | Personalize provider ordering in browse/feed | P2 |
| Review Quality Analysis | Trust | Flag fake reviews, detect fraud patterns | P2 |
| Dispute Triage | Trust | Categorize disputes, suggest resolution | P2 |
| Pricing Suggestions | Commerce | Recommend competitive pricing per service per locality | P3 |
| Demand Forecasting | Knowledge | Predict service demand patterns | P3 |
| Fraud Detection | Trust | Flag suspicious booking, payment, review patterns | P3 |
| Provider Onboarding Assistant | Growth | Guide provider through setup (chat-based wizard) | P3 |
| Voice Interface | Discovery | Speak need in Hindi/Hinglish → matched | P3 |

### Operations

| Capability | Description | Priority |
|---|---|---|
| User Management | List, search, suspend, ban users | P0 |
| Provider Verification Approval | Review and approve KYC documents | P0 |
| Order Oversight | View all orders, intervene if needed | P0 |
| Dispute Resolution Console | Review evidence, resolve disputes | P0 |
| Payout Management | Approve holds, process manual payouts | P0 |
| Feature Flag Management | Toggle features on/off without deploy | P1 |
| Content Moderation Console | Review flagged content | P1 |
| Platform Analytics Dashboard | Key metrics at a glance | P1 |
| Rate Limit Configuration | Adjust rate limits per endpoint | P1 |
| Promo Code Management | Create and manage promo codes | P1 |
| Campaign Creation UI | Build promotional campaigns | P2 |
| Background Job Monitoring | View job queue, retry failed jobs | P1 |
| Admin Audit Log | Track all admin actions | P2 |
| Migration Tools | Database migration and rollback | P0 |

---

## 8. Ecosystems

### Trust Ecosystem

```
                ┌───────────────────────────┐
                │  Identity Verification    │
                │  (L0 → L1 → L2 → L3)     │
                └───────────┬───────────────┘
                            │
┌───────────────────────────────────────────────┐
│              Trust Score (0-1000)              │
│  verification  │  reviews  │  completion       │
│  disputes (-)  │  age  │  response           │
└───────────────────────────────────────────────┘
        │                                     │
        ▼                                     ▼
┌────────────────────┐          ┌────────────────────────┐
│  Bidirectional     │          │  Safety Layer          │
│  Reviews           │          │  Block / Report /       │
│  Verified only     │          │  Moderate / Suspend     │
└────────────────────┘          └────────────────────────┘
        │                                     │
        ▼                                     ▼
┌────────────────────┐          ┌────────────────────────┐
│  Dispute           │          │  Buyer Protection      │
│  Resolution        │          │  Guarantee (future)     │
│  48h SLA           │          │  Insurance (future)     │
└────────────────────┘          └────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────┐
│              Trust Portability                       │
│  Exportable reviews and scores (JSON/API)           │
│  Provider-owned reputation                           │
└────────────────────────────────────────────────────┘
```

### AI Ecosystem

```
                    ┌─────────────────────────────┐
                    │   AI Operating Layer         │
                    │   (infuses all domains)      │
                    └───────────┬─────────────────┘
                                │
    ┌───────────────┬───────────┼───────────┬───────────────┐
    ▼               ▼           ▼           ▼               ▼
┌─────────┐  ┌───────────┐ ┌───────┐ ┌──────────┐  ┌──────────────┐
│ Intent  │  │ Matching  │ │Quote  │ │Content   │  │  Feed        │
│ Parsing │  │ & Ranking │ │Draft  │ │Moderation│  │  Ranking     │
├─────────┤  ├───────────┤ ├───────┤ ├──────────┤  ├──────────────┤
│Gemini   │  │7 criteria │ │LLM +  │ │Regex +   │  │Personalized  │
│+ keyword│  │scoring    │ │catalog│ │LLM       │  │+ history     │
└─────────┘  └───────────┘ └───────┘ └──────────┘  └──────────────┘
                                │
    ┌───────────────┬───────────┴───────────┬───────────────┐
    ▼               ▼                       ▼               ▼
┌──────────┐  ┌──────────────┐  ┌────────────────┐  ┌────────────┐
│Pricing   │  │ Fraud        │  │ Dispute         │  │ Voice      │
│Suggest   │  │ Detection    │  │ Triage          │  │ Interface  │
├──────────┤  ├──────────────┤  ├────────────────┤  ├────────────┤
│Market    │  │Suspicious    │  │Categorize +     │  │Speech→Text │
│data based│  │patterns      │  │suggest resolve  │  │Hindi/Eng   │
└──────────┘  └──────────────┘  └────────────────┘  └────────────┘
```

### Commerce Ecosystem

```
                   ┌──────────────────────────┐
                   │      SERVICE              │
                   │  What provider offers     │
                   └───────────┬──────────────┘
                               │
                     ┌─────────▼─────────┐
                     │     REQUEST        │
                     │  Consumer needs    │
                     └─────────┬─────────┘
                               │
                    ┌──────────▼──────────┐
                    │      MATCHING       │
                    │  Request → Provider │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │       QUOTE         │
                    │  Provider pricing   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │       ORDER         │
                    │  Confirmed work     │
                    └──────────┬──────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌──────────────┐  ┌──────────────┐  ┌────────────────┐
    │   PAYMENT     │  │   REVIEW     │  │    PAYOUT      │
    │  Collect →    │  │  Consumer →  │  │  Provider      │
    │  Hold →       │  │  Provider →  │  │  settlement    │
    │  Release      │  │  Consumer   │  │  T+2 cycle     │
    └──────────────┘  └──────────────┘  └────────────────┘
```

---

## 9. Scale Architecture

### The Neighborhood Unit

No matter how large ServiQ grows, the atomic unit is always **one neighborhood**.

A neighborhood is defined by:
- **Geographic boundary** (locality, sector, village)
- **Provider density** (minimum 20 active providers)
- **Trust baseline** (average trust score, verification rate)
- **Transaction volume** (minimum 100/month for health)
- **Service mix** (which categories have sufficient supply)

### Scale Dimensions

| Scale | Neighborhoods | What Changes | What Stays The Same |
|-------|---------------|-------------|---------------------|
| Pilot | 3-5 | Manual onboarding, high-touch ops | Core domain model |
| City | 50-100 | Automated onboarding, regional ops | Matching algorithm |
| Metro | 200-500 | City-specific config, local teams | Trust model |
| Region | 500-2000 | Regional managers, localized campaigns | Domain hierarchy |
| Nation | 2000-10000 | State-level compliance, language adaptation | Neighborhood unit |
| Global | 10000+ | Country-specific regulations, multi-currency | Trust portability |

### Scaling Rules

1. **Neighborhoods are independent markets.** Each locality has its own trust baseline, pricing dynamics, and service mix. A provider in Sector 62 does not serve Connaught Place. The platform is a federation of micro-markets.

2. **Trust is cumulative but local.** A provider moving from Noida to Gurgaon carries their trust score. But they must establish coverage in the new locality. Trust is portable; neighborhood presence is not.

3. **Matching is always local first.** The algorithm always prefers providers in the consumer's locality. Radius expansion is a fallback, not a default.

4. **Growth is neighborhood-by-neighborhood.** You cannot "launch Delhi." You launch Sector 62, then Sector 44, then Indirapuram, then Crossings Republik. Each neighborhood must pass health metrics before the next opens.

5. **Knowledge is aggregate across neighborhoods.** Pricing data, demand patterns, and trust baselines are computed per neighborhood AND aggregated for city/regional insights.

6. **Operations is centralized, then distributed.** Day 1: centralized ops manages all neighborhoods. Day 1000: each city has its own ops team with centralized tooling.

---

## 10. Architecture Rules

### Rule 1: Three Transactions, Always

Every feature, endpoint, screen, and notification must serve one of:
- Discovery (need finds provider)
- Commerce (work gets priced, booked, paid, completed)
- Trust (reputation updates and compounds)

Features that serve none of these are infrastructure (keep minimal) or premature (remove).

### Rule 2: One Noun, One Meaning

The system must use exactly one term for each concept. The canonical vocabulary is:

| Concept | Term | Never Call It |
|---------|------|---------------|
| Consumer need | Request | Task, Job, Help Request, Post, Booking |
| Provider pricing | Quote | Offer, Proposal, Deal |
| Confirmed transaction | Order | Booking, Job, Task |
| Provider offering | Service | Listing, Post, Product (use Product for goods) |
| User state with another user | Relationship | Connection, Follow, Friend |
| User identity with attributes | Profile | Account (reserved for billing) |

### Rule 3: Every Domain Has One Owner

No two teams own the same domain. No domain is split across teams.

If a feature touches multiple domains, the **originating domain** owns it. For example:
- Chat belongs to Conversation (even though it's used for Commerce negotiation)
- Trust Score belongs to Trust (even though it's displayed in Discovery)
- Provider Matching belongs to Discovery (even though it feeds Commerce)

### Rule 4: AI Is Infrastructure, Not A Feature

AI must never appear as a separate tab, button, or mode. AI is the intelligence behind:
- Search results (ranking)
- Request creation (auto-fill from natural language)
- Quote drafting (line items from catalog)
- Moderation (content safety)
- Match quality (scoring)

If a user can "turn off AI" or "use AI mode," the architecture has failed. AI is the default, invisible, always-on operating layer.

### Rule 5: The Platform Works Without AI

Every AI capability has a non-AI fallback:
- Intent parsing → keyword matching + structured form
- Provider matching → geo + category filter
- Quote drafting → template with provider catalog
- Content moderation → basic regex checks
- Feed ranking → recency + distance sort

AI enhances. It never gates.

### Rule 6: No Premature Scaling

If a feature requires more than 100 completed orders to be useful, it must not be built until order 101.

Examples of premature features: Workspaces, Campaign Analytics, Provider Loans, Dynamic Pricing, B2B Services, Enterprise Team Management, Insurance Products.

### Rule 7: Platform Over Product

The same backend serves consumers, providers, businesses, and admins. Roles change what is visible. The data model does not change. Building four separate platforms would:
- Duplicate domain logic
- Fragment trust data
- Multiply maintenance burden
- Create integration surface area

### Rule 8: Neighborhood Is The Default Filter

Every query that involves providers must default to the consumer's neighborhood. Radius expansion requires explicit user action or algorithmic fallback (when insufficient results in current neighborhood).

This ensures density. Density creates liquidity. Liquidity creates defensibility.

### Rule 9: Trust Is Visible At Every Decision Point

A provider's trust signals (verification badge, trust score, review count, completion rate, response time) must be visible on:
- Search result cards
- Quote comparison view
- Chat header
- Order confirmation
- Provider profile

If trust is hidden, it does not exist. Trust is the product. Show it everywhere.

### Rule 10: Conversation Is The Transaction Interface

Chat is not a feature. Chat is how transactions happen. Every Request, Quote, and Order has a conversation thread. System messages (status changes, payments) are injected into chat. Quote cards and order status cards render inline.

This consolidates Quote Room, Deal Room, and Chat into a single surface.

---

## Appendix: Placement Test

If a new feature cannot be placed into exactly one domain, the architecture is incomplete.

### Test 1: "Provider Training Videos"

Where does it go? **Growth** (provider value-add). If Growth disagrees, create a new domain or prove the placement is incorrect.

### Test 2: "Neighborhood WhatsApp Groups"

Where does it go? **Community** (neighborhood social features). Conversation handles 1:1 chat; Community handles group dynamics.

### Test 3: "AI Photo Recognition for Service Requests"

Where does it go? **AI** (cross-cutting) consuming **Discovery** (user uploads photo → AI identifies service → match provider). The originating domain is Discovery.

### Test 4: "Provider Performance Scorecard"

Where does it go? **Knowledge** (analytics) owned by the provider, displayed in **Trust** (as a trust signal). Knowledge owns the computation; Trust owns the display. The originating domain is Knowledge.

### Test 5: "Consumer Cashback Rewards"

Where does it go? **Growth** (loyalty program). This is a retention mechanism under Growth's domain.

---

*End of Product Architecture. This is the scaffolding. Every future feature should fit into one domain. If it doesn't, update the architecture — not the feature list.*
