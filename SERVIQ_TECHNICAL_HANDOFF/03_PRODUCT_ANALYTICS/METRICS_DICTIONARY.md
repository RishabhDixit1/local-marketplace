# Metrics Dictionary

**Last updated:** August 2026

Every measurable metric in ServiQ, its definition, SQL query, and source table.

---

## User Metrics

### total_users

**Definition:** Total registered users (profiles).  
**Table:** `profiles`

```sql
SELECT count(*) AS total_users FROM profiles;
```

### new_users_day

**Definition:** Users who created a profile on a given day.  
**Table:** `profiles`

```sql
SELECT date(created_at) AS day, count(*) AS new_users
FROM profiles
WHERE created_at >= now() - interval '30 days'
GROUP BY 1 ORDER BY 1;
```

### new_users_week

**Definition:** Users who created a profile in the past 7 days.

```sql
SELECT count(*) AS new_users_week
FROM profiles
WHERE created_at >= now() - interval '7 days';
```

### new_users_month

**Definition:** Users who created a profile in the past 30 days.

```sql
SELECT count(*) AS new_users_month
FROM profiles
WHERE created_at >= now() - interval '30 days';
```

### active_users

**Definition:** Users with activity in the past 30 days (any order, message, or post).  
**Tables:** `profiles`, `orders`, `messages`, `help_requests`

```sql
SELECT count(DISTINCT p.id) AS active_users
FROM profiles p
LEFT JOIN orders o ON o.buyer_id = p.id OR o.provider_id = p.id
LEFT JOIN messages m ON m.sender_id = p.id
LEFT JOIN help_requests hr ON hr.user_id = p.id
WHERE greatest(
  o.created_at,
  m.created_at,
  hr.created_at
) >= now() - interval '30 days';
```

### users_by_role

**Definition:** User count segmented by role.  
**Table:** `profiles`

```sql
SELECT role, count(*) AS count
FROM profiles
GROUP BY role ORDER BY count DESC;
```

### users_by_locality

**Definition:** User count by locality.  
**Tables:** `profiles`, `localities`

```sql
SELECT l.name AS locality, count(*) AS user_count
FROM profiles p
JOIN localities l ON l.id = p.locality_id
GROUP BY l.name ORDER BY user_count DESC;
```

### users_by_verification_level

**Definition:** User count by verification level.  
**Table:** `profiles`

```sql
SELECT
  CASE
    WHEN is_verified THEN 'verified'
    ELSE 'unverified'
  END AS verification_status,
  count(*) AS count
FROM profiles
GROUP BY 1;
```

---

## Provider Metrics

### total_providers

**Definition:** Unique providers with at least one active service.  
**Table:** `services`

```sql
SELECT count(DISTINCT profile_id) AS total_providers
FROM services
WHERE is_active = true;
```

### active_providers

**Definition:** Providers who received a match or order in the past 30 days.

```sql
SELECT count(DISTINCT p.id) AS active_providers
FROM profiles p
WHERE p.role = 'provider'
AND EXISTS (
  SELECT 1 FROM orders o
  WHERE o.provider_id = p.id
  AND o.created_at >= now() - interval '30 days'
);
```

### providers_by_category

**Definition:** Provider count per service category.  
**Tables:** `services`, `service_categories`

```sql
SELECT sc.name AS category, count(DISTINCT s.profile_id) AS provider_count
FROM services s
JOIN service_categories sc ON sc.id = s.category_id
WHERE s.is_active = true
GROUP BY sc.name ORDER BY provider_count DESC;
```

### avg_trust_score

**Definition:** Average trust score across all providers.  
**Table:** `trust_scores`

```sql
SELECT avg(trust_score) AS avg_trust_score
FROM trust_scores
WHERE trust_score > 0;
```

### avg_profile_completion

**Definition:** Average profile completion percentage across providers.

```sql
SELECT avg(profile_completion_pct) AS avg_completion
FROM profiles
WHERE role = 'provider';
```

---

## Request Metrics

### total_requests

**Definition:** Total help requests posted.  
**Table:** `help_requests`

