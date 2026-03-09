begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  full_name text,
  location text,
  role text not null default 'seeker',
  bio text,
  interests text[] not null default '{}'::text[],
  services text[] not null default '{}'::text[],
  email text,
  phone text,
  website text,
  avatar_url text,
  availability text not null default 'available',
  onboarding_completed boolean not null default false,
  profile_completion_percent integer not null default 0,
  latitude double precision,
  longitude double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.profiles
  add column if not exists full_name text;

alter table if exists public.profiles
  add column if not exists interests text[] not null default '{}'::text[];

alter table if exists public.profiles
  add column if not exists onboarding_completed boolean not null default false;

alter table if exists public.profiles
  add column if not exists profile_completion_percent integer not null default 0;

alter table if exists public.profiles
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.profiles
  add column if not exists created_at timestamptz not null default timezone('utc', now());

alter table if exists public.profiles
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table if exists public.profiles
  add column if not exists name text;

alter table if exists public.profiles
  add column if not exists location text;

alter table if exists public.profiles
  add column if not exists role text not null default 'seeker';

alter table if exists public.profiles
  add column if not exists bio text;

alter table if exists public.profiles
  add column if not exists services text[] not null default '{}'::text[];

alter table if exists public.profiles
  add column if not exists email text;

alter table if exists public.profiles
  add column if not exists phone text;

alter table if exists public.profiles
  add column if not exists website text;

alter table if exists public.profiles
  add column if not exists avatar_url text;

alter table if exists public.profiles
  add column if not exists availability text not null default 'available';

alter table if exists public.profiles
  add column if not exists latitude double precision;

alter table if exists public.profiles
  add column if not exists longitude double precision;

create or replace function public.normalize_profile_role(input_role text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text := lower(trim(coalesce(input_role, '')));
begin
  if normalized in ('provider', 'service_provider', 'seller') then
    return 'provider';
  end if;

  if normalized = 'business' then
    return 'business';
  end if;

  return 'seeker';
end;
$$;

create or replace function public.normalize_profile_availability(input_availability text)
returns text
language plpgsql
immutable
as $$
declare
  normalized text := lower(trim(coalesce(input_availability, '')));
begin
  if normalized in ('busy', 'offline') then
    return normalized;
  end if;

  return 'available';
end;
$$;

create or replace function public.normalize_profile_tag_array(values text[])
returns text[]
language plpgsql
immutable
as $$
declare
  result text[] := '{}'::text[];
  seen text[] := '{}'::text[];
  value text;
  normalized_value text;
begin
  foreach value in array coalesce(values, '{}'::text[]) loop
    normalized_value := btrim(coalesce(value, ''));
    if normalized_value = '' then
      continue;
    end if;

    if lower(normalized_value) = any(seen) then
      continue;
    end if;

    seen := array_append(seen, lower(normalized_value));
    result := array_append(result, normalized_value);

    if coalesce(array_length(result, 1), 0) >= 15 then
      exit;
    end if;
  end loop;

  return result;
end;
$$;

create or replace function public.is_profile_onboarding_complete(
  input_full_name text,
  input_location text,
  input_role text,
  input_bio text
)
returns boolean
language sql
immutable
as $$
  select
    nullif(btrim(coalesce(input_full_name, '')), '') is not null
    and nullif(btrim(coalesce(input_location, '')), '') is not null
    and public.normalize_profile_role(input_role) in ('provider', 'business', 'seeker')
    and length(btrim(coalesce(input_bio, ''))) >= 32;
$$;

create or replace function public.calculate_profile_completion_percent(
  input_full_name text,
  input_location text,
  input_role text,
  input_bio text,
  input_interests text[],
  input_services text[],
  input_email text,
  input_phone text,
  input_website text,
  input_avatar_url text
)
returns integer
language sql
immutable
as $$
  select least(
    100,
    greatest(
      0,
      (
        case when nullif(btrim(coalesce(input_full_name, '')), '') is not null then 18 else 0 end +
        case when nullif(btrim(coalesce(input_location, '')), '') is not null then 18 else 0 end +
        case when nullif(btrim(coalesce(public.normalize_profile_role(input_role), '')), '') is not null then 10 else 0 end +
        case when length(btrim(coalesce(input_bio, ''))) >= 32 then 20 else 0 end +
        case when coalesce(array_length(public.normalize_profile_tag_array(coalesce(input_interests, '{}'::text[]) || coalesce(input_services, '{}'::text[])), 1), 0) > 0 then 12 else 0 end +
        case when nullif(btrim(coalesce(input_email, '')), '') is not null then 8 else 0 end +
        case when nullif(btrim(coalesce(input_phone, '')), '') is not null then 6 else 0 end +
        case when nullif(btrim(coalesce(input_website, '')), '') is not null then 4 else 0 end +
        case when nullif(btrim(coalesce(input_avatar_url, '')), '') is not null then 4 else 0 end
      )::integer
    )
  );
$$;

create or replace function public.sync_profile_derived_fields()
returns trigger
language plpgsql
as $$
declare
  merged_tags text[];
begin
  new.full_name := nullif(btrim(coalesce(new.full_name, new.name, '')), '');
  new.name := coalesce(new.full_name, nullif(btrim(coalesce(new.name, '')), ''));
  new.location := nullif(btrim(coalesce(new.location, '')), '');
  new.bio := nullif(btrim(coalesce(new.bio, '')), '');
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  new.website := nullif(btrim(coalesce(new.website, '')), '');
  new.avatar_url := nullif(btrim(coalesce(new.avatar_url, '')), '');
  new.role := public.normalize_profile_role(new.role);
  new.availability := public.normalize_profile_availability(new.availability);
  merged_tags := public.normalize_profile_tag_array(coalesce(new.interests, '{}'::text[]) || coalesce(new.services, '{}'::text[]));
  new.interests := merged_tags;
  new.services := merged_tags;
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.created_at := coalesce(new.created_at, timezone('utc', now()));
  new.updated_at := timezone('utc', now());
  new.profile_completion_percent := public.calculate_profile_completion_percent(
    new.full_name,
    new.location,
    new.role,
    new.bio,
    new.interests,
    new.services,
    new.email,
    new.phone,
    new.website,
    new.avatar_url
  );
  new.onboarding_completed := public.is_profile_onboarding_complete(new.full_name, new.location, new.role, new.bio);

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_derived_fields on public.profiles;
create trigger trg_profiles_sync_derived_fields
before insert or update on public.profiles
for each row
execute function public.sync_profile_derived_fields();

update public.profiles
set
  full_name = coalesce(full_name, name),
  name = coalesce(name, full_name),
  interests = coalesce(interests, '{}'::text[]),
  services = coalesce(services, interests, '{}'::text[]),
  role = public.normalize_profile_role(role),
  availability = public.normalize_profile_availability(availability),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, timezone('utc', now()));

