# ServiQ Product Bible

> Product decisions reference. Every future prompt checks against this.
> Source: `SERVIQ_COMPLETE_AUDIT.md` (July 30, 2026 audit).
> Status: Pre-launch. Zero transactions. Zero active providers. Zero revenue.

---

## 1. Vision

ServiQ is the online version of the physical neighborhood — not another marketplace. The existential problem is zero trust from zero transactions, not a UI problem. People don't need more features; they need to know "will this person show up, do good work, and not overcharge me?" The product's job is to make that answer obvious. Every decision either builds trust or gets cut.

---

## 2. Mental Model

**Current (doesn't work):**
```
Category → Business → Listing → Booking
```

**Target (what we're building toward):**
```
Intent → AI Understanding → Match (people/businesses/products/services) → Fulfillment → Trust → repeat
```

The old model assumes users know categories. The new model assumes users know what they need. AI maps between them.

---

## 3. Information Architecture

### Core entities

```
Neighborhood (city/zone/locality)
├── People (residents, providers, neighbors — one concept)
├── Work Items (all paid work: orders, tasks, needs, help requests)
├── Offerings (services, products, listings — provider catalog)
├── Proposals (quotes, deal room, comparison — pre-work agreements)
├── Discovery (market, search, feed, map, explore — find anything)
├── Activity (notifications, alerts, inbox — what happened)
├── You (profile, settings, account — the user)
└── Trust (verification, reviews, reputation, badges)
```

### Canonical naming (use these going forward, not the old names)

| Old (scattered) | Canonical |
|---|---|
| Orders, Tasks, Help Requests, Needs | **Work Items** |
| Quotes, Deal Room, Comparison | **Proposals** |
| Services, Products, Listings | **Offerings** |
| Market, Search, Map, Feed, Explore | **Discovery** |
| People, Connections, Providers | **Neighborhood** |
| Notifications, Alerts, Inbox | **Activity** |
| Profile, Settings, Account, Workspaces | **You** |
| Boosts, Campaigns, Subscriptions | **Growth** |

---

## 4. Navigation

### Current (4-tab bottom nav):
```
Home (Welcome/Feed) | Market (Zones) | Work (Tasks) | Inbox (Chat)
```
40+ routes with no hierarchy. Users are 1-2 taps from anything but can't find the right thing.

### Target (AI-first, 3 modes):

**Default: Need Something** (all authenticated users land here)
```
[AI input bar] — "What do you need?"
Results show: People | Offerings | Providers
Actions: Chat | Book | Buy
```

**Provider mode** (activated when user has provider role)
```
Dashboard: My Offerings | My Customers | My Earnings | My Trust
```

**Explore mode** (discovery, always accessible)
```
Nearby | Feed | Map | Activity
```

Key changes: AI is the default landing for authenticated users. No Home/Market/Work/Inbox tabs. ~12 core experiences instead of 40+ routes. Every screen answers "What can I do here?" and "Where do I go next?"

---

## 5. Feature Classification

This table unblocks Track A. Every build-or-remove decision checks here first.

### 40 Flutter feature modules

| # | Module | Class | Rationale |
|---|--------|-------|-----------|
| 1 | admin | **Candidate for removal** | No RLS by admin role, security risk, no data to admin |
| 2 | ai_prompt | **Core for MVP** | AI-first interface — this is the default entry point |
| 3 | analytics | **Hidden** | Keep behind flag; useful when real data exists, no-fill now |
| 4 | auth | **Core for MVP** | Foundation — Email OTP, magic link, Google/Apple OAuth |
| 5 | availability | **Core for MVP** | Providers must set availability; needed for trust |
| 6 | blocking | **Hidden** | Over-engineered for MVP but harmless; keep behind flag |
| 7 | bookings | **Consolidate → Work Items** | Don't build separately; merge concept into Work Items |
| 8 | cart | **Core for MVP** | Needed for checkout flow |
| 9 | chat | **Core for MVP** | Best feature, best-in-app, high discoverability needed |
| 10 | connections | **Experimental** | Unclear value prop but potential for neighborhood concept |
| 11 | control | **Hidden** | God page needs restructuring but functionality is useful |
| 12 | disputes | **Candidate for removal** | Zero transactions = zero disputes. Revisit post-launch. |
| 13 | feed | **Core for MVP** | Makes the app feel alive; primary discovery surface |
| 14 | invoices | **Candidate for removal** | Zero transactions = zero invoices. Simple receipt suffices. |
| 15 | listings | **Core for MVP** | Provider catalog / Offerings |
| 16 | marketplace | **Consolidate → Discovery** | Don't build separately; merge into Discovery |
| 17 | notifications | **Core for MVP** | Realtime push + in-app, grouped, filterable |
| 18 | onboarding | **Core for MVP** | Unified seeker + provider, single flow |
| 19 | orders | **Consolidate → Work Items** | Merge with tasks, help requests |
| 20 | payments | **Core for MVP** | Razorpay + COD — critical path |
| 21 | payouts | **Hidden** | Keep behind flag; activate when first transactions complete |
| 22 | people | **Experimental** | Overlaps with search; keep iterating for Neighborhood concept |
| 23 | post_create | **Consolidate → Work Items** | Create Need / Help Request merges into Work Items |
| 24 | profile | **Core for MVP** | Role-based, needs simplification |
| 25 | promotions | **Candidate for removal** | Premature; no audience to promote to |
| 26 | provider | **Core for MVP** | Provider tools — 11 scattered files need consolidation |
| 27 | public_profile | **Core for MVP** | Provider business pages, trust signals |
| 28 | quotes | **Consolidate → Proposals** | Merge with deal room, comparison |
| 29 | referrals | **Candidate for removal** | Premature without active users; revisit post-launch |
| 30 | reporting | **Candidate for removal** | Premature; no data to report on |
| 31 | reviews | **Core for MVP** | Trust signals — dual-sided (provider + seeker) |
| 32 | saved | **Hidden** | Thin but useful; keep behind flag |
| 33 | search | **Core for MVP** | Primary fallback when AI can't parse intent |
| 34 | settings | **Core for MVP** | Clean, needed |
| 35 | subscriptions | **Hidden** | Monetization feature; keep behind flag until demand validated |
| 36 | task_post | **Consolidate → Work Items** | Overlaps with post_create; merge |
| 37 | tasks | **Consolidate → Work Items** | Overlaps with orders; merge |
| 38 | verification | **Core for MVP** | KYC, verified badges — critical for trust |
| 39 | welcome | **Hidden** | Replace with AI-first landing; keep Welcome accessible but not default |
| 40 | workspaces | **Hidden** | Multi-location/team concept useful later; keep behind flag |

### 58 web API endpoint groups

| Category | Class | Rationale |
|----------|-------|-----------|
| Auth (4) | **Core** | Foundation |
| Orders (7) | **Core** | Consolidate into Work Items |
| Payment (3) | **Core** | Critical path |
| Quotes (8) | **Core** | Consolidate into Proposals |
| Profile (4) | **Core** | You concept |
| Provider (10) | **Core** | Provider tools |
| Upload (4) | **Core** | Photos, verification docs |
| Admin (11) | **Candidate for removal** | Security risk, no data |
| Cron (9) | **Hidden** | Keep behind flag; useful for maintenance jobs |
| Chat (2) | **Core** | Best feature |
| Notifications (3) | **Core** | Activity concept |
| AI (4) | **Core** | AI-first interface |
| Community (3) | **Experimental** | Neighborhood concept; pre-launch |
| Market (3) | **Hidden** | Consolidate into Discovery |
| Launchpad (3) | **Hidden** | AI profile generation; useful but not critical path |
| Reviews (3) | **Core** | Trust signals |
| Subscriptions (5) | **Hidden** | Monetization; keep behind flag |
| Invoices (3) | **Candidate for removal** | Premature; simple receipt is enough |
| Workspaces (8) | **Hidden** | Keep behind flag |
| Verification (4) | **Core** | Trust signals |
| Connections (2) | **Experimental** | Neighborhood concept |
| Referrals (4) | **Candidate for removal** | Premature |
| Webhooks (1) | **Hidden** | Keep for integration potential |
| Other (20+) | **Hidden** | Audit individually; most are zero-usage support endpoints |

### Consolidation actions (Track A)

These are not removals — they are merges into canonical concepts:

| Current modules | Merge into | Owner |
|---|---|---|
| orders + tasks + task_post + post_create + bookings | **Work Items** | Backend + Flutter |
| quotes + marketplace guidance | **Proposals** | Backend + Flutter |
| market + search + feed + map | **Discovery** | Backend + Flutter |

---

## 6. Trust Framework

Six concrete mechanisms. Checklist, not strategy doc.

1. **Verified badges** — Phone-verified, ID-verified, email-verified. Display on every provider card and profile.
2. **Response time display** — Track and show "Responds in X minutes" on provider profiles. Drives accountability.
3. **Photo-of-work galleries** — Completed jobs include photo evidence. Gallery on provider profile shows past work quality.
4. **Micro-task wedge** — Surface ₹50-₹500 small jobs first. Low-risk transactions build trust for larger ones. These happen daily in every neighborhood.
5. **AI-scored matches with reasoning** — Show "Why this provider?" with transparent scoring (distance, response time, completion rate, review score). Users trust AI more when they see the reasoning.
6. **Escrow payments** — Razorpay-powered escrow with clear refund policy. Branding visible at every payment step.

---

## 7. What's Not in Scope

This document does NOT cover:

- **AI architecture redesign** — AI consolidation (single entry point, prompt management, streaming, feedback loops) is its own track.
- **Flutter/Web/Backend architecture redesign** — Architecture decisions (monolith splitting, migration planning, server/client component strategy) are separate work items.
- **Design system v2** — Flutter design system is mature. Web design system needs building. Each gets scoped when a track actually needs it, not preemptively.
- **Migration planning** — Moving from zero-usage to real usage (data seeding, locality onboarding, marketing) is a go-to-market track, not a product spec track.

These get individual scope documents, written only when a track needs them.
