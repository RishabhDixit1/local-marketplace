-- Register core marketplace tables in Supabase Realtime publication.
-- Safe to re-run.

do $$
declare
  target_table text;
  realtime_tables text[] := array[
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
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Publication supabase_realtime does not exist in this project.';
  end if;

  foreach target_table in array realtime_tables loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = target_table
    ) then
      begin
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      exception
        when duplicate_object then
          null;
      end;
    end if;
  end loop;
end $$;
