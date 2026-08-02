# ServiQ Design System Audit

**Date:** 2026-07-31
**Scope:** Flutter (mobile) and Web (Next.js) platforms
**Auditor:** Design Systems Review

---

## 1. Executive Summary

ServiQ maintains dual design systems across Flutter and Web. The **Flutter design system is mature and token-based** with 80+ semantic color tokens, comprehensive spacing/radius/icon/shadow primitives, ThemeExtensions for theme-aware values, and 25+ shared components in two directories. The **Web design system is CSS variable-based** with well-structured tokens embedded in `globals.css`, 10 UI primitives, and 6 motion components, but lacks a formal component library pattern, design token documentation, or a Figma sync mechanism.

**Key ratings:**

| Dimension | Flutter | Web |
|-----------|---------|-----|
| Token coverage | Excellent | Good |
| Component library | Good (with duplication) | Fair (minimal primitives) |
| Dark mode | Mature | Well-supported |
| Accessibility | Partial (Phase A) | Basic (skip-to-content) |
| Documentation | None | None |
| Tooling / automation | None | None |

---

## 2. Flutter Design System

### 2.1 Design Tokens (`mobile/lib/core/theme/design_tokens.dart`)

| Token class | Entries | Key details |
|---|---|---|
| `AppColors` | ~80 constants | background, surface, primary, accent, warm, warning, danger, success, verified, premium, marigold (4), sage (4), scrim, shadow, glow; 10 dark-mode variants (darkBackground, darkInk, darkBorder, etc.); 6 glass variants; shimmerBase/Highlight; heroOverlay/Deep; avatarFallback; 4 booking status colors (darkConfirmed, darkCompleted, darkCancelled, darkRescheduled) |
| `AppSpacing` | 10 | xxs=2, xs=8, sm=12, md=16, lg=20, xl=24, xxl=32, xxxl=40, pageInset=20 |
| `AppIconSize` | 7 | xxs=12, xs=16, sm=18, md=20, lg=24, xl=32, xxl=48 |
| `AppRadii` | 7 | xs=4, sm=6, md=8, lg=12, xl=16, xxl=20, pill=999 |
| `AppBreakpoints` | 3 | compact=360, regular=430, expanded=700 |
| `AppDurations` | 3 | fast=200ms, standard=300ms, slow=500ms |
| `AppShadows` | 12 | soft, card, md, lg, xl, floating, nav, header, popover, glow, glass + dark variants via CSS-equivalent |
| `AppGradients` | 11 | premiumDark, premiumAccent, premiumWarm, glassLight, glassDark, hero, heroLight, explore, people |
| `AppGlassStyles` | 2 | light() / dark() factory methods returning BoxDecoration |
| `AppRoleColors` | 10 | Semantic bg/fg for help request, service, product, order, trust |
| `AppTouchTargets` | 3 | minimum=48, buttonHeight=52, iconButton=44 |

### 2.2 Theme Extensions

- **ServiqThemeTokens** - `ThemeExtension<ServiqThemeTokens>` with 8 tokens: heroGradient, exploreGradient, peopleGradient, trustGradient, authGradient, actionGradient, glassBorder, glassBackground. Light + dark variants defined.
- **WelcomeThemeTokens** - ThemeExtension for welcome page hero/stats (mentioned in AGENTS.md).

### 2.3 Theme (`mobile/lib/core/theme/app_theme.dart`)

- `light()` and `dark()` `ThemeData` factories
- **Typography**: Google Fonts — Manrope (body/UI), DM Serif Display (headings)
- **Text theme**: Complete Material 3 scale (display 4, headline 3, title 3, body 3, label 3 sizes)
- **Full M3 color scheme** applied
- **Custom sub-themes**: AppBar, Card, Divider, Chip, InputDecoration, FilledButton, OutlinedButton, TextButton, SegmentedButton, FAB, BottomSheet, Dialog, SnackBar, NavigationBar, NavigationRail, Badge
- **Input decoration**: `filled: true`, `OutlineInputBorder`, `lg` (12px) border radius
- **Theme extensions**: `ServiqThemeTokens` and `WelcomeThemeTokens` registered

### 2.4 Core Design System Components (`mobile/lib/core/design_system/`)

