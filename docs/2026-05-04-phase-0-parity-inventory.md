# Phase 0 — Parity inventory & contracts

Date: 2026-05-04  
Owner: Team  
Related: [`docs/2026-05-03-flutter-webapp-parity-premium-plan.md`](2026-05-03-flutter-webapp-parity-premium-plan.md)

This document satisfies **Phase 0 exit criteria**: parity stance per surface, API coverage vs Flutter, and a repeatable money-loop script. **Redesign work (Phases 1+) should not start** until open rows here are triaged (parity / native-only / deferred).

---

## 1. Screen parity matrix

**Convention**

| Column | Meaning |
| --- | --- |
| **Parity** | Same primary jobs-to-be-done as web; gaps are polish only. |
| **Partial** | Core path exists; meaningful UX or API gaps vs web. |
| **Native-only** | Deliberately different or mobile-first (document why). |
| **Deferred** | Not targeting parity yet (link issue/milestone). |

**README “Key Routes”** ([`README.md`](../README.md)): `/`, `/dashboard`, `/dashboard/welcome`, `/dashboard/saved`, `/dashboard/chat`, `/dashboard/people`, `/dashboard/tasks`, `/dashboard/orders`, `/dashboard/provider/orders`.

### 1.1 Flutter routes (`mobile/lib/app/router/app_router.dart`)

Capture screenshots at **320**, **390**, and **430** logical width (iOS/Android). Store under `mobile/release/screenshots/<route>/<width>.png` (create folder when you run the pass).

| Flutter path | Primary UI | Web counterpart | Parity stance | Notes / follow-up |
| --- | --- | --- | --- | --- |
| `/` | Router placeholder | `/` | Partial | Resolves to sign-in or app; web landing is richer. |
| `/setup` | `SetupPage` | Env/bootstrap (web: local only) | Native-only | Document in QA matrix. |
| `/sign-in` | `SignInPage` | `/` auth | Partial | Branded / value prop vs web. |
| `/app/welcome` | `WelcomePage` (home tab) | `/dashboard/welcome` | Partial | Surfaces + copy; saved/hub differs. |
| `/app/explore` | `FeedPage` (Find Help) | `/dashboard` | Partial | Same API feed; card density differs. |
| `/app/people` | `PeoplePage` | `/dashboard/people` | Partial | No connect/save flows like web. |
| `/app/tasks` | `TasksPage` | `/dashboard/tasks` | Partial | Edge cases, map overlay (web). |
| `/app/chat` | `ChatPage` | `/dashboard/chat` | Partial | Validate parity of composer + states. |
| `/app/chat/thread/:threadId` | `ChatPage` | `/dashboard/chat` | Partial | Deep links + push. |
| `/app/profile` | `ProfilePage` | `/dashboard/profile`, settings | Partial | IA: command center split (Phase 4). |
| `/app/search` | `SearchPage` | Search in dashboard shell | Partial | |
| `/app/notifications` | `NotificationsPage` | Notification center in layout | Partial | List via Supabase; web shell differs. |
| `/app/create-need` | `CreateNeedPage` | Create flows / needs | Partial | Web also has post modal. |
| `/app/provider-onboarding` | `ProviderOnboardingPage` | Provider onboarding | Partial | |
| `/app/provider-launchpad` | `ProviderLaunchpadPage` | `/dashboard/launchpad` | Partial | Stepper/review parity (Phase 3). |
| `/app/provider-listings` | `ProviderListingsPage` | `/dashboard/provider/listings` | Partial | |
| `/app/provider/:providerId` | `ProviderProfilePage` | `/profile/[slug]` or people card | Partial | Slug vs id URLs. |
| `/app/orders` | `OrdersPage` | `/dashboard/orders` | Partial | Provider lens lives under profile on mobile. |
| `/app/orders/:orderId` | `OrderDetailPage` | Order detail surfaces | Partial | |
| `/app/checkout` | `CheckoutPage` | `/checkout`, cart drawer | Partial | No cart; query-param checkout only. |
| `/app/quote` | `QuoteRoomPage` | Quote flows in tasks/chat | Partial | |

### 1.2 Web-only or web-leading surfaces (no dedicated Flutter route yet)

