# UX Audit: ServiQ Hyperlocal Marketplace

**Date:** 2026-07-31
**Version:** 1.0
**Audience:** Product, Design, Engineering
**Platforms:** Web (Next.js) + Mobile (Flutter)

---

## 1. Executive Summary

ServiQ is a pre-launch hyperlocal marketplace with zero transactions, zero revenue, and zero active providers. The product is feature-rich — both web (Next.js) and mobile (Flutter) clients share a Supabase backend — but the UX surface reveals fundamental problems typical of pre-product-market-fit platforms: overbuilding, concept proliferation, platform inconsistency, and zero validation of core flows.

**Three critical findings:**

1. **Concept overload buries the core value prop.** Users encounter 10+ overlapping terms (posts, listings, services, products, needs, help requests, tasks, quotes, deals, boosts) before completing their first transaction. The mental model is fragmented.

2. **Platform inconsistency erodes trust.** Flutter has a polished design system (tokens, radii, spacing, AppTextField, ServiqScaffold). Web uses CSS variables with different values. Users switching between web and mobile experience two different products.

3. **All growth systems are built but untested.** Referral, campaign, promo code, subscription, boost, and featured placement systems exist with zero real usage. The product is feature-complete but usage-empty.

The product needs radical simplification, platform alignment, and a ruthless focus on the single consumer→provider transaction loop before layering additional complexity.

---

## 2. User Personas

### 2.1 Consumer (Seeker)

| Attribute | Detail |
|---|---|
| Name | Priya Sharma |
| Age | 28 |
| Occupation | Software engineer, Noida Sector 62 |
| Tech comfort | High, smartphone-first |
| Pain point | Needs plumber/electrician but hates Urban Company prices (Rs 499 min) |
| Goal | Find a verified person to fix a leaky tap for Rs 150-200 |
| Fears | Being overcharged, no-show, poor quality work |
| Device | Mobile primary, web for browsing |

### 2.2 Provider

| Attribute | Detail |
|---|---|
| Name | Rajesh Kumar |
| Age | 34 |
| Occupation | Electrician, Crossings Republik |
| Tech comfort | Moderate, WhatsApp-native |
| Pain point | Wants more leads without paying UC commission |
| Goal | Get paying customers, build online reputation |
| Fears | Wasting time on non-serious leads, payment delays |
| Device | Mobile only (budget Android) |

### 2.3 Business (Workspace Owner)

| Attribute | Detail |
|---|---|
| Name | Amit Verma |
| Age | 40 |
| Occupation | Small AC repair business owner, 5 employees |
| Tech comfort | Low-moderate |
| Pain point | Managing leads across 5 technicians manually |
| Goal | Assign jobs to staff, track completion |
| Fears | Complexity, staff not using app |
| Device | Mobile primary |

### 2.4 Admin

| Attribute | Detail |
|---|---|
| Name | Platform Team |
| Age | — |
| Occupation | Internal operator |
| Tech comfort | High |
| Goal | Manage users, disputes, payouts, feature flags |
| Fears | Fraud, failed transactions, escalations |

### 2.5 Moderator

| Attribute | Detail |
|---|---|
| Name | Content/Trust Team |
| Age | — |
| Occupation | Internal operator |
| Tech comfort | Moderate |
| Goal | Review listings, verify providers, moderate disputes |

### 2.6 Guest

| Attribute | Detail |
|---|---|
| Name | Anonymous User |
| Age | Any |
| Occupation | Any |
| Tech comfort | Any |
| Goal | Browse before committing to sign-up |
| Current experience | Landing page only — cannot browse providers, see prices, or search |

---

## 3. User Journey Maps

### 3.1 Consumer Journey

```
Discovery → Landing → Browse Categories → [SIGN UP WALL]
→ Post Need → Provider Matching → Browse Quotes → Chat
→ Accept Quote → Payment → Service Delivery → Review

PAIN POINTS PER STAGE:
1. Landing: Beautiful but shows no actual providers or prices
2. Sign up: Required before seeing anything useful
3. Post Need: "Need" terminology unclear — is this a post? a task? a listing?
4. Matching: No visibility into matching algorithm timeline
5. Quotes: Quote Room concept confusing — is this a chat? a marketplace?
6. Payment: No saved payment methods, multi-step flow
7. Service: No in-progress tracking
8. Review: No quick re-order path
```

### 3.2 Provider Journey

```
Discovery → Sign Up → [DUAL ONBOARDING PATHS]
→ AI Launchpad OR Manual Profile → Create Listings
→ Receive Leads → Quote → Chat → Accept → Deliver → Payout

PAIN POINTS PER STAGE:
1. Sign up: Two onboarding paths (AI Launchpad vs manual) — which to choose?
2. Profile generation: AI-generated vs manual — quality variance
3. Listings: Posts vs listings vs services — terminology confusion
4. Leads: No lead scoring, no response time expectations
5. Quotes: Deal Room terminology confusing
6. Delivery: No check-in/check-out flow
7. Payout: No visibility into payout schedule initially
```