| File | Component | Notes |
|---|---|---|
| `design_system.dart` | barrel | Re-exports all design system + shared components |
| `serviq_async_state.dart` | Async state widget | Loading/error/data states |
| `serviq_chrome.dart` | `ServiqToast` | Toast notification system, replaces raw SnackBar |
| `serviq_pills.dart` | `AppPill` | Pill/chip component |
| `serviq_recovery_banner.dart` | Recovery banner | Error recovery UI |
| `serviq_scaffold.dart` | `ServiqScaffold` | App scaffold wrapper (17 migrations done) |
| `serviq_surface.dart` | `ServiqSurface` | Surface/container component |

### 2.5 Shared Components (`mobile/lib/shared/components/`)

| File | Component | Notes |
|---|---|---|
| `app_buttons.dart` | Button system | Button variants |
| `app_search_field.dart` | Search field | Search input |
| `app_text_field.dart` | `AppTextField` | Primary text input (36+ migrations from raw TextField) |
| `empty_state_view.dart` | Empty state | Empty state display |
| `error_state_view.dart` | Error state | Error state display |
| `feed_card.dart` | Feed card | Feed item card |
| `filter_chip_group.dart` | Filter chip group | Filter chip group |
| `loading_shimmer.dart` | Loading shimmer | Skeleton loading |
| `marketplace_guidance.dart` | Marketplace guidance | Guidance card |
| `marketplace_provider_card.dart` | Provider card | Marketplace provider card |
| `metric_tile.dart` | Metric tile | Metric display tile |
| `nameplate_card.dart` | Nameplate card | Nameplate card |
| `premium_primitives.dart` | Premium primitives | Premium UI elements |
| `profile_avatar_tile.dart` | Avatar tile | Profile avatar |
| `provider_card.dart` | Provider card | Provider listing card |
| `request_card.dart` | Request card | Service request card |
| `section_header.dart` | Section header | Section header |
| `sticky_bottom_cta.dart` | Sticky bottom CTA | Bottom call-to-action bar |
| `trust_badge.dart` | Trust badge | Trust/verification badge |

### 2.6 Shared Widgets (`mobile/lib/shared/widgets/`)

| File | Component | Notes |
|---|---|---|
| `ai_prompt_bar.dart` | AI prompt bar | AI chat prompt bar |
| `cards.dart` | Card widgets | Card variants |
| `chips.dart` | Chip widgets | Chip variants |
| `empty_state.dart` | Empty state | Parallel to `empty_state_view.dart` |
| `error_state.dart` | Error state | Parallel to `error_state_view.dart` |
| `loading_skeletons.dart` | Loading skeletons | Skeleton variants |
| `section_header.dart` | Section header | Parallel to `section_header.dart` in components |
| `service_category_grid.dart` | Service category grid | Category grid |

### 2.7 Migration Status (Phase C & D)

- **Phase C** (Design System Migration): 36+ raw TextField/TextFormField → AppTextField across 14 files; 17 Scaffold → ServiqScaffold migrations; private widget collapse (_ProfileTextField, _FilterChip → AppPill)
- **Phase D** (Token Sweep & Cleanup): 200+ replacements of SizedBox/EdgeInsets/BorderRadius literals → AppSpacing/EdgeInsets tokens/AppRadii across 20+ files; 40+ redundant imports removed; 11 build errors fixed
- **Intentionally kept raw**: Auth pages (login, sign_up, forgot_password, setup), welcome/onboarding, chat page (dynamic leading), admin/connections/referrals (TabBar), market_zones (custom search), ai_prompt_bar (custom container), chat_composer (borderless), budget prefixText field

---

## 3. Web Design System

### 3.1 CSS Variables (`app/globals.css`)

