# Database Architecture

## Overview

ServiQ uses a self-hosted Supabase instance with PostgreSQL 15. The database contains 60+ tables organized into functional domains, 30+ RPC functions for business logic, and comprehensive Row-Level Security (RLS) policies.

## Design Principles

1. **UUID primary keys:** All tables use `uuid PK` with `gen_random_uuid()` default
2. **Auth anchor:** Nearly every table references `auth.users(id)` via FK
3. **Timestamps:** `created_at`/`updated_at` on all tables, `updated_at` managed by triggers
4. **Extensibility:** `metadata jsonb DEFAULT '{}'` on most tables
5. **Money as integers:** All monetary columns in paise (1/100 INR)
6. **Soft relationships:** Dual FK patterns (e.g., `provider_id` to `auth.users` + `profile_id` to `profiles`)
7. **Computed fields:** Trigger-managed (profile completion %, trust score, onboarding status)
8. **RLS-first:** Authorization at the database level, not application layer

## Schema Domains

### Identity & Auth
- `profiles` - Core user entity (1:1 with auth.users)
- `user_settings` - Notification preferences
- `otp_codes` - Phone/email OTP verification codes

### Listings & Catalog (Dual System)
- **Legacy:** `service_listings`, `product_catalog` (FK to auth.users)
- **V2:** `services`, `products` (FK to profiles)
- `manual_offerings` - Quick add offerings
- `portfolio` - Provider portfolio items
- `work_history` - Provider work history
- `availability` - Provider availability slots

### Orders & Tasks
- `orders` - Core order/request entity
- `task_events` - Order audit trail
- `booking_slots` - Scheduled bookings
- `razorpay_webhook_events` - Payment webhook idempotency

### Chat & Connections
- `conversations` - Chat conversations (direct/group)
- `conversation_participants` - Conversation membership
- `messages` - Chat messages
- `connection_requests` - User connections
- `live_talk_requests` - A/V call requests (disabled)

### Notifications
- `notifications` - In-app notifications
- `notification_escalations` - Multi-channel escalation
- `provider_push_subscriptions` - FCM/webpush tokens
- `sms_notifications` - SMS log

### Reviews & Trust
- `reviews` - Provider reviews (1-5 rating)
- `review_votes` - Helpful/not helpful votes
- `review_requests` - Post-order review prompts
- `trust_scores` - Computed trust metrics (6-input weighted formula)
- `provider_trust_metrics` - Legacy trust data
- `trust_artifacts` - Verification documents

### Help Requests & Matching
- `help_requests` - Consumer service requests
- `help_request_matches` - AI-matched providers
- `lead_assignments` - Lead routing with scoring

### Feed & Engagement
- `feed_card_saves` - Saved feed items
- `feed_card_shares` - Shared feed items
- `feed_card_feedback` - Report/not interested

### Geography
- `localities` - Neighborhoods/societies
- `market_zones` - Geographic zones (5 launch zones)
- `service_categories` - Service category catalog (7 seeded categories)
- `category_synonyms` - FTS synonyms for AI matching

### Quotes & Deals
- `quote_drafts` - Provider quotes
- `quote_line_items` - Quote line items
- `quote_versions` - Quote version history (immutable snapshots)
- `quote_version_line_items` - Versioned line items
- `quote_attachments` - Quote attachments/proof of work

### Workspaces & Teams
- `workspaces` - Business workspaces
- `workspace_branches` - Branch locations
- `workspace_members` - Team membership
- `workspace_assignment_rules` - Lead routing rules
- `workspace_activity_log` - Activity audit

### Monetization
- `subscription_plans` - Plan catalog (Free/Essential/Premium)
- `provider_subscriptions` - Active subscriptions
- `featured_placements` - Boost/featured placements
- `provider_payouts` - Payout records
- `payout_items` - Payout line items
- `provider_bank_accounts` - Bank/UPI details
- `invoices` - Generated invoices (GST billing)
- `disputes` - Order disputes
- `promo_codes` - Promotional codes
- `order_promo_codes` - Promo code usage per order

### Referrals & Growth
- `referral_codes` - User referral codes
- `referral_events` - Referral tracking
- `referral_payouts` - Referral rewards
- `campaign_schedules` - Automated campaign scheduling
- `widget_embeds` - Embeddable provider widgets

### Business Tools
- `business_launchpad_drafts` - Business profile drafts
- `google_business_tokens` - Google Business integration
- `verification_documents` - KYC documents

### Infrastructure
- `feature_flags` - Feature flags
- `feature_flag_overrides` - Per-user overrides
- `rate_limits` - API rate limiting
- `background_jobs` - Async job queue
- `_migrations` - Migration tracking
- `blocked_users` - User blocking
- `post_status_history` - Post lifecycle audit

### Cart
- `carts` - User shopping carts (cross-device sync)
- `cart_items` - Cart contents

### Intent Engine
- `intent_logs` - AI query logs
- `intent_matches` - Match results
- `intent_feedback` - Match feedback