create index if not exists idx_profiles_role_updated_at
  on public.profiles (role, updated_at desc);

create index if not exists idx_profiles_onboarding_completed
  on public.profiles (onboarding_completed);

create index if not exists idx_profiles_profile_completion_percent
  on public.profiles (profile_completion_percent desc);

alter table if exists public.profiles enable row level security;

drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_authenticated
on public.profiles
for select
to authenticated
using (true);

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_read_public on storage.objects;
drop policy if exists profile_avatars_insert_own on storage.objects;
drop policy if exists profile_avatars_update_own on storage.objects;
drop policy if exists profile_avatars_delete_own on storage.objects;

create policy profile_avatars_read_public
on storage.objects
for select
to public
using (bucket_id = 'profile-avatars');

create policy profile_avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy profile_avatars_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy profile_avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create or replace function public.get_platform_startup_diagnostics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  checks jsonb := '{}'::jsonb;
  issues text[] := array[]::text[];
  has_posts boolean := false;
  has_help_requests boolean := false;
  has_post_media_bucket boolean := false;
  has_profile_avatar_bucket boolean := false;
  has_posts_insert_policy boolean := false;
  has_help_requests_insert_policy boolean := false;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'posts'
  ) into has_posts;

  if not has_posts then
    issues := array_append(issues, 'Missing required table: public.posts');
  end if;

  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'help_requests'
  ) into has_help_requests;

  if not has_help_requests then
    issues := array_append(issues, 'Missing required table: public.help_requests');
  end if;

  select exists (
    select 1
    from storage.buckets
    where id = 'post-media'
  ) into has_post_media_bucket;

  if not has_post_media_bucket then
    issues := array_append(issues, 'Missing required storage bucket: post-media');
  end if;

  select exists (
    select 1
    from storage.buckets
    where id = 'profile-avatars'
  ) into has_profile_avatar_bucket;

  if not has_profile_avatar_bucket then
    issues := array_append(issues, 'Missing required storage bucket: profile-avatars');
  end if;

  select exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'posts'
      and policyname = 'posts_insert_own'
  ) into has_posts_insert_policy;

  if not has_posts_insert_policy then
    issues := array_append(issues, 'Missing policy: public.posts -> posts_insert_own');
  end if;

  select exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'help_requests'
      and policyname = 'help_requests_insert_own'
  ) into has_help_requests_insert_policy;

  if has_help_requests and not has_help_requests_insert_policy then
    issues := array_append(issues, 'Missing policy: public.help_requests -> help_requests_insert_own');
  end if;

  checks := jsonb_build_object(
    'posts_table', has_posts,
    'help_requests_table', has_help_requests,
    'post_media_bucket', has_post_media_bucket,
    'profile_avatar_bucket', has_profile_avatar_bucket,
    'posts_insert_policy', has_posts_insert_policy,
    'help_requests_insert_policy', has_help_requests_insert_policy
  );

  return jsonb_build_object(
    'ok', coalesce(array_length(issues, 1), 0) = 0,
    'issues', to_jsonb(issues),
    'checks', checks
  );
end;
$$;

grant execute on function public.get_platform_startup_diagnostics() to authenticated, service_role;

commit;
