-- Register core marketplace tables in Supabase Realtime publication.
-- Safe to re-run.

do $$
declare
  table_name text;
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
    'help_request_matches'
  ];
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise exception 'Publication supabase_realtime does not exist in this project.';
  end if;

  foreach table_name in array realtime_tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then
        null;
    end;
  end loop;
end $$;
