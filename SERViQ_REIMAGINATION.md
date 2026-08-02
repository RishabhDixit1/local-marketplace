# ServiQ Product Reimagination

> *A living neighborhood, not a marketplace.*

---

## 1. Product Philosophy

### The Core Insight

People think in **goals**, not categories.

No one wakes up thinking "I need to browse Electrical > Home Services." They think:

- *"My AC stopped working."*
- *"I need breakfast."*
- *"I need a flat."*
- *"I need a tutor."*
- *"I need work."*
- *"I need help."*

Current marketplaces organize around **provider inventory** — what sellers have. ServiQ must organize around **human needs** — what people actually want.

### Mental Model: The Neighborhood, Not The Store

| Current (Marketplace) | New (Neighborhood) |
|---|---|
| Browse categories | Express what you need |
| Search listings | Ask the neighborhood |
| Compare prices | Find trusted people |
| Transaction-focused | Relationship-focused |
| Static profiles | Living presence |
| Seller-driven | Need-driven |

A neighborhood is alive. You walk down the street and see what's happening. You ask your neighbor for a recommendation. You know who's reliable because you've seen their work. Serendipity plays a role. Trust is built through repeated interaction, not star ratings alone.

### Core Metaphors

| Element | Metaphor | Meaning |
|---|---|---|
| Feed | **The Street** | What's happening around you right now |
| Needs | **The Bulletin Board** | Who needs what, who can help |
| Providers | **Local Shops** | People and businesses with known capabilities |
| Network | **Your Circle** | People you know and trust |
| Communities | **The Society** | Your building, your neighborhood, your groups |
| AI | **The Helpful Neighbor** | Knows everyone, knows everything, always helpful |
| Profile | **Your Home** | Who you are in this neighborhood |

---

## 2. Information Architecture

### New Organizational Principle

Organize around **what people want to DO**, not around **what providers SELL**.

### Top-Level Structure

```
NOW          — What's happening around me (feed + pulse)
NEEDS        — Express, track, and fulfill needs
PLACES       — Who and what is near me (map + directory)
YOU          — Your identity, circle, tools, history
```

Everything lives under these four pillars. Nothing lives outside them.

### Why Four?

**NOW** replaces the feed. It's temporal, alive, immediate. Not "what's listed" but "what's happening."

**NEEDS** replaces categories + search + help requests. It's the universal entry point for every goal. One model: "I need X."

**PLACES** replaces provider directories + business pages + map. It's spatial, relational. Not a listing index but a neighborhood directory.

**YOU** replaces dashboard + profile. It's your identity, your network, your tools, your history.

### What Gets Eliminated

- **Categories** — replaced by AI-understood intent (the system infers category from what you say)
- **Dashboard** — replaced by YOU tab with contextual tools; no 30-item sidebar
- **Search** — replaced by the NEEDS entry point + AI clarification
- **Explore/Discover as separate mode** — NOW is always discovery
- **Listings vs Posts vs Help Requests** — unified into "Offerings" (someone who can do something) and "Requests" (someone who needs something)
- **Direct Booking vs Requirement Post loops** — one unified Need Loop

---

## 3. Navigation

### Zero-Level (Always Accessible)

```
┌─────────────────────────────────────────────┐
│  [☰]  [📍 Near me]  "I need..."  [🔔]  [👤] │
└─────────────────────────────────────────────┘
```

A persistent, globally available **"I need..."** input — text or voice, always at the bottom of the screen (mobile) or in a floating bar (web). This is the primary entry point for *everything*.

The location badge shows your current neighborhood. Tap to switch.

### Primary Navigation (Four Tabs)

```
 ┌──────────┬──────────┬──────────┬──────────┐
 │   NOW    │  NEEDS   │  PLACES  │   YOU    │
 └──────────┴──────────┴──────────┴──────────┘
```

No sub-tabs. No stacked navigation. No sidebar of 20 links. Four buttons.

Each tab is a **mode**, not a page. The content within each tab is contextually driven by who you are (seeker/provider/both) and what's happening.

### On First Open

The first time someone opens ServiQ, they see:

```
┌─────────────────────────────────────────────┐
│                                             │
│  Welcome to your neighborhood               │
│                                             │
│  What brings you here?                      │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  "I need help with..."               │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Or browse what's happening nearby 👇       │
│                                             │
└─────────────────────────────────────────────┘
```

