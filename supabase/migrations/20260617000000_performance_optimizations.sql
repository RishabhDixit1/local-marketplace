-- Performance optimizations: missing indexes for common query patterns

-- 1. GIN index on profiles.services for array containment queries
-- Used by: providers-by-category, feed, people, search (contains("services", [...]))
drop index if exists idx_profiles_services_gin;
create index idx_profiles_services_gin on public.profiles using gin (services);

-- 3. Composite indexes for connection_requests status lookups
-- Used by: feed, people, chat guards (status = 'accepted' + requester_id/recipient_id)
drop index if exists idx_connection_requests_status_requester;
drop index if exists idx_connection_requests_status_recipient;
create index idx_connection_requests_status_requester
  on public.connection_requests (status, requester_id);
create index idx_connection_requests_status_recipient
  on public.connection_requests (status, recipient_id);

-- 4. Composite index on localities for ordering queries
-- Used by: localities route (ORDER BY zone_type, name)
drop index if exists idx_localities_zone_type_name;
create index idx_localities_zone_type_name
  on public.localities (zone_type, name);

-- 5. User+created indexes for feed_card_saves and feed_card_feedback
-- Used by: community feed (user_id lookups + ordering)
drop index if exists idx_feed_card_saves_user_created;
drop index if exists idx_feed_card_feedback_user_created;
create index idx_feed_card_saves_user_created
  on public.feed_card_saves (user_id, created_at desc);
create index idx_feed_card_feedback_user_created
  on public.feed_card_feedback (user_id, created_at desc);

-- 6. Composite index on featured_placements for active lookups
-- Used by: providers-by-category (active + date range)
drop index if exists idx_featured_placements_provider_active;
create index idx_featured_placements_provider_active
  on public.featured_placements (provider_id, active, starts_at, ends_at);

-- 7. Helper RPC: get_table_list - returns all table names in a schema
-- Used by: startup-check fallback diagnostics (single query instead of 13+)
create or replace function get_table_list(schema_name text default 'public')
returns text[]
language sql stable security definer
as $$
  select array_agg(table_name::text order by table_name)
  from information_schema.tables
  where table_schema = schema_name and table_type = 'BASE TABLE';
$$;

-- 8. Helper RPC: get_bucket_list - returns all storage bucket IDs
-- Used by: startup-check fallback diagnostics (single query instead of 2+)
create or replace function get_bucket_list()
returns text[]
language sql stable security definer
as $$
  select array_agg(id::text order by id)
  from storage.buckets;
$$;

-- 9. Helper RPC: get_schema_diagnostics - returns tables and buckets in one call
-- Used by: startup-check (single round-trip instead of 15+)
create or replace function get_schema_diagnostics()
returns json
language sql stable security definer
as $$
  select json_build_object(
    'tables', (select array_agg(table_name::text order by table_name) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'),
    'buckets', (select array_agg(id::text order by id) from storage.buckets)
  );
$$;

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