| Category | Token count | Key details |
|---|---|---|
| **Font stacks** | 3 | `--font-sans` (Manrope), `--font-display` (DM Serif Display / Sora), `--font-mono` (JetBrains Mono) |
| **Surface tokens** | 3 | `--surface-app: #f8f6f1`, `--surface-elevated: #ffffff`, `--surface-soft: #f0ede6` |
| **Ink tokens** | 4 | `--ink-950: #0a1628`, `--ink: #141a22`, `--ink-700: #55616b`, `--ink-500: #7a858e` |
| **Brand tokens** | 10 | `--brand-900` through `--brand-50` + `--brand-ring` |
| **Border tokens** | 2 | `--surface-border: #d8d4cb`, `--border-strong: #c2bdb2` |
| **Semantic colors** | 7 | `--accent`, `--accent-soft`, `--color-warm`, `--color-warning`, `--color-danger`, `--color-success`, `--color-verified` |
| **Marigold palette** | 7 | `--marigold-50` through `--marigold-700` |
| **Sage palette** | 6 | `--sage-50` through `--sage-500` |
| **Shadows** | 12 | `--shadow-sm` through `--shadow-elevated`; uses `--shadow-rgb` for dark mode |
| **Layer/z-index** | 8 | `--layer-mobile-nav: 40` through `--layer-fullscreen: 110` |
| **Radius tokens** | 8 | `--radius-xs: 0.5rem` through `--radius-3xl: 2rem`; `radius-control`, `radius-card`, `radius-card-lg` aliases |
| **Shimmer** | 1 | `--shimmer-base: #e7ebf1` |
| **Dark mode overrides** | ~40 vars | `.dark` class overrides all surface, ink, brand, border, shadow, marigold, sage, shimmer tokens |
| **CSS animations** | 7 | startupFade, marketScanSweep, marketOrbFloat, postCardRise, marketFabFloat, commandMarkerFloat/ripple/drop/exit, slideDown |

### 3.2 Web UI Components (`app/components/ui/`)

| Component | File | Notes |
|---|---|---|
| Badge | `Badge.tsx` | Badge/chip |
| Button | `Button.tsx` | Button component |
| Card | `Card.tsx` | Card component |
| ConfirmDialog | `ConfirmDialog.tsx` | Confirmation dialog |
| DashboardLoading | `DashboardLoading.tsx` | Dashboard loading state |
| EmptyState | `EmptyState.tsx` | Empty state display |
| Input | `Input.tsx` | Text input |
| Modal | `Modal.tsx` | Modal dialog |
| PageHeader | `PageHeader.tsx` | Page header |
| SafeImage | `SafeImage.tsx` | Image with fallback handling |

### 3.3 Web Motion Components (`app/components/motion/`)

| Component | File | Notes |
|---|---|---|
| AnimatedPage | `AnimatedPage.tsx` | Page-level enter/exit animation |
| FadeIn | `FadeIn.tsx` | Fade-in animation wrapper |
| PageTransition | `PageTransition.tsx` | Page transition wrapper |
| PressScale | `PressScale.tsx` | Scale-on-press interaction |
| ShimmerSkeleton | `ShimmerSkeleton.tsx` | Skeleton loading animation |
| StaggerChildren | `StaggerChildren.tsx` | Staggered child entrance animation |

### 3.4 Web Trust Components (`app/components/trust/`)

| Component | File |
|---|---|
| TrustSnapshot | `TrustSnapshot.tsx` |
| WhatHappensNext | `WhatHappensNext.tsx` |

### 3.5 Web Profile Components (`app/components/profile/`)

37 components including PublicProfileContentTabs, AboutSection, ServicesSection, ReviewsSection, etc.

### 3.6 Web Nameplate Utility Classes (`globals.css`)

| Class | Purpose |
|---|---|
| `.nameplate-card` | Card with border, shadow, inset highlight, hover lift |
| `.nameplate-card-dark` | Dark mode card override |
| `.nameplate-inset` | Inset container with inner shadow |
| `.nameplate-badge` | Pill badge (shared base) |
| `.nameplate-badge-live` | Live/marigold badge |
| `.nameplate-badge-soon` | Coming-soon/sage badge |
| `.nameplate-hero` | Hero section with gradient background |
| `.nameplate-stat-bar` | Stats bar with border segments |
| `.nameplate-stat-item` | Stat item with separator |

---

## 4. Side-by-Side Comparison