No category selection. No "are you a provider or seeker?" gate. Just a question.

---

## 4. Core Interaction Model: The Need Loop

This is the single most important design decision.

**Everything is a Need.**

| You say | System interprets |
|---|---|
| "My AC stopped working" | Need: AC repair, urgency: high, location: home |
| "I need breakfast" | Need: food delivery, type: breakfast, location: current |
| "I can fix ACs" | Offering: AC repair service, availability: open |
| "I have spare tiles" | Offering: surplus tiles, type: product |
| "I need a flat in Dwarka" | Need: housing, location: Dwarka, type: rent |
| "Teaching math to class 8" | Offering: tutoring, subject: math, level: middle school |

### The Unified Loop

```
                   ┌──────────────────┐
                   │  EXPRESS A NEED  │
                   │  ("I need...")   │
                   └────────┬─────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │  AI CLARIFIES    │
                   │  What? When?     │
                   │  Where? Budget?  │
                   └────────┬─────────┘
                            │
                    ┌───────┴───────┐
                    │               │
                    ▼               ▼
           ┌────────────────┐  ┌────────────────┐
           │ MATCH TO       │  │ POST AS OPEN   │
           │ OFFERINGS      │  │ NEED           │
           │ (direct match) │  │ (no match yet) │
           └───────┬────────┘  └───────┬────────┘
                   │                   │
                   ▼                   ▼
           ┌────────────────┐  ┌────────────────┐
           │ NEGOTIATE      │  │ PROVIDERS      │
           │ (price, time,  │  │ RESPOND / BID  │
           │  scope via AI  │  │                │
           │  or chat)      │  │                │
           └───────┬────────┘  └───────┬────────┘
                   │                   │
                   └───────┬───────────┘
                           │
                           ▼
                   ┌──────────────────┐
                   │  DELIVER         │
                   │  (track, chat,   │
                   │  update status)  │
                   └────────┬─────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │  REVIEW & TRUST  │
                   │  (rate, review,  │
                   │  trust update)   │
                   └────────┬─────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │  REPEAT / REFER  │
                   │  (your person)   │
                   └──────────────────┘
```

**No more "direct booking" vs "requirement post."** One loop. The AI automatically routes based on match confidence:
- High confidence → direct match (show you providers who can do it now)
- Low confidence → post as an open need (let providers come to you)

### Need States

Every need passes through these states:

```
DRAFT → OPEN → MATCHED → NEGOTIATING → CONFIRMED → IN_PROGRESS → COMPLETED → REVIEWED
                                                                        ↘ CANCELLED
                                                                        ↘ DISPUTED
```

### Offerings

Providers don't "list services." They express **what they can help with**:

> "I can fix ACs, install lights, and do plumbing. Available evenings and weekends. Within 5 km of Dwarka."

This is parsed into capabilities, not categories. An offering is:
- A capability ("fix ACs")
- A location context ("within 5 km of Dwarka")
- An availability pattern ("evenings and weekends")
- A pricing model ("₹500 fixed + parts" or "₹300/hr" or "quote")

---

## 5. AI Interaction Model

### AI Is Ambient, Not A Destination

Most platforms treat AI as a chat window you navigate to. In ServiQ, AI is **woven into every surface**.

| Surface | AI Role |
|---|---|
| The "I need..." input | Primary clarifier and matcher |
| The NOW feed | Curator: "3 people in your building need AC repair this week" |
| A provider page | Translator: "This provider can help with what you need right now" |
| Chat | Mediator: suggests prices, times, resolutions |
| Your NEEDS list | Proactive: "Your AC repair is tomorrow at 10 AM" |
| Trust | Synthesizer: "You and this provider share 3 connections" |

### Interaction Modes

**1. Conversational Need Expression** (Primary)

The "I need..." input opens into a conversational interface, not a search results page.

```
You: "I need my AC fixed"
AI: "Got it. Which AC? The one in your living room or bedroom?"
You: "Living room. It's not cooling at all."
AI: "When would you like someone to come?"
You: "Today if possible."
AI: "Checking who's available near you...

   Rajesh, 0.5 km away — available at 4 PM
   Priya, 1.2 km away — available at 6 PM
   Amit, 0.8 km away — available tomorrow 9 AM

Rajesh has fixed 12 ACs in your building this month. Want me to connect you?"
```

