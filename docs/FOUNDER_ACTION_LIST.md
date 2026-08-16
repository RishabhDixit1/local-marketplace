# Founder & Ops Action List (pre-launch)

Every item below is a decision or deliverable owned by [Founder]/[Ops], due by
**5 Sep 2026** (beta target). Sorted by launch impact. Single source of truth for
status is `docs/LAUNCH_CHECKLIST.md`; this file is the work list.

## Tier 1 - Launch-blocking (nothing ships without these)

| ID | Item | Owner | What to decide / do |
| --- | --- | --- | --- |
| ~~3.8~~ | Supabase HTTPS + DNS | Ops | **DONE Aug 14** (see `docs/LAUNCH_CHECKLIST.md` 3.8): production builds now use `SUPABASE_URL=https://www.serviqapp.com` (existing nginx TLS + Kong proxy); Realtime 503 fixed (service container started). The optional `supabase.serviqapp.com`/`realtime.serviqapp.com` host split (Route 53 A records + certbot) is deferred - see `docs/SUPABASE_HTTPS_RUNBOOK.md`. |
| 4.3 | Razorpay live onboarding | Founder | Complete live KYC, get live key id + secret, set them in Vercel + mobile build env. |
| 4.4 | Razorpay webhook E2E | Ops | After live keys: test checkout, webhook verify (HMAC), double-refund guard, settlement reconciliation on live. |
| 7.4 | App store listings | Founder | Play Console + App Store Connect: screenshots, descriptions, privacy nutrition labels, test accounts for review. Mobile store metadata draft: `mobile/release/store_metadata.md`. |

## Tier 2 - Product decisions (need a call from founder)

| ID | Item | Decision needed |
| --- | --- | --- |
| 3.2 | Featured placements model | Free verified-first ordering (current default) vs paid boosts/placements. If paid: define pricing, slot rules, and seeding plan. `public.featured_placements` is currently empty on live. |
| - | "Browse all" funnel | `/app/search?browse=1` and the search/Explore view-all are auth-gated. Keep the sign-in funnel, or add a public listing page for anonymous visitors. |
| - | AI provider budget | Gemini free-tier daily quota is exhausted (`RESOURCE_EXHAUSTED`, limit 0/day). Without a paid tier, mobile AI search + web AI chat silently degrade to keyword fallback. Decision: enable billing on the Gemini project / upgrade tier. |
| - | AI intent tuning | Service queries occasionally classify as product intent (e.g. "plumber" -> `buy_product`). Low priority; batch tuning after beta or with the AI budget decision. |

## Tier 3 - Compliance & legal (5 Sep)

| ID | Item | Owner |
| --- | --- | --- |
| 2.5 | GST registration + tax invoice flow | Founder |
| 2.6 | Telecom DLT (SMS/WhatsApp template approvals) | Founder |
| 2.7 | Trademark filing (ServiQ) | Founder |
| 2.1-2.4 | Legal copy review (privacy/terms/refund/cookie) | Founder |
| 6.3 | Email templates (transactional + marketing) | Founder |
| 6.4 | SMS/WhatsApp templates + DLT (see 2.6) | Founder |

## Tier 4 - Trust & safety operations (5 Sep)

| ID | Item | Owner |
| --- | --- | --- |
| 5.4 | KYC API vendor selection + integration | Founder |
| 5.5 | Moderation / fraud escalation SOP | Ops |
| 8.1 | Vendor onboarding SOP | Ops |
| 8.2 | Customer support SOP | Ops |
| 8.3 | Escalation matrix | Ops |
| 8.4 | Pilot vendors onboarded (pilot scope) | Founder |

## Tier 5 - Launch prep

| ID | Item | Owner |
| --- | --- | --- |
| 7.3 | Social media + launch campaign | Founder |
| 10.2 | KPI targets (users/vendors/orders/activation/retention/NPS) | Founder |
| 9.1 | Grant utilization plan | Founder |
| 9.2 | Monthly budget + burn | Founder |
| 9.3 | Accounting for settlements/payouts | Founder |
| 3.4 | Backup cadence confirmation + restore drill | Ops (drill: `docs/DB_OPERATIONS.md`) |
| 3.7 | Uptime + Supabase health alerts | Ops (workflows added Aug 9: `uptime-check.yml`, `backup-verify.yml`) |

## Credentials / access unblock list (needed to finish QA + verification)

| What | Why | Needed from |
| --- | --- | --- |
| Test customer + provider accounts (clean, on the dev Supabase) | Run the interactive money-loop QA (#8) and signed-in FCM/Crashlytics verification on the emulator. `mobile/release/staging_scope_freeze.md` references two clean accounts but lists no credentials. | Founder |
| Razorpay staging keys | E2E checkout QA without live money | Founder |
| EC2 SSH + DNS provider access | Execute the 3.8 TLS + DNS runbook | Ops |
| Vercel dashboard access (or CLI token) | Confirm Sentry DSN + set production env vars | Founder/Ops |