| Web route | Parity stance | Notes |
| --- | --- | --- |
| `/dashboard/saved` | **Deferred** → Phase 7 | Mobile saves via API but no library hub. |
| `/dashboard/settings` | Partial | Settings largely inside `ProfilePage`. |
| `/dashboard/provider` hub | Partial | Web top nav “Grow Business”; mobile buried in profile/onboarding. |
| `/dashboard/provider/orders` | Partial | Route exists on web; mobile uses orders + provider context. |
| `/dashboard/launchpad/review` | Partial | Fold into launchpad parity (Phase 3). |
| `/dashboard/posts`, `/dashboard/create_post` | Deferred | Product decision: posts vs needs-first on mobile. |

---

## 2. API coverage — Next.js `app/api` vs Flutter

Each row is a `route.ts` under [`app/api/`](../app/api/). **Caller** is the Dart module that issues HTTP to Next (via [`mobile/lib/core/api/mobile_api_client.dart`](../mobile/lib/core/api/mobile_api_client.dart)) unless noted.

| API route | Flutter caller | Notes |
| --- | --- | --- |
| `GET/POST /api/auth/send-link` | [`mobile/lib/core/auth/mobile_auth_service.dart`](../mobile/lib/core/auth/mobile_auth_service.dart) | |
| `GET /api/community/feed` | [`mobile/lib/features/feed/data/feed_repository.dart`](../mobile/lib/features/feed/data/feed_repository.dart) | |
| `POST` interest flows | same + [`feed_repository.dart`](../mobile/lib/features/feed/data/feed_repository.dart) (`express-interest`, `withdraw-interest`) | |
| `GET /api/community/people` | [`mobile/lib/features/people/data/people_repository.dart`](../mobile/lib/features/people/data/people_repository.dart) | |
| `POST /api/feed-card-interactions` | [`mobile/lib/features/feed/data/feed_interactions_repository.dart`](../mobile/lib/features/feed/data/feed_interactions_repository.dart) | |
| `GET/POST /api/feed-card-saves` | **N/A** | Web often reads `feed_card_saves` via Supabase client; mobile should align in Phase 7. |
| `GET/POST /api/launchpad/draft`, `POST .../publish` | [`mobile/lib/features/provider/data/launchpad_repository.dart`](../mobile/lib/features/provider/data/launchpad_repository.dart) | |
| `GET /api/mobile/account` | [`mobile/lib/features/profile/data/profile_repository.dart`](../mobile/lib/features/profile/data/profile_repository.dart) | Bundle for profile hub. |
| `POST /api/needs/publish` | [`create_need_repository.dart`](../mobile/lib/features/post_create/data/create_need_repository.dart), [`task_post_repository.dart`](../mobile/lib/features/task_post/data/task_post_repository.dart) | |
| `POST /api/notifications/subscribe` | [`mobile/lib/core/firebase/mobile_push_notifications.dart`](../mobile/lib/core/firebase/mobile_push_notifications.dart) | Push token registration. |
| `GET /api/tasks/help-requests` | [`mobile/lib/features/tasks/data/task_repository.dart`](../mobile/lib/features/tasks/data/task_repository.dart) | |
| `POST /api/tasks/progress` | [`task_repository.dart`](../mobile/lib/features/tasks/data/task_repository.dart) | |
| `GET/PATCH/POST /api/orders`, `/api/orders/[id]` | [`mobile/lib/features/orders/data/order_repository.dart`](../mobile/lib/features/orders/data/order_repository.dart) | |
| `POST /api/payment/create-order`, `POST .../verify` | [`order_repository.dart`](../mobile/lib/features/orders/data/order_repository.dart) | Checkout uses Razorpay SDK + verify. |
| `GET/POST /api/quotes/draft`, `POST .../send`, `POST .../accept` | [`mobile/lib/features/quotes/data/quote_repository.dart`](../mobile/lib/features/quotes/data/quote_repository.dart) | |
| `POST /api/chat/direct`, `POST .../messages` | [`mobile/lib/features/chat/data/chat_repository.dart`](../mobile/lib/features/chat/data/chat_repository.dart) | |
| `GET/POST/PATCH/DELETE /api/provider/listings` | [`mobile/lib/features/provider/data/provider_listing_repository.dart`](../mobile/lib/features/provider/data/provider_listing_repository.dart) | |
| `POST /api/upload/post-media` | [`create_need_repository.dart`](../mobile/lib/features/post_create/data/create_need_repository.dart) | Multipart. |
| `POST /api/upload/listing-image` | [`provider_listing_repository.dart`](../mobile/lib/features/provider/data/provider_listing_repository.dart) | Multipart. |
| `POST /api/needs/status` | [`task_repository.dart`](../mobile/lib/features/tasks/data/task_repository.dart) | |
| `/api/connections` | **N/A** | Phase 7 — People connect UX. |
| `/api/connections/[requestId]` | **N/A** | Phase 7. |
| `/api/profile/save` | **N/A** | Phase 4 — align with web canonical save. |
| `/api/profile/avatar` | **N/A** | Phase 4 if not using Supabase-only uploads. |
| `/api/user-settings` | **N/A** | Phase 4 / settings route. |
| `/api/presence/ping` | **N/A** | Web/dashboard may use; mobile may rely on `community/people` payload. |
| `/api/posts/publish`, `/api/posts/manage` | **N/A** | Product: parity with Create Post vs needs-only. |
| `/api/needs/accept`, `.../reopen` | **N/A** | Confirm task UI coverage vs web. |
| `/api/live-talk` | **N/A** | |
| `/api/notifications/send-push` | **N/A** | Server-to-device; not a mobile client caller. |
| `/api/observability` | **N/A** | Web client forwarding; mobile may add later. |
| `/api/system/startup-check` | **N/A** | Admin/diagnostic web banner. |

