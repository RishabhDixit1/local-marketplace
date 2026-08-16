# ServiQ Mobile — Information Architecture Redesign (Phase 2)

Grounding: audit findings in [MOBILE_AUDIT.md](MOBILE_AUDIT.md), current 3-tab
shell in `app_router.dart:482-519`, and the existing mental model in
`IA_MENTAL_MODEL.md`.

## 1. Principles

1. **One screen, one primary purpose.** A screen earns a bottom-level slot only
   if a user can answer "what am I here to do?" in one sentence.
2. **≤ 5–7 navigation destinations.** Anything deeper is a *task*, not a *place*.
3. **Under 3 seconds to understand.** First screenful = purpose + one obvious
   action. No screen opens with more than 3 primary affordances.
4. **Progressive disclosure.** Advanced/provider tools live one tap deep and are
   hidden from consumers.
5. **No dead ends.** Every tappable destination must resolve to a real surface
   (audit C-1). If it isn't built, it isn't in the nav.
6. **Scannability over completeness.** Density is a cost; decision-relevant
   information only.

## 2. Current-state diagnosis

| Problem | Evidence |
|---|---|
| Two "home/feed" surfaces compete | Tab 0 (welcome) shows a feed; tab 1's first route is `FeedPage(mode: explore)` (`app_router.dart:494-496`). Same feed concept twice. |
| Discovery duplicates web landing | `DiscoveryPage` mirrors the web landing sections (audit C4/Explore alignment). |
| 6 dead provider destinations | analytics, payouts, referrals, workspaces, boosts, subscriptions all redirect `→ profile` (`app_router.dart:274-275,282-283,290-291,302-303,342-343,346-347`) yet remain as profile/control tiles. |
| 4 more dead routes | invoices `350-356`, blockedUsers `250-251`, admin `362-363`, saved `373-374`. |
| Route clutter | 40+ top-level routes; `marketZones`, `profilePublic`, `profileEdit`, `profileTrust`, `inbox`, `post-task`, `saved` are aliases that hide intent. |
| Consumer/provider mixing | Profile hub mixes consumer identity, provider tools, payments, trust, account in one 18-tile surface (reduced to 4 groups, but provider tools + payments still share the identity tab). |

## 3. Target IA

### 3.1 The three tabs (keep, but sharpen)

| Tab | Purpose (one sentence) | Primary action |
|---|---|---|
| **Need Something** | "Get something done fast." AI bar + live needs + quick categories. | Type a need → AI routes it. |
| **Explore** | "Find and compare providers." Discovery sections + provider cards + map. | Search / open a provider. |
| **You** | "Manage my identity, my stuff, and my money." | Profile + context switch. |

The **Explore feed page is removed from the shell.** It was the pre-3-tab
artifact: `FeedPage(mode: explore)` at `app_router.dart:494-496` moves out of
the shell to top-level deep-link routes (like Tasks/Chat already are). Feed
content belongs on the Need Something home, not a parallel tab.

### 3.2 Route map after cleanup

**Shell (3 tabs):**
- `/app` — Welcome (Need Something): AI bar + active needs + trusted rail.
- `/app/discovery` — Explore: sections + provider cards + map.
- `/app/profile` — You: identity + hub groups.

**Top-level task routes (deep-linkable, back-stack):** chat, tasks, search,
map, notifications, provider profile, listing detail, create need, checkout,
quote room/comparison, orders, bookings, settings, people, launchpad, listings,
verification, availability, control, transactions, public business, marketplace
landing (`/`), auth, onboarding, setup.

**Removed (DONE — routes + tiles deleted together, Aug 2026):**

