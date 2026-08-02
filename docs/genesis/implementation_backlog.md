# Implementation Backlog

> Comprehensive work breakdown organized by epic, covering everything needed from pre-launch through maturity.
>
> *Last updated: July 2026 · Pre-launch*

---

## Backlog Summary

| Epic | Priority | Features | Total Effort | Dependencies |
|------|----------|----------|-------------|--------------|
| 1. Launch Readiness | P0 | 6 | XL | None (foundation) |
| 2. Platform Stability | P0-P1 | 5 | L | Epic 1 (partial) |
| 3. Unified Design System | P1 | 5 | L | None |
| 4. AI Observability & Reliability | P1 | 5 | M | None |
| 5. User Experience Unification | P1-P2 | 6 | L | Epic 3 (partial) |
| 6. Growth Engine Activation | P1-P2 | 5 | L | Epic 1 |
| 7. Mobile Monetization | P2 | 4 | M | Epic 1, Epic 6 |
| 8. AI Platform Evolution | P2-P3 | 5 | XL | Epic 4 |
| 9. Multi-City Expansion | P3 | 4 | XL | Epic 1, Epic 6 |
| 10. Advanced Marketplace | P3 | 5 | XL | Epic 1, Epic 9 |

**Effort Guide:** S = days, M = 1-2 weeks, L = 2-4 weeks, XL = 1-3 months

---

## Epic 1: Launch Readiness (P0)

**Goal:** Enable the first real end-to-end transaction on the platform. Everything else depends on this.

