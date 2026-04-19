# ServiQ Mobile Home / Welcome Redesign

## 1. Concise redesign strategy

Turn Home from an MVP stack into a trust-first decision surface:

1. Explain value in the first screenful:
   - trusted live feed
   - nearby needs
   - fast next actions
2. Keep `Post a Need` dominant.
3. Make accepted-connections activity visible before the broader public feed.
4. Give dual-role users a fast way to move between:
   - getting help
   - earning nearby
   - managing people
5. Use fewer generic boxes and more purposeful sections:
   - hero
   - trust snapshot
   - network rail
   - segmented live feed
6. Rank cards by trust + urgency + response speed + distance + category relevance.

## 2. Proposed section architecture

### First screenful

1. App bar
   - ServiQ brand
   - Search
   - Notifications
   - Chat

2. Hero greeting
   - time-aware greeting
   - clear value statement
   - tap-to-search
   - primary CTA: `Post a Need`
   - secondary CTAs: `Earn Nearby`, `People`
   - compact live signals

3. Trust snapshot
   - Trusted live
   - Urgent nearby
   - Providers ready
   - Fastest response

### Scroll sections

4. Popular nearby
   - horizontal category shortcuts

5. Trusted activity
   - accepted-connection rail
   - if empty: network growth CTA

6. Live for today
   - segmented surfaces:
     - `For you`
     - `Trusted`
     - `Nearby`
     - `Earn`

7. Mixed ranked feed
   - request cards
   - trusted connection cards
   - provider spotlight cards
   - CTA / empty-state cards when needed

## 3. UX rules and feed logic

### Section order rationale

1. Hero first:
   the user should immediately understand what ServiQ does and what to do next.
2. Trust snapshot second:
   credibility must land before the feed asks for action.
3. Trusted rail before public feed:
   network content should feel privileged.
4. Segmented feed after trust:
   once the user understands the system, they can switch intent without losing context.

### Primary user journeys

1. Seeker
   - lands on Home
   - sees trusted + urgent nearby
   - taps `Post a Need`
   - browses live cards for alternatives

2. Provider
   - lands on Home
   - switches to `Earn`
   - sees high-intent requests ranked by urgency and proximity
   - messages or responds

3. Social / trust-led user
   - lands on Home
   - checks accepted-connections activity
   - opens a request or manages people

### Ranking model

Use a blended score:

`score = trust + urgency + intent + speed + distance + category fit + provider quality`

Suggested weights:

- accepted connection: `+48`
- urgent: `+28`
- demand card on Home: `+14`
- demand card on Earn: `+24`
- verified: `+18`
- hot category match: `+12`
- fast response: up to `+30`
- completed jobs: up to `+18`
- review volume: up to `+10`
- recency: up to `+16`
- distance: up to `+14`

### Feed mixing rules

#### For you

- Start with the strongest trusted item if one exists.
- Fill with ranked nearby items.
- Inject one provider spotlight after 2-3 feed items.
- Avoid repeating the same category back-to-back where possible.

#### Trusted

- Show accepted-connections content only.
- If empty:
  - push `Manage people`
  - keep secondary path to nearby feed

#### Nearby

- Mix public demand with occasional provider spotlights.
- Demand should outnumber supply by default on Home.

#### Earn

- Show demand-first cards only.
- Insert provider spotlight only as proof of marketplace quality, not as the dominant content type.

### Repetition controls

- Deduplicate by item id.
- Stagger repeated categories.
- Suppress hidden / not interested ids locally.
- Prefer one provider spotlight every 3 request cards max.

### New user vs active user

- New user:
  - hero + categories + `Post a Need`
  - social module becomes education + `Manage people`
- Active user:
  - trusted rail expands
  - feed becomes primary

## 4. Action logic

### Post a Need

- Placement:
  hero primary CTA + persistent FAB
- Interaction:
  tap
- Success:
  open create flow immediately

### Earn Nearby / Become a Provider

- Placement:
  hero secondary CTA + `Earn` feed surface
- Interaction:
  tap
- Success:
  provider onboarding or earn-focused feed

### Search

- Placement:
  app bar + hero tap field
- Interaction:
  tap to dedicated search screen

### Manage Connections / People

- Placement:
  hero secondary CTA + trusted empty state + trusted section action
- Interaction:
  tap

### Save

- Placement:
  leading icon in feed/provider cards
- Interaction:
  tap
- Success:
  optimistic local saved state + snackbar

### Share / Report / Hide / Not Interested

- Placement:
  overflow sheet
