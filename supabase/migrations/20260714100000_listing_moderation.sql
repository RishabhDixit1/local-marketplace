-- Add moderation columns to service_listings and product_catalog
-- Follows the same pattern as is_suspended on profiles (20260714000000_user_suspension.sql)

-- service_listings moderation
alter table public.service_listings
  add column if not exists is_flagged boolean not null default false;

alter table public.service_listings
  add column if not exists flagged_at timestamptz;

alter table public.service_listings
  add column if not exists flagged_reason text;

alter table public.service_listings
  add column if not exists removed_at timestamptz;

-- product_catalog moderation
alter table public.product_catalog
  add column if not exists is_flagged boolean not null default false;

alter table public.product_catalog
  add column if not exists flagged_at timestamptz;

alter table public.product_catalog
  add column if not exists flagged_reason text;

alter table public.product_catalog
  add column if not exists removed_at timestamptz;

-- posts: no new columns needed (status='hidden' already handles moderation)
-- but add flagged_at/flagged_reason for audit trail consistency
alter table public.posts
  add column if not exists flagged_at timestamptz;

alter table public.posts
  add column if not exists flagged_reason text;

-- RLS: flagged/removed listings should not appear in public queries
-- service_listings: block anon and authenticated SELECT when removed
drop policy if exists service_listings_select_removed_block on public.service_listings;
create policy service_listings_select_removed_block
on public.service_listings for select to anon, authenticated
using (removed_at is null);

-- product_catalog: block anon and authenticated SELECT when removed
drop policy if exists product_catalog_select_removed_block on public.product_catalog;
create policy product_catalog_select_removed_block
on public.product_catalog for select to anon, authenticated
using (removed_at is null);

-- posts: block public SELECT when status is hidden and removed_at is set
drop policy if exists posts_select_hidden_block on public.posts;
create policy posts_select_hidden_block
on public.posts for select to anon, authenticated
using (removed_at is null);

-- Grant service_role full access (bypasses RLS anyway, but explicit for clarity)
-- No grants needed — service_role already bypasses RLS.
