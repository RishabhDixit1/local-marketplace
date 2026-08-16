# ServiQ Mobile Design System

Single source of truth for the Flutter design system. Every screen must consume
these tokens and primitives; screens must NOT hardcode raw colors, spacing,
radii, durations, curves, or `TextStyle(fontSize: ...)`.

Canonical import for all screens:

```dart
import '../../../core/design_system/design_system.dart';
```

The barrel (`core/design_system/design_system.dart`) re-exports the primitives
below plus the shared components. Import the barrel, not individual files.

---

## 1. Color tokens (`core/theme/design_tokens.dart` → `AppColors`)

### Brand / semantic

| Token | Value | Use |
|-------|-------|-----|
| `primary` | `#0D2137` (navy) | Primary brand, deep text |
| `primaryDeep` | `#071526` | Hero/CTA backgrounds (dark-mode-safe) |
| `primarySoft` | `#E8EDF5` | Primary surfaces, selected chips |
| `accent` | `#0F766E` (teal) | Secondary brand, links, icons |
| `accentDeep` | `#0A5C56` | Accent text on soft |
| `accentSoft` | `#CCFBF1` | Accent pill backgrounds |
| `warm` / `warmDeep` / `warmSoft` | amber | Warm/urgency accents |
| `premium` / `premiumSoft` | violet | Premium/boosts |
| `marigold` / `marigoldSoft` / `marigoldDeep` | `#F59E0B` | Featured placements |

### Status (do NOT overload for identity)

| Token | Value | Use |
|-------|-------|-----|
| `success` / `successSoft` | `#0E8345` | Success, job completion |
| `warning` / `warningSoft` | `#DC6803` | Urgent, warnings |
| `danger` / `dangerSoft` | `#E03E5A` | Errors, destructive |
| `verified` / `verifiedSoft` | `#2563EB` blue | **Identity/verification ONLY** |

### Canonical surfaces

`background` `#FCFCFD`, `surface` `#FFFFFF`, `surfaceAlt` `#F0F1F5`,
`surfaceTint` `#E8EDF5`, `surfacePressed` `#E5E6EB`, `surfaceMuted` = `surfaceAlt`.

### Avatar palette

`kAppAvatarPalette` (`shared/components/app_avatar.dart`): 8 mid-dark colors
(`#0F766E`, `#4338CA`, `#BE123C`, `#B45309`, `#047857`, `#0369A1`, `#6D28D9`,
`#9F1239`) for deterministic initials circles; white w700 text stays legible
in both themes.

**Rule:** verified/trust color is **blue** (`AppColors.verified`) everywhere.
Green = success/job-completion, not identity.

---

## 2. Spacing (`AppSpacing`)

| Token | px |
|-------|-----|
| `xxxs` | 2 |
| `xxs` | 4 |
| `xs` | 8 |
| `sm` | 12 |
| `md` | 16 |
| `lg` | 20 |
| `xl` | 24 |
| `xxl` | 32 |
| `xxxl` | 40 |
| `pageInset` | 20 |

Use `SizedBox(height: AppSpacing.md)`, `EdgeInsets.all(AppSpacing.sm)`, etc.
No raw `SizedBox(height: 10)`.

---

## 3. Radii (`AppRadii`)

| Token | px |
|-------|-----|
| `xs` | 4 |
| `sm` | 6 |
| `md` | 8 |
| `lg` | 12 |
| `xl` | 16 |
| `xxl` | 20 |
| `pill` | 999 |

Cards: `lg`/`xl`. Pill-shaped elements: `pill`. No `circular(14)` / `(18)`.

---

## 4. Typography (`core/design_system/app_type.dart` → `AppType`)

Standard Material roles consumed via `Theme.of(context).textTheme.*` with the
`AppType` accessors (`AppType.headlineMedium(context)`, etc.). Screens must not
invent raw `TextStyle(fontSize: N)`. Exception: controlled inline sizes inside
primitives (pills, mini stats) where the token layer owns them.

---

## 5. Motion (`core/design_system/app_motion.dart`)

| `AppEasing` | curve |
|-------|-------|
| `fast` / `standard` | `easeOutCubic` |
| `emphasize` / `spring` | `easeOutBack` |
| `sheet` | `easeOutQuart` |
| `exit` | `easeInCubic` |

| `AppMotion` | duration |
|-------|-------|
| `fast` | 180ms |
| `dialog` | 220ms |
| `page` | 260ms |
| `standard` | 300ms |
| `sheet` | 320ms |
| `slow` | 500ms |

Plus helpers: `fadeIn`, `fadeSlide`, `smoothPage`, `smoothSheet`. No raw
`Duration(milliseconds: ...)` / `Curves.*` in screens.

---

## 6. Pills (`shared/widgets/chips.dart`)