**2. Proactive AI (Notifications + Feed)**

AI doesn't wait to be asked. It surfaces relevant information:

- "It's going to be 45°C next week. Your AC provider Rajesh has slots open Wednesday."
- "Your neighbor just posted they need a tutor for class 8 math — you said you teach math."
- "3 people in your society are ordering dinner from Spice Kitchen. Want to join the group order?"

**3. Contextual AI (On Every Page)**

Every page has a subtle AI companion that understands context:

- On a provider profile: "They've done 5 jobs in your building. Want to ask about your AC?"
- On a need: "2 new providers have offered to help since you last checked."
- On your profile: "Your response time is in the top 10% of your area."

**4. Voice-First Design**

"I need..." accepts voice input. AI responds verbally or textually depending on context. The mobile app should work hands-free for when you're actually dealing with a broken AC.

### AI as Trust Layer

The AI doesn't just match — it **vouches**:

- "This provider has completed 47 jobs, all with 5-star reviews. You share 2 mutual connections."
- "This provider verified their identity and has been active for 8 months."
- "This provider typically responds within 5 minutes."

These signals are woven into every AI recommendation.

---

## 6. NOW — The Living Feed

### What It Shows

Not a classified listing grid. A **living stream** of what matters to you right now.

**Feed Objects:**

| Object | Example |
|---|---|
| Needs | "Riya needs a plumber — leaking pipe, urgent" |
| Offerings | "ElectroCare is running a monsoon AC service camp" |
| Activity | "Your neighbor fixed their kitchen — before/after photos" |
| Recommendations | "Anjali: 'Rajesh fixed my AC in 30 minutes, highly recommend'" |
| Community | "Building B has a group order for dinner — join?" |
| Updates | "Your AC service is confirmed for tomorrow 10 AM" |
| Serendipity | "Sharma Sweets is 200m away and has fresh gulab jamun" |

### Feed Philosophy

1. **Temporal, not categorical** — organized by when things happen, not what type they are
2. **Personal** — shows what matters to *you*, based on your needs, network, and location
3. **Alive** — realtime updates, presence dots, "active now" indicators
4. **Sparse** — not infinite scroll of listings; a curated stream of signal, not noise

### Feed Personalization

| Factor | Weight |
|---|---|
| Your active needs | Highest |
| Your network (connections) | Very high |
| Proximity | High |
| Past behavior | High |
| Serendipity (discovery) | Low but present |

### Feed Actions

Each card offers contextual actions, not generic ones:

- A need → "I can help" / "Share with someone"
- An offering → "I need this" / "Save for later"
- A recommendation → "Connect with them" / "Book them"
- An update → "View details" / "Message"

---

## 7. NEEDS — The Bulletin Board

### Your Needs

A clean list of everything you've asked for:

```
ACTIVE (3)                   PAST (12)
┌──────────────────────┐    ┌──────────────────────┐
│ AC Repair            │    │ Plumbing (Jun 12)    │
│  ↓ Rajesh, tomorrow  │    │ ★★★★★ · ₹1,200       │
├──────────────────────┤    ├──────────────────────┤
│ Need: Math Tutor     │    │ Deep Cleaning (May 3) │
│  ◌ Open · 2 bids     │    │ ★★★★☆ · ₹2,500       │
├──────────────────────┤    ├──────────────────────┤
│ Need: Dinner Tonight │    │ WiFi Install (Apr 20) │
│  ◌ 3 providers near  │    │ ★★★★★ · ₹500          │
└──────────────────────┘    └──────────────────────┘
```

### Needs Near You

Open needs from people around you. You can fulfill them or share them.

### The Need Detail Page

Not a listing page. A **living document**:

```
┌──────────────────────────────────────────────┐
│  🔧 AC NOT COOLING                           │
│  📍 Sector 12, Dwarka · 🏠 Living Room       │
│  ⏰ Urgent · Today if possible                │
│                                              │
│  ─── Conversation ───                        │
│  Me: It's blowing warm air                   │
│  AI: Checked — Rajesh can come at 4 PM       │
│  Me: Okay, confirm                           │
│                                              │
│  ─── Matches (2) ────                        │
│  Rajesh ⭐ 4.9 · 0.5 km · Avail 4 PM         │
│    [Connect] [Book] [View Profile]           │
│  Priya  ⭐ 4.7 · 1.2 km · Avail 6 PM         │
│    [Connect] [Book] [View Profile]           │
│                                              │
│  ─── Updates ────                            │
│  📅 Confirmed: Tomorrow 4 PM                 │
│  💳 Payment: ₹500 (on completion)            │
└──────────────────────────────────────────────┘
```

