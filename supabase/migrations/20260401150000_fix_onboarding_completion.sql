-- Fix: is_profile_onboarding_complete previously required bio >= 32 chars,
-- which blocked all Quick Setup users (the form has no bio field).
-- The intent of the quick onboarding check is: name + location + role.
-- Bio is a "profile quality" signal tracked separately via profile_completion_percent.

create or replace function public.is_profile_onboarding_complete(
  input_full_name text,
  input_location text,
  input_role text,
  input_bio text   -- kept in signature for backwards-compatibility with existing triggers
)
returns boolean
language sql
immutable
as $$
  select
    nullif(btrim(coalesce(input_full_name, '')), '') is not null
    and nullif(btrim(coalesce(input_location, '')), '') is not null
    and public.normalize_profile_role(input_role) in ('provider', 'business', 'seeker');
$$;

-- Re-evaluate onboarding_completed for all profiles that now qualify
-- (name + location already present but were blocked by missing bio).
update public.profiles
set updated_at = timezone('utc', now())
where full_name is not null
  and location is not null
  and onboarding_completed = false;
