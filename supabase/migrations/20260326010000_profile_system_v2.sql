begin;

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter table if exists public.profiles
  add column if not exists username text;
alter table if exists public.profiles
  add column if not exists headline text;
alter table if exists public.profiles
  add column if not exists verification_level text not null default 'email';
alter table if exists public.profiles
  add column if not exists on_time_rate numeric not null default 0;
alter table if exists public.profiles
  add column if not exists response_time_minutes numeric not null default 0;
alter table if exists public.profiles
  add column if not exists repeat_clients_count integer not null default 0;
alter table if exists public.profiles
  add column if not exists trust_score numeric not null default 0;

create unique index if not exists idx_profiles_username_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric,
  service_type text not null default 'onsite' check (lower(service_type) in ('onsite', 'remote', 'hybrid')),
  area text,
  payment_methods text[] not null default '{}'::text[],
  availability text not null default 'available',
  rating numeric not null default 0,
  review_count integer not null default 0,
  is_featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  price numeric,
  stock integer not null default 0,
  category text,
  delivery_mode text not null default 'both' check (lower(delivery_mode) in ('pickup', 'delivery', 'both')),
  area text,
  payment_methods text[] not null default '{}'::text[],
  availability text not null default 'available',
  rating numeric not null default 0,
  review_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.portfolio (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  media_url text,
  media_type text,
  link_url text,
  category text,
  is_featured boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.work_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_title text not null,
  company_name text not null,
  description text,
  location text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  verification_status text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  availability text not null default 'available',
  days_of_week text[] not null default '{}'::text[],
  start_time text,
  end_time text,
  timezone text,
  notes text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null default 'bank_transfer',
  provider_name text,
  account_label text,
  account_last4 text,
  account_handle text,
  is_default boolean not null default false,
  is_verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.trust_scores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rating_score numeric not null default 0,
  completion_rate numeric not null default 0,
  on_time_rate numeric not null default 0,
  repeat_clients_score numeric not null default 0,
  verification_score numeric not null default 0,
  response_time_score numeric not null default 0,
  trust_score numeric not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_trust_scores_profile_unique
  on public.trust_scores (profile_id);

create table if not exists public.profile_sections (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  section_type text,
  section_order int,
  is_visible boolean default true,
  created_at timestamp default now()
);

alter table public.profile_sections
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;
alter table public.profile_sections
  add column if not exists section_type text;
alter table public.profile_sections
  add column if not exists section_order int;
alter table public.profile_sections
  add column if not exists is_visible boolean default true;
alter table public.profile_sections
  add column if not exists created_at timestamp default now();

create unique index if not exists idx_profile_sections_profile_type
  on public.profile_sections (profile_id, section_type);
create index if not exists idx_profile_sections_profile_order
  on public.profile_sections (profile_id, section_order);

alter table public.reviews
  add column if not exists service_id uuid references public.services(id) on delete set null;
alter table public.reviews
  add column if not exists product_id uuid references public.products(id) on delete set null;
alter table public.reviews
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_services_profile_created on public.services (profile_id, created_at desc);
create index if not exists idx_products_profile_created on public.products (profile_id, created_at desc);
create index if not exists idx_portfolio_profile_created on public.portfolio (profile_id, created_at desc);
create index if not exists idx_work_history_profile_created on public.work_history (profile_id, created_at desc);
create index if not exists idx_availability_profile_created on public.availability (profile_id, created_at desc);
create index if not exists idx_payment_methods_profile_created on public.payment_methods (profile_id, created_at desc);
create index if not exists idx_reviews_provider_created_v2 on public.reviews (provider_id, created_at desc);

create or replace function public.normalize_profile_username(input_value text)
returns text
language sql
immutable
as $$
  select nullif(
    regexp_replace(
      regexp_replace(lower(btrim(coalesce(input_value, ''))), '[^a-z0-9]+', '-', 'g'),
      '(^-|-$)',
      '',
      'g'
    ),
    ''
  );
$$;

create or replace function public.normalize_profile_verification_level(input_value text)
returns text
language sql
immutable
as $$
  select case
    when lower(btrim(coalesce(input_value, ''))) in ('business', 'kyc', 'verified_business') then 'business'
    when lower(btrim(coalesce(input_value, ''))) in ('identity', 'id_verified', 'verified') then 'identity'
    when lower(btrim(coalesce(input_value, ''))) in ('phone', 'phone_verified') then 'phone'
    when lower(btrim(coalesce(input_value, ''))) in ('email', 'email_verified') then 'email'
    else 'email'
  end;
$$;

create or replace function public.marketplace_verification_score(input_value text)
returns numeric
language sql
immutable
as $$
  select case
    when lower(btrim(coalesce(input_value, ''))) in ('business', 'kyc', 'verified_business') then 100
    when lower(btrim(coalesce(input_value, ''))) in ('identity', 'id_verified', 'verified') then 85
    when lower(btrim(coalesce(input_value, ''))) in ('phone', 'phone_verified') then 65
    when lower(btrim(coalesce(input_value, ''))) in ('email', 'email_verified') then 35
    else 20
  end;
$$;

create or replace function public.marketplace_response_time_score(input_value numeric)
returns numeric
language sql
immutable
as $$
  select case
    when input_value is null or input_value <= 0 then 0
    else greatest(0, 100 - least(100, input_value * 2))
  end;
$$;

create or replace function public.marketplace_repeat_clients_score(input_value integer)
returns numeric
language sql
immutable
as $$
  select least(100, greatest(0, coalesce(input_value, 0) * 12));
$$;

create or replace function public.calculate_marketplace_profile_completion(
  input_full_name text,
  input_username text,
  input_headline text,
  input_location text,
  input_avatar_url text,
  input_services_count integer,
  input_products_count integer,
  input_portfolio_count integer,
  input_availability_count integer,
  input_payment_method_count integer,
  input_verification_level text
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
        case when nullif(btrim(coalesce(input_full_name, '')), '') is not null then 6 else 0 end +
        case when nullif(btrim(coalesce(input_username, '')), '') is not null then 4 else 0 end +
        case when nullif(btrim(coalesce(input_headline, '')), '') is not null then 5 else 0 end +
        case when nullif(btrim(coalesce(input_location, '')), '') is not null then 5 else 0 end +
        case when nullif(btrim(coalesce(input_avatar_url, '')), '') is not null then 10 else 0 end +
        case when coalesce(input_services_count, 0) > 0 then 20 else 0 end +
        case when coalesce(input_products_count, 0) > 0 then 10 else 0 end +
        case when coalesce(input_portfolio_count, 0) > 0 then 10 else 0 end +
        case when coalesce(input_availability_count, 0) > 0 then 10 else 0 end +
        case when coalesce(input_payment_method_count, 0) > 0 then 10 else 0 end +
        case when public.marketplace_verification_score(input_verification_level) > 0 then 10 else 0 end
      )::integer
    )
  );
