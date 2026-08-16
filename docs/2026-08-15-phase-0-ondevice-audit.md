# Phase 0 — On-Device Full Audit (Aug 15 2026)

Scope: every user-facing surface of the ServiQ Flutter app, verified **on
device** via uiautomator semantics dumps (exact bounds) + screenshots. No code
changes made this phase (device state was restored to its found state at the
end — see [Device state](#device-state)).

- [Method](#method)
- [Environment](#environment)
- [Flows verified end-to-end](#flows-verified-end-to-end)
- [Known-issue reconciliation](#known-issue-reconciliation)
- [New findings](#new-findings)
- [Accessibility findings](#accessibility-findings)
- [Device state](#device-state)
- [Blockers & evidence limits](#blockers--evidence-limits)
- [Hand-off to Phase 1](#hand-off-to-phase-1)

---

## Method

- Walked every screen on emulator-5554, capturing `uiautomator dump` XML
  (semantics + bounds) at each step and PNG screenshots for visual review.
- Every claim below is backed by a dump/screenshot artifact (indexed as
  `dumps/##_name.xml`, `shots/##_name.png`).
- Source cross-checks (`rg` / file reads) used only where a behavior is not
  observable in semantics (e.g. truncation, gating logic).
- No app code was modified. The only system-side writes were test data
  (a posted request) and a device-prefs restore.

## Environment

- Device: emulator-5554, 1080x2400, API 37.
- App: `com.serviq.serviq_mobile`, debug APK built Aug 15 14:44 (newer than all
  source, so installed build == current source).
- Flutter 3.41.9, branch `main` (~101 pre-existing uncommitted modified files).
- Test account: `dixit4119` (signed in).
- Evidence dir:
  `/var/folders/yf/t84qrcx51zvbxtj8ygtx05yc0000gn/T/opencode/p0-audit/`.

## Flows verified end-to-end

| Flow | Outcome | Evidence |
|---|---|---|
| Home (Need Something tab) | Greeting clean ("Good evening"), AI bar, Quick actions, FAB, Work section | dumps 26, 46, 61, 80; shot 00 |
| Explore tab | Discover hero, AI bar, Popular Services chips, "N providers near you", Open map, zones | dumps 15, 33, 47; shot 15 |
| Tasks (Activity) page | "Next up", "Next-action queue", Filters sheet (Role/Status lanes), "Done work" cards | dumps 18–22 |
| Chat / Inbox | "0 unread", 1 quote + 1 task thread, thread previews, cleaned names | dump 23 |
| Search | "Search nearby", category chips, "1 provider found" fast load | dumps 27–28 |
| Notifications | "All caught up", Mark all read / Clear all, tabs, "View request" rows | dump 29; shot 29 |
| Profile (You tab) | Profile Hub, grouped sections, readiness 4/4, "Local member" once | dumps 30–32 |
| Post a Need | **Full 4-step flow + submission** | dumps 33–79; shot 61 |
| Posted request lands in Tasks | "My needs" 0→1, queue 8→9, Active work card shows the new request | dumps 80–83 |

### Post a Need — detailed (the money-loop path)

- Step 1 Need: intent pills, category grid, title field with 160-char counter,
  validation messages ("Add a clear request title." / "Use a little more detail
  in the title."), sticky CTA. Verified on-device.
- Step 2 Where: urgency chips, location field, In person/Remote, reach. Verified.
- Step 3 Proof: budget chips, budget + description fields, Photos. Verified.
- Step 4 Review: summary (category/urgency/budget/location), "Ready to
  publish.", Edit + Post Need buttons. Verified.
- **Submission succeeded** — "Request posted nearby", "30 nearby providers
  matched. 30 notifications have already started going out.", 8 km reach,
  Matched: 30 / Queued: 30 / Speed: 1s, Request ID
  `f4e9d87f-833f-4ca6-8ee9-d0dfc4530bbf`. (shot 61, dump 79)
- The request appeared in Tasks: Work tile 0→1, queue 8→9, Filters
  Requested 5→6 / Active 0→1, and an Active-work card "Plumberbathroomleak /
  Price on request / Ghaziabad / 1m ago / Watch Chat". (dumps 80–83)

## Known-issue reconciliation

| # | Known issue | Status | Evidence |
|---|---|---|---|
| 1 | Intent card re-shows every cold start | **Root-caused** — `prepareForAuth` writes the intent value but never `writeIntentChosen(true)`; gate `welcome_page.dart:701-703` requires `!hasChosenIntent`. Dismissal persists across restart. | dumps 26 vs 11/14; source read |
| 2 | Work section zero-state | **Confirmed bug** — only flat "0 My needs / 0 My work" tiles exist; no zero-state code path (`_HomeQuickActions` single impl). | dumps 46/61; source |
| 3 | Home FAB overlap | **Partial / still open** — hide-on-scroll-down works (bounds collapse), but on scroll-up FAB `[680,1778][1038,1925]` overlaps Trusted rail "Open" `[893,1917][1038,2054]`; "Open request" occluded by bottom nav at list bottom. | dumps 06/07/61 |
| 4 | Post Need entry points | 3 on home (FAB + Quick actions tile + intent card when shown). Verified. | dumps 46/61/80 |
| 5 | Garbled display names | **FIXED** — `cleanPersonName` on feed path (`lib/server/communityData.ts:442` via `loadCommunityFeedSnapshot`), also `profile/utils.ts:89`, `providers-by-category:232`, `ai/prompt:99`. On-device chat shows cleaned "Chaturvedi Chakori". | dump 23; source |
| 6 | Explore == web layout | Resolved — single search entry (AI bar); no "How ServiQ Works" card; no Marketplace/List-Your-Business promos (absent from code); zones present; FAB hides on scroll. | dumps 15/33/47 |
| 7 | Search loading skeleton | **Partial** — `search_page.dart:450` still bare `CircularProgressIndicator`; LoadingShimmer skeletons only in `discovery_page.dart`. | dump 27/28; source |
| 8 | "New to reviews" rating slot | **Verified in source** — `ratingLabel` in `feed_snapshot.dart:428-435` (`reviewCount == 0`), `people_snapshot.dart:462`, `provider_profile_page.dart:853`. | source read |
| 9 | Seed/test accounts in provider lists | **Fixed server-side** — `is_test` flag (migration `20260814000000`, 10 accounts), filtered in `communityData.ts:398/1341`, `providers-by-category:66,89`. No test-named providers seen on-device. | source read |
| 10 | Route error page | **Verified** — `RouteErrorPage` wired as GoRouter `errorBuilder` (`app_router.dart:100-103`), takes `location` + shows Retry; 3 widget tests exist. | source read |
| 11 | Notifications a11y (card text) | **Confirmed gap** — card title/message text is NOT in the a11y tree (only "View request" buttons + tabs exposed). | dump 29 |

## New findings

1. **Create-need draft restore drops the title text.** After app relaunch, the
   draft restores category + urgency ("Plumber / Today") but the title field
   restores empty. Category selection can also silently change if the tap
   lands on the category grid instead of the field (observed: Plumber → RO
   Service). Severity: Medium (user retype).
2. **Spontaneous "Discard changes? …unsaved business profile" modal** appeared
   mid-scroll on home (dismissed "Keep editing"). Unexplained; needs a
   repro/scenario. Severity: Low-unknown.
3. **Emulator text input flakiness** (input events deliver partial text; IME
   occasionally does not open on field tap; one Back press can exit the app)
   is a test-harness issue, not app code — but it inflates QA time. Not an app
   finding.

## Accessibility findings

- Notifications card title/message not exposed to screen readers (only the
  action buttons). `SectionCard` in `section_card.dart` has no
  `ExcludeSemantics`, yet the text still does not surface — needs a human
  TalkBack pass.
- Sub-48px touch targets and semantic gaps flagged in the existing Phase 1
  audit (`docs/MOBILE_AUDIT.md`) remain relevant; this phase adds the
  notifications case above.
- uiautomator content-desc carries full text even when visually truncated, so
  truncated-label checks ("Accepted connec…") require human screenshot review.

## Device state

- During the audit the handoff prefs were accidentally changed to
  `intent=business_setup` + `intentChosen=true` + `intentPromptDismissed=true`
  (card hidden, one-time launchpad redirect).
- **Restored to the found state** at the end: `intent=find_help`,
  `intentChosen=false`, `intentPromptDismissed=false` — verified the "What
  brings you to ServiQ?" card renders on cold start again (dump 84, shot 62).
- Test data created during audit: one posted request (ID
  `f4e9d87f-833f-4ca6-8ee9-d0dfc4530bbf`, "Plumberbathroomleak"). Left in place
  so Phase 1 can use it as live data; delete when convenient.

## Blockers & evidence limits

- uiautomator dump intermittently returns "null root node" during transitions
  / with IME open; mitigated with sleep+retry.
- `adb input text` is unreliable on this emulator (partial delivery).
- The model has no image input: pixel-level truncation, color/contrast, and
  TalkBack behavior need human screenshot review (shots saved).
- Missing constraint docs on disk: `ServiQ_UI_UX_Standing_Constraint.md` and
  the Round 4 prompt doc were not found anywhere — teams should re-upload.

## Hand-off to Phase 1

Open items for Phase 1 (no known-issue list carries a code fix in this doc):

1. Decide the intent-card fix (write `intentChosen` in `prepareForAuth`, or
   change the show gate) — now that the root cause is pinned.
2. Add the Work section zero-state ("Nothing in motion yet" card) — currently
   flat counters only.
3. Revisit Home FAB overlap with the Trusted rail "Open"/"Open request"
   actions (scroll-up case, bottom-of-list occlusion).
4. Swap the bare `CircularProgressIndicator` in `search_page.dart:450` for the
   shared `LoadingShimmer` used by `discovery_page.dart`.
5. Restore draft title text in create-need draft restore.
6. Notifications card text a11y pass (TalkBack) + decide whether SectionCard
   needs semantics wiring.
7. Reproduce the "Discard changes?" modal on home before accepting it.

Evidence index: `dumps/00–84` (XML, 83 files), `shots/00–62` (PNG, 9 files).
