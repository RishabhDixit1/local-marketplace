-- Track applied migrations to enable idempotent, ordered deployments.
-- Every migration script should call record_migration() at the end.
-- The migration runner checks this table before applying new migrations.

create table if not exists public._migrations (
  id          bigint generated always as identity primary key,
  filename    text not null unique,
  checksum    text not null,
  applied_at  timestamptz not null default now(),
  duration_ms int not null default 0,
  success     boolean not null default true,
  error_msg   text
);

create index if not exists idx_migrations_filename on public._migrations (filename);
create index if not exists idx_migrations_applied_at on public._migrations (applied_at);

alter table public._migrations enable row level security;

-- Only allow inserts (nobody should delete or update migration records)
create policy "migrations_insert_only"
  on public._migrations
  for insert
  to authenticated
  with check (true);

-- Helper function to record a migration
create or replace function public.record_migration(
  p_filename text,
  p_checksum text,
  p_duration_ms int default 0
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public._migrations (filename, checksum, duration_ms)
  values (p_filename, p_checksum, p_duration_ms)
  on conflict (filename) do nothing;
end;
$$;

-- Helper function to check if a migration has been applied
create or replace function public.migration_applied(p_filename text) returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public._migrations
  where filename = p_filename and success = true;
  return v_count > 0;
end;
$$;

-- Seed this migration itself as applied
select public.record_migration('20260709000000_migration_tracking.sql', md5('migration_tracking'));
