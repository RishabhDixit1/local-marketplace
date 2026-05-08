# Flutter Mobile Tab Inspection: Next Implementation Notes

Date: 2026-05-08

## Tab 1: Home

- Current: Home has Post Need, Work, Inbox, and readiness prompts, plus feed cards.
- Gap: Business AI setup can appear only as a conditional readiness prompt, so providers may miss it.
- Next: keep Home focused, but make the top actions point clearly to Inbox/Work/Profile readiness and use Profile as the persistent Business AI entry point.

## Tab 2: People

- Current: Search, discovery modes, category rail, filters, compare panel, provider cards.
- Gap: The filter area is dense, but core provider actions are present.
- Next: later pass should collapse advanced filters into a sheet once provider discovery is stable.

## Tab 3: Work

- Current: Task lanes and role filters exist; route focus from notifications works.
- Gap: Lane/filter controls can feel like tabs inside tabs.
- Next: later pass should combine role filter and lane summary into a simpler work dashboard.

## Tab 4: Inbox

- Current: Inbox route and bottom tab exist, but the first card says "Deal room."
- Gap: Users can think Inbox is missing because the screen title and main card use different language.
- Next: rename the main inbox card to "Inbox" and clarify that quotes/tasks live inside inbox threads.

## Tab 5: You / Profile

- Current: Edit Profile, Business Setup, Listings, Trust, and Settings exist as sections.
- Gap: Six wrapping section chips make the UI cluttered and bury the important actions.
- Next: add a visible top action cluster for Business AI setup, Edit Profile, and Inbox; convert the section selector into a compact horizontal rail.

## Implementation Order

1. Make Profile's top actions expose Business AI setup, Edit Profile, and Inbox immediately.
2. Declutter Profile's section selector without removing existing sections or test keys.
3. Rename Inbox's main card from "Deal room" to "Inbox."
4. Verify responsive/widget tests.
