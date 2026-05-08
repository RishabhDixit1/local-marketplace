# Mobile Staging Seed Data Checklist

Date: 2026-05-08

Use this before judging whether the Flutter app is failing to load data. The
same signed-in staging accounts should show deterministic data across Home,
People, Work, Inbox, You, Business Control, Cart, Checkout, and Orders.

## Accounts

- Customer test account exists and can sign in on mobile.
- Provider test account exists and can sign in on mobile.
- Both accounts have profiles with name, public area, avatar fallback, and role.

## Provider Supply

- Provider has one published service.
- Provider has one published product with stock greater than zero.
- Provider has availability set.
- Provider has at least one trust signal: linked identity, review, portfolio
  item, work history, or verified payout method.

## Customer Demand

- Customer has one open help request.
- Customer has one saved feed card or provider if saved-state QA is in scope.

## Inbox

- At least one conversation exists between customer and provider.
- Conversation has at least one message from each side.
- One conversation has unread state for the signed-in viewer.
- One conversation is related to a request, quote, or order where possible.

## Work

- One help request appears in Work for the customer.
- One accepted/provider-side task appears in Work for the provider.
- One task has a next action.
- One task is active or in progress.
- One completed or closed task exists for history.

## Quote And Checkout

- One quote draft exists.
- One sent quote exists.
- One quote has been accepted.
- One COD order exists.
- One Razorpay test order exists or can be created with staging credentials.
- One payment failure/cancel path can be tested without corrupting order state.

## Notifications

- FCM token registration row exists for each test account after sign-in.
- Chat notification routes to Inbox thread.
- Task notification routes to Work.
- Order notification routes to order detail.
- Quote notification routes to quote room.

## Expected Mobile Data Contracts

- Home shows local feed, unread count, and work count.
- People shows provider profile, services/products, location, trust, and
  availability.
- Inbox shows conversation id, participant, last message, unread count, and
  related work context when available.
- Work shows task id, source type, role, status, progress stage, payment/order
  context, and next action.
- You shows profile identity, completion, trust, offers, and clickable routes.
- Business Control shows setup readiness, listings, lead state, trust state, and
  next best action.
- Checkout shows line items, provider grouping, quantity, payment method, and
  payment verification state.