`AppPill` — the ONLY pill primitive (absorbed `TrustBadge`, `PremiumPill`, and
the bespoke `_TypePill`/`_InlinePill`/`_TrustChip` copies).

Named constructors (label is **positional**):

```dart
AppPill.neutral('Plumber')                 // surfaceMuted / onSurface
AppPill.accent('Available')                // accentSoft / accentDeep
AppPill.success('98% job completion')      // successSoft / success
AppPill.warning('New to reviews')          // warningSoft / warmDeep
AppPill.danger('Blocked')                  // dangerSoft / danger
AppPill.verified('Verified')               // verifiedSoft / verified (BLUE)
AppPill.premium('Premium')                 // premiumSoft / premium
AppPill.featured('Featured')               // marigoldSoft / marigoldDeep
AppPill.dark('On-image label')             // dark glass, white text
```

All take `icon`, `size` (`AppPillSize.regular` | `mini`), `maxWidth`,
`onPressed`. Pressable pills wrap in `Semantics(button: true, label: ...)`.
`AppFilterChip` (filter selection) and `AppStatusChip` (status color maps) are
the other chip primitives.

---

## 7. Avatar (`shared/components/app_avatar.dart` → `AppAvatar`)

Single avatar primitive — photo via `CachedNetworkImageProvider` (wrapped in
`ResizeImage.resizeIfNeeded` for decode-size caps), else deterministic
color-per-name initials. Optional online dot, semantic label. Replaces all
`CircleAvatar`+letter sites. Never render a flat grey circle with a lone
letter.

---

## 8. Buttons (`shared/components/app_buttons.dart`)

- `PrimaryButton` — primary action (fills width by default).
- `SecondaryButton` — secondary action.
- Text/outlined buttons only where a tertiary affordance is genuinely needed
  (L-12 remediation favors these shared buttons; remaining raw `FilledButton`
  sites are intentional page-level overrides).

---

## 9. Surfaces & scaffolding

| Component | File | Use |
|-----------|------|-----|
| `ServiqScaffold` | `serviq_scaffold.dart` | Page scaffold (SafeArea + scroll + FAB gate) |
| `ServiqTopBar` | `serviq_chrome.dart` | App bar |
| `AppTextField` | `shared/components/app_text_field.dart` | All inputs (filled + OutlineInputBorder) |
| `AppSearchField` | `shared/components/app_search_field.dart` | Search inputs |
| `LoadingShimmer` | `shared/components/loading_shimmer.dart` | Loading state (not bare spinners) |
| `ErrorStateView` | `shared/components/error_state_view.dart` | Error state (not bespoke glass cards) |
| `EmptyStateView` | `shared/components/empty_state_view.dart` | Empty state |
| `SectionHeader` | `shared/components/section_header.dart` | Section titles (canonical; `AppSectionHeader` was deleted) |
| `MetricTile` | `shared/components/metric_tile.dart` | KPI tiles |
| `StickyBottomCTA` | `shared/components/sticky_bottom_cta.dart` | One-primary-action bottom bars |
| `FilterChipGroup` | `shared/components/filter_chip_group.dart` | Multi-select filters |
| `ServiceCategoryGrid` | `shared/widgets/service_category_grid.dart` | Category grids (theme-aware glass) |
| `CountBadge` | `shared/widgets/cards.dart` | Unread/count badges |
| `VoiceInputButton` | `shared/components/voice_input_button.dart` | Speech-to-text mic input |

`ServiqAsyncBody` (`serviq_async_state.dart`) standardizes loading/error/data
with `errorTitle`, `errorMessageFor`, `onRetry`, `loadingBuilder`.

---

## 10. Rules enforced by the migration

1. **One canonical pill** — `AppPill`; no bespoke pill copies.
2. **Blue = verified/trust**, green = success, marigold = featured.
3. **`AppAvatar` for all people** — photos or colored initials, never grey.
4. **`CachedNetworkImage` + decode-size caps** (`memCacheWidth` /
   `ResizeImage`) for every network image.
5. **Touch targets ≥ 48px** — chips use `MaterialTapTargetSize.padded`,
   icon buttons have `tooltip`/`Semantics`.
6. **Token-only spacing/radii/type/motion** — no raw literals.
7. **LoadingShimmer / ErrorStateView / EmptyStateView** instead of bespoke
   states.
8. **`serviq_chrome.dart` toasts** (`ServiqToast`) not raw SnackBars.
9. **One primary action per screen** — `StickyBottomCTA` where the page has a
   hero CTA; no duplicate in-body booking buttons.

---

## References

- Audit driving these fixes: [MOBILE_AUDIT.md](MOBILE_AUDIT.md)
- Information architecture: [MOBILE_IA_REDESIGN.md](MOBILE_IA_REDESIGN.md)
- Tokens live in `mobile/lib/core/theme/design_tokens.dart`; barrel in
  `mobile/lib/core/design_system/design_system.dart`.
