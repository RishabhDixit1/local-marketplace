-- Migration: AI Intent Engine
-- Adds intent tracking, match logging, feedback, and category synonyms
-- for the natural language → service discovery pipeline

-- 1. Category synonyms for FTS matching
CREATE TABLE IF NOT EXISTS public.category_synonyms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text NOT NULL,
  synonym     text NOT NULL,
  locale      text NOT NULL DEFAULT 'en',
  weight      numeric NOT NULL DEFAULT 1.0,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_synonyms_unique
  ON public.category_synonyms (category, synonym, locale);

-- Seed core synonyms from the existing intentParser keywords
INSERT INTO public.category_synonyms (category, synonym, locale, weight) VALUES
  ('electrician', 'wiring', 'en', 1.0),
  ('electrician', 'switchboard', 'en', 1.0),
  ('electrician', 'electrical', 'en', 1.0),
  ('electrician', 'power cut', 'en', 1.0),
  ('electrician', 'circuit', 'en', 0.9),
  ('electrician', 'inverter', 'en', 1.0),
  ('electrician', 'बिजली', 'hi', 1.0),
  ('electrician', 'इलेक्ट्रीशियन', 'hi', 1.0),
  ('plumber', 'plumbing', 'en', 1.0),
  ('plumber', 'pipe', 'en', 1.0),
  ('plumber', 'leak', 'en', 1.0),
  ('plumber', 'tap', 'en', 0.9),
  ('plumber', 'faucet', 'en', 0.9),
  ('plumber', 'drain', 'en', 0.9),
  ('plumber', 'geyser', 'en', 1.0),
  ('plumber', 'प्लंबर', 'hi', 1.0),
  ('plumber', 'नल', 'hi', 1.0),
  ('plumber', 'पाइप', 'hi', 1.0),
  ('ac-repair', 'ac', 'en', 1.0),
  ('ac-repair', 'air conditioner', 'en', 1.0),
  ('ac-repair', 'cooling', 'en', 0.9),
  ('ac-repair', 'gas refill', 'en', 1.0),
  ('ac-repair', 'एसी', 'hi', 1.0),
  ('ro-repair', 'ro', 'en', 1.0),
  ('ro-repair', 'water purifier', 'en', 1.0),
  ('ro-repair', 'filter', 'en', 0.8),
  ('ro-repair', 'aquaguard', 'en', 1.0),
  ('ro-repair', 'आरओ', 'hi', 1.0),
  ('carpenter', 'carpenter', 'en', 1.0),
  ('carpenter', 'furniture', 'en', 1.0),
  ('carpenter', 'wood', 'en', 0.9),
  ('carpenter', 'cabinet', 'en', 1.0),
  ('carpenter', 'modular', 'en', 1.0),
  ('carpenter', 'बढ़ई', 'hi', 1.0),
  ('cleaning', 'cleaning', 'en', 1.0),
  ('cleaning', 'deep cleaning', 'en', 1.0),
  ('cleaning', 'sanitization', 'en', 1.0),
  ('cleaning', 'सफाई', 'hi', 1.0),
  ('appliance-repair', 'washing machine', 'en', 1.0),
  ('appliance-repair', 'refrigerator', 'en', 1.0),
  ('appliance-repair', 'microwave', 'en', 1.0),
  ('appliance-repair', 'वॉशिंग मशीन', 'hi', 1.0),
  ('mobile-repair', 'phone', 'en', 0.9),
  ('mobile-repair', 'screen', 'en', 0.8),
  ('mobile-repair', 'battery', 'en', 0.8),
  ('mobile-repair', 'laptop', 'en', 1.0),
  ('mobile-repair', 'मोबाइल', 'hi', 1.0),
  ('bike-repair', 'bike', 'en', 1.0),
  ('bike-repair', 'scooter', 'en', 1.0),
  ('bike-repair', 'mechanic', 'en', 1.0),
  ('bike-repair', 'कार मैकेनिक', 'hi', 1.0),
  ('computer-repair', 'computer', 'en', 1.0),
  ('computer-repair', 'laptop repair', 'en', 1.0),
  ('computer-repair', 'cctv', 'en', 1.0),
  ('computer-repair', 'प्रिंटर', 'hi', 1.0),
  ('tutor', 'tutor', 'en', 1.0),
  ('tutor', 'tuition', 'en', 1.0),
  ('tutor', 'coaching', 'en', 0.9),
  ('tutor', 'ट्यूटर', 'hi', 1.0),
  ('tailor', 'tailor', 'en', 1.0),
  ('tailor', 'stitching', 'en', 1.0),
  ('tailor', 'alteration', 'en', 1.0),
  ('tailor', 'दर्जी', 'hi', 1.0),
  ('beautician', 'beautician', 'en', 1.0),
  ('beautician', 'salon', 'en', 1.0),
  ('beautician', 'makeup', 'en', 1.0),
  ('beautician', 'ब्यूटीशियन', 'hi', 1.0),
  ('grocery', 'grocery', 'en', 1.0),
  ('grocery', 'vegetables', 'en', 1.0),
  ('grocery', 'kirana', 'en', 1.0),
  ('grocery', 'किराना', 'hi', 1.0),
  ('pharmacy', 'pharmacy', 'en', 1.0),
  ('pharmacy', 'medicine', 'en', 1.0),
  ('pharmacy', 'chemist', 'en', 0.9),
  ('pharmacy', 'दवा', 'hi', 1.0),
  ('packers-movers', 'packers', 'en', 1.0),
  ('packers-movers', 'movers', 'en', 1.0),
  ('packers-movers', 'shifting', 'en', 1.0),
  ('packers-movers', 'पैकर्स', 'hi', 1.0),
  ('pest-control', 'pest control', 'en', 1.0),
  ('pest-control', 'termite', 'en', 1.0),
  ('pest-control', 'cockroach', 'en', 0.9),
  ('pest-control', 'पेस्ट कंट्रोल', 'hi', 1.0),
  ('hardware-store', 'hardware shop', 'en', 1.0),
  ('hardware-store', 'hardware store', 'en', 1.0),
  ('hardware-store', 'हार्डवेयर', 'hi', 1.0),
  ('electrical-shop', 'electrical shop', 'en', 1.0),
  ('electrical-shop', 'electrical store', 'en', 1.0),
  ('electrical-shop', 'इलेक्ट्रिकल शॉप', 'hi', 1.0),
  ('medical-store', 'medical store', 'en', 1.0),
  ('medical-store', 'chemist', 'en', 0.9),
  ('medical-store', 'फार्मेसी', 'hi', 1.0),
  ('general-store', 'general store', 'en', 1.0),
  ('general-store', 'kirana store', 'en', 1.0),
  ('general-store', 'जनरल स्टोर', 'hi', 1.0)