```sql
SELECT count(*) AS total_requests FROM help_requests;
```

### open_requests

**Definition:** Help requests still open (not matched/accepted).

```sql
SELECT count(*) AS open_requests
FROM help_requests
WHERE status = 'open';
```

### matched_requests

**Definition:** Help requests that received at least one provider match.

```sql
SELECT count(DISTINCT hr.id) AS matched_requests
FROM help_requests hr
JOIN help_request_matches hrm ON hrm.help_request_id = hr.id;
```

### completed_requests

**Definition:** Help requests that resulted in a completed order.

```sql
SELECT count(*) AS completed_requests
FROM orders
WHERE status = 'completed';
```

### avg_time_to_match

**Definition:** Average time from request creation to first provider match.

```sql
SELECT avg(EXTRACT(EPOCH FROM (hrm.created_at - hr.created_at))) AS avg_seconds_to_match
FROM help_requests hr
JOIN help_request_matches hrm ON hrm.help_request_id = hr.id;
```

### avg_time_to_completion

**Definition:** Average time from order creation to completion.

```sql
SELECT avg(EXTRACT(EPOCH FROM (updated_at - created_at))) AS avg_seconds_to_completion
FROM orders
WHERE status = 'completed';
```

---

## Order Metrics

### total_orders

**Definition:** Total orders created.  
**Table:** `orders`

```sql
SELECT count(*) AS total_orders FROM orders;
```

### orders_by_status

**Definition:** Order count by status.  
**Table:** `orders`

```sql
SELECT status, count(*) AS count
FROM orders
GROUP BY status ORDER BY count DESC;
```

### avg_order_value

**Definition:** Average order value in paise (divide by 100 for rupees).

```sql
SELECT avg(total_amount) AS avg_order_value_paise
FROM orders
WHERE status IN ('completed', 'in_progress');
```

### total_revenue

**Definition:** Sum of completed order values in paise.

```sql
SELECT sum(total_amount) AS total_revenue_paise
FROM orders
WHERE status = 'completed';
```

### commission_collected

**Definition:** Platform commission from completed orders.

```sql
SELECT sum(commission_amount) AS commission_paise
FROM orders
WHERE status = 'completed'
AND commission_amount IS NOT NULL;
```

---

## Chat Metrics

### total_conversations

**Definition:** Total unique conversations.  
**Table:** `conversations`

```sql
SELECT count(*) AS total_conversations FROM conversations;
```

### messages_sent

**Definition:** Total messages sent.  
**Table:** `messages`

```sql
SELECT count(*) AS total_messages FROM messages;
```

### avg_messages_per_conversation

**Definition:** Average messages per conversation.

```sql
SELECT avg(msg_count) AS avg_messages
FROM (
  SELECT conversation_id, count(*) AS msg_count
  FROM messages
  GROUP BY conversation_id
) sub;
```

---

## Engagement Metrics

### feed_saves

**Definition:** Total feed card saves.  
**Table:** `feed_card_saves`

```sql
SELECT count(*) AS total_saves FROM feed_card_saves;
```

### feed_shares

**Definition:** Total feed card shares.  
**Table:** `feed_card_shares`

```sql
SELECT count(*) AS total_shares FROM feed_card_shares;
```

### feed_feedback

**Definition:** Feed card feedback breakdown.  
**Table:** `feed_card_feedback`

```sql
SELECT feedback_type, count(*) AS count
FROM feed_card_feedback
GROUP BY feedback_type;
```

### search_queries

**Definition:** AI intent engine queries logged.  
**Table:** `intent_logs`

```sql
SELECT count(*) AS total_search_queries FROM intent_logs;
```

### ai_queries

**Definition:** AI queries by strategy (AI match vs keyword fallback).

```sql
SELECT match_strategy, count(*) AS count
FROM intent_logs
GROUP BY match_strategy;
```

---

## Subscription Metrics

### free_providers

**Definition:** Providers without an active subscription.

