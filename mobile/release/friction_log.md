# Mobile Staging Friction Log

Use this file during real-device QA. Keep every item tied to a money-loop step,
release gate, trust/safety risk, observability gap, or reliability issue.

## Severity Guide

- P0: crash, auth lockout, payment/order corruption, private data leak, release
  signing/config blocker.
- P1: broken customer/provider money-loop step, broken deep link, unusable form,
  misleading payment/order state, inaccessible primary action.
- P2: confusing copy, rough empty/loading/error state, slow but usable screen,
  contained layout issue, missing helpful recovery.
- P3: cosmetic preference or feature expansion. Defer until after beta.

## Status Guide

- New: found and not triaged.
- Accepted: must fix for this staging cycle.
- Deferred: logged but not required before beta.
- Fixed: patch merged and ready to verify.
- Verified: retested on device and closed.

## Log

| ID | Date | Loop | Device | Step | Severity | Status | Issue | Expected | Owner | Link |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MQ-001 | 2026-05-03 | Example | Android 360dp | Notification tap to Quote Room | P1 | New | Example: tap opened Tasks instead of Quote Room | Quote Room opens with target quote/order | TBD | TBD |
| MQ-101 | 2026-08-09 | AI search | Emulator API 37 | Web AI stream | P1 | Fixed | `/api/ai/prompt/stream` used bare `google` provider (reads `GOOGLE_GENERATIVE_AI_API_KEY`, never set) so web AI chat always keyword-fallback | Streams real Gemini output | Eng | app/api/ai/prompt/stream/route.ts |
| MQ-102 | 2026-08-09 | AI search | Emulator API 37 | Local API QA | P1 | New | Gemini free-tier daily quota exhausted (`RESOURCE_EXHAUSTED`, `GenerateRequestsPerDayPerProjectPerModel-FreeTier`) -> mobile AI prompt + web chat degrade to keyword fallback | Paid Gemini key / quota headroom before beta | Founder | lib/ai/provider.ts |
| MQ-103 | 2026-08-09 | Discovery | Emulator API 37 | AI intent parse | P2 | New | "plumber near me" classified `action=buy_product` (product intent) instead of service | Service intent for service keywords | Eng | lib/ai/intentParser.ts |
| MQ-104 | 2026-08-09 | Realtime | Emulator API 37 | Live hub subscribe | P1 | New | Realtime websocket 503 on `http://54.253.40.174:8000/realtime/v1/websocket` (dev endpoint); app retries with correct backoff but live chat/notifications won't update | WS upgrade succeeds; verify after 3.8 TLS/Kong fix | Eng | Supabase infra |

## Daily QA Review Template

Date:
Build:
Android device:
iOS device:
Customer account:
Provider account:

P0/P1 opened:
P0/P1 closed:
P2 accepted:
P2 deferred:

Decision needed:

Next 24 hours:
