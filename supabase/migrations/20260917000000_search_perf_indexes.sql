-- Search & marketplace performance indexes
-- 1) pg_trgm GIN indexes so `ilike '%term%'` searches across
--    profile name/location/bio hit index scans instead of seq scans.
-- 2) Covering index for reviews rating aggregates (search/feed batch IN queries).
-- 3) Partial index for the dominant provider-search predicate
--    (role IN provider/business AND is_test=false AND full_name NOT NULL,
--    ordered by created_at DESC).
-- 4) Functional index on orders(provider_id, lower(status)) — the
--    get_provider_order_stats RPC filters on lower(status), so the plain
--    status indexes cannot be used (confirmed seq scan before this migration).
-- 5) Drop the duplicate reviews index (idx_reviews_provider_created_v2 is
--    identical; keeping one copy avoids double write amplification).

create extension if not exists pg_trgm;

create index if not exists idx_profiles_full_name_trgm
  on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists idx_profiles_name_trgm
  on public.profiles using gin (name gin_trgm_ops);
create index if not exists idx_profiles_location_trgm
  on public.profiles using gin (location gin_trgm_ops);
create index if not exists idx_profiles_bio_trgm
  on public.profiles using gin (bio gin_trgm_ops);

create index if not exists idx_reviews_provider_rating
  on public.reviews (provider_id, rating);

create index if not exists idx_profiles_search_page
  on public.profiles (created_at desc)
  where role in ('provider'::text, 'business'::text)
    and is_test = false
    and full_name is not null;

create index if not exists idx_orders_provider_lower_status
  on public.orders (provider_id, lower(status));

drop index if exists idx_reviews_provider_created;