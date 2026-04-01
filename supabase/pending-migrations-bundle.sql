-- =========================================
-- ServiQ Pending Migrations Bundle
-- =========================================

-- --- 20260329145500_allow_direct_chat_without_connection.sql ---
begin;

create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  resolved_conversation_id uuid;
  direct_conversation_key text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = actor_id then
    raise exception 'A different recipient is required';
  end if;

  direct_conversation_key := public.make_direct_conversation_key(actor_id, target_user_id);

  insert into public.conversations (kind, created_by, direct_key, metadata)
  values ('direct', actor_id, direct_conversation_key, jsonb_build_object('participant_count', 2))
  on conflict (direct_key) do update
    set updated_at = timezone('utc', now())
  returning id into resolved_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (resolved_conversation_id, actor_id),
    (resolved_conversation_id, target_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return resolved_conversation_id;
end;
$$;

grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

commit;


-- --- 20260331190000_user_settings.sql ---
begin;

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_notifications boolean not null default true,
  promo_notifications boolean not null default true,
  message_notifications boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists user_settings_user_id_key on public.user_settings(user_id);

alter table public.user_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'user_settings_select_own'
  ) then
    create policy "user_settings_select_own"
      on public.user_settings
      for select
      using (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'user_settings_insert_own'
  ) then
    create policy "user_settings_insert_own"
      on public.user_settings
      for insert
      with check (auth.uid() = user_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_settings'
      and policyname = 'user_settings_update_own'
  ) then
    create policy "user_settings_update_own"
      on public.user_settings
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end;
$$;

create or replace function public.user_settings_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.user_settings_set_updated_at();

commit;


-- --- 20260331200000_add_listing_columns.sql ---
-- Add missing columns to service_listings and product_catalog
-- These columns are referenced in application code but were absent from
-- earlier migrations, causing profile-page queries to fail silently.

-- pricing_type on service_listings (used by buildServiceWritePayload)
alter table public.service_listings
  add column if not exists pricing_type text not null default 'fixed';

-- delivery_method, image_url, image_path on product_catalog
alter table public.product_catalog
  add column if not exists delivery_method text not null default 'delivery';

alter table public.product_catalog
  add column if not exists image_url text;

alter table public.product_catalog
  add column if not exists image_path text;


-- --- 20260401000000_manual_offerings.sql ---
begin;

create table if not exists public.manual_offerings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  thumbnail_url text,
  price numeric,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_manual_offerings_profile_id
  on public.manual_offerings (profile_id, sort_order, created_at desc);

alter table public.manual_offerings enable row level security;

create policy "Anyone can view manual offerings"
  on public.manual_offerings
  for select
  using (true);

create policy "Owners can insert their own offerings"
  on public.manual_offerings
  for insert
  with check (profile_id = auth.uid());

create policy "Owners can update their own offerings"
  on public.manual_offerings
  for update
  using (profile_id = auth.uid());

create policy "Owners can delete their own offerings"
  on public.manual_offerings
  for delete
  using (profile_id = auth.uid());

create or replace trigger set_manual_offerings_updated_at
  before update on public.manual_offerings
  for each row
  execute procedure public.set_updated_at();

commit;


-- --- 20260401120000_public_listings_anon_select.sql ---
-- Allow anonymous (public) visitors to read service listings and product catalog.
-- Previously SELECT was restricted to authenticated users only, which meant
-- any visitor who was not signed in saw an empty Store tab.

drop policy if exists service_listings_select_anon on public.service_listings;
create policy service_listings_select_anon
on public.service_listings
for select
to anon
using (true);

drop policy if exists product_catalog_select_anon on public.product_catalog;
create policy product_catalog_select_anon
on public.product_catalog
for select
to anon
using (true);


-- --- 20260401130000_payment_and_storage.sql ---
-- ============================================================
-- ServiQ: Payment columns + listing-images Storage bucket
-- ============================================================

-- Add Razorpay payment tracking columns to orders
alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists notes text;

-- listing-images Storage bucket (created via Supabase Storage API,
-- this migration sets up the RLS policy so authenticated users can
-- upload their own images and everyone can read them publicly).

-- The bucket itself must be created in the Supabase dashboard:
--   Storage â†’ New bucket â†’ Name: listing-images â†’ Public: ON

-- RLS: anyone can read listing images
create policy if not exists "listing_images_public_read"
  on storage.objects for select
  using ( bucket_id = 'listing-images' );

-- RLS: authenticated user can upload to their own folder
create policy if not exists "listing_images_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: owner can delete their own images
create policy if not exists "listing_images_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );



