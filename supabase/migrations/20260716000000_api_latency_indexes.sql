-- Migration: Add missing indexes for API latency optimization
-- Addresses slow responses on /api/reviews/by-provider, /api/community/people,
-- /api/community/feed, and /api/mobile/account

-- 1. Reviews by provider (fixes /api/reviews/by-provider sequential scans)
CREATE INDEX IF NOT EXISTS idx_reviews_provider_created
  ON public.reviews (provider_id, created_at DESC);

-- 2. Orders by provider+status (fixes /api/reviews/by-provider verified purchase check)
CREATE INDEX IF NOT EXISTS idx_orders_provider_status
  ON public.orders (provider_id, status);

-- 3. Provider presence by provider (fixes /api/community/people and /api/community/feed)
CREATE INDEX IF NOT EXISTS idx_provider_presence_provider
  ON public.provider_presence (provider_id);

-- 4. Reviews by provider for IN-filter queries (fixes /api/community/people and /api/community/feed)
--    The idx_reviews_provider_created above covers eq("provider_id") lookups,
--    but this单独 covering index is lighter weight for the bulk IN queries
--    that only need provider_id and rating.
--    NOTE: idx_reviews_provider_created already covers this use case.

-- 5. Service listings by created_at (fixes /api/community/feed ORDER BY)
CREATE INDEX IF NOT EXISTS idx_service_listings_created
  ON public.service_listings (created_at DESC);

-- 6. Product catalog by created_at (fixes /api/community/feed ORDER BY)
CREATE INDEX IF NOT EXISTS idx_product_catalog_created
  ON public.product_catalog (created_at DESC);

-- 7. Help requests by created_at (fixes /api/community/feed ORDER BY)
CREATE INDEX IF NOT EXISTS idx_help_requests_created
  ON public.help_requests (created_at DESC);

-- 8. Profiles by updated_at for people directory ordering
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at
  ON public.profiles (updated_at DESC);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
