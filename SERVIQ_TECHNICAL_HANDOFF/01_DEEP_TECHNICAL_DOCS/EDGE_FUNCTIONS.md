# ServiQ Edge Functions (RPC Functions)

## 1. Help Request Functions

### match_help_request(uuid)
Matches providers to a help request based on locality, services, and availability.
```sql
CREATE OR REPLACE FUNCTION match_help_request(p_help_request_id uuid)
RETURNS void
-- 1. Reads help request (locality_id, category, urgency)
-- 2. Queries providers in same locality with matching services
-- 3. Filters by availability (available, online)
-- 4. Creates help_request_matches rows (status: 'open')
-- 5. Sends push notifications to matched providers
```

### match_help_request_v2(uuid)
Enhanced matching with trust scoring and AI.
```sql
CREATE OR REPLACE FUNCTION match_help_request_v2(p_help_request_id uuid)
RETURNS void
-- Same as v1 but:
-- 6. Scores providers using lead scoring formula
-- 7. Deduplicates by provider (keeps best listing)
-- 8. Limits to top 10 matches
```

### accept_help_request(uuid)
Transitions help request from matched to accepted.
```sql
CREATE OR REPLACE FUNCTION accept_help_request(p_help_request_id uuid)
RETURNS uuid  -- returns order_id
-- 1. Validates status is 'matched'
-- 2. Updates help_requests.status = 'accepted'
-- 3. Creates orders row with provider_id
-- 4. Creates task_events audit row
-- 5. Returns new order ID
```

### transition_help_request_status(uuid, text)
Generic status transition with validation.
```sql
CREATE OR REPLACE FUNCTION transition_help_request_status(
  p_help_request_id uuid,
  p_new_status text
)
RETURNS void
-- 1. Validates transition is allowed (open→matched→accepted→in_progress→completed/cancelled)
-- 2. Updates help_requests.status
-- 3. Creates task_events audit row
-- 4. Sends notifications if needed
```

---

## 2. Chat Functions

### get_or_create_direct_conversation(uuid)
Atomic get-or-create for direct conversations.
```sql
CREATE OR REPLACE FUNCTION get_or_create_direct_conversation(p_recipient_id uuid)
RETURNS uuid  -- conversation_id
-- 1. Generates direct_key via make_direct_conversation_key(auth.uid(), p_recipient_id)
-- 2. Checks if conversation with direct_key exists
-- 3. If exists: returns existing conversation_id
-- 4. If not: creates conversations row + conversation_participants rows
-- 5. Returns conversation_id
```

### make_direct_conversation_key(uuid, uuid)
Generates deterministic conversation key for deduplication.
```sql
CREATE OR REPLACE FUNCTION make_direct_conversation_key(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS text
-- Sorts two UUIDs alphabetically, joins with ':'
-- Example: make_direct_conversation_key('b-uuid', 'a-uuid') → 'a-uuid:b-uuid'
```

### is_conversation_participant(uuid, uuid)
Checks if user is a participant in a conversation.
```sql
CREATE OR REPLACE FUNCTION is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid
)
RETURNS boolean
-- SELECT EXISTS (
--   SELECT 1 FROM conversation_participants
--   WHERE conversation_id = p_conversation_id
--   AND user_id = p_user_id
-- );
```

---

## 3. Connection Functions

### send_connection_request(uuid)
Sends a connection request to another user.
```sql
CREATE OR REPLACE FUNCTION send_connection_request(p_recipient_id uuid)
RETURNS uuid  -- request_id
-- 1. Validates not self-request
-- 2. Checks no existing pending request between users
-- 3. Inserts connection_requests row (status: 'pending')
-- 4. Creates notification for recipient
-- 5. Returns request_id
```

### respond_to_connection_request(uuid, text)
Accepts or rejects a connection request.
```sql
CREATE OR REPLACE FUNCTION respond_to_connection_request(
  p_request_id uuid,
  p_action text  -- 'accept' | 'reject'
)
RETURNS void
-- 1. Validates user is recipient
-- 2. Validates status is 'pending'
-- 3. Updates connection_requests.status
-- 4. Sets responded_at timestamp
-- 5. Creates notification for requester
```

### is_connection_accepted(uuid, uuid)
Checks if two users have an accepted connection.
```sql
CREATE OR REPLACE FUNCTION is_connection_accepted(
  p_user_a uuid,
  p_user_b uuid
)
RETURNS boolean
-- SELECT EXISTS (
--   SELECT 1 FROM connection_requests
--   WHERE status = 'accepted'
--   AND (
--     (requester_id = p_user_a AND recipient_id = p_user_b)
--     OR
--     (requester_id = p_user_b AND recipient_id = p_user_a)
--   )
-- );
```

---

## 4. Presence Functions

