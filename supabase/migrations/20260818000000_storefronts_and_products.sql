-- Storefronts: a business/shop presence owned by a provider.
create table if not exists public.storefronts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  description text,
  cover_url text,
  gallery_urls text[] not null default '{}'::text[],
  address text,
  latitude double precision,
  longitude double precision,
  operating_hours jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  locality_id uuid references public.localities(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_storefronts_owner on public.storefronts (owner_id, created_at desc);
create index if not exists idx_storefronts_category on public.storefronts (category) where is_active;
create index if not exists idx_storefronts_locality on public.storefronts (locality_id) where is_active;
create index if not exists idx_storefronts_created on public.storefronts (created_at desc);

drop trigger if exists trg_storefronts_updated_at on public.storefronts;
create trigger trg_storefronts_updated_at
before update on public.storefronts
for each row
execute function public.set_updated_at();

-- RLS for storefronts
alter table public.storefronts enable row level security;

drop policy if exists storefronts_select_public on public.storefronts;
create policy storefronts_select_public on public.storefronts
for select to authenticated, anon
using (is_active = true);

drop policy if exists storefronts_insert_own on public.storefronts;
create policy storefronts_insert_own on public.storefronts
for insert to authenticated
with check (auth.uid() = owner_id);

drop policy if exists storefronts_update_own on public.storefronts;
create policy storefronts_update_own on public.storefronts
for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists storefronts_delete_own on public.storefronts;
create policy storefronts_delete_own on public.storefronts
for delete to authenticated
using (auth.uid() = owner_id);

-- Add storefront_id FK to product_catalog (links products to storefronts)
alter table public.product_catalog
  add column if not exists storefront_id uuid references public.storefronts(id) on delete set null;

create index if not exists idx_product_catalog_storefront on public.product_catalog (storefront_id) where storefront_id is not null;

-- Seed data: turn a few existing providers into storefronts with products
do $$
declare
  sf_id uuid;
  provider_rec record;
  prod_id uuid;
begin
  -- Find providers with shop-like names in the Greater Noida area
  for provider_rec in
    select p.id, p.full_name, p.services, p.latitude, p.longitude, p.locality_id
    from public.profiles p
    where p.role = 'provider'
      and p.is_test = false
      and (
        p.full_name ilike '%RO%' or
        p.full_name ilike '%tailor%' or
        p.full_name ilike '%repair%' or
        p.full_name ilike '%shop%' or
        p.full_name ilike '%services%'
      )
    limit 5
  loop
    insert into public.storefronts (
      owner_id, name, category, description, cover_url, address, latitude, longitude, locality_id, is_verified
    ) values (
      provider_rec.id,
      provider_rec.full_name,
      coalesce(provider_rec.services[1], 'General'),
      'Quality services and products available at ' || provider_rec.full_name || '. Visit us or order online.',
      null,
      null,
      provider_rec.latitude,
      provider_rec.longitude,
      provider_rec.locality_id,
      true
    ) returning id into sf_id;

    -- Seed 2-3 products per storefront
    insert into public.product_catalog (provider_id, storefront_id, title, description, category, price, stock, delivery_method, image_url)
    values
      (provider_rec.id, sf_id, 'Basic Service Package', 'Standard service package with warranty', provider_rec.services[1], 499, 10, 'both', null),
      (provider_rec.id, sf_id, 'Premium Service Package', 'Comprehensive service with extended warranty', provider_rec.services[1], 999, 5, 'both', null),
      (provider_rec.id, sf_id, 'Spare Parts Kit', 'Genuine spare parts for common repairs', 'Spare Parts', 299, 20, 'delivery', null);
  end loop;
end $$;
