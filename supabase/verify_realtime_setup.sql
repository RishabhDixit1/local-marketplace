-- Realtime + RLS verification checks for Local Marketplace.
-- Safe read-only checks.

-- 1) Ensure required tables are in supabase_realtime publication.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'posts',
    'service_listings',
    'product_catalog',
    'profiles',
    'reviews',
    'orders',
    'conversations',
    'conversation_participants',
    'messages',
    'notifications',
    'task_events',
    'help_requests',
    'help_request_matches',
    'provider_presence',
    'connection_requests',
    'live_talk_requests',
    'feed_card_saves',
    'feed_card_shares'
  )
order by tablename;

-- 2) Confirm RLS is enabled on core realtime/security tables.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'orders',
    'messages',
    'conversations',
    'conversation_participants',
    'reviews',
    'notifications',
    'task_events',
    'help_requests',
    'help_request_matches',
    'provider_presence',
    'connection_requests',
    'live_talk_requests',
    'feed_card_saves',
    'feed_card_shares'
  )
order by tablename;

-- 3) Confirm marketplace realtime trigger coverage exists.
select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_notify_order_events',
    'trg_notify_message_events',
    'trg_notify_review_events',
    'trg_notify_connection_request_events',
    'trg_notify_live_talk_request_events',
    'trg_help_request_match_insert',
    'trg_help_request_match_update',
    'trg_connection_requests_sync',
    'trg_feed_card_saves_updated_at'
  )
order by table_name, trigger_name;

-- 4) Confirm key RPCs/helpers exist for notifications + realtime UX.
select
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'mark_all_notifications_read' and oidvectortypes(p.proargtypes) = ''
  ) as mark_all_notifications_read_rpc,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'clear_all_notifications' and oidvectortypes(p.proargtypes) = ''
  ) as clear_all_notifications_rpc,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'send_connection_request' and oidvectortypes(p.proargtypes) = 'uuid'
  ) as send_connection_request_rpc,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'respond_to_connection_request' and oidvectortypes(p.proargtypes) = 'uuid, text'
  ) as respond_to_connection_request_rpc,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_provider_presence' and oidvectortypes(p.proargtypes) = 'boolean, text, integer'
  ) as upsert_provider_presence_rpc,
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_feed_card_metrics' and oidvectortypes(p.proargtypes) = 'text[]'
  ) as get_feed_card_metrics_rpc;

-- 5) Optional data sanity counts (after running seed scripts).
select
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.service_listings) as service_listings_count,
  (select count(*) from public.product_catalog) as product_catalog_count,
  (select count(*) from public.posts) as posts_count,
  (select count(*) from public.orders) as orders_count,
  (select count(*) from public.messages) as messages_count,
  (select count(*) from public.notifications) as notifications_count,
  (select count(*) from public.task_events) as task_events_count,
  (select count(*) from public.connection_requests) as connection_requests_count,
  (select count(*) from public.live_talk_requests) as live_talk_requests_count,
  (select count(*) from public.feed_card_saves) as feed_card_saves_count,
  (select count(*) from public.feed_card_shares) as feed_card_shares_count;
