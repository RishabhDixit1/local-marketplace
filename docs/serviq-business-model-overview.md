# ServiQ — Business Model & Problem Overview

---

## The Problem

**For Consumers (Seekers)**
- Finding a reliable plumber, electrician, or AC repair guy means asking friends, scrolling Justdial (outdated listings), or calling 5 people who don't show up.
- Urban Company is great but only for big jobs (AC service, deep cleaning). For small tasks — fixing a faucet, installing a switch, unclogging a drain — there's no reliable on-demand option.
- Trust is the bottleneck: "Will they show up? Will they overcharge? Will they do a good job?"

**For Providers**
- Small electricians and plumbers survive on word-of-mouth and walk-ins. No digital presence = missed customers.
- Justdial and Sulekha charge for leads that are often fake or low-quality. Google My Business is free but crowded.
- No way to show their work quality, get reviews, or build a reputation online.
- They want more customers but don't know how to get them without paying middlemen.

**The Core Insight**
The Indian hyperlocal services market is massive (₹5 Trillion+) but fragmented. The middle exists — it's called the local hardware store owner, the building watchman, the society WhatsApp group. ServiQ is trying to become the digital version of that referral network.

---

## The Solution

ServiQ is a hyperlocal marketplace connecting consumers with nearby service providers in real time.

**How it works:**
1. Consumer posts a request (e.g., "AC not cooling, need repair").
2. Nearby matching providers get notified instantly.
3. Consumer browses provider profiles — ratings, completed jobs, distance, verification status.
4. They chat, get a quote, and decide.
5. Pay through the platform. Job gets done.
6. Both sides review each other. Trust builds over time.

**Key differentiators vs. Urban Company / Justdial:**
- **Hyperlocal micro-tasks** (₹50–₹500 range) that big platforms skip — small repairs, quick fixes, emergency call-outs.
- **Real-time provider matching** based on geo-proximity, availability, and trust score — not just a directory listing.
- **Dual-sided trust system** — providers earn reputation through completed jobs, consumers build reliability scores too.
- **AI Launchpad** — a one-time ₹499 tool that generates a full business profile (description, pricing, FAQ, SEO keywords) for providers who aren't digitally savvy.

---

## Target Audience

| Segment | Description | Size (Noida pilot) |
|---|---|---|
| **Consumers** | Urban & semi-urban residents aged 22–50 in Noida, needing home services urgently or on a budget | ~500K households |
| **Providers** | Local electricians, plumbers, AC repair, carpenters, appliance repair, mobile repair — solo or small teams (1–25 people) | ~5,000 providers |

**Launch market:** Noida (Sector 12–22, Crossings Republik, and surrounding sectors). Delhi NCR expansion planned post-validation.

---

## Revenue Model

### Revenue Streams

| Stream | Who Pays | How | Target % of Revenue (Y1) |
|---|---|---|---|
| **Transaction Commission** | Provider | 12% platform fee on every completed transaction | ~40% |
| **Provider Subscriptions** | Provider | ₹0 (Free) / ₹299 (Essential) / ₹999 (Premium) per month | ~35% |
| **AI Launchpad** | Provider | ₹499 one-time fee for AI-generated business profile | ~10% |
| **Priority Boosts** | Provider | ₹25 per post to boost visibility in consumer feed | ~10% |
| **Featured Placements** | Provider | Paid premium placement in search results | ~5% |

### Unit Economics (Projected)

| Metric | Projected | Source |
|---|---|---|
| Avg transaction value | ₹350 | Market research (Noida home services) |
| Platform commission (12%) | ₹42 | Per-transaction revenue |
| Payment gateway (2-3%) | ~₹10 | Razorpay fees |
| Net per transaction | ~₹32 | After gateway + estimated support cost |
| Consumer CAC | ₹50 | Social+referral+offline blended |
| Provider CAC | ₹100 | Onboarding + support cost |
| Consumer LTV (12mo) | ₹420 | ~13 transactions × ₹32 net |
| Provider LTV (24mo) | ₹12,000 | ₹500/mo blended subscription |

### Revenue Targets

| Metric | Y1 Target |
|---|---|
| Total Revenue | ₹29.9 Cr |
| Monthly Transactions (by M12) | ~27,000/mo |
| Active Providers | ~2,500 |
| Paid Subscribers | ~800 (32% conversion) |
| Gross Margin | ~65% |
| Break-even | Month 9 |