```sql
SELECT count(*) AS free_providers
FROM profiles p
WHERE p.role = 'provider'
AND NOT EXISTS (
  SELECT 1 FROM provider_subscriptions ps
  WHERE ps.provider_id = p.id
  AND ps.status = 'active'
);
```

### essential_subscribers

**Definition:** Providers on the Essential plan.

```sql
SELECT count(*) AS essential_subscribers
FROM provider_subscriptions ps
JOIN subscription_plans sp ON sp.id = ps.plan_id
WHERE ps.status = 'active'
AND sp.name ILIKE '%essential%';
```

### premium_subscribers

**Definition:** Providers on the Premium plan.

```sql
SELECT count(*) AS premium_subscribers
FROM provider_subscriptions ps
JOIN subscription_plans sp ON sp.id = ps.plan_id
WHERE ps.status = 'active'
AND sp.name ILIKE '%premium%';
```

### mrr

**Definition:** Monthly Recurring Revenue from active subscriptions.

```sql
SELECT sum(sp.price_paise) AS mrr_paise
FROM provider_subscriptions ps
JOIN subscription_plans sp ON sp.id = ps.plan_id
WHERE ps.status = 'active';
```

---

## Geography Metrics

### providers_by_locality

**Definition:** Provider count per locality.  
**Tables:** `profiles`, `localities`

```sql
SELECT l.name AS locality, count(*) AS provider_count
FROM profiles p
JOIN localities l ON l.id = p.locality_id
WHERE p.role = 'provider'
GROUP BY l.name ORDER BY provider_count DESC;
```

### requests_by_locality

**Definition:** Help request count per locality.  
**Tables:** `help_requests`, `localities`

```sql
SELECT l.name AS locality, count(*) AS request_count
FROM help_requests hr
JOIN localities l ON l.id = hr.locality_id
GROUP BY l.name ORDER BY request_count DESC;
```

### coverage_map

**Definition:** Localities with both providers and requests (active markets).

```sql
SELECT
  l.name AS locality,
  count(DISTINCT p.id) AS providers,
  count(DISTINCT hr.id) AS requests
FROM localities l
LEFT JOIN profiles p ON p.locality_id = l.id AND p.role = 'provider'
LEFT JOIN help_requests hr ON hr.locality_id = l.id
GROUP BY l.name
HAVING count(DISTINCT p.id) > 0 OR count(DISTINCT hr.id) > 0
ORDER BY providers DESC, requests DESC;
```

---

## Composite Metrics (Computed)

### provider_utilization_rate

**Definition:** Percentage of providers who received at least one order this month.

```sql
WITH total AS (
  SELECT count(DISTINCT profile_id) AS total
  FROM services WHERE is_active = true
),
active AS (
  SELECT count(DISTINCT provider_id) AS active_count
  FROM orders
  WHERE created_at >= date_trunc('month', now())
  AND status != 'cancelled'
)
SELECT
  a.active_count,
  t.total,
  round(a.active_count::numeric / nullif(t.total, 0) * 100, 1) AS utilization_pct
FROM active a, total t;
```

### request_fulfillment_rate

**Definition:** Percentage of requests that resulted in a completed order.

```sql
SELECT
  count(*) FILTER (WHERE status = 'completed') AS fulfilled,
  count(*) AS total,
  round(
    count(*) FILTER (WHERE status = 'completed')::numeric / nullif(count(*), 0) * 100,
    1
  ) AS fulfillment_pct
FROM orders;
```

### provider_churn_rate

**Definition:** Providers who became inactive this month vs last month.

```sql
WITH this_month AS (
  SELECT count(DISTINCT provider_id) AS c
  FROM orders
  WHERE created_at >= date_trunc('month', now())
),
last_month AS (
  SELECT count(DISTINCT provider_id) AS c
  FROM orders
  WHERE created_at >= date_trunc('month', now()) - interval '1 month'
  AND created_at < date_trunc('month', now())
)
SELECT
  l.c AS last_month_active,
  t.c AS this_month_active,
  l.c - t.c AS churned,
  round((l.c - t.c)::numeric / nullif(l.c, 0) * 100, 1) AS churn_pct
FROM this_month t, last_month l;
```
