begin;

-- Localities / zones for hyperlocal market
create table if not exists public.localities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  zone_type text not null check (zone_type in ('society', 'market', 'supply_area', 'expansion')),
  phase int not null default 1 check (phase in (1, 2)),
  lat double precision,
  lng double precision,
  radius_km numeric(4, 2) default 1.0,
  city text not null default 'Ghaziabad',
  state text not null default 'Uttar Pradesh',
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists idx_localities_zone_type on public.localities (zone_type);
create index if not exists idx_localities_phase on public.localities (phase);
create index if not exists idx_localities_city on public.localities (city);

-- RLS
alter table public.localities enable row level security;

drop policy if exists localities_select_all on public.localities;
create policy localities_select_all
on public.localities
for select
to anon, authenticated
using (true);

-- Realtime publication (if desired)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.localities';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
