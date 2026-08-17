# Analytics Architecture

**Last updated:** August 2026

---

## Overview

ServiQ currently has **no centralized analytics warehouse**. Data is fragmented across Firebase Analytics (mobile), Vercel Analytics (web), and Supabase PostgreSQL (database-level RPCs). There is no single pane of glass for product metrics.

---

## 1. Mobile Analytics (Firebase Analytics)

Firebase Analytics is the primary mobile event pipeline. Events are sent via the `firebase_analytics` Flutter package.

### Screen Tracking

Every page in the Flutter app logs a screen view via `FirebaseAnalytics.instance.logScreenView(screenName: ...)`. Screen names follow a `category_page` convention:

| Screen Name | Description |
|-------------|-------------|
| `home_welcome` | AI home / Need Something tab |
| `explore_discovery` | Discovery / Explore tab |
| `profile_hub` | You / Profile tab |
| `chat_inbox` | Chat conversation list |
| `chat_thread` | Individual chat thread |
| `feed_browse` | Feed / community posts |
| `search_results` | Search results page |
| `order_detail` | Order detail page |
| `provider_profile` | Public provider profile |
| `create_need` | Post a help request |
| `quote_comparison` | Compare quotes |
| `marketplace_landing` | Public landing page (web) |

### Custom Events

Key custom events logged:

| Event Name | Parameters | When |
|------------|-----------|------|
| `app_open_mobile` | `firebase_ready`, `cold_start_ms` | App foreground / cold start |
| `first_engagement` | `method` (feed/need/explore) | First meaningful interaction |
| `intent_chosen` | `intent` (findHelp/earnNearby/businessSetup) | Onboarding role selection |
| `ai_query_submitted` | `has_location`, `result_count`, `latency_ms` | AI prompt bar submission |
| `order_created` | `order_id`, `provider_id`, `amount_paise` | Order placement |
| `payment_completed` | `order_id`, `amount_paise`, `method` | Razorpay payment success |
| `quote_sent` | `quote_id`, `order_id`, `amount_paise` | Provider sends quote |
| `quote_accepted` | `quote_id`, `order_id` | Consumer accepts quote |
| `review_submitted` | `order_id`, `rating` | Review posted |
| `chat_message_sent` | `conversation_id`, `has_image` | Message sent |

### Firebase Crashlytics

Crashlytics is enabled for release builds (`!kDebugMode`). Reports are sent via:
- `FlutterError.onError` → `FirebaseCrashlytics.instance.recordError`
- `runZonedGuarded` → `FirebaseCrashlytics.instance.recordError`
- `PlatformDispatcher.instance.onError` → `FirebaseCrashlytics.instance.recordError`

**Known limitation:** Crashlytics upload is unverified in debug builds (Crashlytics is a no-op when `firebase_ready: false`). Requires a signed release build with `ENABLE_TEST_CRASH=true` to verify.

### Firebase Cloud Messaging (FCM)

5 push notification channels:
1. `orders` — order status updates
2. `quotes` — new quotes received
3. `chat` — new messages
4. `leads` — AI-matched lead notifications
5. `general` — system notifications

FCM tokens are registered on each app open and stored in `provider_push_subscriptions`.

---

## 2. Web Analytics (Vercel Analytics)

Vercel Analytics is enabled for the Next.js web app at `www.serviqapp.com`.

- **Web Vitals:** LCP, FID, CLS tracked automatically
- **Page views:** Automatic route-level tracking
- **No custom events:** The web app does not log custom analytics events to Vercel Analytics

Access: Vercel dashboard → Project → Analytics tab.

---

## 3. Database-Level Analytics (Supabase RPCs)

### `count_by_day(table_name, start_date, end_date)`

Returns daily counts for any table with a `created_at` column.

```sql
SELECT * FROM count_by_day('profiles', '2026-01-01', '2026-08-17');
-- Returns: [{date: "2026-01-01", count: 5}, ...]
```

Used by the admin analytics API (`/api/admin/analytics`).

### `get_platform_startup_diagnostics()`

Returns a health check object:
```sql
SELECT * FROM get_platform_startup_diagnostics();
-- Returns: {total_users, total_providers, total_orders, total_conversations, ...}
```

### `refresh_profile_marketplace_metrics(profile_id)`

