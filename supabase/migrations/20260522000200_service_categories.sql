begin;

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  icon_slug text,
  description text,
  base_price_min int,
  base_price_max int,
  estimated_duration_mins int,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists idx_service_categories_active on public.service_categories (is_active, sort_order);
create index if not exists idx_service_categories_slug on public.service_categories (slug);

-- RLS
alter table public.service_categories enable row level security;

drop policy if exists service_categories_select_all on public.service_categories;
create policy service_categories_select_all
on public.service_categories
for select
to anon, authenticated
using (true);

-- Seed data for ServiQ Repairs launch
insert into public.service_categories (id, name, slug, icon_slug, description, base_price_min, base_price_max, estimated_duration_mins, sort_order)
values
  ('a0000000-0000-0000-0000-000000000001', 'Electrician', 'electrician', 'zap', 'Wiring, switches, MCB, fan fitting', 200, 800, 60, 1),
  ('a0000000-0000-0000-0000-000000000002', 'Plumber', 'plumber', 'droplets', 'Leaks, taps, pipe fitting, drainage', 200, 700, 60, 2),
  ('a0000000-0000-0000-0000-000000000003', 'RO / Water Purifier Repair', 'ro-repair', 'filter', 'Service, membrane, UV lamp replacement', 300, 1200, 90, 3),
  ('a0000000-0000-0000-0000-000000000004', 'AC Repair & Service', 'ac-repair', 'wind', 'Gas refill, cleaning, PCB repair', 400, 2000, 120, 4),
  ('a0000000-0000-0000-0000-000000000005', 'Geyser Repair', 'geyser-repair', 'flame', 'Element, thermostat, pressure valve', 300, 1000, 90, 5),
  ('a0000000-0000-0000-0000-000000000006', 'Appliance Repair', 'appliance-repair', 'wrench', 'Washing machine, fridge, microwave', 300, 1500, 120, 6),
  ('a0000000-0000-0000-0000-000000000007', 'Carpenter / Minor Fitting', 'carpenter', 'hammer', 'Door, furniture, curtain rods, drilling', 250, 900, 90, 7)
on conflict (id) do nothing;

-- Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.service_categories';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
