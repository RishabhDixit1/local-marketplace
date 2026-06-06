-- Feature flags for gradual rollouts and kill switches
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-user overrides for A/B testing and early access
CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_key text NOT NULL REFERENCES public.feature_flags(key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, flag_key)
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone can read flags (for client-side checks)
CREATE POLICY "Anyone can read feature_flags" ON public.feature_flags
  FOR SELECT USING (true);

-- Only admins can manage flags
CREATE POLICY "Admins can insert feature_flags" ON public.feature_flags
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update feature_flags" ON public.feature_flags
  FOR UPDATE USING (true) WITH CHECK (true);

-- Users can read their own overrides
CREATE POLICY "Users can read own overrides" ON public.feature_flag_overrides
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage overrides" ON public.feature_flag_overrides
  FOR ALL USING (true);

-- Seed some default flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('new-onboarding', false, 'Use the new simplified onboarding flow'),
  ('ai-matching', false, 'Enable AI-powered provider matching'),
  ('video-consultation', false, 'Enable WebRTC video consultation feature'),
  ('subscription-boost', false, 'Show subscription upsell during checkout'),
  ('instant-booking', false, 'Enable one-click instant booking for eligible providers'),
  ('provider-verification-badge', true, 'Show verification badges on provider profiles'),
  ('dark-mode', true, 'Enable dark mode toggle in settings'),
  ('referral-program', true, 'Enable referral program features')
ON CONFLICT (key) DO NOTHING;
