# ServiQ Flutter Mobile — UI Polish Implementation Plan (phase index)

Governing constraint: `docs/ServiQ_UI_UX_Standing_Constraint.md` — no new features, improve what exists only.

- **Phase 0 — Full audit, no code changes.** COMPLETE (see `docs/2026-08-15-phase-0-ondevice-audit.md`). Produced the current known-issue reconciliation and hand-off list.
- **Phase 0.5 — Fast fix pass** (this session, Part B below): the specific items Phase 0 already root-caused, fixed before the broader design-system work so visible regressions don't linger.
- **Phase 1 — Design system consolidation.** One source of truth for color, type, spacing, elevation, iconography — close the audit gap where screens still use ad hoc styling instead of the shared component library.
- **Phase 2 — Core journey: Need Something + Explore.** The highest-traffic screens, treated as their own session.
- **Phase 3 — Supporting screens: Tasks list, Chat, Notifications, You.** Tasks-card density reduction is the largest item here.
- **Phase 4 — Quality pass.** Loading/empty/error state consistency, responsiveness, route-error coverage audit, performance spot-check.
- **Phase 5 — Real-world test.** 5 people unfamiliar with the app, one task each, watch and fix what blocks them.

Each phase session starts by reading the standing constraint file, this plan, and the previous phase's completion report (not just "the app as it currently is"). Each phase ends with a written completion report and on-device evidence for every claimed fix — no fix is marked done on self-report alone.
