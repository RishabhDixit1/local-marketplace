# ServiQ Mobile — Standing UI/UX Constraint (read before every polish session)

**This file governs every future "make it billion-dollar grade" / "fix the UI" / "polish this" session, regardless of what the accompanying prompt says. If a specific prompt ever conflicts with this file, this file wins.**

## The one rule

**Improve what exists. Do not add features, screens, tabs, or sections.**

Every change in a UI/UX session must be answerable to: *does this make an existing screen clearer, cleaner, or more coherent — or does it add surface area?* Only the first is in scope. If you (the agent) find yourself creating a new screen, a new tab, a new top-level section, or a new "concept" the app didn't already expose to users, stop — that's out of scope for this class of session, no matter how good the idea is or how directly it traces back to the product vision.

## Why this rule exists

ServiQ's broader vision (Discover / Connect / Get It Done — businesses, products, services, people, tasks, provider dashboards, analytics, subscriptions) is real and worth building eventually. But the app is pre-revenue, pre-transaction, single-locality pilot stage, built by a team of three with no dedicated developer. Every round of feedback on this app so far has traced back to the same root cause: too many concepts each getting their own card, section, or badge, competing for attention with no hierarchy. Adding more surface area to chase the vision doc — a People tab, a Products section, a provider analytics dashboard — recreates that exact problem, just with more features this time. The vision gets built by nailing one core loop (search → find a real provider → chat → get it done → review) inside the *existing* three tabs, not by adding rooms to a house that's already cluttered.

## What "improve" means, concretely

In scope for a polish session:
- Simplifying, consolidating, or removing duplicate information within an existing screen.
- Fixing visual hierarchy, density, spacing, typography, iconography consistency.
- Fixing bugs (data-binding errors, layout collisions, truncated text, crashes, raw error states).
- Aligning visual language across existing screens so the app reads as one product.
- Making an existing search/discovery flow smarter (e.g. better AI intent routing within the existing AI bar) — improving how an existing feature works, not adding a new one.

Out of scope for a polish session (belongs in a separate, explicitly-approved feature session instead):
- New tabs or new top-level nav destinations.
- New content types as separate browsable sections (e.g. a standalone "People" directory, a standalone "Products" catalog) — if the vision calls for these, they should surface as filters/results *within* the existing Explore search, not new places to navigate to.
- Provider/business dashboard tooling beyond what already exists (the current lightweight "Business" entry point on You/Profile is enough for this stage).
- Any new settings, preferences, or configuration screens.
- Anything that would require a new onboarding step to explain.

## How to use this file

Every OpenCode UI/UX prompt for ServiQ mobile should be read alongside this file. If a prompt's instructions ever seem to call for new surface area, flag it back rather than building it — the accompanying prompt may have been written loosely; this file is the actual constraint.