### 3.3 Business Journey

```
Sign Up → Create Workspace → Invite Members → Setup Branches
→ Configure Lead Rules → Team receives leads → Assign → Complete

PAIN POINTS:
1. Over-engineered for small teams (most providers are solo)
2. Branch setup assumes multi-location business
3. Lead assignment rules confuse non-technical users
4. Workspace concept overlaps with provider profile
```

---

## 4. Screen-by-Screen Evaluation

### 4.1 Web: Landing Page

| Element | Status | Issue |
|---|---|---|
| Hero section | ✅ Present | No social proof (0 providers shown) |
| Category grid | ✅ Present | No provider counts per category |
| How it works | ✅ Present | Generic, no real examples |
| CTA | ✅ Present | Leads to sign-up immediately |
| Provider listings | ❌ Missing | Guests cannot see any provider |
| Pricing info | ❌ Missing | No price transparency |
| Reviews/testimonials | ❌ Missing | Zero reviews to display |

### 4.2 Web: Dashboard (25+ sections)

Overwhelming for new users. After logging in, a consumer sees a dashboard with: profile, posts, needs, tasks, orders, connections, chat, notifications, subscriptions, referrals, disputes, settings, help center, and more. The information density rivals enterprise SaaS, not a consumer marketplace.

### 4.3 Mobile: Bottom Tab Navigation

| Tab | Content | Issue |
|---|---|---|
| Feed | AI-powered feed | Empty state — no content |
| People | Provider discovery | No providers to show |
| Tasks | Task listings | No tasks |
| Chat | Message center | No conversations |
| Profile | User profile | Setup incomplete |

All tabs show empty states. The feed tab — positioned as primary — has zero personalized content pre-launch.

### 4.4 Mobile: Onboarding

- Seeker onboarding: Multi-step flow, polished but unnecessary length
- Provider onboarding: AI Launchpad vs manual — duplicate paths add confusion
- Guest experience: App store listing suggests functionality that requires sign-up

---

## 5. Navigation Analysis

### 5.1 Web Navigation

```
┌─────────────────────────────────────────────────┐
│ LANDING ──→ SIGN IN/UP ──→ DASHBOARD           │
│                              ├─ Posts           │
│                              ├─ Listings        │
│                              ├─ Services        │
│                              ├─ Products        │
│                              ├─ Needs           │
│                              ├─ Tasks           │
│                              ├─ Orders          │
│                              ├─ Connections     │
│                              ├─ Chat            │
│                              ├─ Notifications   │
│                              ├─ Quotes          │
│                              ├─ Deals           │
│                              ├─ Reviews         │
│                              ├─ Wallet/Payouts  │
│                              ├─ Subscriptions    │
│                              ├─ Referrals       │
│                              ├─ Disputes        │
│                              ├─ Settings        │
│                              ├─ Help Center     │
│                              ├─ Admin (if role) │
│                              └─ More...         │
└─────────────────────────────────────────────────┘
```

**Depth:** 3 levels max
**Width:** 25+ sections — violates Miller's Law (7±2)
**Problem:** No progressive disclosure. New users face the same complexity as power users.

### 5.2 Mobile Navigation

```
┌─────────────────────────────────┐
│ Bottom Tabs (5)                 │
│ Feed │ People │ Tasks │ Chat │ Profile │
├─────────────────────────────────┤
│ Each tab has nested routes      │
│ Feed → Categories → Detail      │
│ People → Profile → Chat         │
│ Tasks → Detail → Quote → Order  │
└─────────────────────────────────┘
```

**Depth:** 4-5 levels
**Width:** 5 tabs (appropriate)
**Problem:** Tab names are generic. "Tasks" could be tasks I need done or tasks I offer. "People" is vague.

### 5.3 Key Finding

Web navigation is 5x wider than mobile navigation. A user who signs up on web and switches to mobile will search for familiar section names and fail to find them.

---

## 6. Onboarding Analysis

### 6.1 Guest → Consumer

| Step | UX | Issue |
|---|---|---|
| Land on homepage | ✅ Clean | No value before sign-up |
| Browse categories | ✅ Works | No provider count or price indication |
| Click "Get Started" | ✅ Clear | — |
| Sign up (email/phone) | ✅ Standard | OTP flow works |
| Onboarding questions | ❌ Present | Multi-step form asks preferences with no data to personalize |
| Dashboard | ❌ Empty | Zero content, user must post a need to see anything useful |

**Verdict:** The onboarding asks too much before delivering value. The user must post a need before seeing any providers, prices, or available services.

### 6.2 Provider Onboarding