### upsert_provider_presence(boolean, text, integer)
Updates provider online status.
```sql
CREATE OR REPLACE FUNCTION upsert_provider_presence(
  p_is_online boolean,
  p_status text DEFAULT 'available',
  p_listing_score integer DEFAULT 0
)
RETURNS void
-- 1. Upserts into provider_presence table
-- 2. Sets last_seen = now()
-- 3. Updates is_online flag
-- 4. Updates status and listing_score
```

---

## 5. Notification Functions

### enqueue_notification(...)
Enqueues a notification for a user.
```sql
CREATE OR REPLACE FUNCTION enqueue_notification(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_message text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid  -- notification_id
-- 1. Inserts into notifications table
-- 2. Returns notification_id
-- 3. Realtime triggers push to subscribed clients
```

### mark_all_notifications_read()
Marks all notifications as read for the current user.
```sql
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void
-- UPDATE notifications SET read_at = now()
-- WHERE user_id = auth.uid() AND read_at IS NULL;
```

### clear_all_notifications()
Clears all notifications for the current user.
```sql
CREATE OR REPLACE FUNCTION clear_all_notifications()
RETURNS void
-- UPDATE notifications SET cleared_at = now()
-- WHERE user_id = auth.uid() AND cleared_at IS NULL;
```

---

## 6. Trust & Metrics Functions

### refresh_profile_marketplace_metrics(uuid)
Recalculates trust score and marketplace metrics for a provider.
```sql
CREATE OR REPLACE FUNCTION refresh_profile_marketplace_metrics(p_profile_id uuid)
RETURNS void
-- 1. Fetches order stats via get_provider_order_stats([p_profile_id])
-- 2. Calculates job completion rate via calculate_job_completion_rate()
-- 3. Calculates trust score via calculate_marketplace_trust_score()
-- 4. Updates profiles.trust_score, .completed_jobs, .average_rating, .review_count
-- 5. Updates marketplace_trust_scores table
```

### calculate_marketplace_trust_score(...)
Calculates the 6-input trust score.
```sql
CREATE OR REPLACE FUNCTION calculate_marketplace_trust_score(
  p_average_rating numeric,
  p_completion_rate numeric,
  p_on_time_rate numeric,
  p_repeat_clients integer,
  p_verification_level text,
  p_response_time_minutes numeric
)
RETURNS jsonb
-- Returns: { ratingScore, completionRate, onTimeRate, repeatClientsScore, verificationScore, responseTimeScore, trustScore }
-- Formula: rating*0.35 + completion*0.20 + onTime*0.15 + repeat*0.15 + verification*0.10 + responseTime*0.05
```

### calculate_marketplace_profile_completion(...)
Calculates profile completion percentage.
```sql
CREATE OR REPLACE FUNCTION calculate_marketplace_profile_completion(p_profile_id uuid)
RETURNS jsonb
-- Returns: { basicInfo, avatar, serviceAdded, productAdded, portfolioAdded, availability, paymentMethod, verification, total }
```

### calculate_job_completion_rate(bigint, bigint)
Calculates job completion percentage.
```sql
CREATE OR REPLACE FUNCTION calculate_job_completion_rate(
  p_completed bigint,
  p_accepted bigint
)
RETURNS numeric
-- Returns: CASE WHEN p_accepted > 0 THEN (p_completed::numeric / p_accepted) * 100 ELSE 0 END
```

### get_provider_order_stats(uuid[])
Batch-fetches order statistics for providers.
```sql
CREATE OR REPLACE FUNCTION get_provider_order_stats(p_provider_ids uuid[])
RETURNS TABLE (
  provider_id uuid,
  completed_jobs bigint,
  open_leads bigint,
  accepted_jobs bigint,
  repeat_consumers bigint
)
-- Groups orders by provider_id, counts by status
-- repeat_consumers: count of distinct consumer_ids with > 1 order
```

---

## 7. Feed & Metrics Functions

### get_feed_card_metrics(text[])
Returns metrics for feed cards.
```sql
CREATE OR REPLACE FUNCTION get_feed_card_metrics(p_card_ids text[])
RETURNS TABLE (
  card_id text,
  likes integer,
  saves integer,
  shares integer,
  comments integer
)
-- Aggregates interaction counts from feed_card_interactions table
```

---

## 8. Geographic Functions

### providers_near_locality(uuid, int, int)
Returns providers near a locality with pagination.
```sql
CREATE OR REPLACE FUNCTION providers_near_locality(
  p_locality_id uuid,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  provider_id uuid,
  display_name text,
  headline text,
  avatar_url text,
  trust_score numeric,
  locality_id uuid,
  distance_km numeric
)
-- Joins profiles with localities for distance calculation
-- Orders by distance ascending
-- Filters out is_test accounts
```

---

## 9. Product Functions

