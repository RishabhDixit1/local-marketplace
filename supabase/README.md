# Supabase Seeds

## One-command setup (from project root)

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'
npm run supabase:setup
```

Optional seeds:

```bash
npm run supabase:setup -- --with-seeds
```

## Security + unread migration (run first)

Run `secure_realtime_rls.sql` before seeding to:
- enforce RLS on `orders`, `messages`, `conversations`, `conversation_participants`, `reviews`
- add `conversation_participants.last_read_at` for persistent unread counts
- create live `notifications` table + triggers from `orders/messages/reviews`
- create structured `help_requests` + `help_request_matches` with provider scoring + realtime notifications
- add profile geo columns `latitude` / `longitude` for real distance ranking
- add indexes + helper functions for participant-based access checks
- add `get_provider_order_stats(provider_ids uuid[])` RPC used by People/Business surfaces

## Hosted auth + posting patch (run second)

Run `fix_hosted_auth_and_posting.sql` to ensure production-ready defaults for:
- `posts` RLS read/write policies for authenticated users
- `help_requests` open-feed visibility for authenticated marketplace users
- `post-media` storage bucket + object policies for user-scoped uploads

## Realtime publication setup (run third)

Run `enable_realtime_publication.sql` to register all live marketplace tables in `supabase_realtime` publication.
Without this step, UI subscriptions can connect but receive no row-change events.

## Feed interaction persistence (run after security setup)

Run `add_feed_interactions.sql` to persist Welcome feed card actions per user:
- `Save` state in `feed_card_saves`
- `Share` events in `feed_card_shares`

This script also enables RLS + per-user policies for these tables.

## Feed metrics RPC (run after feed interactions)

Run `add_feed_card_metrics_function.sql` to create `public.get_feed_card_metrics(card_ids text[])`.
The Welcome feed uses this RPC to load aggregated `saves` and `shares` counts per card.

## Verification (run after setup)

Run `verify_realtime_setup.sql` to validate:
- publication table registration
- RLS enabled on core tables
- required triggers are present
- quick row-count sanity checks

## SQL Editor usage note

In Supabase SQL Editor, paste the SQL **contents** and run them.
Do not type only the filename (for example `supabase/seed_realtime_tabs_demo.sql`) as SQL input.

## Dashboard demo seed

Run `seed_dashboard_demo.sql` in the Supabase SQL Editor after steps above to seed realistic visual data for the unified dashboard.

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
