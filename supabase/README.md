# Supabase Seeds

## Security + unread migration (run first)

Run `secure_realtime_rls.sql` before seeding to:
- enforce RLS on `orders`, `messages`, `conversations`, `conversation_participants`, `reviews`
- add `conversation_participants.last_read_at` for persistent unread counts
- create live `notifications` table + triggers from `orders/messages/reviews`
- create structured `help_requests` + `help_request_matches` with provider scoring + realtime notifications
- add profile geo columns `latitude` / `longitude` for real distance ranking
- add indexes + helper functions for participant-based access checks
- add `get_provider_order_stats(provider_ids uuid[])` RPC used by People/Business surfaces

## Dashboard demo seed

Run `seed_dashboard_demo.sql` in the Supabase SQL Editor to seed realistic visual data for the unified dashboard.

### What it seeds
- `profiles`
- `service_listings`
- `product_catalog`
- `posts`
- `help_requests`
- `help_request_matches`

### Notes
- Re-runnable: uses deterministic IDs + upserts.
- It maps seed rows to existing `auth.users` IDs (create at least one user first).
- More existing users = better distribution across providers.

### Quick checks
```sql
select count(*) from profiles;
select count(*) from service_listings;
select count(*) from product_catalog;
select count(*) from posts where status = 'open';
select count(*) from help_requests;
select count(*) from help_request_matches;
```

## Realtime tab seed (optional)

Run `seed_realtime_tabs_demo.sql` after `seed_dashboard_demo.sql` to preload richer demo data for:
- `chat`
- `tasks`
- `people`

### What it seeds
- `orders`
- `reviews`
- `conversations`
- `conversation_participants`
- `messages`

### Quick checks
```sql
select count(*) from orders;
select count(*) from reviews;
select count(*) from conversations;
select count(*) from conversation_participants;
select count(*) from messages;
```