**Risk:** Critical. If launch readiness slips, there is no product. No revenue. No learning.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 1.1 | First transaction end-to-end | As a consumer, I can post a need, receive a quote, accept, pay, and review. As a provider, I can receive a need notification, send a quote, accept an order, get paid, and review. | 1.1.1 Validate order status flow (quoted → accepted → confirmed → in_progress → completed → paid → reviewed) end-to-end with test payments | None | High | P0 | S |
| | | | 1.1.2 Verify Razorpay test mode integration works (payment capture, refund, webhook) | 1.1.1 | High | P0 | S |
| | | | 1.1.3 Test UPI + card + netbanking payment flows | 1.1.2 | High | P0 | M |
| | | | 1.1.4 Verify HMAC timing-safe comparison on payment verification endpoint | None | High | P0 | S |
| | | | 1.1.5 Test double-refund idempotency guard | None | High | P0 | S |
| | | | 1.1.6 End-to-end smoke test on staging with real test payment | All above | High | P0 | M |
| 1.2 | Provider acquisition concierge | As a platform operator, I can onboard a provider through a high-touch concierge process that gets them to L1 verified and ready to receive orders. | 1.2.1 Define provider onboarding checklist (phone, email, selfie, ID proof, service selection, locality setting) | None | Medium | P0 | S |
| | | | 1.2.2 Create provider onboarding script/playbook for concierge team | None | Medium | P0 | S |
| | | | 1.2.3 Build admin tool to manually verify provider documents | None | Medium | P0 | M |
| | | | 1.2.4 Build admin tool to set provider verification level | 1.2.3 | Medium | P0 | S |
| | | | 1.2.5 Test end-to-end: concierge signs up provider → provider receives first need notification | 1.3, 1.1 | High | P0 | M |
| | | | 1.2.6 Create provider welcome kit (app guide, service tips, FAQ) | None | Low | P0 | S |
| 1.3 | Consumer acquisition (Noida pilot) | As a consumer in Noida, I can discover ServiQ, sign up, and post my first need. | 1.3.1 Define pilot locality criteria and select 3-5 Noida localities | None | Medium | P0 | S |
| | | | 1.3.2 Create invite code system for controlled pilot access | None | Medium | P0 | S |
| | | | 1.3.3 Test guest browsing flow (discover without signup) | None | Low | P0 | M |
| | | | 1.3.4 Test signup flow (phone + OTP) end-to-end | None | High | P0 | S |
| | | | 1.3.5 Verify OTP cooldown timer (60s) works correctly | None | Medium | P0 | S |
| | | | 1.3.6 Test AI intent parsing with diverse pilot-expected inputs (Hindi, Hinglish, mixed) | None | Medium | P0 | M |
| | | | 1.3.7 Create consumer welcome guide (how to post a need, how to choose a provider) | None | Low | P0 | S |
| 1.4 | Payment flow validation | As a platform operator, I am confident that money flows correctly: collection, hold, release, refund, payout. | 1.4.1 End-to-end test: consumer pays → funds held → provider completes → funds released → provider receives payout | 1.1.2, 1.1.3 | High | P0 | L |
| | | | 1.4.2 Test: consumer pays → order cancelled before completion → full refund issued | 1.1.2 | High | P0 | M |
| | | | 1.4.3 Test: order disputed → partial refund → remainder released | 1.1.2, 6.4 (dispute) | High | P0 | L |
| | | | 1.4.4 Test webhook failure handling (Razorpay webhook missed → reconciliation) | 1.1.2 | High | P0 | M |
| | | | 1.4.5 Verify payout runs (T+2 cycle) work correctly for test accounts | 1.1.2 | High | P0 | M |
| | | | 1.4.6 Generate first payment reconciliation report manually | All above | Medium | P0 | M |
| 1.5 | Trust baseline | As a platform operator, I have enough trusted providers to launch: verified, reviewed, trustworthy. | 1.5.1 Onboard 10-15 pilot providers through concierge (L1 verified) | 1.2.5 | High | P0 | L |
| | | | 1.5.2 Create synthetic first reviews for pilot providers (admin-generated, flagged as test) | 1.5.1 | Medium | P0 | S |
| | | | 1.5.3 Verify trust score calculation for pilot providers | None | Medium | P0 | S |
| | | | 1.5.4 Test trust score display on provider profile (consumer view) | None | Medium | P0 | S |
| | | | 1.5.5 Test verification level badge display | None | Medium | P0 | S |
| | | | 1.5.6 Test consumer trust score (provider sees consumer's trustworthiness) | None | Medium | P0 | M |
| 1.6 | Go/no-go checklist | As a platform operator, I have a clear, data-driven go/no-go criterion for alpha launch. | 1.6.1 Define launch readiness criteria (provider count, transaction test passes, payment test passes, trust baseline met) | All of Epic 1 | High | P0 | S |
| | | | 1.6.2 Create launch readiness dashboard (real-time status of each criterion) | All of Epic 1 | Medium | P0 | M |
| | | | 1.6.3 Run full dry-run: 10 simulated end-to-end transactions on staging | All of Epic 1 | High | P0 | L |
| | | | 1.6.4 Document launch day runbook (who does what, escalation paths) | None | Medium | P0 | S |

---

## Epic 2: Platform Stability (P0-P1)

**Goal:** Ensure the platform is reliable, observable, and testable before real users arrive.

**Risk:** High. Bugs found by users erode trust before trust exists. Poor performance kills conversion.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 2.1 | Flutter test foundation | As a Flutter engineer, I can write and run unit and widget tests for every feature module to prevent regressions. | 2.1.1 Set up Flutter test infrastructure (test runner, mocks, golden test config) | None | High | P0 | M |
| | | | 2.1.2 Write unit tests for domain layer (models, repositories, use cases) across all 40 feature modules | None | High | P0 | XL |
| | | | 2.1.3 Write widget tests for key screens (login, home feed, orders, chat, profile) | 2.1.1 | High | P0 | L |
| | | | 2.1.4 Set up CI test runner for Flutter (run on every PR) | 2.1.1 | High | P0 | S |
| | | | 2.1.5 Achieve 40%+ unit test coverage baseline | 2.1.2 | High | P0 | XL |
| 2.2 | Web test expansion | As a web engineer, I can write and run component and integration tests for critical user flows. | 2.2.1 Audit current web test coverage and identify gaps | None | Medium | P1 | S |
| | | | 2.2.2 Write integration tests for critical flows (signup, post need, complete order) | None | High | P0 | L |
| | | | 2.2.3 Write component tests for shared web components | None | Medium | P1 | M |
| | | | 2.2.4 Set up CI test runner for web tests | None | Medium | P1 | S |
| | | | 2.2.5 Achieve 30%+ test coverage on web | All above | Medium | P1 | L |
| 2.3 | Error monitoring & alerting | As a platform operator, I am immediately notified when something breaks so I can fix it before users are affected. | 2.3.1 Verify Sentry is correctly configured for both Flutter and Next.js | None | High | P0 | S |
| | | | 2.3.2 Configure Sentry alerts for P0 errors (payment failures, auth failures, 5xx spikes) | 2.3.1 | High | P0 | S |
| | | | 2.3.3 Create error dashboard (Sentry + custom metrics) | 2.3.1 | Medium | P1 | M |
| | | | 2.3.4 Set up uptime monitoring (external health check for serviqapp.com) | None | High | P0 | S |
| | | | 2.3.5 Define error severity levels and response SLAs | None | Medium | P0 | S |
| | | | 2.3.6 Create on-call rotation and escalation policy | None | Medium | P1 | S |
| 2.4 | Performance baselining | As a platform operator, I know the performance characteristics of every critical flow before users arrive. | 2.4.1 Define critical user journeys (signup, post need, quote, pay, complete) | None | Medium | P0 | S |
| | | | 2.4.2 Establish baseline performance metrics (P50, P95, P99 latency) for each journey | None | High | P0 | M |
| | | | 2.4.3 Set up Lighthouse CI for web performance regression detection | None | Medium | P1 | S |
| | | | 2.4.4 Test AI endpoint latency (intent parse, matching) with simulated load | 4.3 (AI health monitoring) | Medium | P0 | M |
| | | | 2.4.5 Test database query performance with realistic data volume | None | Medium | P0 | M |
| 2.5 | Database migration testing | As a platform operator, I can deploy database changes safely without downtime or data loss. | 2.5.1 Verify all 63 existing migrations are idempotent and reversible | None | High | P0 | L |
| | | | 2.5.2 Set up staging database that mirrors production schema | None | Medium | P0 | M |
| | | | 2.5.3 Create migration dry-run script (apply migration to staging, verify, rollback) | 2.5.2 | High | P0 | M |
| | | | 2.5.4 Test migration performance on large tables | None | Medium | P1 | M |

---

## Epic 3: Unified Design System (P1)

**Goal:** Both platforms look and feel identical. Web catches up to Flutter's mature design system.

**Risk:** Medium. Inconsistent design hurts trust but doesn't block launch. However, the gap widens with every new feature.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 3.1 | Web component library creation | As a web engineer, I have a library of reusable React components that match Flutter's design system, so I can build consistent UIs quickly. | 3.1.1 Audit Flutter design system components and map to web equivalents | None | Low | P1 | S |
| | | | 3.1.2 Create React component: `ServiqButton` (primary, secondary, ghost, disabled states, loading state) | None | Low | P1 | S |
| | | | 3.1.3 Create React component: `ServiqTextField` (matches AppTextField behavior) | None | Low | P1 | S |
| | | | 3.1.4 Create React component: `ServiqCard` (with elevation variants) | None | Low | P1 | S |
| | | | 3.1.5 Create React component: `ServiqModal` / `ServiqBottomSheet` | None | Low | P1 | M |
| | | | 3.1.6 Create React component: `ServiqToast` (matches ServiqToast.show()) | None | Low | P1 | S |
| | | | 3.1.7 Create React component: `ServiqSkeleton` (loading states) | None | Low | P1 | S |
| | | | 3.1.8 Create React component: `ServiqPill` (matches AppPill) | None | Low | P1 | S |
| | | | 3.1.9 Create React component: `ServiqTopBar` (matches ServiqTopBar) | None | Low | P1 | S |
| | | | 3.1.10 Create React component: `ServiqScaffold` (matches ServiqScaffold layout) | None | Low | P1 | M |
| 3.2 | Design token consolidation | As a designer and engineer, both platforms use the same design tokens so the visual output is identical. | 3.2.1 Extract all Flutter design tokens (colors, spacing, radii, typography, shadows) into a single source of truth | None | Medium | P1 | M |
| | | | 3.2.2 Map web CSS variables to match Flutter tokens (same names, same values) | 3.2.1 | Medium | P1 | M |
| | | | 3.2.3 Verify dark mode tokens match across platforms | 3.2.2 | Medium | P1 | S |
| | | | 3.2.4 Validate color contrast for all token pairs (WCAG AA) | 3.2.1 | Medium | P1 | M |
| | | | 3.2.5 Create token migration guide for any existing hardcoded values | 3.2.1 | Low | P1 | S |
| 3.3 | Design token documentation | As a designer or engineer, I can reference a single source of truth for all design tokens. | 3.3.1 Create living design token documentation page (web) | 3.2.1 | Low | P1 | M |
| | | | 3.3.2 Document component usage guidelines and examples | 3.1 | Low | P1 | L |
| | | | 3.3.3 Create migration guide: web hardcoded values → tokens | 3.2.1 | Low | P1 | S |
| 3.4 | Figma token sync pipeline | As a designer, I update tokens in Figma, and code automatically updates. | 3.4.1 Evaluate token sync tools (Specify, Tokens Studio, Style Dictionary) | None | Medium | P1 | S |
| | | | 3.4.2 Implement token export from Figma → JSON | 3.4.1 | Medium | P1 | M |
| | | | 3.4.3 Implement token import: JSON → Flutter Dart constants | 3.4.2 | Medium | P1 | M |
| | | | 3.4.4 Implement token import: JSON → Web CSS variables | 3.4.2 | Medium | P1 | M |
| | | | 3.4.5 Set up CI to validate token sync on PR | 3.4.3, 3.4.4 | Medium | P1 | S |
| 3.5 | Accessibility audit & remediation | As a user with disabilities, I can use ServiQ without barriers. | 3.5.1 Run automated accessibility audit on web (axe-core, Lighthouse) | None | High | P1 | S |
| | | | 3.5.2 Run automated accessibility audit on Flutter (flutter analyze + manual) | None | High | P1 | S |
| | | | 3.5.3 Fix all critical and serious accessibility issues found | 3.5.1, 3.5.2 | High | P1 | L |
| | | | 3.5.4 Audit and fix keyboard navigation on web | 3.5.1 | High | P1 | M |
| | | | 3.5.5 Audit and fix screen reader labels on both platforms | 3.5.1, 3.5.2 | Medium | P1 | M |
| | | | 3.5.6 Add accessibility regression tests (CI checks) | All above | Medium | P1 | M |

---

## Epic 4: AI Observability & Reliability (P1)

**Goal:** Make AI predictable, observable, and reliable. Without this, AI features are fragile and opaque.

**Risk:** Medium. AI failures won't block launch (heuristic fallbacks exist) but degrade experience and increase debugging time.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 4.1 | Prompt logging & cost tracking | As an AI engineer, I can audit every prompt sent to the LLM and know exactly how much it costs. | 4.1.1 Implement prompt/response logging to database (with user_id, feature, model, tokens, latency) | None | Medium | P1 | M |
| | | | 4.1.2 Create AI cost dashboard (cost per feature, per user, per day) | 4.1.1 | Medium | P1 | M |
| | | | 4.1.3 Implement prompt replay tool (resubmit logged prompt to debug) | 4.1.1 | Medium | P1 | L |
| | | | 4.1.4 Set alert when cost per transaction exceeds threshold (target: Rs 1) | 4.1.2 | Medium | P1 | S |
| 4.2 | Model fallback (multi-provider) | As a platform operator, if Gemini goes down, AI features gracefully fall back to another model. | 4.2.1 Evaluate alternative LLM providers (Claude, GPT-4o-mini, Llama via Bedrock) | None | Medium | P1 | S |
| | | | 4.2.2 Implement abstract LLM interface with provider-agnostic API | None | Medium | P1 | M |
| | | | 4.2.3 Implement Gemini provider (existing) | 4.2.2 | Low | P1 | S |
| | | | 4.2.4 Implement secondary provider (e.g., Claude via Bedrock) | 4.2.2, 4.2.1 | Medium | P1 | M |
| | | | 4.2.5 Implement automatic fallback (primary fails → secondary → heuristic) | 4.2.3, 4.2.4 | High | P1 | M |
| | | | 4.2.6 Test failover scenarios (primary returns 5xx, timeout, bad response) | 4.2.5 | High | P1 | M |
| 4.3 | AI health monitoring | As a platform operator, I know when AI is degrading before users complain. | 4.3.1 Implement AI endpoint health checks (synthetic prompts, verify response structure) | None | Medium | P1 | M |
| | | | 4.3.2 Set up latency monitoring for each AI capability (p50/p95/p99) | 4.1.1 | Medium | P1 | S |
| | | | 4.3.3 Set up error rate monitoring per AI capability | 4.1.1 | Medium | P1 | S |
| | | | 4.3.4 Create AI health dashboard (latency, error rate, cost, fallback rate) | 4.3.1, 4.3.2, 4.3.3 | Medium | P1 | M |
| | | | 4.3.5 Set alerts for anomaly detection (sudden latency spike, error rate increase) | 4.3.4 | Medium | P1 | S |
| 4.4 | A/B testing framework (AI vs heuristic) | As an AI engineer, I can experimentally validate that AI improves outcomes over the heuristic baseline. | 4.4.1 Design A/B testing data model (experiment, variant, assignment, metric) | None | Medium | P1 | M |
| | | | 4.4.2 Implement user assignment logic (consistent variant per user) | 4.4.1 | Medium | P1 | M |
| | | | 4.4.3 Implement metric collection (conversion rate, satisfaction, latency) | 4.4.1 | Medium | P1 | M |
| | | | 4.4.4 Create A/B test results dashboard | 4.4.1, 4.4.3 | Medium | P1 | M |
| | | | 4.4.5 Run A/B test: AI intent parsing vs heuristic regex (measure: parse accuracy, user satisfaction) | 4.4.2, 4.4.3 | Medium | P1 | M |
| | | | 4.4.6 Run A/B test: AI matching vs geo+category filter (measure: acceptance rate, time to match) | 4.4.2, 4.4.3 | Medium | P1 | M |
| 4.5 | Prompt versioning & management | As an AI engineer, I can version, review, and roll back system prompts like code. | 4.5.1 Implement prompt storage (versioned, with metadata: author, date, feature, changelog) | None | Low | P2 | M |
| | | | 4.5.2 Implement prompt deployment pipeline (prompt change → staging test → production) | 4.5.1 | Low | P2 | L |
| | | | 4.5.3 Implement prompt rollback (revert to previous version) | 4.5.1 | Low | P2 | S |
| | | | 4.5.4 Create prompt management UI (view versions, diff, deploy, rollback) | 4.5.1 | Low | P2 | L |

---

## Epic 5: User Experience Unification (P1-P2)

**Goal:** Eliminate confusion, simplify flows, and create a cohesive experience across platforms.

**Risk:** Medium. UX friction reduces conversion but won't block the first transaction. Some items are pre-launch nice-to-haves.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 5.1 | Simplified onboarding | As a new user, I can sign up, set up my profile, and post/offer my first service in under 3 minutes. | 5.1.1 Audit current onboarding flow (web + mobile) for friction points | None | Medium | P1 | M |
| | | | 5.1.2 Implement unified onboarding progress indicator (step 1 of 4 style) | None | Medium | P1 | M |
| | | | 5.1.3 Reduce required fields at signup (phone + OTP only, defer profile setup) | None | Medium | P1 | S |
| | | | 5.1.4 Add post-signup call-to-action (guided first action based on role) | 5.1.3 | Medium | P1 | S |
| | | | 5.1.5 Test onboarding flow: signup → first action → complete → get value | 5.1.3, 5.1.4 | High | P1 | M |
| 5.2 | Terminology cleanup | As a user, I am never confused by overlapping terms like "Need" vs "Task" vs "Job" or "Quote" vs "Offer" vs "Proposal." | 5.2.1 Audit all user-facing terminology across both platforms | None | Low | P2 | S |
| | | | 5.2.2 Create canonical term list: Need → Quote → Order → Review | 5.2.1 | Low | P2 | S |
| | | | 5.2.3 Migrate database columns/values to canonical terms (with backward-compatible views) | 5.2.2 | High | P2 | L |
| | | | 5.2.4 Update Flutter UI strings to canonical terms | 5.2.2 | Low | P2 | L |
| | | | 5.2.5 Update Web UI strings to canonical terms | 5.2.2 | Low | P2 | L |
| | | | 5.2.6 Add deprecation warnings for old API parameter names | 5.2.3 | Medium | P2 | S |
| | | | 5.2.7 Remove dead feature references (Launchpad, Deal Room, Quote Room, Lead OS) from UI | None | Low | P2 | M |
| 5.3 | Quick re-order flow | As a consumer, I can re-order from a provider I have used before in 2 taps, without re-posting a need. | 5.3.1 Design quick re-order UI (recent providers list → select service → confirm) | None | Low | P2 | S |
| | | | 5.3.2 Implement "re-order" button on past order detail page | 5.3.1 | Low | P2 | S |
| | | | 5.3.3 Implement quick re-order API (reuse last need's attributes) | None | Low | P2 | M |
| | | | 5.3.4 Add "frequent providers" section on home screen for quick re-order | 5.3.1 | Low | P2 | M |
| 5.4 | Guest browsing | As a potential user, I can explore ServiQ (browse services, see provider profiles, view pricing) without signing up. | 5.4.1 Implement guest session (no auth required, read-only access to public data) | None | Medium | P1 | S |
| | | | 5.4.2 Implement guest → registered conversion flow (call-to-action overlays on key actions) | 5.4.1 | Medium | P1 | M |
| | | | 5.4.3 Test guest browsing on both platforms | 5.4.1 | Medium | P1 | M |
| 5.5 | Unified service catalog | As a user, I can browse a structured service catalog without needing to post a need first (discovery mode). | 5.5.1 Implement service catalog API (categories → services → providers) | None | Low | P2 | M |
| | | | 5.5.2 Implement catalog browse UI (category grid, service list, provider cards) | 5.5.1 | Low | P2 | L |
| | | | 5.5.3 Implement search across catalog (full-text + AI-powered) | 5.5.1 | Low | P2 | M |
| | | | 5.5.4 Implement "compare providers" view within a service category | 5.5.2 | Low | P2 | M |
| 5.6 | AI search enhancement | As a user, I can type a natural language query ("plumber near sector 62 who can come today") and get relevant providers instantly. | 5.6.1 Improve AI intent parser to handle locality + service + time constraints | 4.4 (A/B test) | Medium | P2 | M |
| | | | 5.6.2 Implement search results page with provider cards sorted by relevance | 5.6.1 | Medium | P2 | M |
| | | | 5.6.3 Add search filters (locality, price range, rating, availability) | 5.6.2 | Low | P2 | M |
| | | | 5.6.4 Implement "save search" for recurring needs | None | Low | P3 | S |

---

## Epic 6: Growth Engine Activation (P1-P2)

**Goal:** Activate the growth loops that will drive acquisition, retention, and monetization.

**Risk:** High. Growth is the engine. Without activation, we have a product with no users. But these features depend on launch readiness.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 6.1 | Referral program launch | As a user, I can refer friends to ServiQ and earn credits. | 6.1.1 Implement referral code generation (unique per user) | None | Medium | P1 | S |
| | | | 6.1.2 Implement referral tracking (who referred whom, when, conversion status) | 6.1.1 | Medium | P1 | M |
| | | | 6.1.3 Implement referral reward credit system (Rs 50 consumer, Rs 200 provider) | None | Medium | P1 | M |
| | | | 6.1.4 Implement referral dashboard (see invites, conversions, rewards earned) | 6.1.2 | Medium | P1 | M |
| | | | 6.1.5 Implement deep link sharing for referrals | 6.1.1 | Medium | P1 | M |
| | | | 6.1.6 Test referral flow: invite → signup → first transaction → reward credit | All above | High | P1 | M |
| 6.2 | Provider subscription activation | As a provider, I can subscribe to a paid plan and immediately see benefits (priority matching, lower commission). | 6.2.1 Validate subscription API (create, renew, cancel, expire) end-to-end | None | Medium | P1 | M |
| | | | 6.2.2 Implement subscription payment flow via Razorpay | 6.2.1 | Medium | P1 | M |
| | | | 6.2.3 Implement priority matching for Plus/Pro subscribers | 6.2.1 | High | P1 | M |
| | | | 6.2.4 Implement commission rate override based on subscription tier | 6.2.1 | High | P1 | M |
| | | | 6.2.5 Build subscription management UI (plans, upgrade, cancel, history) | 6.2.1 | Medium | P1 | M |
| | | | 6.2.6 Test end-to-end: subscribe → see priority match → complete order → verify lower commission | All above | High | P1 | L |
| 6.3 | Campaign system | As a platform operator, I can create and launch promotional campaigns. | 6.3.1 Audit existing campaign system for launch readiness | None | Low | P2 | S |
| | | | 6.3.2 Implement campaign creation admin UI (name, type, target, discount, dates) | None | Low | P2 | L |
| | | | 6.3.3 Implement campaign application engine (apply discount, feature placement, etc.) | 6.3.2 | Low | P2 | M |
| | | | 6.3.4 Implement campaign analytics (redemptions, incremental orders, ROI) | 6.3.3 | Low | P2 | M |
| | | | 6.3.5 Test campaign: create → publish → user sees → user redeems → campaign ends | All above | Low | P2 | L |
| 6.4 | Promo code activation | As a user, I can apply a promo code at checkout for a discount. | 6.4.1 Validate promo code system (create, validate, apply, track usage) end-to-end | None | Medium | P1 | M |
| | | | 6.4.2 Implement promo code input UI at checkout (both platforms) | 6.4.1 | Medium | P1 | S |
| | | | 6.4.3 Implement promo code validation logic (expiry, usage limit, min order, user eligibility) | 6.4.1 | High | P1 | M |
| | | | 6.4.4 Test promo code scenarios: valid, expired, maxed, ineligible user, first-order only | 6.4.1 | High | P1 | M |
| | | | 6.4.5 Create first promo code for alpha launch (e.g., WELCOME50) | 6.4.4 | Low | P1 | S |
| 6.5 | Seasonal campaign playbook | As a platform operator, I have a documented, repeatable process for running seasonal campaigns. | 6.5.1 Document campaign strategy (seasonal calendar, offer types, targeting criteria) | 6.3 | Low | P2 | S |
| | | | 6.5.2 Create campaign templates (Diwali cleaning, monsoon repairs, summer AC service, etc.) | 6.5.1 | Low | P2 | M |
| | | | 6.5.3 Build campaign scheduler (schedule future campaigns with auto-activate) | 6.3 | Low | P2 | M |
| | | | 6.5.4 Create campaign retrospective template (what worked, what didn't, ROI) | None | Low | P2 | S |

---

## Epic 7: Mobile Monetization (P2)

**Goal:** Enable users to transact fully on mobile — download the app, subscribe, purchase boosts.

**Risk:** Medium. Monetization is essential, but the app can work with web payments initially.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 7.1 | Play Store deployment | As a consumer, I can download ServiQ from the Google Play Store. | 7.1.1 Prepare Flutter Android build for production (signing, proguard, app bundle) | None | Medium | P2 | M |
| | | | 7.1.2 Create Play Store listing (icons, screenshots, description, category) | 7.1.1 | Medium | P2 | S |
| | | | 7.1.3 Set up Play Console account and configure app | 7.1.2 | Medium | P2 | S |
| | | | 7.1.4 Submit for review and address feedback | 7.1.3 | Medium | P2 | M |
| | | | 7.1.5 Set up CI/CD for Play Store releases (signed bundle generation) | 7.1.1 | Low | P2 | M |
| 7.2 | Subscription purchase in app | As a provider, I can subscribe to Plus/Pro directly from the mobile app. | 7.2.1 Implement Google Play Billing integration for subscriptions | 7.1.1 | High | P2 | L |
| | | | 7.2.2 Implement subscription purchase flow in Flutter (plan selection → Play Billing → activation) | 7.2.1 | High | P2 | L |
| | | | 7.2.3 Implement purchase token validation server-side | 7.2.1 | High | P2 | M |
| | | | 7.2.4 Handle subscription lifecycle (renewal, cancellation, grace period, expiry) | 7.2.1 | High | P2 | M |
| | | | 7.2.5 Test end-to-end subscription purchase on Play Store (sandbox mode) | All above | High | P2 | L |
| 7.3 | In-app payments for boosts | As a provider, I can purchase a boost (featured placement) directly from the mobile app. | 7.3.1 Implement boost purchase flow via Google Play Billing (consumable product) | 7.1.1 | Medium | P2 | M |
| | | | 7.3.2 Apply boost to provider listing upon successful purchase | 7.3.1 | Medium | P2 | S |
| | | | 7.3.3 Handle refund/cancellation for boosts | 7.3.1 | Medium | P2 | M |
| | | | 7.3.4 Test boost purchase → listing appears boosted → duration expires | All above | Medium | P2 | L |
| 7.4 | Push notification optimization | As a platform operator, I use push notifications to drive conversion and re-engagement. | 7.4.1 Implement Firebase Cloud Messaging (FCM) for Flutter push notifications | None | Medium | P2 | M |
| | | | 7.4.2 Optimize notification content and timing for conversion (need alert → open app → quote → book) | 7.4.1 | Medium | P2 | M |
| | | | 7.4.3 Implement notification preferences (user can opt out per type) | 7.4.1 | Low | P2 | S |
| | | | 7.4.4 Set up notification analytics (delivery rate, open rate, conversion rate) | 7.4.1 | Medium | P2 | M |
| | | | 7.4.5 A/B test notification copy and timing | 7.4.4 | Medium | P2 | M |

---

## Epic 8: AI Platform Evolution (P2-P3)

**Goal:** Move AI from assistant to differentiator. Personalized, intelligent, proactive.

**Risk:** Medium. These features differentiate but are not launch-critical. Failure modes are UX degradation, not platform failure.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 8.1 | AI-powered provider ranking | As a consumer, the order of providers I see is intelligently ranked based on my preferences and history. | 8.1.1 Collect user interaction signals (profile views, quotes accepted, orders completed) | None | Medium | P2 | M |
| | | | 8.1.2 Design ranking algorithm (trust score + distance + response rate + past engagement + subscription tier) | 8.1.1 | Medium | P2 | M |
| | | | 8.1.3 Implement AI-enhanced ranking (LLM evaluates fit based on need + provider profile) | 8.1.2 | Medium | P3 | L |
| | | | 8.1.4 A/B test: AI ranking vs algorithmic ranking (measure: quote acceptance rate) | 8.1.3, 4.4 (A/B framework) | Medium | P3 | M |
| 8.2 | Personalized recommendations | As a user, ServiQ surfaces services and providers that match my history and preferences. | 8.2.1 Implement recommendation data pipeline (user history, similar users, seasonal trends) | 8.1.1 | Low | P3 | L |
| | | | 8.2.2 Implement "recommended for you" section on home screen | 8.2.1 | Low | P3 | M |
| | | | 8.2.3 Personalize search results based on user history | 8.2.1 | Low | P3 | M |
| 8.3 | Dynamic pricing suggestions | As a provider, I get AI-suggested prices for my services based on market data. As a consumer, I see fair price estimates. | 8.3.1 Collect market pricing data (quotes accepted/rejected, service type, locality) | 1.1 (completed transactions) | Medium | P3 | M |
| | | | 8.3.2 Implement AI pricing suggestion for provider quotes | 8.3.1 | Medium | P3 | L |
| | | | 8.3.3 Implement price estimate display for consumers (before posting need) | 8.3.1 | Medium | P3 | M |
| | | | 8.3.4 Measure quote acceptance rate with vs without AI pricing suggestion | 8.3.2, 4.4 (A/B framework) | Medium | P3 | M |
| 8.4 | Automated quality assurance | As a platform operator, AI monitors transaction quality and flags issues before they become disputes. | 8.4.1 Implement AI analysis of chat messages for dispute warning signs | 1.1 (transactions) | Medium | P3 | L |
| | | | 8.4.2 Implement AI analysis of reviews for fraud detection (fake reviews, collusion, review gating) | 1.1 (reviews) | Medium | P3 | L |
| | | | 8.4.3 Create admin alert system for QA flags | 8.4.1, 8.4.2 | Medium | P3 | M |
| | | | 8.4.4 Measure dispute rate reduction after QA automation | 8.4.3 | Low | P3 | M |
| 8.5 | Voice interface | As a user, I can speak my need in Hindi or Hinglish and ServiQ understands and processes it. | 8.5.1 Evaluate speech-to-text APIs (Google Speech-to-Text, Whisper, etc.) with Hindi support | None | Low | P3 | S |
| | | | 8.5.2 Implement voice input on need posting (Flutter) | 8.5.1 | Low | P3 | L |
| | | | 8.5.3 Implement voice search for service discovery | 8.5.1 | Low | P3 | L |
| | | | 8.5.4 Test voice recognition accuracy with diverse Hindi/Hinglish accents | 8.5.2 | Low | P3 | M |

---

## Epic 9: Multi-City Expansion (P3)

**Goal:** Expand beyond Noida to Delhi NCR, then Tier 1 cities, with a repeatable playbook.

**Risk:** High. Expansion before product-market fit is wasteful. Premature scaling is the #1 startup killer.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 9.1 | City onboarding playbook | As a platform operator, I have a documented, repeatable process for entering a new city. | 9.1.1 Document Noida pilot learnings (what worked, what didn't, metrics thresholds) | Epic 1 (launch) | Medium | P3 | M |
| | | | 9.1.2 Create city launch checklist (locality selection, provider recruitment, demand generation, metrics gates) | 9.1.1 | Medium | P3 | M |
| | | | 9.1.3 Create city lead hiring and training playbook | 9.1.1 | Medium | P3 | M |
| | | | 9.1.4 Identify Tier 1 city expansion order (criteria: population, service density, income level, competitive landscape) | 9.1.1 | Medium | P3 | S |
| 9.2 | Localization infrastructure | As a user in a new city, the platform is ready for local content, pricing, and preferences. | 9.2.1 Implement city-specific configuration (service catalog, pricing tiers, commission rates) | None | Low | P3 | M |
| | | | 9.2.2 Implement locality data import pipeline (for new cities) | None | Low | P3 | M |
| | | | 9.2.3 Implement city-specific campaign targeting | 6.3 (campaign system) | Low | P3 | M |
| 9.3 | Regional language support | As a Hindi speaker, I can use ServiQ entirely in Hindi. | 9.3.1 Audit current i18n infrastructure (both platforms) | None | Medium | P3 | M |
| | | | 9.3.2 Implement Hindi translations for all user-facing strings | 9.3.1 | Medium | P3 | XL |
| | | | 9.3.3 Implement language switcher (user setting, persisted) | 9.3.1 | Medium | P3 | S |
| | | | 9.3.4 Ensure AI understands Hindi/Hinglish input and can respond in Hindi | None | Medium | P3 | M |
| | | | 9.3.5 Test end-to-end flow entirely in Hindi | 9.3.2, 9.3.3, 9.3.4 | Medium | P3 | L |
| 9.4 | Offline area support | As a user in an area with poor connectivity, I can use essential ServiQ features offline. | 9.4.1 Implement full offline mode for service catalog browsing | None | Low | P3 | L |
| | | | 9.4.2 Implement offline request queue (post need while offline, send when connected) | None | Low | P3 | L |
| | | | 9.4.3 Implement progressive image loading for low-bandwidth areas | None | Low | P3 | M |
| | | | 9.4.4 Test offline flows in simulated poor connectivity (throttled network) | 9.4.1, 9.4.2 | Low | P3 | L |

---

## Epic 10: Advanced Marketplace (P3)

**Goal:** Build the moat. Differentiate beyond basic matching into advanced marketplace capabilities.

**Risk:** High/Medium. These are ambitious features that may not achieve product-market fit. Build only if core marketplace is working.

| # | Feature | Stories | Tasks | Dependencies | Risk | Priority | Effort |
|---|---------|---------|-------|-------------|------|----------|--------|
| 10.1 | Dynamic pricing (supply/demand) | As a platform operator, prices adjust based on supply and demand to optimize marketplace liquidity. | 10.1.1 Implement supply/demand tracking per service + locality + time | Epic 1 (transactions) | High | P3 | L |
| | | | 10.1.2 Implement dynamic pricing algorithm (base price + demand multiplier) | 10.1.1 | High | P3 | XL |
| | | | 10.1.3 Implement price floor/celling to prevent gouging | 10.1.2 | High | P3 | M |
| | | | 10.1.4 A/B test: dynamic pricing vs fixed pricing (measure: matching rate, utilization, user satisfaction) | 10.1.2, 4.4 (A/B framework) | High | P3 | L |
| 10.2 | Surge pricing for urgent requests | As a consumer, I can pay a premium to get a provider immediately. As a provider, I earn more for urgent work. | 10.2.1 Implement urgency levels (standard, express, emergency) with different fees | None | Medium | P3 | M |
| | | | 10.2.2 Implement surge pricing algorithm (urgency + time of day + provider availability) | 10.2.1 | Medium | P3 | L |
| | | | 10.2.3 Display surge multiplier transparently to consumer before booking | 10.2.2 | Medium | P3 | S |
| | | | 10.2.4 Test: consumer books urgent → pays surge → provider gets surge premium | All above | Medium | P3 | L |
| 10.3 | Insurance/guarantee products | As a consumer, I am protected if a job goes wrong. As a provider, I am covered for liability. | 10.3.1 Research insurance partners for service guarantee products | None | High | P3 | M |
| | | | 10.3.2 Design guarantee product (scope, price, claim process) | 10.3.1 | High | P3 | L |
| | | | 10.3.3 Integrate guarantee purchase into checkout flow | 10.3.2 | High | P3 | L |
| | | | 10.3.4 Implement claim filing and processing workflow | 10.3.2 | High | P3 | L |
| 10.4 | B2B services | As a business owner, I can use ServiQ to find and manage service providers for my business. | 10.4.1 Research B2B service needs (office cleaning, IT support, maintenance contracts) | None | Medium | P3 | M |
| | | | 10.4.2 Implement business account type (multiple locations, billing, team management) | None | Medium | P3 | XL |
| | | | 10.4.3 Implement contract/recurring service booking | 10.4.2 | Medium | P3 | L |
| | | | 10.4.4 Implement business dashboard (spend analytics, provider management, invoice consolidation) | 10.4.2 | Medium | P3 | XL |
| 10.5 | Enterprise provider management | As a large provider (e.g., cleaning company with 50 staff), I can manage my team through ServiQ. | 10.5.1 Implement provider groups/teams (one business, multiple service professionals) | None | Medium | P3 | L |
| | | | 10.5.2 Implement team scheduling and dispatch | 10.5.1 | Medium | P3 | XL |
| | | | 10.5.3 Implement team-level analytics (utilization, revenue, ratings per team member) | 10.5.1 | Medium | P3 | L |
| | | | 10.5.4 Implement role-based access within provider business (owner, manager, service professional) | 10.5.1 | Medium | P3 | L |

---

## Cross-Epic Dependencies Matrix

```
                    Depends On →
                    E1   E2   E3   E4   E5   E6   E7   E8   E9   E10
Epic 1 (Launch)      -    -    -    -    -    -    -    -    -    -
Epic 2 (Stability)   P    -    -    -    -    -    -    -    -    -
Epic 3 (Design Sys)  -    -    -    -    -    -    -    -    -    -
Epic 4 (AI Obs)      -    -    -    -    -    -    -    -    -    -
Epic 5 (UX)          -    -    P    -    -    -    -    -    -    -
Epic 6 (Growth)      R    -    -    -    -    -    -    -    -    -
Epic 7 (Mobile $)    P    -    -    -    -    P    -    -    -    -
Epic 8 (AI Evolve)   P    -    -    R    -    -    -    -    -    -
Epic 9 (Expansion)   R    -    -    -    -    R    -    -    -    -
Epic 10 (Advanced)   R    -    -    -    -    -    -    -    P    -

KEY: R = Required (must be done first), P = Partial (some features depend), - = No dependency
```

---

## Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|-----------|--------|------------|-------|
| R1 | Payment flow fails in production (funds lost, double charge, refund failure) | Low | Critical | Double-refund idempotency guard, HMAC verification, test mode validation, webhook reconciliation | Engineering |
| R2 | Zero provider supply in pilot localities | Medium | Critical | Concierge onboarding, provider incentives, aggressive recruitment before launch | Operations |
| R3 | Low consumer demand in pilot (no transactions) | High | Critical | Referral program, targeted social media, local events, limited paid ads | Marketing |
| R4 | AI latency or errors degrade UX (slow intent parsing, bad matches) | Medium | High | Heuristic fallbacks, latency monitoring, model fallback, timeout handling | AI/Engineering |
| R5 | Security incident (data breach, payment compromise, auth bypass) | Low | Critical | RLS on all tables, security audit before launch, CSP headers, rate limiting, input sanitization | Engineering |
| R6 | Regulatory issue (GST compliance, data localization, labor law) | Medium | High | Legal review before launch, GST-compliant invoicing, data stored in India (Supabase) | Leadership |
| R7 | Platform performance degrades under load (slow queries, high latency) | Medium | High | Performance baselining, database indexing, rate limiting, load testing | Engineering |
| R8 | User confusion due to terminology/UX complexity | High | Medium | Terminology cleanup (Epic 5), simplified onboarding, user testing | Product |
| R9 | Provider quality issues (bad service, no-show, fraud) | Medium | High | Trust system (verification, reviews, deposits), dispute resolution, provider screening | Operations |
| R10 | Premature scaling (expanding before product-market fit) | Medium | Critical | Strict metrics gates per locality, data-driven expansion decisions | Leadership |
| R11 | Dependency on single AI provider (Gemini) | Medium | Medium | Multi-model fallback (Epic 4), heuristic fallbacks already in place | Engineering |
| R12 | Competitor replicates core features faster | Medium | Medium | Network effects as moat, trust data portability, neighborhood density, speed of execution | Leadership |

---

## Migration Notes

### Breaking Changes Requiring Migration

| Change | Impact | Migration Strategy | Timeline |
|--------|--------|-------------------|----------|
| **Terminology cleanup** (Need/Task/Job → Need) | API consumers, database queries, UI strings | Database views with aliased columns + old API params deprecated with warning → remove after cutover | P2, post-launch |
| **API versioning introduction** | All API consumers | URL prefix (/v1/ → /v2/) with gradual deprecation. Old endpoints maintained for 2 release cycles | P2, post-launch |
| **Dead feature removal** (Launchpad, Deal Room, Quote Room, Lead OS) | Code references, DB tables, route definitions | Feature flag off first → monitor for issues → remove code next release | Ongoing (P2 target) |
| **Messages metadata column** (jsonb used for images) | Chat API consumers, analytics queries | Add proper `message_images` table, migrate data, add deprecation notice on metadata column | P2-P3 |
| **Shared types/SDK extract** | Both Flutter and web codebases | Extract common types to NPM + pub packages. Both codebases import from shared packages. No immediate migration — start with new features | Post-launch (P2) |
| **Web design system migration** (hardcoded → component library) | All web UI files | Incremental: migrate page by page, start with high-traffic pages. CSS variables first, component replacement second | Pre-launch (P1, ongoing) |
| **Environment config consolidation** | Build pipelines, CI/CD, local dev | Single .env per environment (.env.development, .env.staging, .env.production) with CI validation. Legacy files deprecated | Pre-launch |
| **Database migration testing** (63 existing migrations) | Production deployment safety | All migrations verified idempotent and reversible. Dry-run on staging before production | Pre-launch (P0) |
| **Flutter secure storage / session handling** | All mobile users | No migration needed (internal refactor). Session refresh timeout (8s), pre-warm on cold start | Already done |
| **Rate limiting atomic upsert** | API rate limiting behavior | Already deployed. No migration needed | Already done |

### Non-Breaking Changes (Safe to Deploy Anytime)

- Design token additions (new CSS variables, new spacing/radii values)
- New API endpoints (no existing consumer affected)
- New service categories (data-driven, no schema change)
- Notification preference additions
- Analytics event additions
- New environment variables (with sensible defaults)
- AI prompt changes (no API contract change)
- Trust score algorithm adjustments

---

*End of Implementation Backlog. This is a living document — reprioritize as we learn from real users.*
