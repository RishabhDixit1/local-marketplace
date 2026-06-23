# UI/UX Audit — Local Marketplace

## File Overview

| File | Lines | Type | Role |
|------|-------|------|------|
| `app/dashboard/layout.tsx` | 1111 | Layout | Shell: sidebar nav, top header, mobile bottom nav, FAB, user menu, modals |
| `app/dashboard/page.tsx` | ~900 | Page | Feed: saved feed + hero + posts |
| `app/dashboard/people/page.tsx` | 225 | Page | People discovery with locality filter |
| `app/dashboard/providers/page.tsx` | 516 | Page | Provider grid with ProviderCard |
| `app/dashboard/orders/page.tsx` | 570 | Page | Order management (incoming/outgoing tabs, status badges) |
| `app/dashboard/chat/page.tsx` | 2054 | Page | Monolithic real-time chat (inbox, messages, LiveTalk, quotes) |
| `app/dashboard/notifications/page.tsx` | 48 | Page | Thin wrapper around NotificationCenter |
| `app/dashboard/analytics/page.tsx` | 442 | Page | Recharts dashboards (earnings, funnel, pricing, top customers) |
| `app/dashboard/subscriptions/page.tsx` | 278 | Page | Razorpay plan listing + subscription management |
| `app/dashboard/boosts/page.tsx` | 227 | Page | Boost placement purchase & tracking |
| `app/market/layout.tsx` | 417 | Layout | Market-specific shell (nav, hero, footer) |
| `app/search/page.tsx` | ~540 | Page | Universal search with filters + results grid |
| `app/components/MobileBottomNav.tsx` | 101 | Component | Standalone mobile nav (duplicated in layout) |
| `app/components/NotificationCenter.tsx` | 486 | Component | Live notification feed with real-time |
| `app/components/market/MarketAiBar.tsx` | 380 | Component | Floating AI assistant with chat overlay |
| `app/components/CookieConsentBanner.tsx` | 379 | Component | Cookie banner |
| `app/dashboard/components/CreatePostModal.tsx` | 572 | Component | Post creation modal with image upload |
| `app/dashboard/components/DashboardHero.tsx` | 203 | Component | Welcome hero with dynamic content |
| `app/dashboard/components/SavedFeedView.tsx` | ~1180 | Component | Feed view with saved/recommended items |
| `app/dashboard/components/posts/FeedCard.tsx` | ~570 | Component | Feed post card with rich interactions |
| `app/dashboard/people/components/ConnectionsPanel.tsx` | ~145 | Component | Connection requests panel |
| `app/dashboard/people/components/ProviderCard.tsx` | ~265 | Component | Provider profile card |

---

## Key Findings

### 1. Z-Index Layer Architecture

The app uses CSS custom properties for z-index layering, defined in `app/globals.css`:

| Variable | Purpose |
|----------|---------|
| `--layer-mobile-nav` | Mobile bottom nav |
| `--layer-floating-action` | FAB, MarketAiBar trigger |
| `--layer-popover-backdrop` | Backdrops for user menu, mobile "more" |
| `--layer-popover` | User menu, mobile "more" panel |
| `--layer-modal` | Logout confirmation |
| `--layer-toast` | Toast notifications (SavedFeedView) |
| `--layer-tooltip` | (defined but not observed in scanned files) |
| `--layer-dropdown` | (defined but not observed in scanned files) |
| `--layer-dialog` | (defined but not observed in scanned files) |

**Status:** Good system in place. Verify all layered surfaces use these variables rather than raw z-index values.

---

### 2. Fixed Positioning — 8 instances in `dashboard/layout.tsx`

| Element | Layer | Breakpoint Behavior |
|---------|-------|-------------------|
| User menu backdrop | `--layer-popover-backdrop` | Full screen |
| User menu panel | `--layer-popover` | Desktop: anchored; Mobile: inset-x-3 |
| FAB "Post Need" | `--layer-floating-action` | bottom-4 right-4 → md:bottom-6 md:right-6 |
| Mobile bottom nav | `--layer-mobile-nav` | hidden on md+ |
| Mobile "More" backdrop | `--layer-popover-backdrop` | md:hidden |
| Mobile "More" panel | `--layer-popover` | md:hidden |
| Logout confirm modal | `--layer-modal` | Centered flex, backdrop-blur |

**MarketAiBar** (`market/MarketAiBar.tsx:151`): `fixed bottom-24 right-4 z-[var(--layer-floating-action)]` — overlaps with dashboard FAB area.