ON CONFLICT (category, synonym, locale) DO NOTHING;

-- 2. Intent logs — every parsed query
CREATE TABLE IF NOT EXISTS public.intent_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query           text NOT NULL,
  parsed_action   text,
  parsed_category text,
  parsed_urgency  text,
  parsed_location text,
  parsed_budget_min numeric,
  parsed_budget_max numeric,
  parsed_keywords jsonb DEFAULT '[]'::jsonb,
  locality_id     uuid REFERENCES public.localities(id) ON DELETE SET NULL,
  latitude        double precision,
  longitude       double precision,
  response_ms     integer,
  matched_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_intent_logs_user
  ON public.intent_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intent_logs_category
  ON public.intent_logs (parsed_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intent_logs_created
  ON public.intent_logs (created_at DESC);

-- 3. Intent matches — ranked results per intent
CREATE TABLE IF NOT EXISTS public.intent_matches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id       uuid NOT NULL REFERENCES public.intent_logs(id) ON DELETE CASCADE,
  match_type      text NOT NULL CHECK (match_type IN ('provider', 'service', 'product', 'market')),
  match_id        uuid NOT NULL,
  title           text,
  score           numeric NOT NULL DEFAULT 0,
  score_breakdown jsonb DEFAULT '{}'::jsonb,
  rank            integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_intent_matches_intent
  ON public.intent_matches (intent_id, rank);

CREATE INDEX IF NOT EXISTS idx_intent_matches_type
  ON public.intent_matches (match_type, match_id);

-- 4. Intent feedback — learning loop
CREATE TABLE IF NOT EXISTS public.intent_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id       uuid NOT NULL REFERENCES public.intent_logs(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  match_id        uuid,
  feedback_type   text NOT NULL CHECK (feedback_type IN ('clicked', 'contacted', 'booked', 'helpful', 'not_relevant', 'wrong_category', 'wrong_location')),
  feedback_text   text,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_intent_feedback_intent
  ON public.intent_feedback (intent_id);

CREATE INDEX IF NOT EXISTS idx_intent_feedback_user
  ON public.intent_feedback (user_id, created_at DESC);

-- 5. FTS index on service_listings for intent matching
CREATE INDEX IF NOT EXISTS idx_service_listings_fts
  ON public.service_listings
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')));

-- 6. FTS index on product_catalog for intent matching
CREATE INDEX IF NOT EXISTS idx_product_catalog_fts
  ON public.product_catalog
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(category, '')));

-- 7. FTS index on help_requests for intent matching
CREATE INDEX IF NOT EXISTS idx_help_requests_fts
  ON public.help_requests
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(details, '') || ' ' || coalesce(category, '')));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