| Design Dimension | Flutter | Web |
|---|---|---|
| **Token format** | Dart static const classes | CSS custom properties |
| **Color tokens** | ~80 semantic colors | ~45 CSS vars (brand, ink, surface, semantic, marigold, sage) |
| **Spacing** | `AppSpacing` (10 tokens, dp-based) | Tailwind utility classes (no explicit spacing vars) |
| **Radii** | `AppRadii` (7 tokens, dp: 4-999) | `--radius-*` (8 tokens, rem: 0.5-2rem) |
| **Typography** | Google Fonts (Manrope + DM Serif Display); full M3 text theme | CSS vars (`--font-sans`, `--font-display`, `--font-mono`); Tailwind prose |
| **Shadows** | `AppShadows` (12 presets, BoxShadow list) | `--shadow-*` (12 presets, CSS box-shadow) |
| **Gradients** | `AppGradients` (11 presets) + `ServiqThemeTokens` (6 thematic) | Inline gradients in `.nameplate-hero` and `.market-hero-surface` |
| **Dark mode** | `dark()` ThemeData + `ServiqThemeTokens.dark` | `.dark` class overrides all tokens |
| **Glass morphism** | `AppGlassStyles` light/dark factories + `ServiqThemeTokens` glass tokens | Not formalized (some backdrop-filter usage in map attribution) |
| **Icons** | `AppIconSize` (7 sizes) | Not tokenized |
| **Breakpoints** | `AppBreakpoints` (compact/regular/expanded) | Tailwind breakpoints |
| **Duration** | `AppDurations` (3: 200/300/500ms) | Hardcoded in CSS transitions (200ms, 460ms, 780ms) |
| **Z-index layers** | Not tokenized | `--layer-*` (8 layers, 40-110) |
| **Touch targets** | `AppTouchTargets` (48/52/44) | Not tokenized |
| **Component library** | 25+ shared components + 7 core design system components | 10 UI primitives + 6 motion components |
| **Theme documentation** | None | None |
| **Figma sync** | None | None |
| **Audit tooling** | None | None |
| **Design token runtime** | Static const | CSS vars (runtime-switchable via .dark class) |

---

## 5. Identified Duplications

### 5.1 Flutter: Shared Component Overlap

Two parallel directories contain semantically overlapping components with near-identical APIs:

| `shared/components/` | `shared/widgets/` | Status |
|---|---|---|
| `empty_state_view.dart` | `empty_state.dart` | **Duplicate** - same concept, different location |
| `error_state_view.dart` | `error_state.dart` | **Duplicate** - same concept, different location |
| `section_header.dart` | `section_header.dart` | **Duplicate** - same filename, different location |
| `loading_shimmer.dart` | `loading_skeletons.dart` | **Overlap** - both loading indicators, likely different styles |
| (none) | `cards.dart` | Cards only in widgets |
| (none) | `chips.dart` | Chips only in widgets |
| `filter_chip_group.dart` | (none) | FilterChipGroup only in components |
| (none) | `ai_prompt_bar.dart` | AI prompt only in widgets |
| (none) | `service_category_grid.dart` | Category grid only in widgets |
| Remaining 14 components | (none) | Uniquely in components dir |

**Recommendation**: Consolidate into a single directory (preferably `shared/components/`), remove the `shared/widgets/` duplicates, and update all imports.

### 5.2 Web: No component duplication detected

The Web UI component set is small enough that no meaningful duplication exists.

---

## 6. Identified Inconsistencies

### 6.1 Cross-Platform Token Mismatches

| Token | Flutter (dp) | Web (rem) | Ratio (rem → dp approximate) |
|---|---|---|---|
| `--radius-xs` / `AppRadii.xs` | 4px | 0.5rem (8px) | **2x** |
| `--radius-sm` / `AppRadii.sm` | 6px | 0.625rem (10px) | ~1.67x |
| `--radius-md` / `AppRadii.md` | 8px | 0.75rem (12px) | **1.5x** |
| `--radius-lg` / `AppRadii.lg` | 12px | 1rem (16px) | ~1.33x |
| `--radius-xl` / `AppRadii.xl` | 16px | 1.25rem (20px) | 1.25x |
| `--radius-xxl` / none on web | 20px | n/a | n/a |
| `--radius-3xl` / none on Flutter | n/a | 2rem (32px) | n/a |
| `pill` / `--radius-*` | 999px | 999px (in `.nameplate-badge`) | Aligned |

