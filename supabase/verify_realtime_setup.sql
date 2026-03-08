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
    'help_request_matches'
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
    'help_request_matches'
  )
order by tablename;

-- 3) Confirm marketplace notification + matching triggers exist.
select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_notify_order_events',
    'trg_notify_message_events',
    'trg_notify_review_events',
    'trg_help_request_match_insert',
    'trg_help_request_match_update'
  )
order by table_name, trigger_name;

-- 4) Optional data sanity counts (after running seed scripts).
select
  (select count(*) from public.profiles) as profiles_count,
  (select count(*) from public.service_listings) as service_listings_count,
  (select count(*) from public.product_catalog) as product_catalog_count,
  (select count(*) from public.posts) as posts_count,
  (select count(*) from public.orders) as orders_count,
  (select count(*) from public.messages) as messages_count,
  (select count(*) from public.notifications) as notifications_count,
  (select count(*) from public.task_events) as task_events_count;
