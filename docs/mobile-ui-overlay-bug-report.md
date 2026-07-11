# Mobile UI Overlay Bug Report

**Date:** 2026-07-11  
**Investigator:** opencode (read-only audit)  
**Scope:** serviqapp.com mobile web views (Home, Market/Explore Markets, Market Zone pages)  
**Viewport tested against:** ~390px wide (Chrome Android)

---

## Executive Summary

Four distinct but related visual bugs were identified across the Home, Market/Explore, and Market Zone pages. **Three share a single root cause**: hardcoded `bg-white/*` Tailwind classes that do not adapt to dark mode, creating semi-transparent white overlays that wash out dark-theme text and card content. The fourth (bottom nav clipping) is a separate padding/safe-area issue.

**Confidence ranking:**

| # | Issue | Confidence | Root cause |
|---|-------|------------|------------|
| 1 | Faded/ghosted text on all pages | **HIGH (95%)** | Hardcoded `bg-white/*` in dark mode |
| 2 | Header "collision" on Home page | **HIGH (90%)** | Semi-transparent header + missing `scroll-padding-top` |
| 3 | Card overlap on Market page | **MEDIUM (70%)** | Sticky header negative margins + semi-transparent background |
| 4 | Bottom nav clipping on Home page | **HIGH (85%)** | Missing `env(safe-area-inset-bottom)` in page padding |

---

## Issue 1: Faded / Ghosted Text Rendering (All Pages)

### Symptom
Zone name pills, logo text, card text, and section headers render with a washed-out, low-contrast, semi-transparent appearance — as if a translucent white layer is sitting on top of content.

### Root Cause
The app supports dark mode via a `.dark` class on `<html>` (`app/globals.css:73`). Dark mode redefines CSS custom properties (e.g., `--surface-app: #0e1217`, `--ink-950: #e6edf5`). However, **43+ components** use hardcoded `bg-white/*` classes instead of CSS variable-based surfaces. In dark mode, `bg-white/95` renders as a 95%-opaque white layer on top of the dark background, creating a frosted-glass effect that **reduces contrast of all text and elements behind it**.

This explains why "Live" / "Coming Soon" badges (which use opaque colored backgrounds like `bg-emerald-100`) render at full contrast while zone name text (which relies on text color contrast against the semi-transparent white background) appears ghosted.

### Evidence — Affected Components

#### Sticky Headers (all 3 pages use identical pattern)
| Page | File | Line | Class |
|------|------|------|-------|
| Home (`/`) | `app/components/landing/LandingPageClient.tsx` | 249 | `bg-white/95 backdrop-blur-md` |
| Market (`/market`) | `app/market/page.tsx` | 28 | `bg-white/95 backdrop-blur-md` |
| Market Zone (`/market/zone/[slug]`) | `app/components/market/MarketZonePage.tsx` | 142 | `bg-white/95 backdrop-blur-md` |

#### Bottom Navigation Bar
| File | Line | Class |
|------|------|-------|
| `app/components/MobileBottomNav.tsx` | 68 | `bg-white/98 backdrop-blur-none` |

#### Zone Cards (Explore Markets `/market`)
| File | Line | Class | Note |
|------|------|-------|------|
| `app/market/page.tsx` | 68 | `bg-white` | Zone card links — fully opaque white, not CSS variable |

#### Dashboard Hero Zone Pills (Dashboard `/dashboard`)
| File | Line | Class |
|------|------|-------|
| `app/dashboard/components/DashboardHero.tsx` | 39 | `bg-gradient-to-br from-[var(--brand-50)] to-white` |
| `app/dashboard/components/DashboardHero.tsx` | 68 | `bg-[var(--brand-100)]/80` (zone pill, 80% opacity) |
| `app/dashboard/components/DashboardHero.tsx` | 106 | `bg-white/70` (active filter bar) |
| `app/dashboard/components/DashboardHero.tsx` | 98 | `bg-white` (button) |

#### ZoneBrowser Component
| File | Line | Class |
|------|------|-------|
| `app/components/locality/ZoneBrowser.tsx` | 68 | `bg-white` (loading skeleton tabs) |
| `app/components/locality/ZoneBrowser.tsx` | 94 | `bg-white` (tab bar container) |
| `app/components/locality/ZoneBrowser.tsx` | 139 | `bg-white` (individual locality cards) |