**Regenerate this table’s mechanical check**: `npm run phase0:api-coverage` (or `bash scripts/phase0_verify_api_coverage.sh` from repo root). The script matches `api/...` substrings in `mobile/lib/**/*.dart` (dynamic routes use a path prefix, e.g. `api/orders/`). A **missing** line means no mobile HTTP call to that path—see the Notes column here, not the script output alone.

---

## 3. Money-loop test script (manual, both platforms)

Run against **staging** or **local** with known consumer + provider test accounts. Goal: prove the revenue path works end-to-end and capture screenshots at critical steps.

### Preconditions

- Next.js API reachable from device/emulator (`mobile` [`README.md`](../mobile/README.md) — API base URL).
- Supabase auth works; Razorpay test keys if exercising online pay (or skip to COD).
- Two accounts: **consumer** `C`, **provider** `P`.

### Steps

1. **Browse (guest or signed out)**  
   - Web: open `/dashboard` or `/dashboard/welcome` as allowed by product.  
   - Mobile: open Explore/home as allowed.  
   - *Screenshot*: browse state.

2. **Save**  
   - Web: save a feed card on `/dashboard/welcome` or `/dashboard`.  
   - Mobile: save on Welcome/Explore card (`feed-card-interactions`).  
   - *Screenshot*: saved bookmark state (web: optional `/dashboard/saved` — mobile may only show on-card state until Phase 7).

3. **Chat**  
   - From a provider card or profile: start conversation (web chat, mobile `ChatPage`).  
   - Send one message each direction.  
   - *Screenshot*: thread open.

4. **Quote**  
   - Provider or consumer: open quote flow (web tasks/chat; mobile `QuoteRoomPage` or entry from Tasks).  
   - Draft → send → other party accepts (path depends on role).  
   - *Screenshot*: quote accepted state.

5. **Pay**  
   - Mobile: `CheckoutPage` from checkout deep link with item params; complete **COD** or **Razorpay test**.  
   - Web: checkout + cart path per web flows.  
   - *Screenshot*: payment success / order created.

6. **Order state**  
   - Confirm order appears in orders list + detail (consumer); provider view if applicable.  
   - Tasks board shows consistent status if wired to same order/help-request.  
   - *Screenshot*: order detail + task row.

### Pass / fail

- **Pass**: No blocking errors; order id consistent across orders + detail + tasks where applicable.  
- **Fail**: File an entry in [`mobile/release/friction_log.md`](../mobile/release/friction_log.md) with severity and loop step.

Optional automation: extend Playwright (`tests/e2e/`) for web; add Flutter integration tests later for mobile loop (Phase 8).

---

## 4. Phase 0 exit checklist

- [ ] Screenshot set captured for every row in §1.1 (320 / 390 / 430).  
- [ ] §1.2 web-only rows triaged (issue links or “Phase N”).  
- [ ] §2 reviewed; N/A rows have an owner and phase.  
- [ ] §3 money-loop executed once on web + once on mobile; friction log updated if failed.  
- [ ] `bash scripts/phase0_verify_api_coverage.sh` exits 0.  