---

## 8. PLACES — The Neighborhood Directory

### Entry Points

| Mode | When |
|---|---|
| Map | "What's around me right now?" |
| List | "Who in my area does X?" |
| Your Regulars | "Who have I used before?" |
| Trending | "Who's popular this week?" |

### The Map

Not a pin-drop map. A **living map**:

- Providers show where they are *right now* (presence)
- Needs show where they're happening
- Active jobs show progress
- Heat map of what's in demand

### Provider/Business Page

Not a profile. A **storefront with a pulse**:

```
┌──────────────────────────────────────────────┐
│  🛠️ Rajesh Electricals                       │
│  ⭐ 4.9 · 47 jobs · 0.5 km away             │
│  🔵 Available now · Usually responds in 2 min│
│                                              │
│  "I fix ACs, wiring, and install fixtures"   │
│                                              │
│  ─── Your Connection ───                     │
│  You: "Fixed my AC last month"               │
│  3 mutual connections                        │
│  Has worked in your building 12 times        │
│                                              │
│  ─── What People Need From Them ───          │
│  🔧 AC repair (8 people this week)           │
│  ⚡ Wiring (3 people this week)               │
│  💡 Fixture installation (2 this week)       │
│                                              │
│  ─── Availability ───                        │
│  Today:  4 PM, 6 PM                          │
│  Tomorrow: 9 AM, 11 AM, 2 PM                │
│                                              │
│  [I Need This] [Message] [Share] [Save]      │
└──────────────────────────────────────────────┘
```

**Key differences from current profiles:**
- Shows **what people need from them** (demand signals), not just what they offer
- Shows **your relationship** to them (shared connections, history)
- Shows **real-time presence** and response time
- The "I Need This" button replaces "Book Now" — it opens the need expression flow, not a direct booking

---

## 9. YOU — Your Identity, Circle, and Tools

### Tab Layout

```
┌──────────────────────────────────────┐
│  👤 Your Name                        │
│  📍 Sector 12, Dwarka               │
│  ⭐ Trust: 4.8 · 12 connections      │
│                                      │
│  ┌──────────────┬──────────────────┐ │
│  │ I need help  │ I can help       │ │
│  └──────────────┴──────────────────┘ │
│                                      │
│  ─── Your Circle ───                │
│  [Connection 1] [C 2] [C 3] [+12]  │
│                                      │
│  ─── Your Tools ───                 │
│  📋 Active Needs     (3)            │
│  📦 My Offerings     (5)            │
│  📊 My Performance                  │
│  💰 Earnings         (this month)   │
│  📅 Schedule                        │
│  📁 Portfolio                       │
│                                      │
│  ─── Your History ───              │
│  🛒 Past Orders      (24)           │
│  ⭐ Reviews Received  (18)           │
│  💬 Saved Providers  (6)            │
│                                      │
│  ─── Account ───                   │
│  ⚙️ Settings                        │
│  🛡️ Verification                    │
│  📞 Support                         │
└──────────────────────────────────────┘
```

### Identity Model

**You are not a "provider" or a "seeker."** You are a **neighbor** who sometimes needs help and sometimes gives it.

The "I need help" / "I can help" toggle replaces the provider/seeker role. You can be both simultaneously. Context determines which hat you're wearing.

### Trust Score

Visible at the top of YOUR tab. A single number that synthesizes:

- On-time rate
- Response time
- Completion rate
- Review average
- Verification level
- Connection quality (who vouches for you)
- Tenure on platform

Trust is **portable** — it follows you across neighborhoods, across need types, across time.

---

## 10. Communities

### What Communities Are

Physical: Your building, your society, your sector
Interest-based: Parents in Dwarka, Home chefs, Weekend cricketers
Temporary: "Building B group dinner" (dissolves after)

### What Communities Enable

