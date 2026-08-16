# Phase 0.5 — Fast-Fix Pass Completion (Aug 15 2026)

Scope: the six hand-off items from
[`2026-08-15-phase-0-ondevice-audit.md`](2026-08-15-phase-0-ondevice-audit.md)
(Hand-off to Phase 1, items 1–5) plus the entry-points item, implemented under
the governance constraint in
[`ServiQ_UI_UX_Standing_Constraint.md`](ServiQ_UI_UX_Standing_Constraint.md)
("Improve what exists. Do not add features, screens, tabs, or sections") and the
phase boundary in [`UI_POLISH_IMPLEMENTATION_PLAN.md`](UI_POLISH_IMPLEMENTATION_PLAN.md)
(Phases 1–5 strictly out of scope).

Every code fix is verified three ways: deterministic widget/unit tests, a full
`flutter analyze` + `flutter test` run, and on-device reproduction on
emulator-5554 via uiautomator semantics dumps (exact bounds), not narrative
claims. Evidence dumps live in
`/var/folders/yf/t84qrcx51zvbxtj8ygtx05yc0000gn/T/opencode/p05-verify/`
(`p05_*.xml`, `prefs_*.xml`, `p05_loading1.png`).

- [Environment](#environment)
- [Fix #1 — Intent card cold-start](#fix-1--intent-card-cold-start)
- [Fix #2 — Work section zero-state](#fix-2--work-section-zero-state)
- [Fix #3 — Home FAB overlap](#fix-3--home-fab-overlap)
- [Fix #4 — Post Need entry points](#fix-4--post-need-entry-points)
- [Fix #5 — Create-need draft title restore](#fix-5--create-need-draft-title-restore)
- [Fix #6 — Search loading skeleton](#fix-6--search-loading-skeleton)
- [Verification](#verification)
- [Device state](#device-state)
- [Out of scope / open items](#out-of-scope--open-items)

---

## Environment

- Device: emulator-5554, 1080x2400, API 37.
- App: `com.serviq.serviq_mobile`, debug APK built from current source.
- Flutter 3.41.9; branch `main`.
- Test account: `dixit4119` (signed in, dev endpoints from `config/local.json`).
- Network: emulator wifi enabled (`svc wifi enable`); app reaches Supabase at
  `http://54.253.40.174:8000` and the local API at `http://10.0.2.2:3000`.

## Fix #1 — Intent card cold-start

**Root cause (audit):** `prepareForAuth` in `onboarding_handoff.dart` wrote the
intent value but never `intentChosen=true`; `welcome_page.dart` gates the
"Who are you?" card on `!hasChosenIntent`, so the card re-showed every cold
start. **Root cause of the incomplete gate:** `prepareForAuth` writes the
intent destination to the handoff store but the chosen flag was never set.

**Fix (`mobile/lib/features/auth/data/onboarding_handoff.dart`,
`mobile/lib/features/welcome/presentation/welcome_page.dart`):**
- `prepareForAuth` now persists `intentChosen=true` and clears
  `intentPromptDismissed` when it stores an intent, so a user who picked a
  role on the card never sees it again.
- `_selectIntent` awaits `selectIntent(...)` (persisting the chosen flag) before
  `context.push(...)`, so the flag survives navigation and restart.
- `_WhoAreYouCard.onSelect` retyped `Future<void> Function(MobileOnboardingIntent)`.

**On-device verification (3-step repro):**
1. Set `intentPromptDismissed=false` in `FlutterSharedPreferences.xml`
   (`run-as`), force-stop, cold start → card renders ("Find help / Earn nearby /
   Not now") — `p05_q1.xml`.
2. Tap "Find help" `[84,442][996,604]` → navigates to create-need; prefs now
   `intentChosen=true` — `p05_q2.xml`, `prefs` readback.
3. Force-stop, cold start → card absent (grep "Find help" = 0 matches) —
   `p05_q3.xml`.

## Fix #2 — Work section zero-state

**Fix (`welcome_page.dart`, `welcome_widgets.dart`):** `_HomeQuickActions` gains
`required bool isLoaded`; when loaded and both `needCount == 0` and
`workCount == 0` it renders a `_WorkEmptyState` card ("Nothing in motion yet" +
subtitle + "Post your first need" / "Browse my tasks") instead of bare
"0 My needs / 0 My work" tiles. Four new l10n keys in all 6 locales
(`nothingInMotion`, `nothingInMotionSubtitle`, `postYourFirstNeed`,
`browseMyTasks`).

**Verification:** new `mobile/test/welcome_work_empty_state_test.dart`
(zero-needs snapshot → empty-state card shown; one active posted need → "My
needs" tile shown, empty-state absent). Both pass.

**On-device:** the test account has 1 active need ("Plumberbathroomleak"), so
the both-zero state is not reachable without cancelling the live test request
(cancel path sits deep in the task hub; a provider-profile detour was explored
and rejected). Locked in by widget tests instead; the non-empty rendering path
was verified live (dump `p05_o3.xml` shows "1 My needs / 0 My work").

## Fix #3 — Home FAB overlap

**Fix (`mobile/lib/app/presentation/app_shell.dart`, `welcome_page.dart`,
`discovery_page.dart`):**
- FAB reveal now requires `delta < 0 && !nearBottom` where
  `nearBottom = maxScrollExtent - pixels < 480` and the viewport bottom is
  within `min(480, maxExtent * 0.5)` of the content — so the FAB stays hidden
  while the Trusted rail "Open" actions are on screen, instead of re-covering
  them.
- Bottom-of-list occlusion fixed: home SliverPadding and discovery ListView
  bottom padding `→ 300`, so the last "Open request" button no longer sits
  under the bottom nav.
- FAB gate wrapped in `IgnorePointer(Key('post-need-fab-gate'))` + `AnimatedScale`.

**On-device verification:**
- Scroll down → FAB collapses to point bounds `[859,1922][859,1922]` (hidden).
- Scroll up near bottom → FAB stays hidden; Trusted rail "Open" buttons fully
  clear (`[74,2295][651,2400]`, `[893,2295][1038,2400]`).
- Scroll up away from bottom → FAB re-shows `[680,1778][1038,1925]`.
- At absolute list bottom the last "Open request" `[81,2045][859,2182]` vs nav
  top `y=2159` → ~23px hit-target bleed vs fully-occluded `[81,2329][859,2400]`
  pre-fix.

**Test:** new near-bottom FAB case in `mobile/test/app_shell_fab_test.dart`.

## Fix #4 — Post Need entry points

**Decision (no code change):** a signed-in user has 2 stable entry points
(FAB + Quick Actions tile) plus the first-run intent card when applicable.
Verified on-device (`p05_o3.xml` / `p05_v.xml`: FAB `[680,1778][1038,1925]`,
Quick Actions "Post Need" `[84,221][524,324]`). No third entry point needed;
documented here per the audit request.

## Fix #5 — Create-need draft title restore

**Root cause:** `_restoreDraftIfAvailable` assigned `_titleController.text`
first; the `.text` setter fires `_handleDraftChanged` → `_cacheDraft()`
synchronously mid-restore, writing an intermediate partial snapshot (title set
but `_category`/`_step`/`_neededWithin` still defaults). With an empty cached
title, `hasContent` computed false → `_CreateNeedDraftCache.clear()` wiped the
cache while local state (category/urgency) still restored — the audit's
"Plumber / Today restored, title empty" symptom, self-perpetuating via
`dispose` rewrites.

**Fix (`mobile/lib/features/post_create/presentation/create_need_page.dart`):**
- Added `bool _restoringDraft = false`.
- `_handleDraftChanged` early-returns while `_restoringDraft`.
- `_restoreDraftIfAvailable` and `_applyInitialParams` wrap their assignments in
  the flag and end with a single `if (cached.hasContent) { _cacheDraft(); }` so
  the complete restored snapshot is persisted once, atomically.

**Verification:**
- New `mobile/test/create_need_draft_roundtrip_test.dart`: type a title, select
  Electrician, navigate away (dispose caches), reopen → title text and chip
  selection both survive. Passes.
- On-device: opened create-need, typed "Coldstart" (`text="Coldstart"`,
  `p05_o6.xml`), selected Electrician (hero shows Electrician, `p05_o8.xml`),
  Back to home (dispose), reopened → hero Electrician (`p05_p1.xml`),
  "Discard draft" restore banner present (`p05_p3.xml`), and the title field
  shows `text="Coldstart"` (`p05_p4.xml`).

## Fix #6 — Search loading skeleton

**Fix (`mobile/lib/features/search/presentation/search_page.dart`):** replaced
the bare `Center(child: CircularProgressIndicator())` with `_ResultsLoading` — a
`ListView` with a shimmer "found" header plus a glass `ServiqSurface` holding 5
`_ProviderResultSkeleton` rows (avatar circle + name/location lines + mini pill
+ chevron), reusing the shared `LoadingShimmer` (`design_system.dart`).

**On-device verification:** triggered "painter" search, instant dump caught the
loading state — `content-desc="Loading"` header `[42,628][1038,659]` plus 5
skeleton rows at y=722/896/1069/1242/1415, each with avatar circle
(e.g. `[74,722][189,838]`), name/location lines (`[221,722][588,757]` /
`[221,762][483,791]`), pill (`[221,812][389,864]`), chevron
(`[949,722][1006,780]`) — `p05_s1.xml`, screenshot `p05_loading1.png`. The
search then completed to the "No providers found" empty state (`p05_s2.xml`).

## Verification

- `flutter analyze --no-pub` — **No issues found** (13.3s).
- `flutter test` — **214 tests passed** (baseline 200 at Phase 0.5 start; +1 FAB
  near-bottom, +2 welcome Work empty-state, +1 create-need draft round-trip,
  +10 from earlier landed passes). `app_shell_fab_test.dart`,
  `onboarding_handoff_test.dart`, `welcome_work_empty_state_test.dart`,
  `create_need_draft_roundtrip_test.dart` all green.
- No web/`tsc` changes were needed in this pass.

## Device state

- **Restored to the audit's found state:** `intent=find_help`,
  `intentChosen=false`, `intentPromptDismissed=false` — the "Who are you?" card
  renders on cold start again (`prefs_restore.xml`, readback verified).
- Transient on-device artifacts (a "Coldstart" in-memory draft, the "painter"
  search query) live only in process memory / the current app session and do
  not persist across app restarts; no server data was created.
- The audit's posted test request ("Plumberbathroomleak", ID
  `f4e9d87f-833f-4ca6-8ee9-d0dfc4530bbf`) was left untouched.

## Out of scope / open items

- Notifications card text a11y (audit finding #11 / hand-off item 6) — Phase 1.
- "Discard changes?" modal reproduction (audit finding 2) — Phase 1.
- The intent card is a first-run surface; keep the `_WhoAreYouCard` behavior
  verified here in mind when Phase 1 touches the welcome page.

Evidence index (p05-verify): dumps `p05_q1/q2/q3` (#1), `p05_o3` (#2), FAB
bounds dumps (#3), `p05_o6/o8/p1/p3/p4` + `create_need_draft_roundtrip_test.dart`
(#5), `p05_s1/s2` + `p05_loading1.png` (#6), `prefs_before/restore.xml` (state).