---

## 5. Roadmap pointer (Phases 1–8)

Execution order after Phase 0 closes:

1. **Phase 1** — Design system v2 (`design_tokens.dart`, shell, cards, async states).  
2. **Phase 2** — Auth & onboarding (`sign_in_page`, `setup_page`, `onboarding_handoff`, `/api/mobile/account`).  
3. **Phase 3** — Launchpad parity (`provider_launchpad_page`, web `app/dashboard/launchpad`).  
4. **Phase 4** — Profile command center + `/api/profile/save`.  
5. **Phase 5** — `feed_card.dart`, `provider_card.dart`, welcome/people.  
6. **Phase 6** — Cart + checkout + orders lenses (highest commerce leverage).  
7. **Phase 7** — Saved hub + connections API + notifications alignment.  
8. **Phase 8** — Reliability, deep links, perf, i18n, security hardening.

Choose **commerce-first** vs **social/trust-first** after Phase 0 based on §1–§3 results (e.g. if money-loop fails on checkout, bias Phase 6 earlier; if People/connect blocks trust, bias Phase 7).

---

## Phase 1 — Design system (started)

Implemented in-repo:

- **Tokens**: [`mobile/lib/core/theme/design_tokens.dart`](../mobile/lib/core/theme/design_tokens.dart) — refined neutrals, calmer primary teal, `AppRoleColors`, shimmer tokens, touch targets.
- **Theme**: [`mobile/lib/core/theme/app_theme.dart`](../mobile/lib/core/theme/app_theme.dart) — accent-forward bottom nav / chips / text buttons (less all-green chrome).
- **Primitives**: [`mobile/lib/core/design_system/`](../mobile/lib/core/design_system/) — `ServiqAsyncBody`, `ServiqSurface`, `ServiqRecoveryBanner`, `ServiqScaffold`, `ServiqStatusPill` / `ServiqLocationPill` / `ServiqPricePill`, barrel [`design_system.dart`](../mobile/lib/core/design_system/design_system.dart).
- **Surfaces**: Feed uses `ServiqStatusPill`; empty/error states use tokenized icon wells; **Feed / People / Tasks** async bodies use `ServiqAsyncBody`; shell FAB uses `Theme.of(context).colorScheme.primary`.

**Update (next slice):** `SectionCard` now delegates to [`ServiqSurface`](../mobile/lib/core/design_system/serviq_surface.dart) (flat). **Chat** (inbox + message thread), **notifications**, **orders list**, and **order detail** use `ServiqAsyncBody`. Notification and chat chrome colors moved to `AppColors` / tokens; `MetricTile` uses tokens.

**Update (Phase 1 parity sweep):**

- **ServiqAsyncBody** now covers **search** (nested feed + people), **profile**, **provider onboarding**, **listings**, **launchpad**, **quote room**, **provider profile**, plus earlier screens.
- **Checkout** shows [`ServiqRecoveryBanner`](../mobile/lib/core/design_system/serviq_recovery_banner.dart) when order placement / Razorpay open fails (alongside existing snackbars).
- **Provider onboarding** checklist uses semantic success/surface tokens (`successSoft`, `success`, …).
- **Deferred:** [`welcome_page.dart`](mobile/lib/features/welcome/presentation/welcome_page.dart) uses custom composite loading/error for multiple `AsyncValue`s (not a flat `.when`); refactor later if we introduce a combined provider.

**create_need_page:** Already relies on `AppColors` throughout; no separate hex sweep needed.

### Phase 2 — Auth & onboarding (started / grounded)

- [`main.dart`](mobile/lib/main.dart) already wires **`SharedPreferencesOnboardingHandoffStore`** into [`OnboardingHandoffController`](mobile/lib/features/auth/data/onboarding_handoff.dart) — intent + post-auth route **persist across restarts**.
- [`sign_in_page.dart`](mobile/lib/features/auth/presentation/sign_in_page.dart) already includes **ServiqBrandLockup**, **intent selector**, **resume handoff** card when `hasStoredHandoff`, and trust strip — branded entry path is in place.
- **Next Phase 2 coding pass** (when you prioritize it): optional **`/api/mobile/account`**-driven **readiness banner** after login (e.g. nudge toward launchpad when profile incomplete), and tighter router polish after `completeAuthHandoff`.
