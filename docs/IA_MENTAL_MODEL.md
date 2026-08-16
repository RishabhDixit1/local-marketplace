# ServiQ Mobile IA Mental Model (3 tabs)

One-page summary of how the mobile app is organized in the user's head, and
the rules that keep it consistent. Covers the app shell, the three tabs, and
the surfaces that live outside the shell.

## The mental model

The whole app is three rooms, plus a hallway of full-screen pages you walk
into and come back from.

| Room | Route | The user's job here |
| --- | --- | --- |
| **Need Something** | `/app/welcome` | Answer "what do I need right now?" Post a need, ask the assistant, catch up on messages and my active needs/work. |
| **Explore** | `/app/discovery` | Browse the neighborhood: services, zones, nearby providers on a map. Structured discovery, not task-oriented. |
| **You** | `/app/profile` | Manage my identity, trust, listings, orders, payments, and settings. The command hub for my account. |

## Tab rules

1. **One job per tab.** Need Something is *action* (post, ask, reply).
   Explore is *discovery* (browse, compare, locate). You is *account*
   (manage, trust, pay). A tile belongs in exactly one tab.
2. **The FAB appears only on the action tabs** (Need Something, Explore);
   it is hidden on You so the profile hub is never confused with a post
   action.
3. **Deep pages live outside the shell.** Chat threads, tasks, orders,
   listings, quotes, provider profiles, settings, etc. are full pages pushed
   with a back button. The three tabs are the only state that survives tab
   switches.
4. **No duplicate info.** The same fact (a provider's address, the user's
   name, a role label) must not render twice in one view. When two
   components would show it, one shows the summary and the other reveals
   the full value (e.g., chat thread header: short area under the name,
   full address behind the location chip).

## Cross-tab primitives

- **Section header**: `SectionHeader` (title + subtitle + optional action)
  is the single section-title language on Need Something and Explore, and is
  now reused by You's hub sections.
- **Search entry + AI prompt**: Explore leads with an AI prompt bar and a
  search entry; both funnel into `/app/search`. Search accepts
  `?browse=1` to skip the fresh-search state and auto-load all providers.
- **Glass surfaces**: `ServiqSurface` (glass) and `SectionCard` are the two
  card languages; glass is reserved for hero/immersive surfaces, cards for
  tappable lists.

## Page titles

- Tabs use the shell's bottom nav label (Need Something / Explore / You).
- Pushed pages always show a `ServiqTopBar` title + back button so the user
  always knows they left the tab shell.
