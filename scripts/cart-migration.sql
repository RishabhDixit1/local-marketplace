-- ── Cart Sync (cross-device) ─────────────────────────────────────────
-- Run this in Supabase SQL Editor if the carts/cart_items tables are missing.
-- Part of migration: 20260616000000_cart_sync.sql

create table if not exists carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  schema_version integer not null default 3,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id)
);

create table if not exists cart_items (
  id              uuid primary key default gen_random_uuid(),
  cart_id         uuid not null references carts(id) on delete cascade,
  item_type       text not null check (item_type in ('service', 'product')),
  item_id         uuid not null,
  provider_id     uuid not null,
  provider_name   text not null,
  title           text not null,
  price_paise     integer not null check (price_paise >= 0),
  quantity        integer not null default 1 check (quantity > 0),
  delivery_method text,
  created_at      timestamptz not null default now(),
  unique(cart_id, item_type, item_id)
);

-- RLS
alter table carts enable row level security;
alter table cart_items enable row level security;

create policy "users can manage own cart"
  on carts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can manage own cart items"
  on cart_items for all
  using (
    cart_id in (select id from carts where user_id = auth.uid())
  )
  with check (
    cart_id in (select id from carts where user_id = auth.uid())
  );

-- Indexes
create index if not exists idx_carts_user on carts(user_id);
create index if not exists idx_cart_items_cart on cart_items(cart_id);

-- Refresh PostgREST schema cache so the new tables are immediately visible
notify pgrst, 'reload schema';
