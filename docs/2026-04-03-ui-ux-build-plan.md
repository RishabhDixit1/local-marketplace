# April 3 Build Plan: UI/UX + Logic Fixes

## Goal

Ship one high-leverage feature that reduces confusion and trust hesitation, while fixing the logic regressions that make the product feel unreliable.

## What We Learned From The Current Repo

- The product is strong on breadth, but the main journeys are split across multiple mental models:
  - `Welcome` = connected network feed
  - `Explore` = wider marketplace feed
  - `People` = provider discovery
  - `Tasks` = operational follow-through
- Trust exists in the product, but it is fragmented across cards, the trust panel, public profile pages, readiness banners, and business pages instead of being visible at the moment of decision.
- Overlay and layering behavior is brittle:
  - there are many ad-hoc fixed overlays and z-index values across dashboard, notifications, profile modals, store drawers, map view, and trust panels
  - current values range from low modal stacks like `z-[90]` to full-screen map at `z-[9000]`
- Current logic drift is real even though the app builds successfully:
  - `npm run build` passes
  - `npm run test:unit` currently fails in notification routing and product listing validation
- Some route surfaces are carrying too much responsibility:
  - `app/dashboard/tasks/page.tsx` is over 3,100 lines
  - `app/dashboard/people/page.tsx` is over 1,700 lines
  - `app/dashboard/welcome/page.tsx` is over 1,400 lines

## Today's Feature

### Feature Name

Marketplace Clarity Layer

### Why This Feature Next

This is the fastest feature that improves:

- confusion about where the user is
- trust at the moment of action
- visibility of next steps
- conversion from browse -> connect -> accept -> task

### What It Includes

1. Add a clear page-context strip to `Welcome`, `Explore`, `People`, and `Tasks`.
   - one sentence explaining what this screen is for
   - one primary next action
   - one secondary switch action when a nearby surface is more relevant

2. Add a compact trust snapshot on decision cards.
   - verification level
   - response speed
   - completed jobs / reviews
   - location accuracy label where relevant

3. Add a consistent "What happens next" state explainer.
   - after connect
   - after accept
   - after quote
   - after notification deep-link

4. Reduce hidden mode-switching.
   - make the difference between connected feed and marketplace feed explicit
   - avoid sending users into another route without context

## Must-Fix Bugs Today

### P0 Logic

- Fix notification deep-link and CTA contract drift in `lib/notifications.ts`.
  - help request actions, connection request actions, and demo notification assumptions need a single current contract
- Fix product image validation drift in `lib/provider/listings.ts`.
  - invalid strings are currently treated like acceptable image paths
- Re-run and make green:
  - `tests/unit/notifications.test.ts`
  - `tests/unit/provider-listings.test.ts`

### P1 UX Reliability

- Audit all notification destinations so the user always lands on a meaningful focused state.
- Make empty states and fallback copy more action-oriented instead of just descriptive.
- Tighten task status wording so inbox, accepted, in progress, completed, and cancelled feel like one system.

### P1 Layering

- Introduce shared layer tokens for overlays, drawers, toasts, panels, and fullscreen experiences.
- Normalize modal stacking so trust panel, notification center, create post modal, cart drawer, and global map cannot overlap unpredictably.

## Implementation Order

1. Stabilize logic contracts.
   - fix notification action mapping
   - fix product image validation
   - update tests to match intended current behavior only where product behavior is deliberate

2. Add shared UI primitives.
   - page-context strip
   - trust snapshot row
   - layer/z-index constants

3. Apply the clarity layer to the core routes.
   - `app/dashboard/welcome/page.tsx`
   - `app/dashboard/page.tsx`
   - `app/dashboard/people/page.tsx`
   - `app/dashboard/tasks/page.tsx`

4. Clean overlay behavior.
   - `app/dashboard/layout.tsx`
   - `app/components/NotificationCenter.tsx`
   - `app/components/ProviderTrustPanel.tsx`
   - `app/components/CreatePostModal.tsx`
   - store/profile modal surfaces

5. Verify.
   - `npm run test:unit`
   - targeted route smoke check
   - mobile layering pass

## Concrete Acceptance Criteria

- A user can tell within 3 seconds whether they are in `Welcome`, `Explore`, `People`, or `Tasks`.
- A user can see why a provider is trustworthy before they open profile or chat.
- Notification taps always land on the expected focused state.
- No modal or drawer is hidden behind another overlay on mobile.
- Unit tests pass for notifications and provider listings.

## Out Of Scope For Today

- Launchpad expansion
- new AI generation flows
- team workspaces
- deep lead scoring
- payment settlement work
- major map animation redesign

## Recommended Build Slice For This Session

If we want the highest-value slice first, build in this order:

1. notification routing fix
2. product image validation fix
3. shared context strip
4. trust snapshot on People + Explore cards
5. z-index/layer cleanup for top overlays

## Success Signal

By the end of this slice, the product should feel less like multiple powerful features sitting side by side, and more like one guided marketplace flow with visible trust and obvious next steps.