#### ZoneSwitcher Component
| File | Line | Class |
|------|------|-------|
| `app/components/market/ZoneSwitcher.tsx` | 45 | `bg-white` (trigger button) |
| `app/components/market/ZoneSwitcher.tsx` | 53 | `bg-white` (dropdown panel) |

#### ServiQLogo Mark
| File | Line | Class |
|------|------|-------|
| `app/components/ServiQLogo.tsx` | 41 | `bg-[radial-gradient(circle_at_top_left,#ffffff_12%,#ecfeff_58%,#dbeafe_100%)]` (hardcoded light gradient) |
| `app/components/ServiQLogo.tsx` | 58 | `border-white` (dot border, hardcoded) |
| `app/components/ServiQLogo.tsx` | 88 | `border-white` (dot border, hardcoded) |

#### Other Components on Public Pages
| File | Line | Class |
|------|------|-------|
| `app/components/PageContextStrip.tsx` | 14 | `bg-white/92` |
| `app/components/prompt/DashboardPromptContext.tsx` | 398 | `bg-white/95` |
| `app/dashboard/layout.tsx` | 853 | `bg-white/96` (mobile header) / `bg-white/92` (md+) |
| `app/components/profile/ProfileSectionCard.tsx` | 19 | `bg-white/90` |
| `app/components/profile/ProfileStickySaveBar.tsx` | 53 | `bg-white/92` |
| `app/components/profile/OnboardingGuard.tsx` | 42 | `bg-white/90` |

### Why It Looks Like a Loading State
The faded appearance closely matches what these elements look like **while data is loading** — skeleton screens use `bg-slate-100`/`bg-slate-200` with `animate-pulse`, producing a similar low-contrast, washed-out look. The bug essentially makes loaded content look like it's still in a loading/placeholder state.

### Shared Component Path
All three affected pages share:
1. **`AnimatedPage`** (`app/components/motion/AnimatedPage.tsx`) — wraps all page content via `app/layout.tsx:84`. Uses Framer Motion `AnimatePresence` + `PageTransition`. The transition animates from `opacity: 0, y: 12` → `opacity: 1, y: 0` (0.35s). This completes correctly to `opacity: 1` — **not the source of persistent fading**.
2. **`MobileBottomNav`** (`app/components/MobileBottomNav.tsx`) — rendered on all three pages. Uses `bg-white/98`.
3. **`ServiQLogo`** (`app/components/ServiQLogo.tsx`) — rendered in headers on all three pages. Uses hardcoded light gradient.

### Is This Viewport-Specific?
**No — this is universal.** It affects dark mode on all viewport sizes (mobile, tablet, desktop). It is MORE noticeable on mobile because:
- Semi-transparent headers cover a larger proportion of the viewport
- `backdrop-blur-md` rendering varies by browser/engine and can interact poorly with `z-index` stacking on mobile browsers
- Dark mode is more commonly enabled on mobile devices

### Recommended Fix
Replace all hardcoded `bg-white/*` classes with CSS variable-based surfaces:
- `bg-white/95` → `bg-[var(--surface-elevated)]/95` or add dark mode overrides
- `bg-white` → `bg-[var(--surface-elevated)]`
- `bg-white/98` → `bg-[var(--surface-elevated)]/98`
- Add dark mode variants: e.g., `bg-white/95 dark:bg-[#1a2332]/95`
- The ServiQLogo gradient needs dark mode variants for the radial-gradient background
- Total: ~43 files need updates (see full list in the evidence table above)

---

## Issue 2: Header "Collision" on Home Page

### Symptom
The "How ServiQ works" onboarding banner appears to visually collide/overlap with the sticky top nav bar rather than sitting cleanly below it.

### Root Cause (Two Contributing Factors)

#### Factor A: Semi-transparent header reveals content behind it
The sticky header at `app/components/landing/LandingPageClient.tsx:249` uses `bg-white/95 backdrop-blur-md`. This 95%-opaque frosted-glass effect means the "How it works" banner content is **partially visible through the header** when the page is scrolled or during the initial page-load animation. This creates a visual "collision" where two layers of content appear to occupy the same space.

