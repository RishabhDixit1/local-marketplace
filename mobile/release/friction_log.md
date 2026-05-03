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
