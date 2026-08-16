# ServiQ Mobile — Full Product Audit (Phase 1)

Scope: every screen in `mobile/lib/features/**/presentation/**` plus shared
components and the app shell. Each finding is rated **Critical / High /
Medium / Low**. Line numbers are from the files at time of audit (Aug 14).

- [Executive summary](#executive-summary)
- [Critical findings](#critical-findings)
- [High findings](#high-findings)
- [Medium findings](#medium-findings)
- [Low findings](#low-findings)
- [Cross-cutting matrix by screen](#cross-cutting-matrix-by-screen)
- [Verified bugs (behavioral)](#verified-bugs-behavioral)

---

## Executive summary

The current UI is a prototype that has accumulated **14+ bespoke "provider
card" variants, 3 competing pill systems, 3 duplicate hero implementations, 4
checklist-row copies, and hundreds of hardcoded spacing/text-style values** —
the exact opposite of a calm, scalable, premium system. The design-token
foundation (`AppSpacing`, `AppRadii`, `AppColors`, `AppShadows`) is strong, and
5 screens (listing detail, launchpad review, listings, onboarding, storefront)
are near-conformant. The remaining screens are where the debt lives.

The most damaging structural problems:

1. **6 provider-card variants** show different facts for the same entity.
2. **Trust/verification is scattered and color-drifted** (green vs blue vs navy).
3. **The provider profile repeats the name twice** and buries trust below the fold.
4. **The home screen is a ~1200px control stack** before the first card.
5. **6 provider destinations are dead routing no-ops** (redirect back to profile).
6. **Dozens of sub-48px touch targets and fixed font sizes** break accessibility.
7. **Verified behavioral bugs**: fake "Redirecting to order..." copy, silent
   auto-scroll that breaks "load older" in chat, `maxLines:20` message
   truncation, shareable search controller across conversations.

---

## Critical findings

| # | Area | Finding |
|---|------|---------|
| C-1 | Navigation | **6 provider destinations are dead ends**: analytics, payouts, referrals, workspaces redirect `→ profile` (`app_router.dart:290-291, 302-303, 282-283, 274-275`); boosts/subscriptions redirect `→ profile` (`342-343, 346-347`) but the profile hub and control page still render entry tiles (`profile_page.dart:480,488,540,572`, `control_page.dart:506-517`). Tap = "nothing happens." |
| C-2 | Commerce | `quote_comparison_page.dart:120` shows "Quote accepted! Redirecting to order..." but **no navigation is ever called** (`_acceptQuote` at 33-48 only sets `_acceptedId` + toast). False promise copy. |
| C-3 | Chat | Unconditional `jumpTo(maxScrollExtent)` on every thread rebuild (`chat_page.dart:1144-1145`) **breaks "load older"** — the list always snaps back to the bottom. |
| C-4 | Chat | Messages capped at `maxLines: 20` with silent truncation (mine + theirs) (`chat_page.dart:1426, 1535`). Long messages are destroyed with no affordance. |
| C-5 | Data loss | `report_sheet.dart:91` allows submitting "Other" with an empty description. |

## High findings

| # | Area | Finding |
|---|------|---------|
| H-1 | Consistency | 6 near-duplicate provider-card variants: `ProviderCard` (`provider_card.dart:9-100`), `ProviderDirectoryCard` (`provider_card.dart:~240-346`), `MarketplaceProviderCard` (`marketplace_provider_card.dart`), `_ProviderResultCard` (`search_page.dart`), `_GlassMapTile` (`map_discovery_page.dart`), `_CompareRow` (`people_page.dart:1012-1110`), `_ProviderDetailSheet` (`marketplace_landing_page.dart:728-872`). Different field sets + label vocabulary per surface. |
| H-2 | Consistency | 3 competing pill systems (`TrustBadge`, `AppPill`, `PremiumPill`) + 8 bespoke pill copies (`_TypePill`, `_InlinePill`, `_TrustChip`, `_OverlayPill`, `_AvailabilityPill`, `_GlassPill`, `_SignalChip`, `_DirectoryMetaPill`). Two status-pill systems too. |
| H-3 | Color | Verified/trust color is **green** (`marketplace_provider_card.dart:118-141`, `trust_badge.dart`), **blue** (`listing_detail_page.dart`, `AppColors.verified`), **navy** (`search_page.dart`) depending on surface. |
| H-4 | Hierarchy | Provider profile hero renders the **name twice** (`provider_profile_page.dart:821-827` hero + `850-854` avatar tile) with two different subtitles. |
| H-5 | Trust | Trust is split across 3 places (`TrustBadge` hero 860, "Trust" MetricTile 1047-1052, "Trust proof" card ~267), none prominent. The single most conversion-relevant signal (X% job completion · Y repeats · verified) has no dominant statement. |
| H-6 | a11y | Provider hero pills use **white text on white 25% alpha glass** (`provider_profile_page.dart:799-814`) — contrast well below 4.5:1 on light imagery. |
| H-7 | a11y | Search chips 28px (`search_page.dart:570`), dropdown 32px (`619`), filter chips 32px (`667`) — all below the 48px minimum. Fixed `fontSize: 9-13` ignores text scale. |
| H-8 | a11y | Map marker tap target 36×36 (`map_discovery_page.dart:130-131`). |
| H-9 | UX | Search `_doSearch` awaits `userLocationProvider.future` (`search_page.dart:143`) with **no timeout — hangs silently offline**. |
| H-10 | Density | Feed page: 4 top-bar actions + hero + search + category chips + scope chips + locality + filter chips + AI bar + zones card ≈ **1200px of controls** before the first card (`feed_page.dart:633-666`). |
| H-11 | Deception | Feed "Load more" is fake — reveals already-fetched items after `Future.delayed(300ms)` (`feed_page.dart:122-138`). No server pagination. |
| H-12 | Dark mode | `_ControlHero` uses `colorScheme.onSurface` as background + white text (`control_page.dart:188-199`) → white-on-near-white in dark mode. |
| H-13 | Dead code | `PayoutStatusChip` + `PayoutSummaryCard` (`payouts/presentation/`) are orphans — never referenced. |
| H-14 | Dead logic | `FeedCard._effectivePrimaryLabel` (`feed_card.dart:39-50`) is unreachable — every caller overrides `primaryLabel` with a different scheme (`feed_page.dart:585-599`, `provider_profile_page.dart:1538-1542`, `feed_page.dart:601-606`). |
| H-15 | Redundancy | `_CategoryCard` (`marketplace_landing_page.dart:547-622`) duplicates `service_category_grid.dart` `_GlassCategoryCard` incl. the `_defaultCategories` list. |
| H-16 | Redundancy | `_ProviderDetailSheet` (`marketplace_landing_page.dart:728-872`) is a 3rd full provider-profile representation alongside `ProviderProfilePage` and `PublicBusinessPage`. |
| H-17 | UX | `quote_room_page.dart:400,441,481` — deal-room sections have **neither loading nor error states** (`SizedBox.shrink()` in both branches). |
| H-18 | Composer | Chat composer `TextEditingController` is shared across conversations (`chat_page.dart:58`) — drafts leak between threads. |
| H-19 | l10n | Only **8 files** use `AppLocalizations`; `orders_page`, `provider_orders_page`, `tasks_page` use it only for the AI-bar placeholder. Every other string in commerce/chat/admin is hardcoded English despite 6 locales. |
| H-20 | Language | Availability timezone `'Asia/Kolkata'` hardcoded in 4 places (`availability_page.dart:12,39`, domain model `8/18`, repository `42`). |

## Medium findings

| # | Area | Finding |
|---|------|---------|
| M-1 | Duplicates | 4 near-identical checklist rows: profile `_ReadinessRow:1806`, control `_ControlChecklistRow:729`, launchpad `_ReadinessItemTile:1218`, onboarding `_ChecklistCard:128` (+ review-page loop 155). |
| M-2 | Duplicates | 2 link/action rows: profile `_ActionRow:2541`, control `_ControlLinkRow:772`. |
| M-3 | Duplicates | 2 gradient-ring-avatar heroes: profile `_ProfileHero:1989`, `_PublicProfilePreviewCard:1345`. |
| M-4 | Duplicates | 2 generated-offering tiles: launchpad `_PreviewTile:1396`, review `_GeneratedItemTile:265`. |
| M-5 | Duplicates | 2 label/detail rows: listing_detail `_DetailRow:634`, provider_profile `_SignalRow:1552`. |
| M-6 | Duplicates | 2 competing section-header components: `shared/widgets/section_header.dart` (`AppSectionHeader`) vs `shared/components/section_header.dart` (`SectionHeader`). One must be deleted. |
| M-7 | Duplicates | 3 raw `DropdownButtonFormField` with non-`AppTextField` decoration: launchpad `_DropdownField:1540`, listings `_SheetDropdown:1017`, verification `277-294`. |
| M-8 | Duplicates | `MarketplaceProviderCard._buildAvatar` (`221-235`) + `public_business_page.dart:226-250` (88px) + map marker re-implement `AppAvatar`'s deterministic initials. |
| M-9 | Duplicates | 2 trust-display systems: `TrustSnapshot` grid (`listing_detail_page.dart:350-376,461-495`) vs `_TrustStrip`/`_TrustChip` (`feed_card.dart:442-475`). |
| M-10 | Typography | verification_page has **12 inline `TextStyle(`** (L194-417), availability **8** (L269-433) — worst per-line debt. |
| M-11 | Spacing | profile_page has **97 numeric `SizedBox`es**; launchpad 38; provider_profile 45; control 30. The Phase-D token sweep stopped at the shared layer. |
| M-12 | Radius | Non-token radii: `circular(14)` (`provider_onboarding_page.dart:140`), `circular(18)` (`profile_page.dart:2822`), radius 24 (`provider_profile_page.dart:900-930`). |
| M-13 | Loading | Inconsistent loading: bare `CircularProgressIndicator` in search 450, map 41, public_business 76, review 78, availability 197 — vs `LoadingShimmer` standard. |
| M-14 | Errors | Bespoke error blocks instead of `ErrorStateView`: provider_profile `164-184`, search `453-477`, availability `200-213` (uses raw `Colors.red`). |
| M-15 | Chat | Custom unread pill (`chat_page.dart:1669-1683`) duplicates `CountBadge`. |
| M-16 | Chat | Quick-reply `ActionChip` sub-48px (`chat_page.dart:1241`). |
| M-17 | People | `connections_page.dart:201` renders a **raw ID fragment** as a connection's name. |
| M-18 | Notifications | Raw `ChoiceChip` instead of `AppFilterChip` (`notifications_page.dart:346`). |
| M-19 | AI bar | Error sheet shows raw `e.toString()` and its Retry only pops the sheet (`ai_prompt_bar.dart:126,134`). |
| M-20 | Auth | `AuthTextField` has `autofillHints` but no `inputFormatters`; OTP/phone fields accept non-digits (`auth_text_field.dart:14/30`, `login_page.dart:236,316,361`). |
| M-21 | Duplicates | Feed card label logic dead — 3 schemes: feed `_primaryLabelFor:585-599`, profile `'Buy'/'Book'/'Request service':1538-1542`, listing `_checkoutLabelFor:601-606`. |
| M-22 | Media | Listing detail renders a **single thumbnail** with "N photos" pill but no carousel (`listing_detail_page.dart:166-206`); feed cards are swipeable. |
| M-23 | Description | Listing description `maxLines: 6` with no "read more" (`listing_detail_page.dart:337`). |
| M-24 | Availability | Provider availability is signals-only — no schedule/time-slot affordance (`provider_profile_page.dart:1094-1143`). |
| M-25 | CTA | Booking CTA duplicated: `StickyBottomCTA` (`provider_profile_page.dart:73-87`) + in-body `PrimaryButton` (`954-958`); sticky repeats hero pill data. |
| M-26 | CTA | "Message" ×3 (sticky 82, square button 961-965, feed cards 1543); "Copy provider" vs "Copy profile" inconsistent labels. |
| M-27 | Landing | Anonymous users hit repeated auth walls (header 168-175, "List Your Business" 471, "Contact" 536, every CTA). Funnel decision needed. |
| M-28 | Landing | Hand-rolled "S" logo + ServiQ (`143-153`) duplicates `ServiqBrandLockup` (`premium_primitives.dart:29-115`). |
| M-29 | Feed | `_ExploreIntentPanel` uses raw `FilterChip` (~1030) while same page uses `FilterChipGroup` (~1105). |
| M-30 | Feed | Locality picker uses raw `showModalBottomSheet` + `fontSize:18` title (`feed_page.dart:156-179`). |
| M-31 | Feed | `_filterItems`/`matchesQuery` client-side filtering (`413-468`) re-implements server filtering. |
| M-32 | Search | Loading/error states inconsistent: bare spinner (450), linear progress (489-491), bespoke glass error card (453-477). |
| M-33 | Map | `withLocation.take(20)` + `withoutLocation.take(20)` silent truncation, no "more" affordance (`map_discovery_page.dart:257`). |
| M-34 | People | `_PeopleDiscoverySummary` reuses `TrustBadge` as a filter chip (785-859) — wrong semantics. |
| M-35 | People | Locality dropdown `height:40` below minimum (~515-548). |

## Low findings

| # | Area | Finding |
|---|------|---------|
| L-1 | a11y | Icon-only affordances without `Semantics`: profile `_HubTile`/`TopActionButton`, report-sheet shield, `_SheetScaffold` drag handle, listing "open seller profile". |
| L-2 | UX | Greeting handler: `_resolveGreetingName` email-base fallback produced "Good afternoon, Dixit4119" — handle-lookalike tokens leak. |
| L-3 | UX | Profile "sync to server" button uses inline spinner + raw `SizedBox` instead of standard button-loading pattern (`profile_page.dart:1591-1599`). |
| L-4 | UX | Recent-search rows show `north_west` icon + delete icon — ambiguous affordance (`search_page.dart:398-413`). |
| L-5 | UX | Map stats show "unmapped" count — internal jargon (`map_discovery_page.dart:224-228`). |
| L-6 | UX | Storefront offer shelf truncates with "+N more" but no in-profile "view all" (`provider_profile_page.dart`). |
| L-7 | Design | `NameplateCard` hardcodes `Color(0xFFD8D4CB)` (`nameplate_card.dart:26-27`). |
| L-8 | Design | Raw alpha hexes: `Color(0x22FFFFFF)`/`Color(0x33FFFFFF)` (`launchpad_page.dart:668/670`), `Color(0x300F766E)` shadow (`profile_page.dart:1420`), `Colors.red` (`availability_page.dart:204`). |
| L-9 | Motion | `MarketplaceLoopHero` stuck at `activeIndex: 0` static (`marketplace_guidance.dart:87`). |
| L-10 | Motion | Fake 300ms load-more (also H-11); map/search transitions absent vs FAB hide-show in shell. |
| L-11 | Robustness | `GlassSurface` dark-mode `UnimplementedError` landmine (`glass_surface.dart:27`). |
| L-12 | Buttons | 14 raw button call sites in profile_page (e.g. `FilledButton.icon` 1232, `OutlinedButton.icon` 2368/2879/3037) instead of shared `PrimaryButton`/`SecondaryButton`. |
| L-13 | Dead code | `_writeReview` `submitting` guard unreachable — busy state never renders (`provider_profile_page.dart:651`). |
| L-14 | Language | Verification document-type labels hardcoded English (`verification_page.dart:100-103`). |
| L-15 | Language | Feed/marketplace strings hardcoded English ("Post Need", "Explore Local Zones", "Urgent nearby"). |
| L-16 | Navigation | "Open seller profile" twice: top-bar (`listing_detail_page.dart:41-50`) + seller-card chevron (`414-420`). |
| L-17 | Reviews | Provider reviews have no aggregate rating breakdown (`provider_profile_page.dart:~1405-1472`). |
| L-18 | Fonts | `fontSize: 9-14` inline in `marketplace_provider_card.dart:108-205`, landing `_CategoryCard:591-613`. |
| L-19 | Chips | Mixed controls: `SegmentedButton` (people 872), `ChoiceChip` (933), custom locality dropdown (515-548). |
| L-20 | Sheets | Bare `showModalBottomSheet` in feed 156, people 179, launchpad — vs `ServiqBottomSheet`. |

---

## Cross-cutting matrix by screen

| Screen | Critical | High | Medium | Low | File |
|---|---|---|---|---|---|
| Profile hub | C-1 | — | M-1,2,3,11,12 | L-1,2,3,12 | `profile_page.dart` (3190 ln) |
| Provider profile | — | H-4,5,6 | M-24,25,26; M-11 | L-6,13,17 | `provider_profile_page.dart` (1655 ln) |
| Provider launchpad | — | — | M-1,5,7 | L-8 | `provider_launchpad_page.dart` (1741 ln) |
| Feed page | — | H-10,11 | M-29,30,31 | L-15 | `feed_page.dart` (1365 ln) |
| Chat page | C-3,4 | H-18 | M-15,16 | — | `chat_page.dart` |
| Quote comparison | C-2 | — | — | — | `quote_comparison_page.dart` |
| Quote room | — | H-17 | — | — | `quote_room_page.dart` |
| Search page | — | H-7,9 | M-32 | L-4 | `search_page.dart` |
| Map discovery | — | H-8 | M-33 | L-5 | `map_discovery_page.dart` |
| Marketplace landing | — | H-15,16 | M-27,28 | L-18 | `marketplace_landing_page.dart` |
| Control page | — | H-12 | M-1,2 | — | `control_page.dart` |
| Verification | — | — | M-7,10 | L-14 | `verification_page.dart` |
| Availability | — | H-20 | M-10,13,14 | L-8 | `availability_page.dart` |
| Listing detail | — | H-3 | M-22,23 | L-16 | `listing_detail_page.dart` |
| People page | — | H-1 | M-34,35 | L-19,20 | `people_page.dart` |
| Report sheet | C-5 | — | — | L-1 | `report_sheet.dart` |
| AI prompt bar | — | — | M-19 | — | `ai_prompt_bar.dart` |
| Connections | — | — | M-17 | — | `connections_page.dart` |
| Notifications | — | — | M-18 | — | `notifications_page.dart` |
| Auth (login/signup) | — | — | M-20 | — | `auth/presentation/` |
| Admin / blocked | — | — | — | L-11 | `admin`, `blocking` |

---

## Verified bugs (behavioral)

1. **Quote accept lies** — `quote_comparison_page.dart:120` "Redirecting to order..." but no navigation.
2. **Chat load-older broken** — unconditional `jumpTo(maxScrollExtent)` (`chat_page.dart:1144-1145`).
3. **Message truncation** — `maxLines: 20` (mine + theirs) silently drops content (`1426, 1535`).
4. **Composer draft leak** — shared controller across conversations (`chat_page.dart:58`).
5. **Report "Other" empty submit** — no validation (`report_sheet.dart:91`).
6. **6 dead provider destinations** — tiles that redirect to profile (C-1).
7. **`_ControlHero` dark-mode white-on-white** (`control_page.dart:188-199`).
8. **`_writeReview` busy state unreachable** (`provider_profile_page.dart:651`).

---

Next phase: see [MOBILE_IA_REDESIGN.md](MOBILE_IA_REDESIGN.md) for the
information-architecture remediation and [MOBILE_DESIGN_SYSTEM.md](MOBILE_DESIGN_SYSTEM.md) for the
token-level fix plan that this audit drives.