#### Factor B: Missing `scroll-padding-top`
The `<html>` element (`app/globals.css:123-125`) sets `scroll-behavior: smooth` but does NOT set `scroll-padding-top`. The sticky header is ~52px tall (py-3 + content). When anchor links or programmatic scrolling targets content near the top, the browser does not account for the sticky header offset, causing content to scroll partially behind it.

**File:** `app/globals.css`  
**Line:** 123-125 (html styles)  
**Missing:** `scroll-padding-top` equivalent to header height (~52-56px on mobile)

### Evidence
| File | Line | Detail |
|------|------|--------|
| `app/components/landing/LandingPageClient.tsx` | 249 | `sticky top-0 z-30 ... bg-white/95 backdrop-blur-md` |
| `app/components/landing/LandingPageClient.tsx` | 282 | "How it works" banner: `relative mt-4` — no z-index, sits below header in stacking context |
| `app/globals.css` | 123-125 | `html { scroll-behavior: smooth; }` — no `scroll-padding-top` |

### Is This Viewport-Specific?
**Universal** — affects all viewports. More pronounced on mobile due to smaller viewport proportion.

### Recommended Fix
1. Add `scroll-padding-top` to `html` in `globals.css` matching the sticky header height:
   ```css
   html {
     scroll-behavior: smooth;
     scroll-padding-top: 3.5rem; /* ~56px, matching header height */
   }
   ```
2. Fix the `bg-white/95` dark mode issue (see Issue 1) to eliminate the transparency-based visual collision.

---

## Issue 3: Card Overlap on Market Page

### Symptom
On the Market/dashboard page, two card-like sections appear to stack/overlap rather than sitting in normal document flow.

### Root Cause

#### On `/market` page (`app/market/page.tsx`)
The sticky header uses **negative horizontal margins** (`-mx-4 mb-6`) to achieve a full-bleed effect:

```tsx
<header className="sticky top-0 z-30 -mx-4 mb-6 border-b ... bg-white/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
```

**File:** `app/market/page.tsx`  
**Line:** 28

The `-mx-4` extends the header 16px beyond each side of its parent container. Combined with `bg-white/95 backdrop-blur-md`, this creates a **full-bleed semi-transparent panel** that visually overlaps with the zone cards below it when scrolling. The `mb-6` (24px) margin below the header may be insufficient to prevent visual overlap, especially when the semi-transparent background reveals the card content underneath.

#### On `/dashboard` page (`app/dashboard/components/DashboardHero.tsx`)
The DashboardHero has `pointer-events-none absolute inset-0 overflow-hidden` with a `motion.div` at `absolute -inset-32 opacity-20` (lines 40-57). This animated radial gradient overlay has `opacity-20` and extends 32 units beyond each edge (clipped by `overflow-hidden`). While properly contained, on certain viewports the combination of:
- The hero card's `bg-gradient-to-br from-[var(--brand-50)] to-white` (hardcoded light)
- The animated gradient at `opacity-20`
- The section below with `bg-white` buttons

...creates a visual impression of overlapping cards, especially in dark mode where the light backgrounds contrast sharply with the dark page background.

### Evidence
| File | Line | Detail |
|------|------|--------|
| `app/market/page.tsx` | 28 | `-mx-4 mb-6` negative margins on sticky header |
| `app/market/page.tsx` | 63-107 | Zone card grid starts immediately after header's mb-6 |
| `app/dashboard/components/DashboardHero.tsx` | 39 | Hero card: `bg-gradient-to-br from-[var(--brand-50)] to-white` |
| `app/dashboard/components/DashboardHero.tsx` | 40-56 | `absolute -inset-32 opacity-20` animated gradient |
| `app/dashboard/components/DashboardHero.tsx` | 98 | CTA button: `bg-white` (hardcoded) |

### Is This Viewport-Specific?
**Primarily mobile.** The negative margins (`-mx-4`) on the header cause it to extend beyond the parent's padding, which is more visible on narrow viewports. On desktop (`sm:-mx-6`), the larger parent container and wider viewport make the overlap less noticeable.