**Finding**: Web radii are consistently larger than Flutter radii. At 16px base font size, the web `--radius-lg` (16px) is 33% larger than Flutter's `AppRadii.lg` (12px).

### 6.2 Missing Token Categories

| Token category | Flutter | Web |
|---|---|---|
| Z-index / layer | Not tokenized | Tokenized (8 layers) |
| Touch targets | Tokenized | Not tokenized |
| Icon sizes | Tokenized | Not tokenized |
| Duration | Tokenized | Not tokenized |
| Breakpoints | Tokenized | Not tokenized (Tailwind default) |
| Glass styles | Tokenized (AppGlassStyles) | Not formalized |

### 6.3 Spacing Strategy

Flutter uses explicit spacing tokens (`AppSpacing`) and the Phase D sweep replaced 200+ literal values. Web relies on Tailwind's utility class spacing scale (`p-4`, `gap-3`, etc.) with no custom spacing variables.

### 6.4 Color Naming Convention

Flutter uses camelCase (`AppColors.danger`, `AppColors.successSoft`). Web uses kebab-case CSS vars (`--color-danger`, `--color-success`). Brand tokens differ: Flutter uses `primary`/`accent`; Web uses `brand-*` with a different numerical scale (900-50 vs Flutter's `primary`/`primaryDeep`/`primarySoft`/`primaryPressed`).

### 6.5 Typography Approach

Flutter has a full Material 3 type scale with Manrope + DM Serif Display via Google Fonts. Web has CSS font stack variables and uses Tailwind typography utilities. No shared type scale values between the two platforms.

---

## 7. Missing Primitives

| Primitive | Flutter | Web |
|---|---|---|
| **Loading skeleton library** | Multiple ad-hoc implementations (`loading_shimmer.dart`, `loading_skeletons.dart`) | `ShimmerSkeleton` motion component - single purpose |
| **Empty state component** | Duplicated (`empty_state_view.dart` + `empty_state.dart`) | `EmptyState` UI component - single |
| **Toast / snackbar system** | `ServiqToast` in `serviq_chrome.dart` (98 raw SnackBars replaced) | None identified (likely uses browser or library toast) |
| **Search input** | `app_search_field.dart` | No dedicated search component |
| **Wrap / flex layout helpers** | Not tokenized | Tailwind layout utilities |
| **Divider / separator** | Part of M3 theme (DividerTheme) | Not formalized |
| **Stepper / progress tracker** | Not found | Not found |
| **Bottom sheet** | M3 BottomSheet themed, 3 DraggableScrollableSheet patterns | `<Modal>` only |
| **Tabs** | NavigationBar/NavigationRail themed | Not formalized |
| **Avatar component** | `profile_avatar_tile.dart` | `SafeImage` used ad-hoc |
| **Data table / list** | Not tokenized | Not tokenized |
| **Form validation** | AppTextField handles | Input component |
| **Error boundary** | `serviq_async_state.dart` + error_state.dart | Not formalized |
| **Skeleton / placeholder** | Duplicated implementations | `ShimmerSkeleton` |
| **Chip / pill** | `AppPill` (serviq_pills.dart) + filter_chip_group.dart + chips.dart | Badge component |
| **Motion / animation wrappers** | Not formalized | 6 motion components (AnimatedPage, FadeIn, PageTransition, PressScale, ShimmerSkeleton, StaggerChildren) |
| **Dialog / confirmation** | M3 Dialog/AlertDialog themed | `Modal` + `ConfirmDialog` |
| **Pull-to-refresh** | Not tokenized | Not applicable |
| **Swipe actions** | Not tokenized | Not applicable |

---

## 8. Deprecated or Unused Components

### 8.1 Flutter

| Component | Reason |
|---|---|
| `shared/widgets/empty_state.dart` | Superseded by `shared/components/empty_state_view.dart` |
| `shared/widgets/error_state.dart` | Superseded by `shared/components/error_state_view.dart` |
| `shared/widgets/section_header.dart` | Superseded by `shared/components/section_header.dart` (unless distinct) |
| `shared/widgets/loading_skeletons.dart` | May be superseded by `loading_shimmer.dart` (verify usage) |
| Raw `TextField` / `TextFormField` (outside auth pages) | Should be `AppTextField` after Phase C |

### 8.2 Web

No deprecated components identified. The small component surface area means everything is in active use.

---

## 9. Migration Opportunities

### 9.1 Consolidate Flutter `shared/components/` and `shared/widgets/`

Merge duplicated directory into `shared/components/`. Migration steps:
1. Remove `shared/widgets/empty_state.dart` → point imports to `empty_state_view.dart`
2. Remove `shared/widgets/error_state.dart` → point imports to `error_state_view.dart`
3. Remove `shared/widgets/section_header.dart` → point imports to `shared/components/section_header.dart` or rename
4. Audit `loading_skeletons.dart` vs `loading_shimmer.dart` usage → consolidate
5. Relocate `cards.dart`, `chips.dart`, `ai_prompt_bar.dart`, `service_category_grid.dart` to `shared/components/`
6. Remove `shared/widgets/` directory
7. Update barrel file (`design_system.dart`)

### 9.2 Cross-Platform Token Alignment

- Align radius scales (decide on Flutter or Web as source of truth)
- Add Web equivalents of `AppSpacing` as CSS custom properties for consistency
- Add touch target tokens to Web (`--touch-minimum: 48px`, etc.)
- Add icon size tokens to Web
- Migrate Web animation durations to CSS custom properties

### 9.3 Design Token Documentation

- Create a shared token dictionary (`docs/design/tokens.md`) mapping Flutter ↔ Web equivalents
- Document intended visual relationships (e.g., `AppColors.accent` = `--brand-500`)
- Add color, spacing, radius, and shadow reference cards

### 9.4 Figma Sync

- No Figma token sync mechanism exists
- Evaluate importing/exporting via Design Token format (DTCG / W3C Design Tokens)
- Consider Token Studio (Figma plugin) for syncing to both platforms

### 9.5 Web Component Maturity

- Build `AppTextField` equivalent on Web with consistent styling matching `Input`
- Build `ServiqScaffold`/layout wrapper equivalent
- Build `ServiqToast` equivalent
- Formalize glass morphism on Web (currently only in map attribution)
- Build card variants matching Flutter's feed_card, request_card, provider_card patterns

### 9.6 Remaining Flutter Raw Widgets

After Phase C, the following remain intentionally raw (based on AGENTS.md):
- Auth pages (login, sign_up, forgot_password, setup)
- Welcome/onboarding pages
- Chat page (dynamic leading widget)
- Admin/connections/referrals (TabBar usage)
- Market zones (custom search)
- ai_prompt_bar (custom container)
- chat_composer (borderless)
- Budget prefixText field

Each should be revisited to determine if migration is now feasible or if the bespoke styling is truly justified.

---

## 10. Accessibility Audit

### 10.1 Web

| Feature | Status | Details |
|---|---|---|
| Skip-to-content | Present | Link at top of page |
| Semantic HTML | Partial | Tailwind-based; relies on JSX tags |
| Focus indicators | Not audited | Not verified against WCAG 2.1 AA |
| Color contrast | Not audited | Verify ink-500 on surface-app, brand-400 on dark bg |
| Reduced motion | Implemented | `@media (prefers-reduced-motion: reduce)` disables startupFade, marketScanSweep, marketOrbFloat, postCardRise, marketFabFloat, all commandMarker animations |
| `role="alert"` on errors | Present | LoginPageClient implements (from AGENTS.md history) |
| ARIA labels | Partial | Not systematically verified |
| Keyboard navigation | Not audited | Tab order, focus trapping in modals |
| Screen reader support | Not audited | Alt text, aria-describedby |

### 10.2 Flutter

| Feature | Status | Details |
|---|---|---|
| Semantic labels | Partial (Phase A) | Feed icons, chat back, feed card images |
| Touch targets | Tokenized | `AppTouchTargets.minimum = 48`, `buttonHeight = 52`, `iconButton = 44` |
| Reduced motion | Not tokenized | `AppDurations` exists but no `prefers-reduced-motion` equivalent |
| Color contrast | Not audited | Not verified against WCAG 2.1 AA |
| Dynamic text | Not audited | Flutter text scaling compatibility |
| Focus indicators | Not applicable | Material handles natively on supported platforms |
| Screen reader | Partial | Semantics widgets used in Phase A, not systematically |

### 10.3 Cross-Platform Gaps

- No formal accessibility test suite or CI checks
- No color contrast audit against WCAG 2.1 AA
- No screen reader testing documentation
- Reduced motion support is present on Web but absent on Flutter
- Focus/active states not systematically verified

---

## 11. Dark Mode Audit

### 11.1 Web

| Feature | Status | Details |
|---|---|---|
| Mechanism | `.dark` class on `<html>` | Toggles all CSS custom properties |
| Surface colors | 3 overrides | `--surface-app`, `--surface-elevated`, `--surface-soft` |
| Ink colors | 4 overrides | White-tinted ink scale |
| Brand colors | 10 overrides | Inverted scale (brand-900 becomes light, brand-50 becomes dark) |
| Shadow colors | All overridden | `--shadow-rgb: 0,0,0` instead of `20,26,34` |
| Border colors | 2 overrides | Darker borders |
| Marigold/Sage | Full overrides | Inverted scales |
| Accent | Minimal override | `--accent` unchanged, `--accent-soft` darkened |
| Semantic colors | Unchanged | `--color-danger`, `--color-success`, `--color-warning`, `--color-verified` kept identical — **potential contrast issue** in dark mode |
| Nameplate utilities | Dark variants | `.dark .nameplate-card`, `.dark .nameplate-card::after`, `.dark .nameplate-card:hover` |
| Scrollbar | Dark styled | `.dark ::-webkit-scrollbar-thumb` overridden |
| Shimmer | Overridden | `--shimmer-base: #222b35` |
| Map attribution | Not overridden | Uses explicit dark colors |

**Finding**: Semantic colors (danger=#c2415a, success=#158463, warning=#ad6b00, verified=#2563eb) are **identical in light and dark mode**. These colors were designed for light backgrounds — on dark surfaces (`--surface-app: #0e1217`) they may fail WCAG AA contrast thresholds.

### 11.2 Flutter

| Feature | Status | Details |
|---|---|---|
| Mechanism | `ThemeData.dark()` + `ServiqThemeTokens.dark` | Full theme switch |
| Surface colors | 10 dark variants | darkBackground, darkBackgroundAlt, darkSurface, darkSurfaceAlt, darkSurfaceTint, darkSurfacePressed |
| Ink colors | 4 dark variants | darkInk, darkInkStrong, darkInkSubtle, darkInkFaint |
| Border colors | 2 dark variants | darkBorder, darkBorderStrong |
| Glass styles | `AppGlassStyles.dark()` | Separate factory with dark surface colors |
| Booking status colors | 4 explicit | darkConfirmed, darkCompleted, darkCancelled, darkRescheduled |
| Gradients | 6 dark variants | Via `ServiqThemeTokens.dark` — heroGradient, exploreGradient, peopleGradient, trustGradient, authGradient, actionGradient |
| Avatar fallback | 1 override | `darkAvatarFallback = darkSurfaceAlt` |
| Glass stroke | 2 variants | glassStroke dark override |

### 11.3 Cross-Platform Dark Mode Gaps

- Flutter has richer dark-mode token coverage than Web (booking status colors, avatar fallback, glass stroke)
- Web keeps semantic colors unchanged (danger/success/warning/verified are same in light and dark) — likely a contrast issue
- Web shadow colors change (rgb 0,0,0 vs 20,26,34) — Flutter shadow colors are static (not a concern since Flutter renders shadows differently)

---

## 12. Recommendations

### P0 (Immediate - Safety/Quality)

1. **Fix Web dark mode semantic colors** — `--color-danger`, `--color-success`, `--color-warning`, `--color-verified` are unchanged in `.dark` and likely fail WCAG AA on dark surfaces. Provide dark-mode-specific values or adjust opacity.

2. **Register missing `AppTouchTargets` tokens** — Ensure `buttonHeight: 52` and `iconButton: 44` are consistently applied across all Flutter buttons (currently only `minimum: 48` is likely enforced via Material constraints).

3. **Audit color contrast** — Run a systematic WCAG AA contrast check on both platforms for all interactive text, placeholder text, and iconography.

### P1 (Design System Health)

4. **Consolidate Flutter duplicate directories** — Merge `shared/widgets/` into `shared/components/`. Remove the 3 confirmed duplicate files. Relocate the 4 unique widget files. Update all imports.

5. **Flatten the token documentation gap** — Create `docs/design/tokens.md` mapping every Flutter token to its Web CSS variable equivalent (where one exists) and documenting gaps.

6. **Align Web and Flutter radius scales** — Choose one as the source of truth. Currently Web radii are consistently larger (e.g., `--radius-lg: 1rem/16px` vs `AppRadii.lg: 12px`). Decide whether this is intentional.

7. **Add Web spacing CSS variables** — Create `--space-xs`, `--space-sm`, `--space-md`, etc. matching `AppSpacing` values for cross-platform consistency, even if Tailwind utilities remain the primary spacing mechanism.

### P2 (Component Library Growth)

8. **Build Web equivalent of AppTextField** — The `Input` component exists but lacks the `filled: true` + `OutlineInputBorder` + `lg` radius pattern that defines Flutter's input style. Align them.

9. **Build ServiqToast for Web** — Toast notifications on Web likely use ad-hoc implementations or a library. Standardize with a `ServiqToast` equivalent matching Flutter's `serviq_chrome.dart`.

10. **Formalize Web glass morphism** — Currently only used in map attribution backdrop-filter. Flutter has `AppGlassStyles` with light/dark variants. Add CSS glass tokens and utility classes to Web.

11. **Add Web touch target tokens** — `--touch-minimum: 48px`, `--touch-button-height: 52px`, `--touch-icon-button: 44px` matching Flutter's `AppTouchTargets`.

### P3 (Tooling & Automation)

12. **Design Token CI check** — Add a CI step that validates no un-tokenized spacing/radius/color values are introduced (e.g., lint rule against magic number `SizedBox(height: 13)` or raw `borderRadius: BorderRadius.circular(7)`).

13. **Figma token sync** — Evaluate Token Studio (Figma plugin) to export DTCG-format tokens and auto-generate both `design_tokens.dart` and `globals.css` variables.

14. **Flutter reduced motion support** — Add a `MediaQuery.alwaysUse24HourFormat` equivalent for `prefers-reduced-motion` that sets `AppDurations` to zero or disables animations.

15. **Accessibility audit CI** — Add axe-core (Web) and Flutter semantics tester to CI pipeline.

16. **Web color token naming alignment** — Consider renaming Web `--brand-*` tokens to match Flutter's semantic naming (`--primary`, `--accent`, etc.) for easier cross-referencing, or add aliases.

---

## Appendix A: File Reference Index

### Flutter

| File | Content |
|---|---|
| `mobile/lib/core/theme/design_tokens.dart` | All design token classes (AppColors, AppSpacing, AppIconSize, AppRadii, AppBreakpoints, AppDurations, AppShadows, AppRoleColors, AppTouchTargets, AppGradients, AppGlassStyles, ServiqThemeTokens) |
| `mobile/lib/core/theme/app_theme.dart` | `light()` and `dark()` ThemeData factories |
| `mobile/lib/core/design_system/design_system.dart` | Barrel file |
| `mobile/lib/core/design_system/serviq_chrome.dart` | ServiqToast |
| `mobile/lib/core/design_system/serviq_scaffold.dart` | ServiqScaffold |
| `mobile/lib/core/design_system/serviq_surface.dart` | ServiqSurface |
| `mobile/lib/core/design_system/serviq_pills.dart` | AppPill |
| `mobile/lib/core/design_system/serviq_async_state.dart` | Async state widget |
| `mobile/lib/core/design_system/serviq_recovery_banner.dart` | Recovery banner |
| `mobile/lib/shared/components/*.dart` | 19 shared components |
| `mobile/lib/shared/widgets/*.dart` | 8 shared widgets (4 duplicates) |

### Web

| File | Content |
|---|---|
| `app/globals.css` | All CSS custom properties, dark mode, utility classes, animations |
| `app/components/ui/*.tsx` | 10 UI primitives |
| `app/components/motion/*.tsx` | 6 motion components |
| `app/components/trust/*.tsx` | 2 trust components |
| `app/components/profile/*.tsx` | 37 profile components |
