begin;

-- Add locality-related columns to profiles
alter table public.profiles
  add column if not exists locality_id uuid references public.localities(id) on delete set null;

alter table public.profiles
  add column if not exists service_zone_ids uuid[] not null default '{}'::uuid[];

alter table public.profiles
  add column if not exists service_category_ids uuid[] not null default '{}'::uuid[];

alter table public.profiles
  add column if not exists service_area_radius_km numeric(4, 2) default 3.0;

-- Indexes for locality-based queries
create index if not exists idx_profiles_locality on public.profiles (locality_id);
create index if not exists idx_profiles_service_zones on public.profiles using gin (service_zone_ids);
create index if not exists idx_profiles_service_categories on public.profiles using gin (service_category_ids);

commit;
