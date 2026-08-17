# ServiQ Notification Architecture

## 1. In-App Notifications

### 1.1 Schema
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,           -- "order" | "message" | "review" | "system" | "connection"
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,             -- "order" | "conversation" | "review" | "connection_request" | ...
  entity_id uuid,               -- ID of the related entity
  metadata jsonb DEFAULT '{}',  -- { href, conversation_id, order_id, ... }
  read_at timestamptz,          -- null = unread
  cleared_at timestamptz,       -- null = not cleared
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id) WHERE read_at IS NULL;
```

### 1.2 Notification Kinds
```typescript
type NotificationKind = "order" | "message" | "review" | "system" | "connection";
```

| Kind | Trigger | Entity Types |
|------|---------|-------------|
| order | Order status change, quote received, payment | order, task, quote, quote_draft |
| message | New chat message | conversation, message, chat, direct_message |
| review | New review posted | review |
| connection | Connection request received | connection_request, connection |
| system | Promotional, system alert | (various) |

### 1.3 RLS Policy
```sql
-- Users can only read their own notifications
CREATE POLICY "users_read_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update (mark read/clear) their own notifications
CREATE POLICY "users_update_own_notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- System can insert notifications for any user
CREATE POLICY "system_insert_notifications" ON notifications
  FOR INSERT WITH CHECK (true);  -- Service role bypasses RLS anyway
```

### 1.4 Read/Clear Operations
- **Mark read:** `UPDATE notifications SET read_at = now() WHERE user_id = :uid AND read_at IS NULL`
- **Mark single read:** `UPDATE notifications SET read_at = now() WHERE id = :id AND user_id = :uid`
- **Clear all:** `UPDATE notifications SET cleared_at = now() WHERE user_id = :uid AND cleared_at IS NULL`
- **RPC:** `mark_all_notifications_read()`, `clear_all_notifications()`

### 1.5 Unread Count
- **Query:** `SELECT COUNT(*) FROM notifications WHERE user_id = :uid AND read_at IS NULL AND cleared_at IS NULL`
- **Realtime:** Client subscribes to `notifications` table changes, updates badge count
- **Mobile:** `unreadNotificationCountProvider` (Riverpod)

---

## 2. FCM Push Notifications

### 2.1 Channels
5 notification channels configured in Android:

| Channel ID | Name | Priority | Use |
|------------|------|----------|-----|
| orders | Orders | high | Order updates, quotes, payments |
| messages | Messages | high | New chat messages |
| reviews | Reviews | default | New reviews, review reminders |
| system | System | default | Promotional, announcements |
| connections | Connections | default | Connection requests, accept/reject |

### 2.2 FCM Token Storage
```sql
CREATE TABLE provider_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,      -- FCM token or web-push endpoint
  p256dh text,                 -- Web-push encryption key
  auth text,                   -- Web-push auth secret
  fcm_token text,              -- FCM registration token (mobile)
  created_at timestamptz DEFAULT now(),
  UNIQUE(provider_id, endpoint)
);
```

### 2.3 Push Flow (Server)
```
1. Event triggers notification
   ├── Order status change → enqueue_notification() RPC
   ├── New message → message insert trigger
   └── Connection request → connection request trigger

2. Notification created in notifications table

3. Push sent via lib/server/pushNotifications.ts
   ├── sendPushToUser(db, userId, payload)
   │   ├── Query provider_push_subscriptions for user
   │   ├── Separate FCM tokens vs web-push subscriptions
   │   ├── FCM: getMessaging().sendEachForMulticast(tokens, payload)
   │   └── Web: webpush.sendNotification(subscription, payload)
   │
   └── sendPushToMatchedProviders(db, helpRequestId, title)
       ├── Query help_request_matches for matched providers
       └── Send push to each matched provider

4. Invalid tokens cleaned up
   ├── FCM: "registration-token-not-registered" → delete from provider_push_subscriptions
   └── Web: 410 Gone → delete from provider_push_subscriptions
```

### 2.4 Push Payload
```typescript
type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;  // Deep-link data
};

// Android config
android: {
  priority: "high",
  notification: {
    channelId: "serviq_updates",
    icon: "ic_launcher",
  }
}