### Recommended Fix
1. Remove negative margins from the sticky header and use a full-bleed technique that doesn't create visual overlap:
   - Option A: Use `w-screen` with `relative left-1/2 -translate-x-1/2` instead of `-mx-4`
   - Option B: Move the full-bleed effect to a wrapper div that doesn't have a sticky position
2. Replace `bg-white/95` with CSS variable-based dark mode background (see Issue 1)
3. Ensure the `mb-6` (or appropriate margin) provides sufficient visual separation

---

## Issue 4: Bottom Nav Clipping on Home Page

### Symptom
Bottom content (category pills, footer) appears cut off / hidden behind the fixed bottom navigation bar rather than having proper bottom padding or safe-area spacing.

### Root Cause

The `MobileBottomNav` is `fixed inset-x-0 bottom-0` (`app/components/MobileBottomNav.tsx:68`). Its inner grid has:
```css
padding-bottom: calc(env(safe-area-inset-bottom) + 0.5rem);
```

This means the nav's **total visual height** includes the safe-area-inset-bottom (typically ~34px on iPhone with home indicator). On such devices:
- Nav visual height: ~65px (content) + ~34px (safe area) = **~99px**

The page content padding:
- LandingPageClient root div: `pb-24` = **96px** (`app/components/landing/LandingPageClient.tsx:247`)
- Inner `<main>`: `pb-16` = **64px** (`app/components/landing/LandingPageClient.tsx:279`)

**96px < 99px** — the page padding is 3px short of clearing the bottom nav on iPhone with home indicator. On devices with larger safe areas (e.g., iPad with home button: ~20px, newer iPhones: ~34px), the gap varies.

Additionally, the page padding does NOT use `env(safe-area-inset-bottom)` at all — the `pb-24` is a fixed value that doesn't adapt to the device's safe area.

### Evidence
| File | Line | Detail |
|------|------|--------|
| `app/components/landing/LandingPageClient.tsx` | 247 | `pb-24 lg:pb-0` — fixed 96px, no safe-area accounting |
| `app/components/landing/LandingPageClient.tsx` | 279 | `<main>` with `pb-16` — fixed 64px |
| `app/components/MobileBottomNav.tsx` | 68 | `fixed inset-x-0 bottom-0` — positioned at viewport bottom |
| `app/components/MobileBottomNav.tsx` | 72 | `[padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]` — nav accounts for safe area |
| `app/layout.tsx` | 55-57 | `viewportFit: "cover"` — enables safe area insets |

### Is This Viewport-Specific?
**Mobile-only.** The `MobileBottomNav` has `md:hidden` so it only renders below 768px. The safe-area-inset-bottom varies by device:
- iPhone with home indicator: ~34px (most affected)
- Android with gesture navigation: ~0-20px
- Desktop: 0px (nav not visible)

### Recommended Fix
Update the page bottom padding to account for `env(safe-area-inset-bottom)`:

On `LandingPageClient.tsx:247`:
```tsx
// Before:
<div className="relative min-h-screen bg-[var(--surface-elevated)] pb-24 lg:pb-0">

// After:
<div className="relative min-h-screen bg-[var(--surface-elevated)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
```

Apply the same pattern to other pages that render `MobileBottomNav`:
- `app/market/page.tsx:26` — currently `pb-20`
- `app/components/market/MarketZonePage.tsx:141` — currently `pb-20`

---

## Dark Mode Activation Path

The dark mode theme is activated by this inline script in `app/layout.tsx:69-71`:

```javascript
(function(){
  try{
    var t=localStorage.getItem("serviq-theme");
    if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme:dark)").matches)){
      document.documentElement.classList.add("dark")
    }
  }catch(e){}
})();
```

This runs `beforeInteractive` (before React hydration). Users whose OS/system preference is dark mode, or who have previously selected dark mode, will have the `.dark` class on `<html>` — triggering all the CSS variable overrides while the hardcoded `bg-white/*` classes remain unchanged.

---

## Files Modified

**Zero files were modified during this investigation.** This was a read-only audit. (Verified via `git diff --stat` — see below.)

---

