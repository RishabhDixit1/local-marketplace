# Notifications

## Notification Types

| Kind | Trigger | Channels |
|------|---------|----------|
| order | Order status change | In-app, Push |
| message | New chat message | In-app, Push |
| review | New review received | In-app, Push |
| connection | Connection request/response | In-app, Push |
| system | Platform announcements | In-app |

## Notification Channels (Mobile)

| Channel ID | Name | Priority |
|------------|------|----------|
| serviq_orders | Orders | High |
| serviq_messages | Messages | High |
| serviq_reviews | Reviews | Default |
| serviq_system | System | Default |
| serviq_connections | Connections | High |

## Deep-Link Routing

When a user taps a notification:
1. Notification data includes `route` field
2. Mobile app resolves route via `AppRoutes.resolveAiRedirect()`
3. Router pushes the resolved route
4. Example: order notification → `/app/orders/:id`