| Path | Steps | Issue |
|---|---|---|
| AI Launchpad | AI-generated profile, listing suggestions | Users don't trust AI-generated content for their business |
| Manual | Step-by-step profile builder | Duplicate effort — why two paths? |

**Verdict:** Two onboarding paths for the same destination creates choice paralysis. The AI Launchpad is unused because it generates generic profiles that providers don't trust.

---

## 7. Trust & Safety UX

### 7.1 Current Trust Signals

| Signal | Visible? | Prominent? |
|---|---|---|
| Verification badge | ✅ Yes | ❌ Small icon, easy to miss |
| Review scores | ✅ Yes | ❌ Hidden behind profile view |
| Trust score | ✅ Computed | ❌ Not shown on listing cards |
| Provider response time | ❌ Not shown | — |
| Order completion rate | ❌ Not shown | — |
| Identity verification | ✅ Yes | ❌ No visual indicator of verification level |
| Insurance/bonding | ❌ Not implemented | — |

### 7.2 Trust Funnel

```
Discovery: No trust signals visible (no provider shown)
Profile: Trust score, reviews visible but below fold
Chat: No trust indicators in chat header
Quote: Provider badge shown but small
Payment: No buyer protection messaging
Post-service: Review prompt — too late to build pre-purchase trust
```

**Verdict:** Trust signals exist but are not surfaced at decision points. A consumer choosing between two quotes sees no trust comparison.

---

## 8. Confusion Points

| # | Point | Impact |
|---|---|---|
| 1 | Posts vs Listings vs Services vs Products | High — which do I create to offer my work? |
| 2 | Needs vs Tasks vs Help Requests | High — which do I create to get help? |
| 3 | Quote Room vs Deal Room | High — both involve provider conversations |
| 4 | AI Launchpad vs Manual Provider Setup | Medium — two paths to same goal |
| 5 | Connections (must connect before chatting) | High — adds friction to transaction flow |
| 6 | Workspace vs Profile for providers | Medium — solo providers don't need both |
| 7 | Boosts vs Featured Placements | Medium — paid visibility vs promoted listings |
| 8 | Feed tab shows nothing pre-launch | High — wasted prime screen real estate |

---

## 9. Dead Ends

| # | Dead End | Detail |
|---|---|---|
| 1 | Guest browsing ends at landing page | Cannot see providers, prices, or search results |
| 2 | Empty dashboard after sign-up | No content, no recommendations, must post first |
| 3 | Feed tab with no personalization | Algorithm needs usage data to work |
| 4 | "People" tab with no providers | Filter returns empty state for all categories |
| 5 | Provider sign-up with no leads | Signed up but no consumers exist to send leads |
| 6 | AI Launchpad generates untrusted profiles | Provider edits the generated profile — why not start blank? |
| 7 | Referral program with nobody to refer | Viral loop requires active users |
| 8 | Subscriptions with zero benefit | What does a subscription unlock if platform is empty? |

---

## 10. Extra Clicks Analysis

### Transaction Flow: Consumer posts need → Provider delivers

Current flow:
```
Post Need → Wait → Receive Quotes → Open Quote Room
→ Chat with Provider → Accept Quote → Enter Payment Details
→ Confirm → Provider Arrives → Service → Rate → Review
```

**Total steps:** 11+
**Minimum possible:** 4 (Search → Select → Pay → Done)

**Friction points:**
- "Connections" requirement: must connect before chatting (3 extra clicks)
- Quote Room: separate screen from chat (2 extra clicks)
- Payment: no saved methods (3-4 extra clicks for first payment)
- Post-then-match vs search-then-book: the current flow adds 5+ steps compared to browse-then-book

**Recommendation:** Eliminate the connection requirement for transaction contexts. Allow direct provider contact when a need is posted.

---

## 11. Concept Overlap Analysis (Terminology Audit)

### User-Facing Terms

| Term | Count in UI | Definition | Overlap |
|---|---|---|---|
| Post | High | A request/offer with description | Overlaps with listing, need, task |
| Listing | High | Provider's service offering | Overlaps with post, service |
| Service | High | A category of work | Overlaps with listing |
| Product | Medium | Physical goods | Distinct (keep) |
| Need | Medium | Consumer's request | Overlaps with task, help request |
| Help Request | Low | Consumer asking for help | Overlaps with need, task |
| Task | High | A unit of work | Overlaps with need, service |
| Quote | High | Provider's price offer | Distinct (keep) |
| Deal | Medium | Negotiated agreement | Overlaps with quote, order |
| Order | High | Confirmed booking | Distinct (keep) |
| Connection | Medium | Mutual follow | Overlaps with friend/follow |
| Boost | Medium | Paid visibility boost | Distinct (keep) |
| Launchpad | Low | AI-assisted provider setup | Confusing name |