Recalculates a provider's trust score, profile completion, and marketplace metrics. Called after order status changes and profile updates.

### `calculate_marketplace_trust_score(...)`

6-input weighted trust score:
- Job completion rate (40%)
- Average rating (25%)
- Review count (10%)
- Response time (10%)
- Repeat consumers (10%)
- Profile completeness (5%)

### `get_provider_order_stats(provider_ids)`

Batch-fetches order statistics for an array of provider IDs:
- `completed_jobs`, `accepted_jobs`, `total_revenue`, `avg_rating`, `repeat_consumers`

---

## 4. Intent Engine Analytics

The AI intent engine logs every request and match for debugging and improvement.

### `intent_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Requesting user |
| `raw_input` | text | Original natural language input |
| `parsed_intent` | jsonb | Gemini-parsed intent (category, locality, urgency) |
| `match_strategy` | text | `ai_match` or `keyword_fallback` |
| `result_count` | integer | Number of providers returned |
| `latency_ms` | integer | End-to-end latency |
| `created_at` | timestamptz | Request timestamp |

### `intent_matches`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `intent_log_id` | uuid | FK to intent_logs |
| `provider_id` | uuid | Matched provider |
| `trust_score` | numeric | Provider trust score at match time |
| `distance_km` | numeric | Distance from user |
| `rank` | integer | Position in result list |
| `selected` | boolean | Whether user selected this provider |

### `intent_feedback`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `intent_log_id` | uuid | FK to intent_logs |
| `feedback_type` | text | `helpful`, `not_relevant`, `no_results` |
| `created_at` | timestamptz | Feedback timestamp |

**No aggregate analytics are currently computed from these tables.** They exist for debugging and future ML training.

---

## 5. Feed Card Metrics

### `feed_card_saves`

Tracks when users save/bookmark feed cards.

```sql
SELECT post_id, count(*) as saves
FROM feed_card_saves
GROUP BY post_id
ORDER BY saves DESC;
```

### `feed_card_shares`

Tracks when users share feed cards (copy link, share externally).

```sql
SELECT post_id, share_method, count(*) as shares
FROM feed_card_shares
GROUP BY post_id, share_method;
```

### `feed_card_feedback`

Tracks upvote/downvote/flag feedback on feed cards.

```sql
SELECT post_id, feedback_type, count(*) as count
FROM feed_card_feedback
GROUP BY post_id, feedback_type;
```

Feed card metrics are fetched via `get_feed_card_metrics(post_ids[])` RPC and rendered on feed cards.

---

## 6. Event Logging Tables (Audit Trail)

### `task_events`

Auto-created by database trigger on order status changes. Full audit trail of every order lifecycle event.

### `workspace_activity_log`

Logs workspace member additions, rule changes, and assignment events.

### `post_status_history`

Tracks feed post status transitions (draft → published → archived).

### `razorpay_webhook_events`

Stores every raw Razorpay webhook payload for debugging payment issues.

---

## 7. What Is Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| **No centralized analytics warehouse** | Cannot do cross-domain analysis (e.g., funnel from signup → first order) | P0 |
| **No user session tracking** | Cannot compute DAU/MAU precisely | P0 |
| **No conversion funnels** | Cannot measure signup → first-post → first-match → first-order | P0 |
| **No A/B testing framework** | Cannot experiment on UI changes | P1 |
| **No revenue dashboards** | Must query DB manually for MRR, commission, refunds | P1 |
| **No real-time active users** | Cannot see concurrent usage | P2 |
| **No cohort analysis** | Cannot measure retention by signup week | P2 |
| **Web custom events not tracked** | Only page views, no click/interaction events | P2 |

---

## 8. Recommended Analytics Architecture (Future)

```
Mobile (Firebase) ──┐
Web (Vercel) ───────┤
Database (RPCs) ────┼──→ Analytics Warehouse (Supabase / BigQuery / ClickHouse)
API Events ─────────┘              │
                                   ├──→ Dashboard (Retool / custom admin)
                                   ├──→ Alerts (PagerDuty / Slack)
                                   └──→ ML Training Data
```

**Immediate next step:** Build an `events` table in Supabase with a `log_event(user_id, event_name, properties jsonb)` RPC, and log key user actions from both web and mobile. This gives you a basic funnel without a full warehouse.