| Route | Reason | Disposition |
|---|---|---|
| `payouts` | no screen | delete route + profile tile ✅ |
| `referrals` | no screen | delete route + profile tile ✅ |
| `analytics` | no screen | delete route + profile tile ✅ |
| `workspaces` | no screen | delete route + profile tile ✅ |
| `providerBoosts` | no screen | delete route + control tile ✅ |
| `providerSubscriptions` | no screen | delete route + control tile ✅ |
| `invoices` | no screen | delete route + tile ✅ |
| `blockedUsers` | no screen | delete route + tile ✅ |
| `admin` | no screen | delete route + tile ✅ |
| `saved` | no screen | delete route + tile ✅ |
| `marketZones`, `profilePublic`, `profileEdit`, `profileTrust`, `inbox`, `post-task` | aliases | keep the redirect (deep links exist in the wild) |

Decision gate for re-adding any removed destination: **build the screen first,
then wire the tile.** (Boosts/subscriptions are the highest product value per
`FOUNDER_ACTION_LIST.md`; build them next, then re-enable.)

### 3.3 One primary action per surface

| Surface | Primary action | Secondary (≤2) |
|---|---|---|
| Home (Need Something) | AI prompt bar | Post need (FAB), view tasks |
| Explore | Search | Map toggle, provider card taps |
| Provider profile | Book / Request service (sticky) | Message, Save |
| Listing detail | Book / Order (sticky) | Message, cart |
| Profile hub | Context switch (Seeker ↔ Provider) | Notifications, settings |
| Quote comparison | Accept best quote | Reject, counter |
| Tasks | Status tabs | Post need |
| Chat | Composer | Back to context |

### 3.4 Decision-fatigue reductions

- **Home:** remove the "Who are you?" intent card after first run (already
  gated); collapse "Nearby categories" + "Explore on map" + "Recommended" into
  **two** sections: *Live near you* (category chips) and *Trusted* (rail). The
  rest is AI bar + active-work status.
- **Profile hub:** keep 4 groups but remove dead tiles; provider-group tiles
  only render when the user has provider onboarding complete.
- **Provider profile:** hero = identity + trust summary; then Reviews; then
  Services; then Availability; CTA sticky. Advanced info (reports, copying,
  business details) in an overflow menu.
- **Explore:** web-layout sections retained but provider cards standardized to
  one component (Phase 5) so no surface re-teaches the card.

## 4. Per-screen purpose audit (from Phase 1 matrix)

| Screen | Primary purpose | Verdict |
|---|---|---|
| Welcome (home) | Route a need | **Sharpen** — reduce pre-card control stack (Phase 4) |
| Feed page (explore mode) | Legacy parallel feed | **Move out of shell** (3.1) |
| Discovery | Explore providers | Keep |
| Profile hub | Identity + tools | **Remove dead tiles** (3.2) |
| Provider profile | Convert to booking | **Redesign** (Phase 6) |
| Provider launchpad | Onboard as provider | Keep (split review page) |
| Search | Find providers/items | Keep; fix a11y (Phase 9) |
| Chat | Converse | Keep; fix C-3/C-4 |
| Tasks | Manage needs/work | Keep |
| Orders/bookings | Track money/service | Keep |
| Quote room/comparison | Negotiate/choose | Keep; fix C-2, H-17 |
| Auth | Identify | Keep |
| Control | Provider settings | Remove dead rows (3.2) |
| Marketplace landing `/` | Public acquisition | Keep |

## 5. Implementation checklist (router + shell)

1. `app_router.dart`: delete 10 dead routes (§3.2); move `FeedPage(mode: explore)`
   out of branch 0.
2. `app_shell.dart`: unchanged shell; branch 0 = welcome only.
3. `profile_page.dart`: delete dead tiles; gate provider-group on
   `onboardingComplete`.
4. `control_page.dart`: delete boosts/subscriptions rows.
5. `feed_page.dart`: keep as deep-link `ExplorePage` (renamed `ExploreFeedPage`)
   reachable from home "Browse all".
6. Update `route_error_page` test coverage for removed routes.
7. Update `IA_MENTAL_MODEL.md` ownership rules to match.

Verification: `flutter analyze` clean; shell contract test updated (3 tabs,
branch 0 has no feed); `tsc --noEmit` unaffected (no web changes).