// iOS config
apns: {
  payload: { aps: { sound: "default" } }
}
```

### 2.5 Client Push Setup
- **Mobile:** FCM token obtained during app init, stored via `POST /api/push/subscribe`
- **Web:** VAPID push subscription via `PushManager.subscribe()`, stored via `POST /api/notifications/subscribe`

---

## 3. SMS via Twilio

### 3.1 Implementation
- **File:** `lib/server/sms.ts`
- **Client:** `twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)`
- **Messaging Service:** `TWILIO_MESSAGING_SERVICE_SID`
- **API:** `client.messages.create({ messagingServiceSid, body, to })`

### 3.2 Use Cases
| Use Case | Trigger | Template |
|----------|---------|----------|
| OTP verification | Auth flow | "Your ServiQ verification code is {code}" |
| Order confirmation | Order accepted | "Your order #{id} has been confirmed" |
| Order update | Status change | "Order #{id} status: {status}" |
| Review reminder | Cron (review-reminders) | "How was your experience? Leave a review" |

### 3.3 Rate Limiting
- OTP: 3 requests per phone per 60 seconds
- General SMS: 10 per user per hour
- Implemented via `rate_limits` table

---

## 4. WhatsApp (Partial)

### 4.1 Implementation Status
- **Schema:** `user_settings.whatsapp_notifications` (boolean) exists
- **Templates:** 10 event templates defined in `lib/server/whatsappNotifications.ts`
- **Sending:** Via Twilio WhatsApp API (`sendWhatsApp()` from `lib/server/twilioClient.ts`)
- **Status:** Schema and templates exist, sending partially implemented

### 4.2 Event Templates
```typescript
type NotificationEvent =
  | "help_request_match"
  | "new_quote"
  | "quote_accepted"
  | "order_confirmed"
  | "order_in_progress"
  | "order_completed"
  | "order_cancelled"
  | "payment_received"
  | "new_review"
  | "new_message";
```

Each event has consumer and provider variants with personalized messages.

### 4.3 Opt-In
- User enables via `PUT /api/user-settings` with `whatsappNotifications: true`
- Phone number read from `profiles.phone`
- Country code auto-prepended for 10-digit Indian numbers

---

## 5. Notification Triggers

### 5.1 Database Triggers
```sql
-- Orders: notify consumer on status change
CREATE TRIGGER trg_order_status_notification
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION enqueue_notification(
    NEW.consumer_id,
    'order',
    'Order updated',
    'Your order status has changed',
    'order',
    NEW.id,
    jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
  );

-- Messages: notify recipient on new message
CREATE TRIGGER trg_message_notification
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_conversation_recipient();
```

### 5.2 Application-Level Triggers
- **Connection request:** `send_connection_request()` RPC creates notification
- **Quote sent:** Quote API route creates notification for consumer
- **Quote accepted:** Quote accept API route creates notification for provider
- **Help request match:** `match_help_request()` RPC creates notifications for matched providers

### 5.3 Background Job Queue
- **Table:** `background_jobs`
- **Pattern:** Insert job → cron/process-jobs picks up → handler executes
- **Job types:** `send_push`, `send_sms`, `send_email`, `send_whatsapp`
- **Retry:** Exponential backoff (30s → 60s → 120s), max 3 attempts
- **Double-processing prevention:** Atomic claim (`UPDATE WHERE status = 'pending'`)

---

## 6. Deep-Link Routing on Tap

### 6.1 Web Deep Links
```typescript
// Notification action resolution (lib/notifications.ts)
resolveNotificationAction(notification) → { ctaLabel, href }

// Routes:
// conversation/message/chat → /dashboard/chat?open={conversationId}
// order/task → /dashboard/tasks?focus={orderId}
// review → /dashboard/profile
// help_request → /dashboard/tasks?tab=inbox&focus={helpRequestId}
// connection_request → /dashboard/people?panel=incoming&provider={requesterId}
// default → /dashboard/welcome
```

### 6.2 Mobile Deep Links
```dart
// Push notification tap handler
// data.url → Navigator.push(url)

// Routes:
// /app/chat/thread/{conversationId} → Chat thread
// /app/tasks?focus={orderId} → Task detail
// /app/profile/{userId} → Provider profile
// /app/create-need → Create need form
```

### 6.3 Metadata-Based Routing
Notifications store routing info in `metadata`:
```json
{
  "href": "/dashboard/chat?open=xxx",
  "conversation_id": "xxx",
  "order_id": "xxx",
  "help_request_id": "xxx",
  "requester_id": "xxx"
}
```

---

## 7. Offline Notification Handling

### 7.1 Mobile
- **FCM:** Notifications delivered even when app is closed (system tray)
- **In-app:** Notifications stored in `notifications` table, fetched on app open
- **Realtime:** Supabase Realtime reconnects on connectivity restore
- **Offline banner:** Shows "You appear to be offline" when no connectivity
- **Queue:** No local notification queue — relies on server-side persistence

### 7.2 Web
- **Push:** Web Push delivered when browser is open (even if tab is background)
- **In-app:** Notifications fetched on page load, realtime subscription for live updates
- **Offline:** Notifications table is the source of truth — no local caching
- **Service Worker:** Not implemented (planned for offline support)

### 7.3 Notification Cleanup
- **Cron:** `cleanup_expired_rate_limits()` also cleans old notifications
- **Retention:** Notifications older than 90 days are archived
- **Clear all:** User can clear all notifications (sets `cleared_at`)
