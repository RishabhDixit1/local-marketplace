begin;

-- ──────────────────────────────────────────────
-- market_zones — top-level grouping for localities
-- ──────────────────────────────────────────────
create table if not exists public.market_zones (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  city       text not null,
  state      text not null,
  lat        double precision,
  lng        double precision,
  phase      int not null default 1 check (phase in (1, 2)),
  is_active  boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_market_zones_slug on public.market_zones (slug);
create index if not exists idx_market_zones_city on public.market_zones (city);

alter table public.market_zones enable row level security;

drop policy if exists market_zones_select_all on public.market_zones;
create policy market_zones_select_all
  on public.market_zones for select
  to anon, authenticated
  using (true);

-- ──────────────────────────────────────────────
-- Seed the 5 launch zones
-- ──────────────────────────────────────────────
insert into public.market_zones (id, slug, name, city, state, lat, lng, phase, is_active)
values
  ('a0000000-0000-0000-0000-000000000001', 'crossing-republik',    'Crossing Republik',     'Ghaziabad',    'Uttar Pradesh', 28.645, 77.440, 1, true),
  ('a0000000-0000-0000-0000-000000000002', 'shahberi',             'Shahberi',              'Ghaziabad',    'Uttar Pradesh', 28.642, 77.392, 2, true),
  ('a0000000-0000-0000-0000-000000000003', 'gaur-city-1',          'Gaur City 1',           'Ghaziabad',    'Uttar Pradesh', 28.601, 77.428, 2, true),
  ('a0000000-0000-0000-0000-000000000004', 'gaur-city-2',          'Gaur City 2',           'Ghaziabad',    'Uttar Pradesh', 28.592, 77.421, 2, true),
  ('a0000000-0000-0000-0000-000000000005', 'greater-noida-west',   'Greater Noida West',    'Greater Noida', 'Uttar Pradesh', 28.565, 77.453, 2, true)
on conflict (id) do nothing;

-- ──────────────────────────────────────────────
-- Link localities to their zone
-- ──────────────────────────────────────────────
alter table public.localities
  add column if not exists zone_id uuid references public.market_zones(id) on delete set null;

create index if not exists idx_localities_zone on public.localities (zone_id);

-- ──────────────────────────────────────────────
-- Realtime publication
-- ──────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.market_zones';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
