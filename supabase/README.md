# Supabase Migrations and Seeds

## Canonical migration flow

Use only `supabase/migrations/*.sql` as the source of truth.
Do not apply legacy one-off SQL files out of order in production.

### Apply migrations (recommended)

```bash
export SUPABASE_DB_URL='postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres'
npm run supabase:migrate
```

If your database password contains URL-reserved characters (such as `@`, `:`, `/`, `?`, `#`), URL-encode them.
Example: `my@pass` becomes `my%40pass` inside `SUPABASE_DB_URL`.

### Apply migrations without verification

```bash
npm run supabase:setup
```

### SQL Editor fallback (clipboard bundle)

```bash
npm run supabase:sql-editor
```

This copies canonical migrations plus verification SQL into your clipboard so you can paste/run once in Supabase SQL Editor.

### Optional demo seeds

```bash
npm run supabase:setup -- --with-seeds
npm run supabase:sql-editor -- --with-seeds
```

## What the canonical migration currently enforces

- `posts` + `help_requests` publishing policies for authenticated users
- server-safe profile bootstrap policies (`profiles_insert_own`, `profiles_update_own`)
- `post-media` storage bucket + object policies
- realtime-ready `notifications`
- `help_requests` state machine (`open -> accepted -> in_progress -> completed/cancelled`)
- immediate matching RPC (`match_help_request`) + provider notifications
- provider presence table/RPC (`provider_presence`, `upsert_provider_presence`)
- push subscription storage (`provider_push_subscriptions`)
- escalation queue primitives for urgent unmatched needs (`notification_escalations`)
- trust + growth base tables (`provider_trust_metrics`, `referral_events`, `featured_placements`)
- startup diagnostics RPC (`get_platform_startup_diagnostics`)

## Startup diagnostics (admin only)

The app calls `/api/system/startup-check` at dashboard startup for admin emails.
If required schema/policies/bucket are missing, an in-app banner shows exact issues and fix steps.

Set admin allowlist env (comma-separated emails):

```bash
ADMIN_EMAIL_ALLOWLIST=admin1@example.com,admin2@example.com
```

## SQL Editor usage note

In Supabase SQL Editor, paste SQL file contents and run them.
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