## Recommended Priority Order

1. **Issue 1 (Faded text)** — Highest impact, affects all pages, single systematic fix (replace `bg-white/*` with CSS variable surfaces or add dark mode variants). ~43 files to update.

2. **Issue 4 (Bottom nav clipping)** — Simple fix, affects mobile usability. Update `pb-*` classes to include `env(safe-area-inset-bottom)`. ~3 files.

3. **Issue 2 (Header collision)** — Add `scroll-padding-top` to `html` in `globals.css`. Single-line fix.

4. **Issue 3 (Card overlap)** — Refactor negative margin technique on sticky headers. Moderate complexity.

---

## Appendix: Full List of `bg-white/*` Instances (43+ files)

The following files contain hardcoded `bg-white/*` classes that will render incorrectly in dark mode. This is not exhaustive but covers the highest-impact instances on public-facing pages:

| File | Line(s) | Class |
|------|---------|-------|
| `app/components/landing/LandingPageClient.tsx` | 249 | `bg-white/95` |
| `app/market/page.tsx` | 28 | `bg-white/95` |
| `app/components/market/MarketZonePage.tsx` | 142 | `bg-white/95` |
| `app/components/MobileBottomNav.tsx` | 68 | `bg-white/98` |
| `app/market/page.tsx` | 52, 68 | `bg-white` |
| `app/components/locality/ZoneBrowser.tsx` | 68, 94, 139 | `bg-white` |
| `app/components/market/ZoneSwitcher.tsx` | 45, 53 | `bg-white` |
| `app/components/ServiQLogo.tsx` | 41, 58, 88 | hardcoded white gradient/borders |
| `app/components/PageContextStrip.tsx` | 14 | `bg-white/92` |
| `app/dashboard/layout.tsx` | 853 | `bg-white/96` |
| `app/dashboard/components/DashboardHero.tsx` | 39, 98, 106 | `to-white`, `bg-white`, `bg-white/70` |
| `app/dashboard/tasks/page.tsx` | 2962, 2990, 2991, 2994, 3015, 3020, 3029, 3065 | `bg-white/88`, `bg-white/90`, `bg-white/92` |
| `app/dashboard/chat/page.tsx` | 1358, 1552, 1649 | `bg-white/90`, `bg-white/85` |
| `app/components/prompt/DashboardPromptContext.tsx` | 398 | `bg-white/95` |
| `app/components/profile/ProfileSectionCard.tsx` | 19 | `bg-white/90` |
| `app/components/profile/ProfileStickySaveBar.tsx` | 53 | `bg-white/92` |
| `app/components/profile/OnboardingGuard.tsx` | 42 | `bg-white/90` |
| `app/components/profile/ProfileCompletionChecklist.tsx` | 12 | `bg-white/90` |
| `app/components/profile/MarketplaceReadinessPanel.tsx` | 61 | `bg-white/85` |
| `app/components/profile/PublicProfilePostsGrid.tsx` | 141, 165, 178 | `bg-white/95`, `bg-white/90` |
| `app/components/map/LiveTaskOverlay.tsx` | 217 | `bg-white/90` |
| `app/components/CreatePostModal.tsx` | 573, 825, 828 | `bg-white/90`, `bg-white/80` |
| `app/components/quotes/QuoteRoom.tsx` | 280 | `bg-white/95` |
| `app/components/quotes/QuoteDraftEditor.tsx` | 212 | `bg-white/95` |
| `app/dashboard/people/components/PeopleLiveHeader.tsx` | 131, 193 | `bg-white/98`, `bg-white/93` |
| `app/dashboard/people/components/PeopleSearchFilters.tsx` | 41 | `bg-white/90` |
| `app/dashboard/people/components/PeopleMapPanel.tsx` | 74 | `bg-white/[0.88]` |
| `app/dashboard/people/components/ConnectionsPanel.tsx` | 94 | `bg-white/85` |
| `app/dashboard/components/posts/FeedMediaCarousel.tsx` | 70, 89, 97 | `bg-white/95`, `bg-white/90` |
| `app/dashboard/components/SavedFeedView.tsx` | 825, 850 | `bg-white/80`, `bg-white/85` |
