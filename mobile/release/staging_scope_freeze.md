# Mobile Staging Scope Freeze

Date: 2026-05-03
Owner: CEO / Product / Engineering
Status: Frozen for staging QA

## Objective

Prove ServiQ mobile is ready for beta by validating the two marketplace money
loops on real Android and iOS devices. During this freeze, new product features
are out of scope unless they directly unblock one of the money loops, trust and
safety, payment correctness, or release compliance.

## Frozen Feature Surface

- Auth: sign in, session restore, sign out, notification permission after sign in.
- Customer discovery: Home, Search, People, provider profile, feed cards.
- Customer request loop: post need, upload media, chat, quote acceptance, checkout,
  payment state, order detail, completion.
- Provider loop: launch profile, publish service/product listing, receive lead,
  chat, quote, fulfill order, update task/order state.
- Notifications: in-app notification center, FCM token registration, cold/background/
  foreground deep links into Chat, Tasks, Orders, and Quote Room.
- Trust and safety: report/block entry points, verified-provider meaning, location
  privacy, review visibility, payment trust copy, moderation escalation path.
- Observability: Firebase Analytics, Crashlytics, server observability, release QA
  notes, and friction log.

## Explicitly Out Of Scope Until QA Passes

- New tabs, new marketplace categories, new provider monetization surfaces, or
  major IA changes.
- Admin or ops workflows in mobile.
- Advanced analytics dashboards inside mobile.
- Large visual redesigns that do not fix a QA issue.
- New payment providers beyond the existing COD and Razorpay flow.
- AI features in the mobile client. AI remains server-side only.

## Money Loop A: Customer

Goal: a customer can complete a request from discovery through order completion.

1. Sign in on a fresh install.
2. Search or browse local providers.
3. Post a need with clear title, details, location, budget, and optional media.
4. Receive provider response or open Chat from the posted request.
5. Review and accept a quote.
6. Checkout with COD and Razorpay staging paths.
7. Open order detail from checkout and notification deep link.
8. Track accepted, in progress, completed, and closed states.
9. Confirm final notification and task history are readable.

## Money Loop B: Provider

Goal: a provider can publish supply, receive demand, quote, and fulfill.

1. Sign in on a fresh install.
2. Launch or edit provider profile.
3. Publish at least one service and one product listing.
4. Confirm listings appear in feed, search, profile, and provider listing manager.
5. Receive lead from customer request or direct message.
6. Chat with customer.
7. Save and send quote.
8. Receive quote acceptance or order notification.
9. Update fulfillment through accepted, in progress, completed, and closed states.

## Entry Criteria

- `flutter analyze --no-pub` passes.
- `flutter test --no-pub` passes.
- Staging API base URL points at the intended backend.
- Supabase staging has two clean test accounts: one customer, one provider.
- Firebase staging project is configured on the build under test.
- Razorpay staging keys are configured and test payment credentials are available.
- Android physical device and iPhone physical device are available.

## Exit Criteria

- Both money loops pass on Android and iOS.
- No open P0 or P1 issues.
- P2 issues have owner, decision, and ship/defer label.
- All notification deep links pass from cold, background, and foreground app states.
- Text scale at 100%, 130%, and 160% does not break the core flows.
- Crashlytics receives at least one non-fatal staging test event.
- Firebase Analytics DebugView shows the required funnel events.
- Store screenshots and privacy notes are captured from the approved build.

## Fix Policy During Freeze

- P0: fix immediately. App crash, payment corruption, auth lockout, private data leak,
  order state corruption, or release-blocking signing/config failure.
- P1: fix before beta. Broken money-loop step, broken notification routing, misleading
  payment/order state, unusable form, inaccessible primary action, or severe layout
  break on target devices.
- P2: fix if contained. Confusing copy, weak empty state, minor layout polish, missing
  helpful loading state, slow but usable interaction.
- P3: defer. Nice-to-have polish, non-core feature expansion, or cosmetic preference.

## Decision Rule

If an issue does not improve one of the two money loops, release safety, trust,
analytics, reliability, or store readiness, it waits until after beta.
