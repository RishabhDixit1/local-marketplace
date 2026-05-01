# Mobile Release QA Checklist

## Staging Data Loop

- Provider launchpad: create draft, save, publish, reopen published profile.
- Listing CRUD: create/edit/pause/delete one service and one product; confirm product stock changes in feed/profile.
- Quote room: provider saves draft, sends quote, customer sees notification, customer accepts before expiry.
- Checkout: COD order creates `cod_due`; Razorpay order opens native SDK and verification marks `payment_status=paid`.
- Order detail: status changes move through accepted, in progress, completed, closed with notifications to the other role.

## FCM And Deep Links

- Fresh install prompts for notifications only after sign-in.
- Token appears in `provider_push_subscriptions.fcm_token`.
- Notification taps route to Chat, Tasks, Orders, and Quote Room from cold, background, and foreground app states.
- Expired or invalid FCM tokens are removed after send failure.

## Real Device Accessibility

- Android and iOS at 100%, 130%, and 160% text scale.
- VoiceOver/TalkBack announces primary buttons, tabs, payment status, order status, and notification cards.
- Checkout, quote room, and listing forms remain usable with large text and keyboard open.
- Tap targets stay at least 44px logical size on primary actions.

## Release Gates

- `flutter analyze --no-pub`
- `flutter test --no-pub`
- Android release bundle signed with `mobile/android/key.properties`.
- iOS archive uses the App Store provisioning profile and push notification entitlement.
- Crashlytics receives a non-fatal test event from staging.
- Firebase Analytics shows `screen_view`, `tap_bottom_nav`, checkout, quote, and order events in DebugView.