**MobileBottomNav** (`components/MobileBottomNav.tsx:57`): Duplicate of layout's inline version. Layout inlines a nearly identical nav at line 984. The standalone component appears unused or is legacy.

---

### 3. Border Radius Inconsistency (high churn)

The codebase uses a mix of Tailwind defaults and arbitrary values:

| Value | Example Files | Frequency |
|-------|--------------|-----------|
| `rounded-2xl` | layout (FAB, menu items, modals), search page, ProviderCard buttons | Very frequent |
| `rounded-[1.6rem]` | layout (user menu), FeedCard | Moderate |
| `rounded-[1.45rem]` | ConnectionsPanel, ProviderCard | Moderate |
| `rounded-[1.35rem]` | FeedCard | Occasional |
| `rounded-3xl` | SavedFeedView sections, layout borders | Frequent |
| `rounded-[28px]` | Logout modal | 1 use |
| `rounded-[1.2rem]` | FeedMediaCarousel, ConnectionsPanel items | Occasional |
| `rounded-[1.15rem]` | FeedCard quote section | 1 use |
| `rounded-[2rem]` | ProviderCard | 1 use |
| `rounded-xl` | Search page filters, layout sidebar items | Frequent |

**Recommendation:** Define a radius scale as CSS variables (e.g., `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`) and migrate arbitrary values to the scale.

---

### 4. Responsive Breakpoint Usage

The `sm:` prefix is used **heavily** (609+ matches across app/), with good mobile-first patterns:
- `sm:flex-row`, `sm:hidden`, `sm:inline` for layout reflow
- `sm:text-*`, `sm:p-*` for spacing/type scaling
- `sm:grid-cols-2` for responsive grids

The `md:` prefix is used for sidebar visibility, header styling, and FAB positioning. The `lg:` prefix is rare (mostly grid columns and transitions).

**Notable:** Layout has a `max-[360px]:` custom breakpoint for extremely small screens (`layout.tsx:865`).

**Pattern:** The codebase consistently uses `pixel-precise` font sizes like `text-[13px]`, `text-[10px]`, `text-[11px]` alongside Tailwind defaults (`text-sm`, `text-xs`). This suggests a desire for fine-grained typography control that the default scale doesn't satisfy.

---

### 5. Scrollbar Hiding Pattern

Both `MarketAiBar.tsx` and `DashboardHero.tsx` use identical scrollbar-hiding CSS:

```tsx
/* Inline <style> tags (e.g., MarketAiBar.tsx:168) */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { scrollbar-width: none; -ms-overflow-style: none; }
```

**Recommendation:** Extract to a global utility class in `globals.css`.

---

### 6. Card Design Fragmentation

Different pages define their own card components with inconsistent radii, shadows, and hover effects:

| Component | Border Radius | Shadow | Hover Effect |
|-----------|--------------|--------|-------------|
| FeedCard | `rounded-[1.35rem]` → sm: `rounded-[1.6rem]` | `shadow-[0_18px_32px_-26px_...]` | `hover:border-[var(--brand-500)]/28 hover:shadow-[0_26px_42px_-28px_...]` |
| ProviderCard | `rounded-[1.45rem]` → sm: `rounded-[1.7rem]` | `shadow-[0_24px_80px_-58px_...]` | (on wrapper only) |
| SavedFeedView items | `rounded-3xl` | `shadow-[0_18px_32px_-26px_...]` | Same as FeedCard |
| People page links | `rounded-2xl` | `shadow-sm` | `hover:border-[var(--brand-300)] hover:shadow-md` |
| Search results | `rounded-2xl` | none | `hover:border-[var(--brand-500)]/30 hover:shadow-md` |

**Recommendation:** Create a shared `Card` component with variant props and vendored shadow tokens.

---

### 7. Shadow Token Proliferation

At least 12 distinct shadow values were found:

| Shadow Value | Used In |
|-------------|---------|
| `0 18px 32px -26px rgba(15,23,42,0.45)` | FeedCard, SavedFeedView |
| `0 26px 42px -28px rgba(14,165,164,0.32)` | FeedCard hover |
| `0 24px 80px -58px rgba(15,23,42,0.38)` | ProviderCard |
| `0 18px 48px -40px rgba(15,23,42,0.38)` | ConnectionsPanel |
| `0 18px 30px -24px rgba(15,23,42,0.45)` | ProviderCard avatar |
| `0 20px 46px -42px rgba(15,23,42,0.65)` | Layout sidebar |
| `0 16px 30px -28px rgba(15,23,42,0.55)` | Layout header (md+) |
| `0 -14px 36px -28px rgba(15,23,42,0.42)` | Mobile bottom nav |
| `0 10px 24px -22px rgba(15,23,42,0.45)` | Layout header |
| `shadow-sm` | Various |
| `shadow-md` | Various |
| `shadow-lg` | MarketAiBar, various |