---

## Costs & Margins

### Fixed Costs (Monthly)

| Item | Monthly Cost | Notes |
|---|---|---|
| Cloud (Supabase + Vercel) | ~₹1.5L | Scales with users |
| Payment gateway fees | ~3% of GMV | Razorpay |
| Team salaries | ~₹8L | 5-8 people at market rates |
| Office + ops | ~₹1L | Co-working + miscellaneous |
| Marketing spend | Variable | Based on CAC targets |

### Variable Costs
- Refunds / chargebacks: ~2% of GMV
- Customer support: ~₹50 per transaction (initially higher, automates over time)
- Provider payouts: 88% of transaction value (after 12% commission)

### Path to Healthy Margins
- Year 1: 65% gross margin (driven by high-touch support + provider acquisition cost)
- Year 2 target: 78% gross margin (automation + scale + subscription mix shift)
- Year 3 target: 82% gross margin (network effects reduce CAC, subscriptions dominate)

---

## Competitive Landscape

| Competitor | Strength | Weakness | ServiQ's Advantage |
|---|---|---|---|
| **Urban Company** | Brand trust, vetted pros, 30-min booking | High prices, only big jobs, supply-constrained | Micro-tasks, lower prices, real-time matching |
| **Justdial / Sulekha** | Massive listing database | Stale listings, fake leads, no transactional trust | Verified providers, reviews, actual transactions |
| **Local WhatsApp groups** | Trusted referrals, zero cost | No discovery, no payment, manual coordination | Structured discovery, payments built-in, reviews |
| **Independent providers** | Cheapest, direct relationship | No discovery, no accountability, cash-only | Reviews, escrow, reliabiliy |

**Moat thesis:** Network effects + trust data. As more transactions happen on-platform, the matching algorithm gets smarter, provider reputations become portable, and switching costs increase for both sides.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Chicken-and-egg:** No providers = no consumers, no consumers = no providers | High | Phase 1: manually onboard providers, concierge service for first consumers, subsidize both sides |
| **Provider churn:** Providers leave after free trial | High | Build stickiness through reviews, portfolio, repeat customers; subscription as lock-in |
| **Low transaction frequency:** Consumers use once, never return | Medium | Push notifications for re-engagement, referral rewards, seasonal campaigns (monsoon = plumber) |
| **Trust failures:** Bad provider experience kills platform | High | Verification badges, review system, dispute resolution, money-back guarantee |
| **Payment fraud:** Fake transactions, chargebacks | Medium | Razorpay fraud detection, escrow-hold until completion, identity verification for high-value |

---

## Traction & Milestones

### Current Status (as of June 2026)
- Web app deployed: serviqapp.com
- Android APK built (not on Play Store yet)
- AI Launchpad: built but zero usage
- Quote Room / Deal Room: built but zero usage
- Lead OS: early stage
- Total transactions on platform: **0**
- Total revenue: **₹0**
- Total active providers: **0**

### Next 90-Day Milestones
| Month | Target | Validation |
|---|---|---|
| Month 1 | 1 completed transaction, 1 paid subscription | Real money moves through platform |
| Month 2 | 5 completed transactions | Repeat usage from at least 1 consumer |
| Month 3 | 10 completed transactions, 5 paid providers | CAC and LTV measurable from real data |

---

## Funding

| Round | Amount | Stage |
|---|---|---|
| Pre-seed (current) | ₹10 Cr (~$1.2M) | Targeting angels/accelerators |
| Use of funds | Product (30%), Marketing (40%), Ops (20%), Reserve (10%) | |

---

## Key Questions for Investors

These are the questions you should be prepared to answer — and the ones the 90-day execution plan is designed to answer with data, not slides:

1. **Do consumers actually pay for this?** → Real transaction data from Phase 1.
2. **Do providers stay?** → Provider retention after free trial.
3. **What's the real CAC?** → From a single channel, measured, not estimated.
4. **Why not Urban Company?** → Micro-task differentiation proven by transaction size data.
5. **Can this scale beyond Noida?** → Playbook from Noida pilot, replicable to next city.
6. **What's the 10-year vision?** → Local services OS for India. But first, prove Noida.
