-- Add seeker onboarding tracking column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS seeker_onboarding_completed boolean NOT NULL DEFAULT false;