**Recommendation:** Define shadow tokens as CSS variables (`--shadow-card`, `--shadow-card-hover`, `--shadow-nav`, `--shadow-popover`, etc.).

---

### 8. Chat Page Monolith

`app/dashboard/chat/page.tsx` at **2054 lines** is the largest file in the app. It handles:
- Inbox/conversation list
- Message rendering (grouped by date)
- Real-time presence (Supabase Realtime)
- Typing indicators
- LiveTalk calling
- QuoteRoom integration
- File attachment UI
- Emoji picker integration
- Message search
- Draft templates

**Recommendation:** Split into smaller modules (inbox list, message thread, composer, LiveTalk panel, etc.).

---

### 9. NotificationCenter Duplication

`NotificationCenter.tsx` (486 lines, `components/`) is imported by `notifications/page.tsx` and also by other pages. It contains:
- Real-time subscription management
- Toast rendering
- Full page mode
- Rich notification types (chat, quote, connection, task)

**Status:** Good separation, but verify that all notification entry points use this component rather than ad-hoc implementations.

---

### 10. Create Post Flow — No Route Found

No `page.tsx` exists under `app/create/`. The create post flow is instead a **modal** (`CreatePostModal.tsx` embedded in `dashboard/layout.tsx:955` FAB). There's no dedicated URL route for creating posts.

**Issue:** The create flow is only accessible via the FAB. If the FAB is hidden (e.g., on desktop sidebar collapse) or during onboarding, there's no alternative entry point.

---

### 11. MarketAiBar Overlap

`MarketAiBar.tsx:151` uses `fixed bottom-24 right-4` which places it above the dashboard FAB (`bottom-[calc(5.5rem+env(safe-area-inset-bottom))]`) on mobile. Both use `--layer-floating-action`. The AI bar's trigger button sits at `z-[var(--layer-floating-action)]` and its expanded panel lacks explicit z-index layering (inherits from wrapper).

**Status:** Verify no visual overlap or click-jacking between the FAB and the AI bar trigger.

---

### 12. Direct Emoji Usage in Production UI

Several components use raw emoji characters in production UI:

| File | Emoji | Context |
|------|-------|---------|
| `app/dashboard/people/page.tsx:197` | `⭐` | Trust score display |
| `app/dashboard/providers/page.tsx` | `⚡` | Category icons (inferred from render patterns) |

**Recommendation:** Replace with SVG icons for consistent rendering across platforms.

---

### 13. Layout Duplication — MobileBottomNav

`app/components/MobileBottomNav.tsx` (101 lines) is a standalone component, but `dashboard/layout.tsx` inlines a nearly identical nav at lines 984–1030. The standalone component does not appear to be imported anywhere in the dashboard layout.

**Status:** Either remove the standalone component or refactor layout to import it.

---

### 14. Header Layout per Page Variation

| Page | Max Width | Context Strip |
|------|-----------|---------------|
| Dashboard (feed) | `max-w-[1180px]` | Inline hero |
| People | (no wrapper) | No context strip |
| Providers | `max-w-6xl` | No context strip |
| Orders | (no wrapper) | No context strip |
| Chat | Full width | No context strip |
| Notifications | `max-w-[1040px]` | `PageContextStrip` |
| Analytics | `max-w-6xl` | No context strip |
| Search | `max-w-5xl` / `max-w-6xl` | No context strip |

Pages use differing max-widths and inconsistent use of `PageContextStrip`.

---

## Summary of Recommendations

1. **Consolidate card design** — Shared Card component with design tokens for radius, shadow, and hover.
2. **Define shadow and radius tokens** — CSS variables in `globals.css`.
3. **Extract scrollbar-hide utility** — To `globals.css`.
4. **Split chat page** — 2054 lines is untenable.
5. **Remove duplicate MobileBottomNav** — Or refactor layout to import it.
6. **Add create-post route** — So the flow has a URL entry point beyond the FAB.
7. **Replace emoji with SVG icons** — For cross-platform consistency.
8. **Audit fixed elements for overlap** — Ensure FAB, MarketAiBar, and mobile nav don't conflict.
9. **Standardize page layouts** — Consistent max-width and header patterns per section.