**Verdict:** The product uses 13+ distinct terms to describe what is fundamentally a two-sided transaction: a consumer needs a service and a provider offers it. Consolidating to 5-6 core terms would dramatically reduce cognitive load.

**Suggested consolidation:**
- **Services** (what providers offer)
- **Requests** (what consumers post)
- **Quotes** (provider pricing)
- **Orders** (confirmed bookings)
- **Chat** (communication)
- **Reviews** (post-service)

Eliminate: posts, listings (replace with services), needs/tasks/help requests (replace with requests), deals (replace with orders in quote context), connections (replace with direct chat for transaction context).

---

## 12. Accessibility Evaluation

### 12.1 What's Done

- Flutter: Semantic labels added to feed icons, chat back button, feed card images
- Flutter: Error roles (`role="alert"`) on web login page
- Flutter: Haptic feedback on feed actions, chat send, quote operations

### 12.2 What's Missing

| Area | Gap |
|---|---|
| VoiceOver/VoiceAccess | No testing with screen readers |
| Color contrast | Not audited against WCAG 2.1 AA |
| Touch targets | Not verified at 48x48dp minimum |
| Keyboard navigation (web) | Not tested |
| Focus management (web) | Not audited |
| Screen reader labels (web) | Incomplete |
| Dynamic text scaling (mobile) | Not tested |
| Reduced motion support | Not implemented |
| Error announcement patterns | Inconsistent |

### 12.3 Verdict

Accessibility work has begun (labels, haptics) but is incomplete. The product likely fails WCAG 2.1 AA compliance in multiple areas. A formal audit is needed before public launch.

---

## 13. Platform Consistency (Web vs Mobile)

| Aspect | Flutter (Mobile) | Next.js (Web) | Consistent? |
|---|---|---|---|
| Design tokens | `AppSpacing`, `AppRadii` (8-999 range) | CSS variables (different values) | ❌ No |
| Navigation | 5 bottom tabs + nested routes | Sidebar with 25+ sections | ❌ No |
| Typography | Custom type scale | Tailwind defaults | ❌ No |
| Component library | `ServiqScaffold`, `AppTextField`, `AppPill`, `ServiqTopBar` | Tailwind utility classes | ❌ No |
| Color palette | Design tokens | CSS variables | ❌ Partial |
| Card/listing design | Polished, shadows | Flatter design | ❌ No |
| Empty states | Custom widgets | Default states | ❌ No |
| Toast/notifications | `ServiqToast` | Different implementation | ❌ No |
| Form inputs | `AppTextField` with filled background, outline border | Raw HTML inputs | ❌ No |

### 13.1 Impact

A user who discovers ServiQ on mobile and continues on web will feel like they're using a different product. This erodes trust and increases cognitive load.

### 13.2 Root Cause

- Flutter received design system migration (Phases C-D completed)
- Web remained on raw Tailwind CSS
- No cross-platform design spec was maintained

---

## 14. Recommendations

### P0: Pre-Launch Must-Fix

1. **Simplify terminology to 5-6 core concepts.** Audit every screen. Replace posts/listings/needs/tasks with services/requests/quotes/orders/reviews.
2. **Eliminate the connection requirement for transactions.** Users should chat with providers directly when responding to a posted request.
3. **Remove AI Launchpad duplicate path.** Single provider onboarding flow.
4. **Add provider discovery without login.** Guests must see provider profiles, services, and prices before signing up.
5. **Show trust signals at decision points.** Quote comparison must show provider trust score, verification level, completion rate, and response time.

### P1: Launch Critical

6. **Unify web and mobile design systems.** Create a cross-platform design spec. Port web to use the same tokens as Flutter.
7. **Simplify web dashboard for new users.** Progressive disclosure: show only 5 core modules, reveal advanced sections as user engages.
8. **Replace empty feed with curated content.** Category grid, featured providers, how-to guides — anything is better than "no content."
9. **Build browse-before-buy flow.** Consumer should search services, browse providers, see prices, and book — without posting a need.
10. **Add one-click checkout for returning users.** Save payment methods, enable repeat booking from past orders.

### P2: Growth Foundation

11. **Test accessibility with real assistive technology.** Hire a screen reader user for a paid audit.
12. **A/B test onboarding length.** Can users complete first transaction in under 3 minutes?
13. **Consolidate Quote Room and Deal Room into Chat.** 1:1 conversations with structured quote templates.
14. **Remove Workspace for solo providers.** Show simplified profile only. Workspace activates when team size > 1.
15. **Add quick re-ordering.** "Book again" button on past order detail page.

### Measurement

| Metric | Current | Target |
|---|---|---|
| Terms in navigation | 13+ | 5-6 |
| Steps to first transaction | 11+ | 5-7 |
| Guest-visible providers | 0 | All |
| Platform consistency score | 2/10 | 8/10 |
| WCAG compliance | Untested | AA |
