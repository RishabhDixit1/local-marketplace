# Mobile Release QA Checklist

Use this checklist after the scope freeze in
`mobile/release/staging_scope_freeze.md`. The goal is not to discover new
features. The goal is to prove that the two real marketplace loops work on real
devices, then fix only the friction that blocks trust, payment, reliability, or
release readiness.

## Baseline Gates

- `flutter analyze --no-pub`
- `flutter test --no-pub`
- Android physical device install succeeds.
- iOS physical device install succeeds.
- Staging app points at the intended API, Supabase, Firebase, and Razorpay
  staging configuration.
- Test customer and provider accounts are clean before the run.

## Device Matrix

- Android compact width near 360dp.
- Android large phone near 430dp.
- iPhone compact width near 390pt.
- Text scale: 100%, 130%, and 160%.
- Keyboard open states on sign in, post need, chat, quote, checkout, and listing
  forms.
- Bottom safe area and gesture navigation enabled.

## Customer Money Loop

- Fresh install opens quickly and does not show a protected, blank, or stale state.
- Customer signs in and stays signed in after force close and relaunch.
- Home shows local discovery, search, people, and request entry points.
- Search finds at least one provider and one listing from staging data.
- Provider profile opens from Search or People.
- Post Need validates title, details, category, location, budget, and media.
- Post Need handles failed or unfinished media uploads clearly.
- Posted need appears in Tasks and feed after refresh/realtime update.
- Chat opens from the posted need or provider profile.
- Customer receives provider message and quote notification.
- Quote Room opens from Chat, Tasks, and notification tap.
- Customer accepts quote before expiry.
- Checkout opens with correct provider, item, quantity, price, and payment method.
- COD creates order with expected `cod_due` or equivalent pending payment state.
- Razorpay opens native SDK and successful staging payment verifies as paid.
- Failed, cancelled, or incomplete Razorpay response gives a recoverable state.
- Order detail opens after checkout and from notification deep link.
- Order progresses through accepted, in progress, completed, and closed.
- Customer sees readable final task/order history.

## Provider Money Loop

- Fresh install opens quickly and provider signs in.
- Provider profile launchpad opens from Profile.
- Draft saves, resumes, publishes, and reopens without losing content.
- Provider listing manager creates one service and one product.
- Listing edit, pause/resume, stock/price changes, and delete behave correctly.
- Service and product appear in provider profile, feed, and search.
- Provider receives customer lead via notification and Tasks/Chat.
- Provider can chat with the customer from notification, Tasks, and direct thread.
- Quote Room opens with the right target and preserves draft fields.
- Provider saves quote draft and sends quote.
- Quote sent state is visible in Chat, Tasks, and notification center.
- Provider sees quote acceptance or order notification.
- Provider updates order fulfillment through accepted, in progress, completed,
  and closed.
- Provider cannot mutate work they do not own.

## FCM And Deep Links

- Fresh install prompts for notifications only after sign-in.
- Token appears in `provider_push_subscriptions.fcm_token`.
- Notification taps route to Chat from cold, background, and foreground states.
- Notification taps route to Tasks from cold, background, and foreground states.
- Notification taps route to Orders from cold, background, and foreground states.
- Notification taps route to Quote Room from cold, background, and foreground
  states.
- Expired or invalid FCM tokens are removed after send failure.
- Foreground notification refreshes the relevant in-app list without duplicate
  cards or stale badges.

## Premium Mobile UI Polish

- Home, Search, People, Create Need, Chat, Tasks, Quote Room, Checkout, and
  Profile fit at 320px/360dp, 390px, and 430px without text overlap.
- Primary controls remain visible above bottom navigation and safe areas.
- App bars, bottom nav, floating action button, and sticky CTAs do not hide form
  fields or payment actions.
- Loading states communicate progress without layout jump.
- Empty states give the next useful action.
- Error states allow retry or clear recovery.
- Long provider names, listing titles, addresses, and quote notes clamp cleanly.
- Tap targets for primary actions are at least 44 logical pixels.
- VoiceOver/TalkBack announces primary buttons, tabs, payment status, order
  status, quote status, and notification cards.

## Trust And Safety

- Report and block entry points are visible from provider/profile/chat contexts
  or have a documented release blocker if missing.
- Verified-provider label explains what is verified or avoids overclaiming.
- Review count and rating states are clear for new providers.
- Location labels avoid exposing precise private addresses in public views.
- Chat and quote copy discourages moving payment or sensitive details outside the
  app.
- Checkout explains COD, Razorpay, payment status, and that card details are not
  stored in ServiQ.
- Abuse-rate limits exist or are documented for connection requests, posting,
  chat send, quote send, media upload, and notification-triggering workflows.
- Moderation escalation path is documented for reported users/listings/posts.

## Analytics And Observability

- Firebase Analytics DebugView shows `app_open_mobile`.
- DebugView shows search query or search submit event.
- DebugView shows provider/profile open event.
- DebugView shows post need start and post need success/failure.
- DebugView shows chat send success/failure.
- DebugView shows quote draft, quote sent, and quote accepted.
- DebugView shows checkout started, payment method selected, payment success,
  payment failure/cancel, and order created.
- DebugView shows order status update and order completed.
- DebugView shows notification tap route and target.
- Crashlytics receives a non-fatal staging test event.
- Server observability captures API failures for auth, post publish, chat, quote,
  payment, order, upload, and notification subscribe/send routes.

## Reliability Polish

- Realtime updates refresh feed, people, tasks, chat, notifications, and profile
  without full app restart.
- Pull-to-refresh or retry exists on every core async surface.
- API failure messages are human-readable and do not expose secrets.
- Stale or empty data does not look like success.
- Offline or poor-network transitions keep the user oriented.
- Image-heavy cards cache and load without blank permanent placeholders.
- Pagination or bounded loading prevents very long lists from blocking the main
  loop.

## Release Readiness

- Android release bundle is signed with `mobile/android/key.properties`.
- iOS archive uses App Store provisioning profile and push notification
  entitlement.
- Production Firebase project files/secrets are present outside git.
- App icon and splash screen are final on Android and iOS.
- Store screenshots are captured from the approved staging or release candidate
  build.
- App Store privacy notes are prepared.
- Play Store data safety notes are prepared.
- TestFlight build uploads and opens for internal testers.
- Play Console internal testing build uploads and opens for internal testers.

## Staging Data Loop

- Provider launchpad: create draft, save, publish, reopen published profile.
- Listing CRUD: create/edit/pause/delete one service and one product; confirm
  product stock changes in feed/profile.
- Quote room: provider saves draft, sends quote, customer sees notification,
  customer accepts before expiry.
- Checkout: COD order creates expected pending payment state; Razorpay order
  opens native SDK and verification marks `payment_status=paid`.
- Order detail: status changes move through accepted, in progress, completed,
  closed with notifications to the other role.