### Booking Calendar
- `availability_exceptions` - Date-specific overrides
- `provider_availability_slots` - Weekly recurring slots

## Key Architectural Patterns

### Computed Fields via Triggers

The `profiles` table has a BEFORE INSERT/UPDATE trigger (`trg_profiles_sync_derived_fields`) that:
- Normalizes `name`, `full_name`, `email`, `phone`
- Auto-generates `username` from full_name if null
- Auto-generates `headline` if null
- Computes `profile_completion_percent` (0-100)
- Sets `onboarding_completed` boolean
- Syncs `services` and `interests` arrays (kept identical)
- Normalizes `role` and `availability`
- Normalizes `verification_level`
- Updates `updated_at`

### Trust Score Recomputation

The `orders` table has an AFTER INSERT/UPDATE trigger (`trg_orders_sync_metrics`) that:
- Calls `refresh_profile_marketplace_metrics()` for the affected provider
- Recomputes trust score using the 6-input weighted formula:
  - Rating score (35%): average review rating * 20
  - Completion rate (20%): completed jobs / accepted jobs * 100
  - On-time rate (15%): on_time_rate from profile
  - Repeat clients (15%): consumers with 2+ bookings * 12
  - Verification score (10%): email=35, phone=65, identity=85, business=100
  - Response time (5%): max(0, 100 - responseTimeMinutes * 2)
- Updates `trust_scores` table (upsert on profile_id)

### Audit Trail

The `orders` table has an AFTER INSERT/UPDATE trigger (`trg_log_task_order_event`) that:
- Creates `task_events` rows for every status change
- Records actor, previous/next status, timestamp
- Logs price changes, assignment changes
- Events: `created`, `status_changed`, `assignment_changed`, `price_updated`

### Conversation Key Generation

Direct conversations use a deterministic `direct_key` for idempotent creation:
```
make_direct_conversation_key(user_a, user_b)
  = min(user_a, user_b) || ':' || max(user_a, user_b)
```
This ensures only one direct conversation exists between any two users.

### Post Status Lifecycle

Posts follow a state machine enforced by `transition_post_status()` RPC:
```
open -> matched -> in_progress -> completed (terminal)
open -> cancelled -> archived -> deleted (terminal)
open -> hidden -> deleted (terminal)
```

### Suspension System

Suspended users (`is_suspended = true` on profiles) are blocked from:
- Creating/updating orders
- Sending messages
- Creating help requests
Enforced via additive RLS policies using `is_user_suspended(auth.uid())`.

## Storage Buckets

| Bucket | Public | Max Size | Purpose |
|--------|--------|----------|---------|
| `post-media` | Yes | 25 MB | Post feed images |
| `profile-avatars` | Yes | 5 MB | User profile photos |
| `listing-images` | Yes | 25 MB | Service/product listing photos |
| `verification-docs` | No | 10 MB | KYC documents (private) |
| `review-photos` | Yes | 5 MB | Review photos |

## Realtime Publications

Tables published to `supabase_realtime`:
- `posts`, `orders`, `task_events`, `connection_requests`
- `conversations`, `conversation_participants`, `messages`
- `services`, `products`, `portfolio`, `work_history`, `availability`, `payment_methods`
- `trust_scores`, `profile_sections`, `reviews`, `profiles`
- `live_talk_requests`, `localities`, `market_zones`
- `quote_drafts`, `quote_line_items`, `quote_versions`, `quote_version_line_items`, `quote_attachments`
- `business_launchpad_drafts`, `lead_assignments`
- `referral_codes`, `review_requests`, `campaign_schedules`, `widget_embeds`
- `feed_card_feedback`, `service_categories`, `google_business_tokens`

## Key RPC Functions

| Function | Purpose |
|----------|---------|
| `match_help_request(uuid)` | AI-matched provider discovery using Haversine distance |
| `accept_help_request(uuid)` | Provider accepts a help request |
| `transition_help_request_status(uuid, text)` | State machine for help requests |
| `get_or_create_direct_conversation(uuid)` | Idempotent direct chat creation |
| `send_connection_request(uuid)` | Mutual connection detection |
| `respond_to_connection_request(uuid, text)` | Accept/reject/cancel connections |
| `get_provider_order_stats(uuid[])` | Batch provider stats (completed, open, accepted, repeat) |
| `transition_post_status(uuid, text, uuid)` | Post lifecycle state machine |
| `refresh_profile_marketplace_metrics(uuid)` | Trust score recomputation |
| `check_booking_slot_available(uuid, date, time, time)` | Booking conflict detection |
| `decrement_product_stock(uuid, int)` | Atomic stock reservation |
| `increment_product_stock(uuid, int)` | Stock restoration on cancellation |
| `validate_promo_code(text, numeric)` | Promo code validation and discount calculation |
| `consume_promo_code(uuid)` | Promo code usage increment |
| `record_migration(text, text, int)` | Migration tracking |
| `upsert_provider_presence(boolean, text, int)` | Provider online status |