$$;

create or replace function public.calculate_marketplace_trust_score(
  input_average_rating numeric,
  input_completion_rate numeric,
  input_on_time_rate numeric,
  input_repeat_clients integer,
  input_verification_level text,
  input_response_time_minutes numeric
)
returns numeric
language sql
immutable
as $$
  select round(
    (
      least(100, greatest(0, coalesce(input_average_rating, 0) * 20)) * 0.35 +
      least(100, greatest(0, coalesce(input_completion_rate, 0))) * 0.20 +
      least(100, greatest(0, coalesce(input_on_time_rate, 0))) * 0.15 +
      public.marketplace_repeat_clients_score(input_repeat_clients) * 0.15 +
      public.marketplace_verification_score(input_verification_level) * 0.10 +
      public.marketplace_response_time_score(input_response_time_minutes) * 0.05
    )::numeric,
    0
  );
$$;

create or replace function public.refresh_profile_marketplace_metrics(target_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public.profiles%rowtype;
  services_count integer := 0;
  products_count integer := 0;
  portfolio_count integer := 0;
  availability_count integer := 0;
  payment_method_count integer := 0;
  avg_rating numeric := 0;
  completion_percent integer := 0;
  trust_score_value numeric := 0;
  rating_score numeric := 0;
  completion_score numeric := 0;
  on_time_score numeric := 0;
  repeat_clients_score numeric := 0;
  verification_score numeric := 0;
  response_time_score numeric := 0;
begin
  if target_profile_id is null then
    return;
  end if;

  select * into profile_row
  from public.profiles
  where id = target_profile_id;

  if not found then
    return;
  end if;

  select count(*)::integer into services_count from public.services where profile_id = target_profile_id;
  select count(*)::integer into products_count from public.products where profile_id = target_profile_id;
  select count(*)::integer into portfolio_count from public.portfolio where profile_id = target_profile_id;
  select count(*)::integer into availability_count from public.availability where profile_id = target_profile_id and coalesce(is_active, true);
  select count(*)::integer into payment_method_count from public.payment_methods where profile_id = target_profile_id;
  select coalesce(avg(rating), 0) into avg_rating from public.reviews where provider_id = target_profile_id;

  completion_percent := public.calculate_marketplace_profile_completion(
    profile_row.full_name,
    profile_row.username,
    profile_row.headline,
    profile_row.location,
    profile_row.avatar_url,
    services_count,
    products_count,
    portfolio_count,
    availability_count,
    payment_method_count,
    profile_row.verification_level
  );

  rating_score := least(100, greatest(0, coalesce(avg_rating, 0) * 20));
  completion_score := least(100, greatest(0, completion_percent));
  on_time_score := least(100, greatest(0, coalesce(profile_row.on_time_rate, 0)));
  repeat_clients_score := public.marketplace_repeat_clients_score(profile_row.repeat_clients_count);
  verification_score := public.marketplace_verification_score(profile_row.verification_level);
  response_time_score := public.marketplace_response_time_score(profile_row.response_time_minutes);

  trust_score_value := public.calculate_marketplace_trust_score(
    avg_rating,
    completion_score,
    on_time_score,
    coalesce(profile_row.repeat_clients_count, 0),
    profile_row.verification_level,
    profile_row.response_time_minutes
  );

  update public.profiles
  set
    profile_completion_percent = completion_percent,
    trust_score = trust_score_value,
    updated_at = timezone('utc', now())
  where id = target_profile_id;

  insert into public.trust_scores (
    profile_id,
    rating_score,
    completion_rate,
    on_time_rate,
    repeat_clients_score,
    verification_score,
    response_time_score,
    trust_score,
    updated_at,
    created_at
  )
  values (
    target_profile_id,
    rating_score,
    completion_score,
    on_time_score,
    repeat_clients_score,
    verification_score,
    response_time_score,
    trust_score_value,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (profile_id) do update set
    rating_score = excluded.rating_score,
    completion_rate = excluded.completion_rate,
    on_time_rate = excluded.on_time_rate,
    repeat_clients_score = excluded.repeat_clients_score,
    verification_score = excluded.verification_score,
    response_time_score = excluded.response_time_score,
    trust_score = excluded.trust_score,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.sync_profile_derived_fields()
returns trigger
language plpgsql
as $$
declare
  merged_tags text[];
  generated_username text;
begin
  new.full_name := nullif(btrim(coalesce(new.full_name, new.name, '')), '');
  new.name := coalesce(new.full_name, nullif(btrim(coalesce(new.name, '')), ''));
  new.username := nullif(btrim(coalesce(new.username, '')), '');
  if new.username is null then
    generated_username := public.normalize_profile_username(coalesce(new.full_name, new.name, new.email, 'local-member'));
    new.username := coalesce(generated_username, 'local-member');
  end if;
  new.headline := nullif(btrim(coalesce(new.headline, '')), '');
  if new.headline is null then
    new.headline := coalesce(new.full_name, new.username, 'ServiQ member') || ' on ServiQ';
  end if;
  new.location := nullif(btrim(coalesce(new.location, '')), '');
  new.bio := nullif(btrim(coalesce(new.bio, '')), '');
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.phone := nullif(btrim(coalesce(new.phone, '')), '');
  new.website := nullif(btrim(coalesce(new.website, '')), '');
  new.avatar_url := nullif(btrim(coalesce(new.avatar_url, '')), '');
  new.role := public.normalize_profile_role(new.role);
  new.availability := public.normalize_profile_availability(new.availability);
  new.verification_level := public.normalize_profile_verification_level(new.verification_level);
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

create or replace function public.insert_default_profile_sections()
returns trigger
language plpgsql
as $$
begin
  insert into public.profile_sections (profile_id, section_type, section_order, is_visible)
  values
    (new.id, 'header', 0, true),
    (new.id, 'trust_stats', 1, true),
    (new.id, 'services', 2, true),
    (new.id, 'products', 3, true),
    (new.id, 'portfolio', 4, true),
    (new.id, 'reviews', 5, true),
    (new.id, 'work_history', 6, true),
    (new.id, 'availability', 7, true),
    (new.id, 'payment_methods', 8, true),
    (new.id, 'about', 9, true)
  on conflict (profile_id, section_type) do nothing;

  perform public.refresh_profile_marketplace_metrics(new.id);
  return new;
end;
$$;

drop trigger if exists trg_profiles_insert_default_sections on public.profiles;
create trigger trg_profiles_insert_default_sections
after insert on public.profiles
for each row
execute function public.insert_default_profile_sections();

create or replace function public.sync_profile_metrics_from_profile_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_profile_marketplace_metrics(old.id);
    return old;
  end if;

  perform public.refresh_profile_marketplace_metrics(new.id);
  return new;
end;
$$;

create or replace function public.sync_profile_metrics_from_profile_id()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_profile_marketplace_metrics(old.profile_id);
    return old;
  end if;

  perform public.refresh_profile_marketplace_metrics(new.profile_id);
  return new;
end;
$$;

create or replace function public.sync_profile_metrics_from_provider_id()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_profile_marketplace_metrics(old.provider_id);
    return old;
  end if;

  perform public.refresh_profile_marketplace_metrics(new.provider_id);
  return new;
end;
$$;

drop trigger if exists trg_services_refresh_profile_metrics on public.services;
create trigger trg_services_refresh_profile_metrics
after insert or update or delete on public.services
for each row
execute function public.sync_profile_metrics_from_profile_id();

drop trigger if exists trg_products_refresh_profile_metrics on public.products;
create trigger trg_products_refresh_profile_metrics
after insert or update or delete on public.products
for each row
execute function public.sync_profile_metrics_from_profile_id();

drop trigger if exists trg_portfolio_refresh_profile_metrics on public.portfolio;
create trigger trg_portfolio_refresh_profile_metrics
after insert or update or delete on public.portfolio
for each row
execute function public.sync_profile_metrics_from_profile_id();

drop trigger if exists trg_work_history_refresh_profile_metrics on public.work_history;
create trigger trg_work_history_refresh_profile_metrics
after insert or update or delete on public.work_history
for each row
execute function public.sync_profile_metrics_from_profile_id();

drop trigger if exists trg_availability_refresh_profile_metrics on public.availability;
create trigger trg_availability_refresh_profile_metrics
after insert or update or delete on public.availability
for each row
execute function public.sync_profile_metrics_from_profile_id();

drop trigger if exists trg_payment_methods_refresh_profile_metrics on public.payment_methods;
create trigger trg_payment_methods_refresh_profile_metrics
after insert or update or delete on public.payment_methods
for each row
execute function public.sync_profile_metrics_from_profile_id();

drop trigger if exists trg_reviews_refresh_profile_metrics on public.reviews;
create trigger trg_reviews_refresh_profile_metrics
after insert or update or delete on public.reviews
for each row
execute function public.sync_profile_metrics_from_provider_id();

drop trigger if exists trg_profile_sections_refresh_profile_metrics on public.profile_sections;
create trigger trg_profile_sections_refresh_profile_metrics
after insert or update or delete on public.profile_sections
for each row
execute function public.sync_profile_metrics_from_profile_id();

alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.portfolio enable row level security;
alter table public.work_history enable row level security;
alter table public.availability enable row level security;
alter table public.payment_methods enable row level security;
alter table public.trust_scores enable row level security;
alter table public.profile_sections enable row level security;

create policy services_select_authenticated
on public.services
for select
to authenticated
using (true);

create policy services_insert_own
on public.services
for insert
to authenticated
with check (profile_id = auth.uid());

create policy services_update_own
on public.services
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy services_delete_own
on public.services
for delete
to authenticated
using (profile_id = auth.uid());

create policy products_select_authenticated
on public.products
for select
to authenticated
using (true);

create policy products_insert_own
on public.products
for insert
to authenticated
with check (profile_id = auth.uid());

create policy products_update_own
on public.products
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy products_delete_own
on public.products
for delete
to authenticated
using (profile_id = auth.uid());

create policy portfolio_select_authenticated
on public.portfolio
for select
to authenticated
using (true);

create policy portfolio_insert_own
on public.portfolio
for insert
to authenticated
with check (profile_id = auth.uid());

create policy portfolio_update_own
on public.portfolio
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy portfolio_delete_own
on public.portfolio
for delete
to authenticated
using (profile_id = auth.uid());

create policy work_history_select_authenticated
on public.work_history
for select
to authenticated
using (true);

create policy work_history_insert_own
on public.work_history
for insert
to authenticated
with check (profile_id = auth.uid());

create policy work_history_update_own
on public.work_history
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy work_history_delete_own
on public.work_history
for delete
to authenticated
using (profile_id = auth.uid());

create policy availability_select_authenticated
on public.availability
for select
to authenticated
using (true);

create policy availability_insert_own
on public.availability
for insert
to authenticated
with check (profile_id = auth.uid());

create policy availability_update_own
on public.availability
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy availability_delete_own
on public.availability
for delete
to authenticated
using (profile_id = auth.uid());

create policy payment_methods_select_authenticated
on public.payment_methods
for select
to authenticated
using (true);

create policy payment_methods_insert_own
on public.payment_methods
for insert
to authenticated
with check (profile_id = auth.uid());

create policy payment_methods_update_own
on public.payment_methods
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy payment_methods_delete_own
on public.payment_methods
for delete
to authenticated
using (profile_id = auth.uid());

create policy trust_scores_select_authenticated
on public.trust_scores
for select
to authenticated
using (true);

create policy trust_scores_insert_own
on public.trust_scores
for insert
to authenticated
with check (profile_id = auth.uid());

create policy trust_scores_update_own
on public.trust_scores
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy trust_scores_delete_own
on public.trust_scores
for delete
to authenticated
using (profile_id = auth.uid());

create policy profile_sections_select_authenticated
on public.profile_sections
for select
to authenticated
using (true);

create policy profile_sections_insert_own
on public.profile_sections
for insert
to authenticated
with check (profile_id = auth.uid());

create policy profile_sections_update_own
on public.profile_sections
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy profile_sections_delete_own
on public.profile_sections
for delete
to authenticated
using (profile_id = auth.uid());

insert into public.profile_sections (profile_id, section_type, section_order, is_visible)
select
  p.id,
  defaults.section_type,
  defaults.section_order,
  defaults.is_visible
from public.profiles p
cross join lateral (
  values
    ('header'::text, 0, true),
    ('trust_stats'::text, 1, true),
    ('services'::text, 2, true),
    ('products'::text, 3, true),
    ('portfolio'::text, 4, true),
    ('reviews'::text, 5, true),
    ('work_history'::text, 6, true),
    ('availability'::text, 7, true),
    ('payment_methods'::text, 8, true),
    ('about'::text, 9, true)
) as defaults(section_type, section_order, is_visible)
where not exists (
  select 1
  from public.profile_sections ps
  where ps.profile_id = p.id
)
on conflict (profile_id, section_type) do nothing;

alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.portfolio enable row level security;
alter table public.work_history enable row level security;
alter table public.availability enable row level security;
alter table public.payment_methods enable row level security;
alter table public.trust_scores enable row level security;
alter table public.profile_sections enable row level security;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.services'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.products'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.portfolio'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.work_history'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.availability'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.payment_methods'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.trust_scores'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.profile_sections'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.reviews'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.profiles'; exception when duplicate_object then null; end;
  end if;
end $$;

commit;