### decrement_product_stock(uuid, int)
Atomically decrements product stock.
```sql
CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id uuid,
  p_quantity int
)
RETURNS boolean
-- UPDATE product_catalog
-- SET stock = stock - p_quantity
-- WHERE id = p_product_id AND stock >= p_quantity
-- RETURNING true;
-- Returns false if insufficient stock
```

### increment_product_stock(uuid, int)
Atomically increments product stock.
```sql
CREATE OR REPLACE FUNCTION increment_product_stock(
  p_product_id uuid,
  p_quantity int
)
RETURNS void
-- UPDATE product_catalog
-- SET stock = stock + p_quantity
-- WHERE id = p_product_id;
```

---

## 10. Analytics Functions

### count_by_day(text, timestamptz, timestamptz)
Counts records by day for chart data.
```sql
CREATE OR REPLACE FUNCTION count_by_day(
  p_table text,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (day date, count bigint)
-- Dynamic SQL: SELECT date(created_at), COUNT(*) FROM {p_table}
-- WHERE created_at BETWEEN p_start AND p_end
-- GROUP BY day ORDER BY day
```

### get_platform_startup_diagnostics()
Returns platform health diagnostics.
```sql
CREATE OR REPLACE FUNCTION get_platform_startup_diagnostics()
RETURNS jsonb
-- Returns: { totalUsers, totalProviders, totalOrders, totalRevenue, activeListings, ... }
-- Used by admin dashboard and health checks
```

---

## 11. Post Functions

### transition_post_status(uuid, text, text)
Transitions post status with validation.
```sql
CREATE OR REPLACE FUNCTION transition_post_status(
  p_post_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS void
-- 1. Validates transition is allowed
-- 2. Updates posts.status
-- 3. Creates task_events audit row
```

---

## 12. Migration Functions

### record_migration(text, text, integer)
Records a migration as applied.
```sql
CREATE OR REPLACE FUNCTION record_migration(
  p_name text,
  p_checksum text,
  p_steps integer
)
RETURNS void
-- INSERT INTO applied_migrations (name, checksum, steps, applied_at)
-- VALUES (p_name, p_checksum, p_steps, now())
-- ON CONFLICT (name) DO NOTHING;
```

### migration_applied(text)
Checks if a migration has been applied.
```sql
CREATE OR REPLACE FUNCTION migration_applied(p_name text)
RETURNS boolean
-- SELECT EXISTS (SELECT 1 FROM applied_migrations WHERE name = p_name);
```

---

## 13. Cleanup Functions

### cleanup_expired_rate_limits()
Removes expired rate limit entries.
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS integer
-- DELETE FROM rate_limits
-- WHERE window_start < EXTRACT(EPOCH FROM now() - interval '2 hours');
-- RETURN COUNT(*);
```

### cleanup_expired_otps()
Removes expired OTP codes.
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS integer
-- DELETE FROM otp_codes
-- WHERE expires_at < now() OR attempts >= 3;
-- RETURN COUNT(*);
```

---

## 14. Utility Functions

### set_updated_at()
Trigger function to auto-update `updated_at` column.
```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
-- NEW.updated_at = now();
-- RETURN NEW;
```

### normalize_profile_role(text)
Normalizes role input to canonical values.
```sql
CREATE OR REPLACE FUNCTION normalize_profile_role(p_role text)
RETURNS text
-- 'provider', 'service_provider', 'seller' → 'provider'
-- 'seeker', 'consumer', 'buyer', 'customer' → 'seeker'
-- NULL or unrecognized → NULL
```

### normalize_profile_availability(text)
Normalizes availability input.
```sql
CREATE OR REPLACE FUNCTION normalize_profile_availability(p_availability text)
RETURNS text
-- 'available', 'online', 'active' → 'available'
-- 'busy', 'away', 'offline' → 'busy'
-- NULL → NULL
```

### normalize_profile_tag_array(text[])
Normalizes tag/service arrays.
```sql
CREATE OR REPLACE FUNCTION normalize_profile_tag_array(p_tags text[])
RETURNS text[]
-- Trims whitespace, removes duplicates, lowercases
```

### is_user_suspended(uuid)
Checks if a user is suspended.
```sql
CREATE OR REPLACE FUNCTION is_user_suspended(p_user_id uuid)
RETURNS boolean
-- SELECT COALESCE(
--   (SELECT is_suspended FROM profiles WHERE id = p_user_id),
--   false
-- );
```

---

## 15. Subscription Guard

### subscription_guard(uuid, text)
Checks if user has active subscription for gated feature.
```sql
CREATE OR REPLACE FUNCTION subscription_guard(
  p_user_id uuid,
  p_feature text
)
RETURNS boolean
-- Checks user_subscriptions table for active subscription
-- that includes the requested feature
```
