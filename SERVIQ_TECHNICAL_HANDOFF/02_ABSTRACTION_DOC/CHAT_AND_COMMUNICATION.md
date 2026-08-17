# Chat & Communication

## Chat System

- **Type:** Direct messaging (1:1), group support in schema
- **Storage:** Supabase Postgres (conversations, messages tables)
- **Realtime:** Postgres changes on messages + conversation_participants
- **Access:** Any authenticated user can start a chat (connection not required since March 2026)
- **Features:** Text messages, image attachments, read receipts

## Connection System

- **Type:** Friend/connection request pattern
- **States:** pending → accepted/rejected/cancelled
- **Auto-accept:** Mutual requests automatically accepted
- **Usage:** Optional for chat, used for feed visibility, provider discovery

## Notification Channels

| Channel | Trigger | Delivery |
|---------|---------|----------|
| In-app | All events | Realtime subscription |
| Push (FCM) | Order updates, messages, reviews | Firebase Cloud Messaging |
| SMS | OTP, order status | Twilio |
| WhatsApp | [UNVERIFIED] Schema exists | Implementation partial |
| Email | [UNVERIFIED] Templates partial | SendGrid |