| Feature | Description |
|---|---|
| Shared Needs | "3 of us need AC repair, can we get a group rate?" |
| Recommendations | Community-vetted providers |
| Group Orders | Combined food/grocery orders |
| Local Events | Society events, workshops |
| Trust Transfer | "I trust this provider because my neighbor does" |
| Moderation | Community self-policing of quality |

### Community Feed

Each community has its own NOW feed — a micro-neighborhood within the neighborhood.

---

## 11. Trust Architecture

### Trust Is Layered, Not Binary

| Layer | Signal | Visible |
|---|---|---|
| Identity | Government ID verified | 🛡️ Badge |
| Activity | Time on platform, job count | Profile stat |
| Reliability | On-time rate, response time | Percentage |
| Quality | Reviews, ratings | Stars + count |
| Social | Mutual connections | "3 mutuals" |
| Recency | Last active, last job | Timestamp |
| Context | "Fixed AC in your building" | Specific |

### Trust In AI Responses

When AI recommends someone, it always includes trust context:

> "Rajesh — he's fixed 12 ACs in your building this month, your neighbor Anjali recommends him, and he's available at 4 PM."

### Trust Decay

Trust signals decay over time. A 5-star review from 2 years ago means less than one from 2 weeks ago. Trust is a **moving average**, not a lifetime score.

---

## 12. Chat

### Chat Is Not A Separate Feature

Chat is the **negotiation and delivery layer** of the Need Loop. Every need gets a chat thread automatically when matched.

### What Chat Contains

```
┌──────────────────────────────────────┐
│  📋 AC Repair — Rajesh               │
│  ─────────────────────────────────── │
│                                      │
│  📅 Scheduled: Tomorrow, 4 PM        │
│  💰 ₹500 (on completion)             │
│  📍 Sector 12, Dwarka — Living Room  │
│                                      │
│  ─────────────────────────────────── │
│  You: Hi Rajesh, the living room AC  │
│  Rajesh: Coming tomorrow at 4. Will  │
│           bring gas refill just in   │
│           case.                      │
│  AI Suggestion: Common issue. Refill │
│  typically ₹200-300 extra. Confirm?  │
│  ─────────────────────────────────── │
│                                      │
│  📎 [Send Invoice] [Reschedule]      │
│     [Track] [Call]                   │
└──────────────────────────────────────┘
```

### Chat Features

- **AI Suggestion** — contextual: pricing, troubleshooting, scheduling
- **Inline payments** — pay, tip, invoice all in chat
- **Need context** — the need card is always pinned at the top
- **Status updates** — "Rajesh is on his way" / "Job started" / "Job completed"
- **Media** — photos of work done, before/after

### Chat Is Also The Inbox