- Interaction:
  bottom sheet actions
- Success:
  snackbar or local dismissal

### Message / Respond / View profile

- Placement:
  card action row
- Interaction:
  tap
- Success:
  open chat or profile route

## 5. State-driven UX priorities

### First-time user

- Emphasize:
  hero
  categories
  post CTA
  people CTA

### No connections

- Replace trusted rail with network growth card.

### Connections but no nearby feed

- Keep trusted rail.
- Nearby feed empty state should recommend categories and explore.

### Provider-only user

- Default or encourage `Earn`.
- Keep `Post a Need` visible but secondary to responding.

### Seeker-only user

- Default to `For you`.
- `Post a Need` remains dominant.

### Dual-role user

- Use feed surfaces to switch mode without leaving Home.

### Low-density city

- Raise trust and categories.
- Show more provider spotlights.

### High-activity city

- Weight urgency, recency, and distance more heavily.

### Poor internet

- preserve cached widgets where possible
- show partial warning banner
- do not blank the whole screen if one data source fails

### Session expired

- route guard should bounce to sign-in

## 6. Flutter production architecture

### Current implementation

- Keep `Riverpod` + `go_router`.
- Keep realtime invalidation through Supabase channels.
- Combine 3 sources on Home:
  - all feed
  - connected feed
  - people snapshot

### Widget structure

- `WelcomePage`
  - `_HeroSection`
  - `_TrustSummarySection`
  - `_QuickCategoryRow`
  - `_TrustedRail`
  - `_SurfaceTabsRow`
  - `_WelcomeRequestCard`
  - `_WelcomeProviderCard`
  - `_WelcomeCtaCard`
  - `_WelcomeLoadingState`

### View-model layer

Use a local presentation view model that:

- filters hidden ids
- builds category stats
- ranks feed items
- ranks providers
- creates surface-specific entry lists

### Caching and refresh

- keep Riverpod provider caching
- invalidate on pull-to-refresh and realtime mutations
- use optimistic UI for save/hide

### Pagination

Current Home is intentionally editorial and compact.
When the feed grows:

- keep first-page curated
- paginate only inside `Nearby` and `Earn`
- keep trusted rail capped

### Image loading

When API exposes media URLs:

- add `cached_network_image`
- use 3-tier image state:
  - thumbnail
  - shimmer
  - error placeholder

### Accessibility

- tap targets at least 44px
- avoid hidden meaning in color alone
- keep button labels explicit
- keep trust labels text-based

### Phone-size behavior

- summary metrics: 2-column wrap
- hero CTAs: 2-up but equal width
- trusted rail: horizontal cards
- cards must ellipsize long text

## 7. Analytics events

- `home_welcome`
- `home_refresh_requested`
- `home_surface_changed`
- `home_search_tapped`
- `home_post_need_tapped`
- `home_earn_nearby_tapped`
- `home_people_tapped`
- `home_category_tapped`
- `home_trusted_card_opened`
- `home_feed_primary_tapped`
- `home_feed_message_tapped`
- `home_provider_opened`
- `home_provider_message_tapped`
- `home_item_saved`
- `home_item_unsaved`
- `home_item_hidden`
- `home_item_share_tapped`
- `home_item_report_tapped`

Recommended payloads:

- `surface`
- `item_id`
- `item_type`
- `category`
- `provider_id`
- `trusted_source`

## 8. Acceptance criteria for QA / design review

1. First screenful communicates:
   - what ServiQ is for
   - the strongest action
   - why the feed can be trusted
2. `Post a Need` is visible without scrolling on small phones.
3. Trusted activity is visually distinct from public nearby content.
4. Feed surfaces switch instantly with no layout jump.
5. No card overflows on 320px wide devices.
6. Save and hide actions work optimistically.
7. Pull-to-refresh reloads:
   - all feed
   - connected feed
   - people
8. Partial data failure shows a warning card, not a blank screen.
9. Trusted empty state routes to `People`.
10. `Earn` shows demand-first cards.
11. Long titles and descriptions truncate gracefully.
12. Home remains usable with:
   - no connections
   - no nearby feed
   - no provider recommendations
13. No screen uses decorative clutter that competes with action clarity.
14. `flutter analyze` passes.
15. `flutter test` passes.

## 9. Files implemented

- `mobile/lib/features/welcome/presentation/welcome_page.dart`
- `mobile/lib/core/theme/app_theme.dart`
- `mobile/lib/features/home/presentation/home_shell_page.dart`
- `mobile/test/widget_test.dart`