The chat tab shows:
- Active needs (with latest message)
- Past needs (archived)
- Provider inquiries (someone responding to your need)
- Need inquiries (you responding to someone's need)

---

## 13. Commerce

### Payment Is The Outcome, Not The Focus

The platform shouldn't feel like a payment processor. Payment happens naturally within the need flow:

1. Need is expressed and matched
2. Price is negotiated (AI-assisted or free-form)
3. Payment is escrowed or agreed
4. On completion, payment releases
5. Tip is optional after good service

### Pricing Models

| Model | When |
|---|---|
| Fixed price | Clear scope, known cost (AC repair, pizza) |
| Hourly | Variable scope (tutoring, consulting) |
| Quote | Custom work (renovation, event planning) |
| Starting at | With variance (wedding photography) |
| Barter | Future — direct exchange of needs |

### Subscription

For recurring needs: "Weekly cleaning, every Tuesday" — auto-matched, auto-scheduled, auto-paid.

---

## 14. Maps

### Maps Are Context, Not A Feature

The map isn't a separate screen. It's a **mode within PLACES**. Toggle between list and map view.

### What The Map Shows

- Providers currently available (with presence dots)
- Active needs (pulse animation)
- Providers you've used before (starred)
- Trust heat map (concentration of verified providers)
- Demand heat map (what people are asking for in each area)

### Future: Dynamic Routing

"Rajesh is finishing a job in Sector 10 at 3:30. Your building is Sector 12. He can be there by 4 PM."

---

## 15. Identity and Onboarding

### Zero-Friction Identity

No "sign up and create a profile" gate. The first interaction is:

1. Enter phone number
2. Say what you need
3. Get matched

Profile is built **gradually** through use, not demanded upfront.

### Identity Evolution

| Stage | What's Known |
|---|---|
| Fresh | Phone number, name |
| After 1st need | Location, first need type |
| After 3 needs | Reliable categories of interest |
| After identity verification | Verified badge |
| After 10 jobs (provider) | Trust score, portfolio |

### The "I Can Help" Setup

For providers, setup is:

1. "What can you help with?" (free text → AI parses into capabilities)
2. "Where can you help?" (location + radius)
3. "When are you available?" (simple schedule)
4. "How do you price?" (model + amounts)

That's it. Everything else (photos, portfolio, detailed description) is gradual.

---

## 16. Future Scalability

### Vertical Expansion

Every new vertical fits the same **Need Loop**:

| Vertical | Example Need |
|---|---|
| Services | "My AC broke" |
| Food | "I'm hungry" |
| Housing | "I need a flat" |
| Education | "I need a math tutor" |
| Jobs | "I need work" |
| Healthcare | "I need a doctor" |
| Events | "I need a caterer" |
| Transport | "I need a ride" |
| Goods | "I need spare tiles" |

No new navigation. No new information architecture. Just new capability types that the AI understands.

### Geographic Expansion

Each city = new neighborhoods. Same fabric. Localized AI that understands:
- Local languages (Hinglish, Tamil, Bengali, etc.)
- Local pricing norms
- Local service expectations
- Local regulations

### Multi-Sided Evolution

| Phase | Capability |
|---|---|
| 1. Needs + Providers | Individual matching |
| 2. Communities | Group needs, shared services |
| 3. Agents | AI agents negotiate on your behalf |
| 4. API | Third parties plug into the need network |
| 5. Cross-neighborhood | Needs that span localities |

### AI Agent Evolution

**Near-term:** AI assists clarification, matching, scheduling
**Mid-term:** AI negotiates pricing, handles rescheduling, suggests alternatives
**Long-term:** AI agents represent users — "My agent knows I need weekly cleaning, negotiates the best rate, schedules it, and pays"

### The Open Need Network (Future)

An API where third-party providers can:
- Post offerings that ServiQ can match
- Respond to needs programmatically
- Integrate their scheduling with ServiQ

ServiQ becomes the **need network** — any person can express any need, and the platform finds the best way to fulfill it, whether through a local provider, another neighbor, a third-party service, or AI.

---

## 17. Summary: What Changes

| Current | Reimagined |
|---|---|
| Categories | AI-understood intent |
| Dashboard sidebar | 4-tab navigation |
| Service listings | Capability offerings |
| Help requests | Needs (universal model) |
| Search bar | "I need..." input (always present) |
| AI as feature | AI as ambient layer |
| Profile as form | Identity as living presence |
| Reviews as metric | Trust as multidimensional |
| Marketplace | Neighborhood |
| Direct booking + post need | One Need Loop |
| Siloed chat | Need-embedded conversation |
| Map as screen | Map as mode within PLACES |
| Provider/seeker role | Neighbor who gives and receives |
| Category browsing | Goal expression |
| Infinite scroll | Curated stream |
| Static business page | Living storefront with demand signals |
| Star ratings | Trust score + context + social proof |
| Payment upfront | Payment as natural outcome |
| Onboarding gate | Gradual identity |

---

## 18. Implementation Heuristics

*If you were to build this, some principles to preserve:*

1. **The "I need..." input must be the fastest thing in the app.** One tap, start speaking/typing. No load time. No transition.

2. **Never show an empty state.** If there's nothing in the NOW feed, show the needs input. If someone has no needs, show needs near them. If there's nothing near them, show a welcome message.

3. **Every AI response must include a trust signal.** Never recommend someone without context about why they're trustworthy.

4. **Every surface must connect to every other surface.** A need connects to chat connects to payment connects to review connects to trust. No dead ends.

5. **The four tabs must never change.** Users learn one navigation model that works for every city, every vertical, every use case.

6. **Presence is more important than listings.** Show me who's available *right now*, not who has a profile.

7. **Design for the person with the broken AC.** They're stressed, they're hot, they need help NOW. Every interaction should reduce their stress, not add to it.

8. **The neighborhood metaphor must be consistent.** Every design decision should pass the test: "Would this make sense in a real neighborhood?"
