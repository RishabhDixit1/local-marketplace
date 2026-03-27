begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core notifications table (for in-app + realtime fanout)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'system',
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Help request state machine + matching
-- ---------------------------------------------------------------------------
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  accepted_provider_id uuid references auth.users(id) on delete set null,
  title text not null,
  details text,
  category text,
  urgency text,
  needed_by timestamptz,
  budget_min numeric,
  budget_max numeric,
  location_label text,
  latitude double precision,
  longitude double precision,
  radius_km numeric not null default 8,
  matched_count integer not null default 0,
  status text not null default 'open'
    check (lower(status) in ('open', 'matched', 'accepted', 'in_progress', 'completed', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_help_requests_requester_created
  on public.help_requests (requester_id, created_at desc);

create index if not exists idx_help_requests_status_created
  on public.help_requests (status, created_at desc);

create index if not exists idx_help_requests_category_status
  on public.help_requests (lower(category), status);

create index if not exists idx_help_requests_location
  on public.help_requests (latitude, longitude);

create table if not exists public.help_request_matches (
  help_request_id uuid not null references public.help_requests(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  score numeric not null default 0,
  distance_km double precision,
  reason text,
  status text not null default 'open'
    check (lower(status) in ('open', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (help_request_id, provider_id)
);

create index if not exists idx_help_request_matches_provider_status
  on public.help_request_matches (provider_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Presence + SLA signals
-- ---------------------------------------------------------------------------
create table if not exists public.provider_presence (
  provider_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default true,
  availability text not null default 'available',
  response_sla_minutes integer not null default 15,
  rolling_response_minutes numeric not null default 15,
  completed_jobs integer not null default 0,
  cancelled_jobs integer not null default 0,
  last_seen timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_provider_presence_last_seen
  on public.provider_presence (last_seen desc);

create table if not exists public.provider_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  platform text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider_id, endpoint)
);

create table if not exists public.notification_escalations (
  id uuid primary key default gen_random_uuid(),
  help_request_id uuid references public.help_requests(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (lower(channel) in ('sms', 'whatsapp', 'push')),
  target text not null,
  status text not null default 'pending' check (lower(status) in ('pending', 'sent', 'failed', 'cancelled')),
  attempt_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_notification_escalations_status_created
  on public.notification_escalations (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Trust + growth primitives
-- ---------------------------------------------------------------------------
create table if not exists public.provider_trust_metrics (
  provider_id uuid primary key references auth.users(id) on delete cascade,
  verified_badge boolean not null default false,
  repeat_customer_score numeric not null default 0,
  cancellation_rate numeric not null default 0,
  abuse_reports integer not null default 0,
  completed_needs integer not null default 0,
  response_consistency_score numeric not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null references auth.users(id) on delete cascade,
  reward_points integer not null default 0,
  status text not null default 'pending' check (lower(status) in ('pending', 'approved', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (referrer_id, referred_id)
);

create table if not exists public.featured_placements (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  placement_type text not null default 'feed_boost',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_featured_placements_active_window
  on public.featured_placements (active, starts_at, ends_at);

-- ---------------------------------------------------------------------------
-- Generic touch trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_help_requests_updated_at on public.help_requests;
create trigger trg_help_requests_updated_at
before update on public.help_requests
for each row
execute function public.set_updated_at();

drop trigger if exists trg_help_request_matches_updated_at on public.help_request_matches;
create trigger trg_help_request_matches_updated_at
before update on public.help_request_matches
for each row
execute function public.set_updated_at();

drop trigger if exists trg_provider_presence_updated_at on public.provider_presence;
create trigger trg_provider_presence_updated_at
before update on public.provider_presence
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notification_escalations_updated_at on public.notification_escalations;
create trigger trg_notification_escalations_updated_at
before update on public.notification_escalations
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS baseline
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.help_requests enable row level security;
alter table public.help_request_matches enable row level security;
alter table public.provider_presence enable row level security;
alter table public.provider_push_subscriptions enable row level security;
alter table public.notification_escalations enable row level security;
alter table public.provider_trust_metrics enable row level security;
alter table public.referral_events enable row level security;
alter table public.featured_placements enable row level security;

do $$
declare
  posts_exists boolean;
  has_status boolean;
  has_state boolean;
  owner_columns text[] := array[]::text[];
  owner_column text;
  owner_check text := 'true';
  open_check text := 'true';
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'posts'
  ) into posts_exists;

  if posts_exists then
    execute 'alter table public.posts enable row level security';

    foreach owner_column in array array['user_id', 'created_by', 'author_id', 'requester_id', 'owner_id', 'provider_id'] loop
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'posts'
          and column_name = owner_column
      ) then
        owner_columns := array_append(owner_columns, owner_column);
      end if;
    end loop;

    if coalesce(array_length(owner_columns, 1), 0) > 0 then
      select string_agg(format('(%I::text = auth.uid()::text)', col_name), ' or ')
      into owner_check
      from unnest(owner_columns) as col_name;
    end if;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'posts'
        and column_name = 'status'
    ) into has_status;

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'posts'
        and column_name = 'state'
    ) into has_state;

    if has_status and has_state then
      open_check := '(coalesce(lower(status::text), lower(state::text), ''open'') = ''open'')';
    elsif has_status then
      open_check := '(coalesce(lower(status::text), ''open'') = ''open'')';
    elsif has_state then
      open_check := '(coalesce(lower(state::text), ''open'') = ''open'')';
    end if;

    execute 'drop policy if exists posts_select_visible on public.posts';
    execute 'drop policy if exists posts_insert_own on public.posts';
    execute 'drop policy if exists posts_update_own on public.posts';
    execute 'drop policy if exists posts_delete_own on public.posts';

    execute format(
      'create policy posts_select_visible on public.posts for select to authenticated using ((%s) or (%s))',
      open_check,
      owner_check
    );

    execute format(
      'create policy posts_insert_own on public.posts for insert to authenticated with check (%s)',
      owner_check
    );

    execute format(
      'create policy posts_update_own on public.posts for update to authenticated using (%s) with check (%s)',
      owner_check,
      owner_check
    );

    execute format(
      'create policy posts_delete_own on public.posts for delete to authenticated using (%s)',
      owner_check
    );

    execute 'create index if not exists idx_posts_open_created_at on public.posts (created_at desc)';
  end if;
end;
$$;

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

drop policy if exists help_requests_select_visible on public.help_requests;
drop policy if exists help_requests_insert_own on public.help_requests;
drop policy if exists help_requests_update_own on public.help_requests;
drop policy if exists help_requests_delete_own on public.help_requests;

create policy help_requests_select_visible
on public.help_requests
for select
to authenticated
using (
  lower(coalesce(status, 'open')) in ('open', 'matched', 'accepted', 'in_progress')
  or requester_id = auth.uid()
  or accepted_provider_id = auth.uid()
  or exists (
    select 1
    from public.help_request_matches hrm
    where hrm.help_request_id = id
      and hrm.provider_id = auth.uid()
  )
);

create policy help_requests_insert_own
on public.help_requests
for insert
to authenticated
with check (requester_id = auth.uid());

create policy help_requests_update_own
on public.help_requests
for update
to authenticated
using (requester_id = auth.uid() or accepted_provider_id = auth.uid())
with check (requester_id = auth.uid() or accepted_provider_id = auth.uid());

create policy help_requests_delete_own
on public.help_requests
for delete
to authenticated
using (requester_id = auth.uid());

drop policy if exists help_request_matches_select_visible on public.help_request_matches;
drop policy if exists help_request_matches_insert_requester on public.help_request_matches;
drop policy if exists help_request_matches_update_provider on public.help_request_matches;

create policy help_request_matches_select_visible
on public.help_request_matches
for select
to authenticated
using (
  provider_id = auth.uid()
  or exists (
    select 1
    from public.help_requests hr
    where hr.id = help_request_id
      and hr.requester_id = auth.uid()
  )
);

create policy help_request_matches_insert_requester
on public.help_request_matches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.help_requests hr
    where hr.id = help_request_id
      and hr.requester_id = auth.uid()
  )
);

create policy help_request_matches_update_provider
on public.help_request_matches
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_insert_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_delete_own on public.notifications;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

create policy notifications_insert_own
on public.notifications
for insert
to authenticated
with check (user_id = auth.uid());

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy notifications_delete_own
on public.notifications
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists provider_presence_select_authenticated on public.provider_presence;
drop policy if exists provider_presence_insert_own on public.provider_presence;
drop policy if exists provider_presence_update_own on public.provider_presence;

create policy provider_presence_select_authenticated
on public.provider_presence
for select
to authenticated
using (true);

create policy provider_presence_insert_own
on public.provider_presence
for insert
to authenticated
with check (provider_id = auth.uid());

create policy provider_presence_update_own
on public.provider_presence
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

drop policy if exists provider_push_subscriptions_select_own on public.provider_push_subscriptions;
drop policy if exists provider_push_subscriptions_insert_own on public.provider_push_subscriptions;
drop policy if exists provider_push_subscriptions_delete_own on public.provider_push_subscriptions;

create policy provider_push_subscriptions_select_own
on public.provider_push_subscriptions
for select
to authenticated
using (provider_id = auth.uid());

create policy provider_push_subscriptions_insert_own
on public.provider_push_subscriptions
for insert
to authenticated
with check (provider_id = auth.uid());

create policy provider_push_subscriptions_delete_own
on public.provider_push_subscriptions
for delete
to authenticated
using (provider_id = auth.uid());

drop policy if exists notification_escalations_select_own on public.notification_escalations;
drop policy if exists notification_escalations_insert_own on public.notification_escalations;
drop policy if exists notification_escalations_update_own on public.notification_escalations;

create policy notification_escalations_select_own
on public.notification_escalations
for select
to authenticated
using (requester_id = auth.uid());

create policy notification_escalations_insert_own
on public.notification_escalations
for insert
to authenticated
with check (requester_id = auth.uid());

create policy notification_escalations_update_own
on public.notification_escalations
for update
to authenticated
using (requester_id = auth.uid())
with check (requester_id = auth.uid());

drop policy if exists provider_trust_metrics_select_authenticated on public.provider_trust_metrics;
create policy provider_trust_metrics_select_authenticated
on public.provider_trust_metrics
for select
to authenticated
using (true);

drop policy if exists referral_events_select_participant on public.referral_events;
drop policy if exists referral_events_insert_referrer on public.referral_events;

create policy referral_events_select_participant
on public.referral_events
for select
to authenticated
using (referrer_id = auth.uid() or referred_id = auth.uid());

create policy referral_events_insert_referrer
on public.referral_events
for insert
to authenticated
with check (referrer_id = auth.uid() and referred_id <> auth.uid());

drop policy if exists featured_placements_select_authenticated on public.featured_placements;
create policy featured_placements_select_authenticated
on public.featured_placements
for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- Storage for post media uploads
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('post-media', 'post-media', true, 26214400)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists post_media_read_public on storage.objects;
drop policy if exists post_media_insert_authenticated on storage.objects;
drop policy if exists post_media_update_authenticated on storage.objects;
drop policy if exists post_media_delete_authenticated on storage.objects;

create policy post_media_read_public
on storage.objects
for select
to public
using (bucket_id = 'post-media');

create policy post_media_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy post_media_update_authenticated
on storage.objects
for update
to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy post_media_delete_authenticated
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- Matching + state transition functions
-- ---------------------------------------------------------------------------
create or replace function public.match_help_request(target_help_request_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.help_requests%rowtype;
  inserted_count integer := 0;
begin
  select *
  into request_row
  from public.help_requests
  where id = target_help_request_id
  for update;

  if not found then
    return 0;
  end if;

  insert into public.help_request_matches (
    help_request_id,
    provider_id,
    score,
    distance_km,
    reason,
    status
  )
  with provider_pool as (
    select
      u.id as provider_id,
      p.name as provider_name,
      p.availability,
      p.latitude,
      p.longitude
    from auth.users u
    left join public.profiles p
      on p.id = u.id
    where u.id <> request_row.requester_id
  ),
  ranked as (
    select
      provider_id,
      case
        when request_row.latitude is not null
          and request_row.longitude is not null
          and latitude is not null
          and longitude is not null
        then 6371 * acos(
          greatest(
            least(
              cos(radians(request_row.latitude))
              * cos(radians(latitude))
              * cos(radians(longitude) - radians(request_row.longitude))
              + sin(radians(request_row.latitude))
              * sin(radians(latitude)),
              1
            ),
            -1
          )
        )
        else null
      end as distance_km,
      availability
    from provider_pool
  )
  select
    request_row.id,
    ranked.provider_id,
    greatest(
      5,
      round(
        100
        - coalesce(ranked.distance_km, 7) * 7
        + case
            when lower(coalesce(ranked.availability, 'available')) in ('available', 'online') then 12
            when lower(coalesce(ranked.availability, 'available')) in ('busy') then -3
            else -8
          end
      )::numeric
    ) as score,
    ranked.distance_km,
    case
      when ranked.distance_km is null then 'location_estimate'
      when ranked.distance_km <= 2 then 'nearby_provider'
      when ranked.distance_km <= 5 then 'within_local_radius'
      else 'expanded_radius_match'
    end as reason,
    'open'
  from ranked
  order by score desc, ranked.distance_km nulls last
  limit 30
  on conflict (help_request_id, provider_id)
  do update set
    score = excluded.score,
    distance_km = excluded.distance_km,
    reason = excluded.reason,
    status = case
      when lower(public.help_request_matches.status) in ('completed', 'cancelled') then public.help_request_matches.status
      else 'open'
    end,
    updated_at = timezone('utc', now());

  get diagnostics inserted_count = row_count;

  update public.help_requests
  set
    matched_count = inserted_count,
    status = case
      when lower(coalesce(status, 'open')) = 'open' and inserted_count > 0 then 'matched'
      when lower(coalesce(status, 'open')) = 'matched' and inserted_count = 0 then 'open'
      else status
    end,
    updated_at = timezone('utc', now())
  where id = request_row.id;

  insert into public.notifications (
    user_id,
    kind,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  )
  select
    hrm.provider_id,
    'system',
    'New local need near you',
    format('A nearby request needs help: "%s".', left(coalesce(request_row.title, 'Need support'), 80)),
    'help_request',
    request_row.id,
    jsonb_build_object(
      'help_request_id', request_row.id,
      'score', hrm.score,
      'distance_km', hrm.distance_km,
      'urgency', request_row.urgency
    )
  from public.help_request_matches hrm
  where hrm.help_request_id = request_row.id;

  return inserted_count;
end;
$$;

grant execute on function public.match_help_request(uuid) to authenticated, service_role;

create or replace function public.accept_help_request(target_help_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  updated_id uuid;
begin
  if actor_id is null then
    return false;
  end if;

  update public.help_requests
  set
    status = 'accepted',
    accepted_provider_id = actor_id,
    updated_at = timezone('utc', now())
  where id = target_help_request_id
    and lower(coalesce(status, 'open')) in ('open', 'matched')
  returning id into updated_id;

  if updated_id is null then
    return false;
  end if;

  update public.help_request_matches
  set
    status = case when provider_id = actor_id then 'accepted' else status end,
    updated_at = timezone('utc', now())
  where help_request_id = target_help_request_id;

  insert into public.help_request_matches (
    help_request_id,
    provider_id,
    score,
    reason,
    status
  )
  values (target_help_request_id, actor_id, 100, 'manual_accept', 'accepted')
  on conflict (help_request_id, provider_id)
  do update set
    status = 'accepted',
    updated_at = timezone('utc', now());

  insert into public.notifications (
    user_id,
    kind,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  )
  select
    requester_id,
    'order',
    'A provider accepted your request',
    'Your local need has been accepted. You can now coordinate next steps.',
    'help_request',
    id,
    jsonb_build_object('help_request_id', id, 'provider_id', actor_id)
  from public.help_requests
  where id = target_help_request_id;

  return true;
end;
$$;

grant execute on function public.accept_help_request(uuid) to authenticated, service_role;

create or replace function public.transition_help_request_status(
  target_help_request_id uuid,
  next_status text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  request_row public.help_requests%rowtype;
  normalized_status text := lower(coalesce(next_status, ''));
  allowed boolean := false;
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  if normalized_status not in ('accepted', 'in_progress', 'completed', 'cancelled') then
    raise exception 'Invalid status transition target: %', next_status;
  end if;

  select *
  into request_row
  from public.help_requests
  where id = target_help_request_id
  for update;

  if not found then
    raise exception 'Help request not found.';
  end if;

  if actor_id <> request_row.requester_id
     and actor_id <> request_row.accepted_provider_id then
    raise exception 'Not allowed to update this request.';
  end if;

  if lower(request_row.status) in ('open', 'matched') and normalized_status in ('accepted', 'cancelled') then
    allowed := true;
  elsif lower(request_row.status) = 'accepted' and normalized_status in ('in_progress', 'cancelled', 'completed') then
    allowed := true;
  elsif lower(request_row.status) = 'in_progress' and normalized_status in ('completed', 'cancelled') then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'Invalid transition from % to %', request_row.status, normalized_status;
  end if;

  update public.help_requests
  set
    status = normalized_status,
    accepted_provider_id = case
      when normalized_status = 'accepted' and accepted_provider_id is null then actor_id
      else accepted_provider_id
    end,
    updated_at = timezone('utc', now())
  where id = target_help_request_id;

  if request_row.accepted_provider_id is not null then
    update public.help_request_matches
    set
      status = case
        when provider_id = request_row.accepted_provider_id then normalized_status
        else status
      end,
      updated_at = timezone('utc', now())
    where help_request_id = target_help_request_id;
  end if;

  insert into public.notifications (
    user_id,
    kind,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  )
  values (
    request_row.requester_id,
    'order',
    'Request status updated',
    format('Your request "%s" is now %s.', left(coalesce(request_row.title, 'Request'), 80), normalized_status),
    'help_request',
    request_row.id,
    jsonb_build_object('status', normalized_status, 'updated_by', actor_id)
  );

  return normalized_status;
end;
$$;

grant execute on function public.transition_help_request_status(uuid, text) to authenticated, service_role;

create or replace function public.upsert_provider_presence(
  p_is_online boolean default true,
  p_availability text default 'available',
  p_response_sla_minutes integer default 15
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Authentication required.';
  end if;

  insert into public.provider_presence (
    provider_id,
    is_online,
    availability,
    response_sla_minutes,
    last_seen,
    updated_at
  )
  values (
    actor_id,
    coalesce(p_is_online, true),
    coalesce(nullif(trim(p_availability), ''), 'available'),
    greatest(1, coalesce(p_response_sla_minutes, 15)),
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (provider_id)
  do update set
    is_online = excluded.is_online,
    availability = excluded.availability,
    response_sla_minutes = excluded.response_sla_minutes,
    last_seen = excluded.last_seen,
    updated_at = timezone('utc', now());
end;
$$;

grant execute on function public.upsert_provider_presence(boolean, text, integer) to authenticated, service_role;

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
  has_bucket boolean := false;
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
  ) into has_bucket;

  if not has_bucket then
    issues := array_append(issues, 'Missing required storage bucket: post-media');
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
    'post_media_bucket', has_bucket,
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


begin;

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  consumer_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (lower(event_type) in ('created', 'status_changed', 'assignment_changed', 'price_updated')),
  previous_status text,
  next_status text,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_task_events_order_created
  on public.task_events (order_id, created_at desc);

create index if not exists idx_task_events_consumer_created
  on public.task_events (consumer_id, created_at desc);

create index if not exists idx_task_events_provider_created
  on public.task_events (provider_id, created_at desc);

alter table public.task_events enable row level security;

drop policy if exists task_events_select_own on public.task_events;

create policy task_events_select_own
on public.task_events
for select
to authenticated
using (auth.uid() = consumer_id or auth.uid() = provider_id);

create or replace function public.log_task_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  previous_status_label text;
  next_status_label text;
  event_title text;
  event_description text;
begin
  next_status_label := initcap(replace(coalesce(new.status, 'new_lead'), '_', ' '));

  if tg_op = 'INSERT' then
    event_title := case lower(coalesce(new.status, 'new_lead'))
      when 'quoted' then 'Quote queued'
      when 'accepted' then 'Task accepted'
      when 'in_progress' then 'Work started'
      when 'completed' then 'Task completed'
      when 'closed' then 'Task closed'
      when 'cancelled' then 'Task cancelled'
      when 'rejected' then 'Task rejected'
      else 'Task created'
    end;

    event_description := format(
      'Order entered the operations pipeline as %s.',
      next_status_label
    );

    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.consumer_id, new.provider_id),
      'created',
      new.status,
      event_title,
      event_description,
      jsonb_build_object(
        'listing_type', to_jsonb(new) ->> 'listing_type',
        'price', to_jsonb(new) -> 'price',
        'source', 'trigger'
      )
    );

    return new;
  end if;

  if new.status is distinct from old.status then
    previous_status_label := initcap(replace(coalesce(old.status, 'new_lead'), '_', ' '));

    event_title := case lower(coalesce(new.status, 'new_lead'))
      when 'quoted' then 'Quote sent'
      when 'accepted' then 'Quote accepted'
      when 'in_progress' then 'Work started'
      when 'completed' then 'Task completed'
      when 'closed' then 'Task closed'
      when 'cancelled' then 'Task cancelled'
      when 'rejected' then 'Task rejected'
      else 'Status updated'
    end;

    event_description := format(
      'Status moved from %s to %s.',
      previous_status_label,
      next_status_label
    );

    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'status_changed',
      old.status,
      new.status,
      event_title,
      event_description,
      jsonb_build_object(
        'listing_type', to_jsonb(new) ->> 'listing_type',
        'price', to_jsonb(new) -> 'price',
        'source', 'trigger'
      )
    );
  end if;

  if new.provider_id is distinct from old.provider_id then
    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'assignment_changed',
      old.status,
      new.status,
      case when new.provider_id is null then 'Provider unassigned' else 'Provider assigned' end,
      case
        when new.provider_id is null then 'The order was moved back to the open pipeline.'
        else 'A provider is now attached to this task.'
      end,
      jsonb_build_object(
        'previous_provider_id', old.provider_id,
        'next_provider_id', new.provider_id,
        'source', 'trigger'
      )
    );
  end if;

  if new.price is distinct from old.price then
    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'price_updated',
      old.status,
      new.status,
      'Quote amount updated',
      format(
        'Task value changed from %s to %s.',
        coalesce(old.price::text, 'not set'),
        coalesce(new.price::text, 'not set')
      ),
      jsonb_build_object(
        'previous_price', old.price,
        'next_price', new.price,
        'source', 'trigger'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_task_order_event on public.orders;

create trigger trg_log_task_order_event
after insert or update on public.orders
for each row
execute function public.log_task_order_event();

insert into public.task_events (
  order_id,
  consumer_id,
  provider_id,
  actor_id,
  event_type,
  next_status,
  title,
  description,
  metadata
)
select
  o.id,
  o.consumer_id,
  o.provider_id,
  coalesce(o.consumer_id, o.provider_id),
  'created',
  o.status,
  case lower(coalesce(o.status, 'new_lead'))
    when 'quoted' then 'Quote queued'
    when 'accepted' then 'Task accepted'
    when 'in_progress' then 'Work started'
    when 'completed' then 'Task completed'
    when 'closed' then 'Task closed'
    when 'cancelled' then 'Task cancelled'
    when 'rejected' then 'Task rejected'
    else 'Task created'
  end,
  format(
    'Order entered the operations pipeline as %s.',
    initcap(replace(coalesce(o.status, 'new_lead'), '_', ' '))
  ),
  jsonb_build_object(
    'listing_type', to_jsonb(o) ->> 'listing_type',
    'price', to_jsonb(o) -> 'price',
    'source', 'backfill'
  )
from public.orders o
where not exists (
  select 1
  from public.task_events te
  where te.order_id = o.id
    and te.event_type = 'created'
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.task_events';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;

commit;


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

create or replace function public.normalize_profile_tag_array(input_values text[])
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
  foreach value in array coalesce(input_values, '{}'::text[]) loop
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


begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  author_id uuid references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete cascade,
  requester_id uuid references auth.users(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete set null,
  title text,
  name text,
  text text,
  content text,
  description text,
  category text,
  type text not null default 'need',
  post_type text not null default 'need',
  visibility text not null default 'public',
  status text not null default 'open',
  state text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.posts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists author_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists created_by uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists requester_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists provider_id uuid references auth.users(id) on delete set null;
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists name text;
alter table public.posts add column if not exists text text;
alter table public.posts add column if not exists content text;
alter table public.posts add column if not exists description text;
alter table public.posts add column if not exists category text;
alter table public.posts add column if not exists type text not null default 'need';
alter table public.posts add column if not exists post_type text not null default 'need';
alter table public.posts add column if not exists visibility text not null default 'public';
alter table public.posts add column if not exists status text not null default 'open';
alter table public.posts add column if not exists state text not null default 'open';
alter table public.posts add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.posts add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.posts add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text,
  price numeric,
  availability text not null default 'available',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.service_listings add column if not exists provider_id uuid references auth.users(id) on delete cascade;
alter table public.service_listings add column if not exists title text not null default 'Untitled service';
alter table public.service_listings add column if not exists description text;
alter table public.service_listings add column if not exists category text;
alter table public.service_listings add column if not exists price numeric;
alter table public.service_listings add column if not exists availability text not null default 'available';
alter table public.service_listings add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.service_listings add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.service_listings add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text,
  price numeric,
  stock integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.product_catalog add column if not exists provider_id uuid references auth.users(id) on delete cascade;
alter table public.product_catalog add column if not exists title text not null default 'Untitled product';
alter table public.product_catalog add column if not exists description text;
alter table public.product_catalog add column if not exists category text;
alter table public.product_catalog add column if not exists price numeric;
alter table public.product_catalog add column if not exists stock integer not null default 0;
alter table public.product_catalog add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.product_catalog add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.product_catalog add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  rating numeric not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.reviews add column if not exists provider_id uuid references auth.users(id) on delete cascade;
alter table public.reviews add column if not exists reviewer_id uuid references auth.users(id) on delete cascade;
alter table public.reviews add column if not exists rating numeric not null default 5 check (rating >= 1 and rating <= 5);
alter table public.reviews add column if not exists comment text;
alter table public.reviews add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.reviews add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid,
  listing_type text not null default 'service',
  service_id uuid,
  product_id uuid,
  post_id uuid,
  help_request_id uuid,
  consumer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete set null,
  price numeric,
  status text not null default 'new_lead'
    check (lower(status) in ('new_lead', 'quoted', 'accepted', 'in_progress', 'completed', 'closed', 'cancelled', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.orders add column if not exists listing_id uuid;
alter table public.orders add column if not exists listing_type text not null default 'service';
alter table public.orders add column if not exists service_id uuid;
alter table public.orders add column if not exists product_id uuid;
alter table public.orders add column if not exists post_id uuid;
alter table public.orders add column if not exists help_request_id uuid;
alter table public.orders add column if not exists consumer_id uuid references auth.users(id) on delete cascade;
alter table public.orders add column if not exists provider_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists price numeric;
alter table public.orders add column if not exists status text not null default 'new_lead';
alter table public.orders add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.orders add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.orders add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (lower(kind) in ('direct', 'group')),
  created_by uuid not null references auth.users(id) on delete cascade,
  direct_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.conversations add column if not exists kind text not null default 'direct';
alter table public.conversations add column if not exists created_by uuid references auth.users(id) on delete cascade;
alter table public.conversations add column if not exists direct_key text;
alter table public.conversations add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.conversations add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.conversations add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'conversations_direct_key_key'
  ) then
    begin
      alter table public.conversations add constraint conversations_direct_key_key unique (direct_key);
    exception
      when duplicate_table then null;
      when duplicate_object then null;
    end;
  end if;
end $$;

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, user_id)
);

alter table public.conversation_participants add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.conversation_participants add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.conversation_participants add column if not exists last_read_at timestamptz;
alter table public.conversation_participants add column if not exists created_at timestamptz not null default timezone('utc', now());

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.messages add column if not exists sender_id uuid references auth.users(id) on delete cascade;
alter table public.messages add column if not exists content text not null default '';
alter table public.messages add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.messages add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.messages add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (lower(status) in ('pending', 'accepted', 'rejected', 'cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (requester_id <> recipient_id)
);

alter table public.connection_requests add column if not exists requester_id uuid references auth.users(id) on delete cascade;
alter table public.connection_requests add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.connection_requests add column if not exists status text not null default 'pending';
alter table public.connection_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.connection_requests add column if not exists responded_at timestamptz;
alter table public.connection_requests add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.connection_requests add column if not exists updated_at timestamptz not null default timezone('utc', now());

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  consumer_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (lower(event_type) in ('created', 'status_changed', 'assignment_changed', 'price_updated')),
  previous_status text,
  next_status text,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_posts_created_at on public.posts (created_at desc);
create index if not exists idx_posts_owner on public.posts (user_id, created_at desc);
create index if not exists idx_service_listings_provider_created on public.service_listings (provider_id, created_at desc);
create index if not exists idx_product_catalog_provider_created on public.product_catalog (provider_id, created_at desc);
create index if not exists idx_reviews_provider_created on public.reviews (provider_id, created_at desc);
create index if not exists idx_orders_consumer_created on public.orders (consumer_id, created_at desc);
create index if not exists idx_orders_provider_created on public.orders (provider_id, created_at desc);
create index if not exists idx_orders_status_created on public.orders (status, created_at desc);
create index if not exists idx_conversations_updated_at on public.conversations (updated_at desc);
create index if not exists idx_conversation_participants_user_created on public.conversation_participants (user_id, created_at desc);
create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at desc);
create index if not exists idx_connection_requests_requester_created on public.connection_requests (requester_id, created_at desc);
create index if not exists idx_connection_requests_recipient_created on public.connection_requests (recipient_id, created_at desc);
create index if not exists idx_task_events_order_created on public.task_events (order_id, created_at desc);

create unique index if not exists idx_connection_requests_active_pair
  on public.connection_requests (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  )
  where lower(status) in ('pending', 'accepted');

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_service_listings_updated_at on public.service_listings;
create trigger trg_service_listings_updated_at
before update on public.service_listings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_product_catalog_updated_at on public.product_catalog;
create trigger trg_product_catalog_updated_at
before update on public.product_catalog
for each row
execute function public.set_updated_at();

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
before update on public.reviews
for each row
execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

drop trigger if exists trg_conversations_updated_at on public.conversations;
create trigger trg_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_messages_updated_at on public.messages;
create trigger trg_messages_updated_at
before update on public.messages
for each row
execute function public.set_updated_at();

create or replace function public.sync_connection_request_fields()
returns trigger
language plpgsql
as $$
begin
  new.requester_id := coalesce(new.requester_id, old.requester_id);
  new.recipient_id := coalesce(new.recipient_id, old.recipient_id);
  new.status := lower(coalesce(new.status, 'pending'));
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.created_at := coalesce(new.created_at, old.created_at, timezone('utc', now()));
  new.updated_at := timezone('utc', now());

  if new.status = 'pending' then
    new.responded_at := null;
  elsif new.responded_at is null then
    new.responded_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_connection_requests_sync on public.connection_requests;
create trigger trg_connection_requests_sync
before insert or update on public.connection_requests
for each row
execute function public.sync_connection_request_fields();

create or replace function public.make_direct_conversation_key(user_a uuid, user_b uuid)
returns text
language sql
immutable
as $$
  select case
    when user_a is null or user_b is null then null
    when user_a::text < user_b::text then user_a::text || ':' || user_b::text
    else user_b::text || ':' || user_a::text
  end;
$$;

create or replace function public.is_conversation_participant(
  target_conversation_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = target_conversation_id
      and cp.user_id = target_user_id
  );
$$;

grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

create or replace function public.is_conversation_creator(
  target_conversation_id uuid,
  actor_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = target_conversation_id
      and c.created_by = actor_id
  );
$$;

grant execute on function public.is_conversation_creator(uuid, uuid) to authenticated;

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

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = timezone('utc', now())
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_on_message on public.messages;
create trigger trg_touch_conversation_on_message
after insert on public.messages
for each row
execute function public.touch_conversation_on_message();

create or replace function public.send_connection_request(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  existing_row public.connection_requests%rowtype;
  next_request_id uuid;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = actor_id then
    raise exception 'You cannot connect with yourself';
  end if;

  select *
  into existing_row
  from public.connection_requests cr
  where (
      (cr.requester_id = actor_id and cr.recipient_id = target_user_id)
      or (cr.requester_id = target_user_id and cr.recipient_id = actor_id)
    )
    and lower(cr.status) in ('pending', 'accepted')
  order by cr.updated_at desc, cr.created_at desc
  limit 1;

  if found then
    if lower(existing_row.status) = 'accepted' then
      return existing_row.id;
    end if;

    if existing_row.requester_id = actor_id then
      return existing_row.id;
    end if;

    update public.connection_requests
    set
      status = 'accepted',
      responded_at = timezone('utc', now()),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('accepted_via', 'mutual_request')
    where id = existing_row.id
    returning id into next_request_id;

    return next_request_id;
  end if;

  insert into public.connection_requests (
    requester_id,
    recipient_id,
    status,
    metadata
  )
  values (
    actor_id,
    target_user_id,
    'pending',
    jsonb_build_object('source', 'rpc_send_connection_request')
  )
  returning id into next_request_id;

  return next_request_id;
end;
$$;

grant execute on function public.send_connection_request(uuid) to authenticated;

create or replace function public.respond_to_connection_request(target_request_id uuid, decision text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  existing_row public.connection_requests%rowtype;
  normalized_decision text := lower(coalesce(decision, ''));
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if normalized_decision not in ('accepted', 'rejected', 'cancelled') then
    raise exception 'Unsupported connection decision';
  end if;

  select *
  into existing_row
  from public.connection_requests
  where id = target_request_id;

  if not found then
    raise exception 'Connection request not found';
  end if;

  if actor_id not in (existing_row.requester_id, existing_row.recipient_id) then
    raise exception 'Not allowed to modify this connection request';
  end if;

  if normalized_decision in ('accepted', 'rejected') and actor_id <> existing_row.recipient_id then
    raise exception 'Only the recipient can accept or reject a connection request';
  end if;

  if normalized_decision = 'cancelled' and actor_id <> existing_row.requester_id then
    raise exception 'Only the requester can cancel a connection request';
  end if;

  update public.connection_requests
  set
    status = normalized_decision,
    responded_at = timezone('utc', now()),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('resolved_by', actor_id, 'resolution', normalized_decision)
  where id = target_request_id
  returning id into target_request_id;

  return target_request_id;
end;
$$;

grant execute on function public.respond_to_connection_request(uuid, text) to authenticated;

create or replace function public.get_provider_order_stats(provider_ids uuid[])
returns table (
  provider_id uuid,
  completed_jobs bigint,
  open_leads bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with requested_provider_ids as (
    select distinct provider_id
    from unnest(coalesce(provider_ids, '{}'::uuid[])) as provider_id
  )
  select
    requested_provider_ids.provider_id,
    count(*) filter (
      where lower(coalesce(o.status, '')) in ('completed', 'closed')
    )::bigint as completed_jobs,
    count(*) filter (
      where lower(coalesce(o.status, 'pending')) not in ('completed', 'cancelled', 'closed', 'rejected')
    )::bigint as open_leads
  from requested_provider_ids
  left join public.orders o on o.provider_id = requested_provider_ids.provider_id
  group by requested_provider_ids.provider_id;
$$;

revoke all on function public.get_provider_order_stats(uuid[]) from public;
grant execute on function public.get_provider_order_stats(uuid[]) to anon;
grant execute on function public.get_provider_order_stats(uuid[]) to authenticated;

create or replace function public.log_task_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  previous_status_label text;
  next_status_label text;
  event_title text;
  event_description text;
begin
  next_status_label := initcap(replace(coalesce(new.status, 'new_lead'), '_', ' '));

  if tg_op = 'INSERT' then
    event_title := case lower(coalesce(new.status, 'new_lead'))
      when 'quoted' then 'Quote queued'
      when 'accepted' then 'Task accepted'
      when 'in_progress' then 'Work started'
      when 'completed' then 'Task completed'
      when 'closed' then 'Task closed'
      when 'cancelled' then 'Task cancelled'
      when 'rejected' then 'Task rejected'
      else 'Task created'
    end;

    event_description := format('Order entered the operations pipeline as %s.', next_status_label);

    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.consumer_id, new.provider_id),
      'created',
      new.status,
      event_title,
      event_description,
      jsonb_build_object(
        'listing_type', new.listing_type,
        'price', new.price,
        'source', 'trigger'
      )
    );

    return new;
  end if;

  if new.status is distinct from old.status then
    previous_status_label := initcap(replace(coalesce(old.status, 'new_lead'), '_', ' '));
    event_title := case lower(coalesce(new.status, 'new_lead'))
      when 'quoted' then 'Quote sent'
      when 'accepted' then 'Quote accepted'
      when 'in_progress' then 'Work started'
      when 'completed' then 'Task completed'
      when 'closed' then 'Task closed'
      when 'cancelled' then 'Task cancelled'
      when 'rejected' then 'Task rejected'
      else 'Status updated'
    end;

    event_description := format('Status moved from %s to %s.', previous_status_label, next_status_label);

    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'status_changed',
      old.status,
      new.status,
      event_title,
      event_description,
      jsonb_build_object(
        'listing_type', new.listing_type,
        'price', new.price,
        'source', 'trigger'
      )
    );
  end if;

  if new.provider_id is distinct from old.provider_id then
    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'assignment_changed',
      old.status,
      new.status,
      case when new.provider_id is null then 'Provider unassigned' else 'Provider assigned' end,
      case
        when new.provider_id is null then 'The order was moved back to the open pipeline.'
        else 'A provider is now attached to this task.'
      end,
      jsonb_build_object(
        'previous_provider_id', old.provider_id,
        'next_provider_id', new.provider_id,
        'source', 'trigger'
      )
    );
  end if;

  if new.price is distinct from old.price then
    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'price_updated',
      old.status,
      new.status,
      'Quote amount updated',
      format(
        'Task value changed from %s to %s.',
        coalesce(old.price::text, 'not set'),
        coalesce(new.price::text, 'not set')
      ),
      jsonb_build_object(
        'previous_price', old.price,
        'next_price', new.price,
        'source', 'trigger'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_task_order_event on public.orders;
create trigger trg_log_task_order_event
after insert or update on public.orders
for each row
execute function public.log_task_order_event();

create or replace function public.notify_connection_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (
      user_id,
      kind,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    )
    values (
      new.recipient_id,
      'system',
      'New connection request',
      'Someone in your marketplace network wants to connect.',
      'connection_request',
      new.id,
      jsonb_build_object(
        'requester_id', new.requester_id,
        'recipient_id', new.recipient_id,
        'status', new.status
      )
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.notifications (
      user_id,
      kind,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    )
    values (
      new.requester_id,
      'system',
      case
        when new.status = 'accepted' then 'Connection request accepted'
        when new.status = 'rejected' then 'Connection request declined'
        else 'Connection request updated'
      end,
      case
        when new.status = 'accepted' then 'You can now message and coordinate with this member.'
        when new.status = 'rejected' then 'This connection request was declined.'
        else 'This connection request was cancelled.'
      end,
      'connection_request',
      new.id,
      jsonb_build_object(
        'requester_id', new.requester_id,
        'recipient_id', new.recipient_id,
        'status', new.status
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_connection_request_events on public.connection_requests;
create trigger trg_notify_connection_request_events
after insert or update on public.connection_requests
for each row
execute function public.notify_connection_request_events();

alter table public.posts enable row level security;
alter table public.service_listings enable row level security;
alter table public.product_catalog enable row level security;
alter table public.reviews enable row level security;
alter table public.orders enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.connection_requests enable row level security;
alter table public.task_events enable row level security;

drop policy if exists posts_select_visible on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_update_own on public.posts;
drop policy if exists posts_delete_own on public.posts;

create policy posts_select_visible
on public.posts
for select
to authenticated
using (
  lower(coalesce(status, state, 'open')) = 'open'
  or auth.uid() = user_id
  or auth.uid() = author_id
  or auth.uid() = created_by
  or auth.uid() = requester_id
  or auth.uid() = owner_id
  or auth.uid() = provider_id
);

create policy posts_insert_own
on public.posts
for insert
to authenticated
with check (
  auth.uid() = user_id
  or auth.uid() = author_id
  or auth.uid() = created_by
  or auth.uid() = requester_id
  or auth.uid() = owner_id
  or auth.uid() = provider_id
);

create policy posts_update_own
on public.posts
for update
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = author_id
  or auth.uid() = created_by
  or auth.uid() = requester_id
  or auth.uid() = owner_id
  or auth.uid() = provider_id
)
with check (
  auth.uid() = user_id
  or auth.uid() = author_id
  or auth.uid() = created_by
  or auth.uid() = requester_id
  or auth.uid() = owner_id
  or auth.uid() = provider_id
);

create policy posts_delete_own
on public.posts
for delete
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = author_id
  or auth.uid() = created_by
  or auth.uid() = requester_id
  or auth.uid() = owner_id
  or auth.uid() = provider_id
);

drop policy if exists service_listings_select_authenticated on public.service_listings;
drop policy if exists service_listings_insert_own on public.service_listings;
drop policy if exists service_listings_update_own on public.service_listings;
drop policy if exists service_listings_delete_own on public.service_listings;

create policy service_listings_select_authenticated
on public.service_listings
for select
to authenticated
using (true);

create policy service_listings_insert_own
on public.service_listings
for insert
to authenticated
with check (provider_id = auth.uid());

create policy service_listings_update_own
on public.service_listings
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

create policy service_listings_delete_own
on public.service_listings
for delete
to authenticated
using (provider_id = auth.uid());

drop policy if exists product_catalog_select_authenticated on public.product_catalog;
drop policy if exists product_catalog_insert_own on public.product_catalog;
drop policy if exists product_catalog_update_own on public.product_catalog;
drop policy if exists product_catalog_delete_own on public.product_catalog;

create policy product_catalog_select_authenticated
on public.product_catalog
for select
to authenticated
using (true);

create policy product_catalog_insert_own
on public.product_catalog
for insert
to authenticated
with check (provider_id = auth.uid());

create policy product_catalog_update_own
on public.product_catalog
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

create policy product_catalog_delete_own
on public.product_catalog
for delete
to authenticated
using (provider_id = auth.uid());

drop policy if exists reviews_select_authenticated on public.reviews;
drop policy if exists reviews_insert_self on public.reviews;
drop policy if exists reviews_update_self on public.reviews;
drop policy if exists reviews_delete_self on public.reviews;

create policy reviews_select_authenticated
on public.reviews
for select
to authenticated
using (true);

create policy reviews_insert_self
on public.reviews
for insert
to authenticated
with check (
  reviewer_id = auth.uid()
  and reviewer_id <> provider_id
);

create policy reviews_update_self
on public.reviews
for update
to authenticated
using (reviewer_id = auth.uid())
with check (reviewer_id = auth.uid());

create policy reviews_delete_self
on public.reviews
for delete
to authenticated
using (reviewer_id = auth.uid());

drop policy if exists orders_select_own on public.orders;
drop policy if exists orders_insert_as_consumer on public.orders;
drop policy if exists orders_update_parties on public.orders;
drop policy if exists orders_delete_consumer on public.orders;

create policy orders_select_own
on public.orders
for select
to authenticated
using (auth.uid() = consumer_id or auth.uid() = provider_id);

create policy orders_insert_as_consumer
on public.orders
for insert
to authenticated
with check (auth.uid() = consumer_id);

create policy orders_update_parties
on public.orders
for update
to authenticated
using (auth.uid() = consumer_id or auth.uid() = provider_id)
with check (auth.uid() = consumer_id or auth.uid() = provider_id);

create policy orders_delete_consumer
on public.orders
for delete
to authenticated
using (auth.uid() = consumer_id);

drop policy if exists conversations_select_participants on public.conversations;
drop policy if exists conversations_insert_creator on public.conversations;
drop policy if exists conversations_update_creator on public.conversations;

create policy conversations_select_participants
on public.conversations
for select
to authenticated
using (public.is_conversation_participant(id));

create policy conversations_insert_creator
on public.conversations
for insert
to authenticated
with check (auth.uid() = created_by);

create policy conversations_update_creator
on public.conversations
for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists conversation_participants_select_visible on public.conversation_participants;
drop policy if exists conversation_participants_insert_self_or_creator on public.conversation_participants;
drop policy if exists conversation_participants_update_self on public.conversation_participants;
drop policy if exists conversation_participants_delete_self_or_creator on public.conversation_participants;

create policy conversation_participants_select_visible
on public.conversation_participants
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

create policy conversation_participants_insert_self_or_creator
on public.conversation_participants
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_conversation_creator(conversation_id)
);

create policy conversation_participants_update_self
on public.conversation_participants
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy conversation_participants_delete_self_or_creator
on public.conversation_participants
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_conversation_creator(conversation_id)
);

drop policy if exists messages_select_participants on public.messages;
drop policy if exists messages_insert_sender on public.messages;
drop policy if exists messages_update_sender on public.messages;
drop policy if exists messages_delete_sender on public.messages;

create policy messages_select_participants
on public.messages
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

create policy messages_insert_sender
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
);

create policy messages_update_sender
on public.messages
for update
to authenticated
using (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
)
with check (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
);

create policy messages_delete_sender
on public.messages
for delete
to authenticated
using (
  sender_id = auth.uid()
  and public.is_conversation_participant(conversation_id)
);

drop policy if exists connection_requests_select_participant on public.connection_requests;
drop policy if exists connection_requests_insert_requester on public.connection_requests;
drop policy if exists connection_requests_update_participant on public.connection_requests;
drop policy if exists connection_requests_delete_requester on public.connection_requests;

create policy connection_requests_select_participant
on public.connection_requests
for select
to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy connection_requests_insert_requester
on public.connection_requests
for insert
to authenticated
with check (auth.uid() = requester_id and requester_id <> recipient_id);

create policy connection_requests_update_participant
on public.connection_requests
for update
to authenticated
using (auth.uid() = requester_id or auth.uid() = recipient_id)
with check (auth.uid() = requester_id or auth.uid() = recipient_id);

create policy connection_requests_delete_requester
on public.connection_requests
for delete
to authenticated
using (auth.uid() = requester_id);

drop policy if exists task_events_select_own on public.task_events;

create policy task_events_select_own
on public.task_events
for select
to authenticated
using (auth.uid() = consumer_id or auth.uid() = provider_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.posts';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.orders';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.task_events';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.connection_requests';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.conversations';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.conversation_participants';
    exception when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.messages';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;


begin;

create table if not exists public.live_talk_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (lower(status) in ('pending', 'accepted', 'declined', 'ended', 'cancelled')),
  mode text not null default 'audio_video'
    check (lower(mode) in ('audio_video')),
  metadata jsonb not null default '{}'::jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (caller_id <> recipient_id)
);

alter table public.live_talk_requests add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.live_talk_requests add column if not exists caller_id uuid references auth.users(id) on delete cascade;
alter table public.live_talk_requests add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.live_talk_requests add column if not exists status text not null default 'pending';
alter table public.live_talk_requests add column if not exists mode text not null default 'audio_video';
alter table public.live_talk_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.live_talk_requests add column if not exists responded_at timestamptz;
alter table public.live_talk_requests add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.live_talk_requests add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists idx_live_talk_requests_conversation_created
  on public.live_talk_requests (conversation_id, created_at desc);

create index if not exists idx_live_talk_requests_recipient_status
  on public.live_talk_requests (recipient_id, status, created_at desc);

create unique index if not exists idx_live_talk_requests_pending_conversation
  on public.live_talk_requests (conversation_id)
  where lower(status) = 'pending';

drop trigger if exists trg_live_talk_requests_updated_at on public.live_talk_requests;
create trigger trg_live_talk_requests_updated_at
before update on public.live_talk_requests
for each row
execute function public.set_updated_at();

create or replace function public.is_connection_accepted(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connection_requests cr
    where lower(coalesce(cr.status, 'pending')) = 'accepted'
      and (
        (cr.requester_id = user_a and cr.recipient_id = user_b)
        or
        (cr.requester_id = user_b and cr.recipient_id = user_a)
      )
  );
$$;

grant execute on function public.is_connection_accepted(uuid, uuid) to authenticated;

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

  if not public.is_connection_accepted(actor_id, target_user_id) then
    raise exception 'Connect before starting a direct chat';
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

drop policy if exists posts_select_visible on public.posts;

create policy posts_select_visible
on public.posts
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = author_id
  or auth.uid() = created_by
  or auth.uid() = requester_id
  or auth.uid() = owner_id
  or auth.uid() = provider_id
  or (
    lower(coalesce(status, state, 'open')) not in ('cancelled', 'canceled', 'closed', 'completed', 'fulfilled', 'archived', 'deleted', 'draft', 'hidden')
    and (
      lower(coalesce(visibility, 'public')) in ('public', 'community', 'marketplace')
      or (
        lower(coalesce(visibility, 'public')) in ('connections', 'network', 'contacts')
        and public.is_connection_accepted(
          auth.uid(),
          coalesce(user_id, author_id, created_by, requester_id, owner_id, provider_id)
        )
      )
    )
  )
);

drop policy if exists conversation_participants_insert_self_or_creator on public.conversation_participants;

create policy conversation_participants_insert_self_or_creator
on public.conversation_participants
for insert
to authenticated
with check (user_id = auth.uid());

alter table public.live_talk_requests enable row level security;

drop policy if exists live_talk_requests_select_participant on public.live_talk_requests;
drop policy if exists live_talk_requests_insert_caller on public.live_talk_requests;
drop policy if exists live_talk_requests_update_participant on public.live_talk_requests;
drop policy if exists live_talk_requests_delete_participant on public.live_talk_requests;

create policy live_talk_requests_select_participant
on public.live_talk_requests
for select
to authenticated
using (auth.uid() = caller_id or auth.uid() = recipient_id);

create policy live_talk_requests_insert_caller
on public.live_talk_requests
for insert
to authenticated
with check (
  caller_id = auth.uid()
  and caller_id <> recipient_id
  and public.is_conversation_participant(conversation_id, caller_id)
  and public.is_conversation_participant(conversation_id, recipient_id)
  and public.is_connection_accepted(caller_id, recipient_id)
);

create policy live_talk_requests_update_participant
on public.live_talk_requests
for update
to authenticated
using (auth.uid() = caller_id or auth.uid() = recipient_id)
with check (auth.uid() = caller_id or auth.uid() = recipient_id);

create policy live_talk_requests_delete_participant
on public.live_talk_requests
for delete
to authenticated
using (auth.uid() = caller_id or auth.uid() = recipient_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.live_talk_requests';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;


begin;

create extension if not exists pgcrypto;

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read_at, created_at desc)
  where cleared_at is null;

create index if not exists idx_notifications_entity
  on public.notifications (entity_type, entity_id);

create table if not exists public.feed_card_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  focus_id text not null,
  card_type text not null check (card_type in ('demand', 'service', 'product')),
  title text not null,
  subtitle text,
  action_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.feed_card_saves add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.feed_card_saves add column if not exists card_id text;
alter table public.feed_card_saves add column if not exists focus_id text;
alter table public.feed_card_saves add column if not exists card_type text;
alter table public.feed_card_saves add column if not exists title text;
alter table public.feed_card_saves add column if not exists subtitle text;
alter table public.feed_card_saves add column if not exists action_path text;
alter table public.feed_card_saves add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.feed_card_saves add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.feed_card_saves add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_feed_card_saves_user_card
  on public.feed_card_saves (user_id, card_id);

create index if not exists idx_feed_card_saves_user_created
  on public.feed_card_saves (user_id, created_at desc);

create index if not exists idx_feed_card_saves_focus
  on public.feed_card_saves (focus_id, card_type);

drop trigger if exists trg_feed_card_saves_updated_at on public.feed_card_saves;
create trigger trg_feed_card_saves_updated_at
before update on public.feed_card_saves
for each row
execute function public.set_updated_at();

create table if not exists public.feed_card_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  focus_id text not null,
  card_type text not null check (card_type in ('demand', 'service', 'product')),
  title text not null,
  channel text not null default 'clipboard' check (channel in ('native', 'clipboard')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.feed_card_shares add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.feed_card_shares add column if not exists card_id text;
alter table public.feed_card_shares add column if not exists focus_id text;
alter table public.feed_card_shares add column if not exists card_type text;
alter table public.feed_card_shares add column if not exists title text;
alter table public.feed_card_shares add column if not exists channel text not null default 'clipboard';
alter table public.feed_card_shares add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.feed_card_shares add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists idx_feed_card_shares_user_created
  on public.feed_card_shares (user_id, created_at desc);

create index if not exists idx_feed_card_shares_card
  on public.feed_card_shares (card_id, created_at desc);

alter table public.feed_card_saves enable row level security;
alter table public.feed_card_shares enable row level security;

drop policy if exists feed_card_saves_select_own on public.feed_card_saves;
create policy feed_card_saves_select_own
on public.feed_card_saves
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists feed_card_saves_insert_own on public.feed_card_saves;
create policy feed_card_saves_insert_own
on public.feed_card_saves
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists feed_card_saves_update_own on public.feed_card_saves;
create policy feed_card_saves_update_own
on public.feed_card_saves
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists feed_card_saves_delete_own on public.feed_card_saves;
create policy feed_card_saves_delete_own
on public.feed_card_saves
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists feed_card_shares_select_own on public.feed_card_shares;
create policy feed_card_shares_select_own
on public.feed_card_shares
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists feed_card_shares_insert_own on public.feed_card_shares;
create policy feed_card_shares_insert_own
on public.feed_card_shares
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists feed_card_shares_delete_own on public.feed_card_shares;
create policy feed_card_shares_delete_own
on public.feed_card_shares
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.get_feed_card_metrics(card_ids text[])
returns table (
  card_id text,
  saves bigint,
  shares bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(card_ids, '{}'::text[])) as card_id
  ),
  save_counts as (
    select s.card_id, count(*)::bigint as saves
    from public.feed_card_saves s
    join requested r on r.card_id = s.card_id
    group by s.card_id
  ),
  share_counts as (
    select sh.card_id, count(*)::bigint as shares
    from public.feed_card_shares sh
    join requested r on r.card_id = sh.card_id
    group by sh.card_id
  )
  select
    r.card_id,
    coalesce(sc.saves, 0)::bigint as saves,
    coalesce(shc.shares, 0)::bigint as shares
  from requested r
  left join save_counts sc on sc.card_id = r.card_id
  left join share_counts shc on shc.card_id = r.card_id;
$$;

revoke all on function public.get_feed_card_metrics(text[]) from public;
grant execute on function public.get_feed_card_metrics(text[]) to anon;
grant execute on function public.get_feed_card_metrics(text[]) to authenticated;

create or replace function public.enqueue_notification(
  target_user_id uuid,
  target_kind text,
  target_title text,
  target_message text,
  target_entity_type text default null,
  target_entity_id uuid default null,
  target_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.notifications (
    user_id,
    kind,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_user_id,
    case
      when lower(coalesce(target_kind, '')) in ('order', 'message', 'review', 'system') then lower(target_kind)
      else 'system'
    end,
    coalesce(nullif(target_title, ''), 'Notification'),
    coalesce(nullif(target_message, ''), 'You have a new notification.'),
    nullif(target_entity_type, ''),
    target_entity_id,
    coalesce(target_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, text, text, text, uuid, jsonb) from public;
grant execute on function public.enqueue_notification(uuid, text, text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.enqueue_notification(uuid, text, text, text, text, uuid, jsonb) to service_role;

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications n
  set read_at = timezone('utc', now())
  where n.user_id = auth.uid()
    and n.cleared_at is null
    and n.read_at is null;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.clear_all_notifications()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications n
  set cleared_at = timezone('utc', now())
  where n.user_id = auth.uid()
    and n.cleared_at is null;
$$;

revoke all on function public.clear_all_notifications() from public;
grant execute on function public.clear_all_notifications() to authenticated;

create or replace function public.notify_order_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_status text := lower(coalesce(new.status, 'new_lead'));
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_notification(
      new.provider_id,
      'order',
      'New lead received',
      format('A new %s request is waiting for your response.', coalesce(new.listing_type, 'listing')),
      'order',
      new.id,
      jsonb_build_object(
        'status', coalesce(new.status, 'new_lead'),
        'listing_type', new.listing_type,
        'price', new.price
      )
    );

    perform public.enqueue_notification(
      new.consumer_id,
      'order',
      'Request submitted',
      'Your booking request has been sent to a provider.',
      'order',
      new.id,
      jsonb_build_object(
        'status', coalesce(new.status, 'new_lead'),
        'listing_type', new.listing_type
      )
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(new.status, '') is distinct from coalesce(old.status, '') then
    if next_status = 'quoted' then
      perform public.enqueue_notification(
        new.consumer_id,
        'order',
        'Quote received',
        'A provider shared a quote for your request.',
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );
    elsif next_status in ('accepted', 'in_progress', 'in-progress', 'active_work') then
      perform public.enqueue_notification(
        new.consumer_id,
        'order',
        'Order accepted',
        'Your request is now in progress.',
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );
    elsif next_status in ('completed', 'closed') then
      perform public.enqueue_notification(
        new.consumer_id,
        'order',
        'Order completed',
        'Your order was marked completed.',
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );
    elsif next_status in ('rejected', 'cancelled') then
      perform public.enqueue_notification(
        new.consumer_id,
        'order',
        'Order updated',
        format('Your order status changed to %s.', replace(next_status, '_', ' ')),
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );

      perform public.enqueue_notification(
        new.provider_id,
        'order',
        'Order updated',
        format('Order status changed to %s.', replace(next_status, '_', ' ')),
        'order',
        new.id,
        jsonb_build_object('status', new.status)
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.notify_message_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    kind,
    title,
    message,
    entity_type,
    entity_id,
    metadata
  )
  select
    cp.user_id,
    'message',
    'New message',
    case
      when length(coalesce(new.content, '')) <= 120 then coalesce(new.content, 'You received a new message.')
      else left(new.content, 117) || '...'
    end as message,
    'conversation',
    new.conversation_id,
    jsonb_build_object(
      'conversation_id', new.conversation_id,
      'message_id', new.id,
      'sender_id', new.sender_id
    )
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id;

  return new;
end;
$$;

create or replace function public.notify_review_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_notification(
    new.provider_id,
    'review',
    'New review received',
    format('You received a %s-star rating.', coalesce(new.rating::text, 'new')),
    'review',
    null,
    jsonb_build_object(
      'rating', new.rating,
      'reviewer_id', new.reviewer_id
    )
  );

  return new;
end;
$$;

create or replace function public.handle_help_request_matching()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.match_help_request(new.id);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if
      coalesce(new.category, '') is distinct from coalesce(old.category, '')
      or new.radius_km is distinct from old.radius_km
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or coalesce(new.urgency, '') is distinct from coalesce(old.urgency, '')
    then
      perform public.match_help_request(new.id);
    end if;
    return new;
  end if;

  return new;
end;
$$;

create or replace function public.notify_live_talk_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := coalesce((new.metadata ->> 'updated_by')::uuid, auth.uid());
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_notification(
      new.recipient_id,
      'system',
      'Incoming Live Talk request',
      'A connected member wants to launch the live audio/video workspace.',
      'live_talk_request',
      new.id,
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'caller_id', new.caller_id,
        'recipient_id', new.recipient_id,
        'status', new.status
      )
    );

    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(new.status, '') is distinct from coalesce(old.status, '') then
    if new.status = 'accepted' then
      perform public.enqueue_notification(
        new.caller_id,
        'system',
        'Live Talk accepted',
        'Your Live Talk request was accepted. Open the chat to continue.',
        'live_talk_request',
        new.id,
        jsonb_build_object(
          'conversation_id', new.conversation_id,
          'caller_id', new.caller_id,
          'recipient_id', new.recipient_id,
          'status', new.status
        )
      );
    elsif new.status = 'declined' then
      perform public.enqueue_notification(
        new.caller_id,
        'system',
        'Live Talk declined',
        'The other member declined your Live Talk request.',
        'live_talk_request',
        new.id,
        jsonb_build_object(
          'conversation_id', new.conversation_id,
          'caller_id', new.caller_id,
          'recipient_id', new.recipient_id,
          'status', new.status
        )
      );
    elsif new.status = 'cancelled' then
      perform public.enqueue_notification(
        case when actor_id = new.caller_id then new.recipient_id else new.caller_id end,
        'system',
        'Live Talk cancelled',
        'The Live Talk request was cancelled.',
        'live_talk_request',
        new.id,
        jsonb_build_object(
          'conversation_id', new.conversation_id,
          'caller_id', new.caller_id,
          'recipient_id', new.recipient_id,
          'status', new.status
        )
      );
    elsif new.status = 'ended' then
      perform public.enqueue_notification(
        case when actor_id = new.caller_id then new.recipient_id else new.caller_id end,
        'system',
        'Live Talk ended',
        'The Live Talk session ended. You can continue in chat anytime.',
        'live_talk_request',
        new.id,
        jsonb_build_object(
          'conversation_id', new.conversation_id,
          'caller_id', new.caller_id,
          'recipient_id', new.recipient_id,
          'status', new.status
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_order_events on public.orders;
create trigger trg_notify_order_events
after insert or update on public.orders
for each row
execute function public.notify_order_events();

drop trigger if exists trg_notify_message_events on public.messages;
create trigger trg_notify_message_events
after insert on public.messages
for each row
execute function public.notify_message_events();

drop trigger if exists trg_notify_review_events on public.reviews;
create trigger trg_notify_review_events
after insert on public.reviews
for each row
execute function public.notify_review_events();

drop trigger if exists trg_help_request_match_insert on public.help_requests;
create trigger trg_help_request_match_insert
after insert on public.help_requests
for each row
execute function public.handle_help_request_matching();

drop trigger if exists trg_help_request_match_update on public.help_requests;
create trigger trg_help_request_match_update
after update on public.help_requests
for each row
execute function public.handle_help_request_matching();

drop trigger if exists trg_notify_live_talk_request_events on public.live_talk_requests;
create trigger trg_notify_live_talk_request_events
after insert or update on public.live_talk_requests
for each row
execute function public.notify_live_talk_request_events();

create or replace function public.get_platform_startup_diagnostics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  checks jsonb := '{}'::jsonb;
  issues text[] := array[]::text[];
  has_publication boolean := false;
  has_posts boolean := false;
  has_help_requests boolean := false;
  has_orders boolean := false;
  has_connection_requests boolean := false;
  has_conversations boolean := false;
  has_messages boolean := false;
  has_notifications boolean := false;
  has_provider_presence boolean := false;
  has_live_talk_requests boolean := false;
  has_feed_card_saves boolean := false;
  has_feed_card_shares boolean := false;
  has_post_media_bucket boolean := false;
  has_profile_avatar_bucket boolean := false;
  has_posts_insert_policy boolean := false;
  has_help_requests_insert_policy boolean := false;
  has_connection_requests_insert_policy boolean := false;
  has_notifications_select_policy boolean := false;
  has_live_talk_insert_policy boolean := false;
  has_feed_saves_insert_policy boolean := false;
  has_mark_all_notifications_read boolean := false;
  has_clear_all_notifications boolean := false;
  has_send_connection_request boolean := false;
  has_respond_to_connection_request boolean := false;
  has_upsert_provider_presence boolean := false;
  has_get_feed_card_metrics boolean := false;
  has_posts_realtime boolean := false;
  has_notifications_realtime boolean := false;
  has_provider_presence_realtime boolean := false;
  has_connection_requests_realtime boolean := false;
  has_live_talk_requests_realtime boolean := false;
  has_feed_card_saves_realtime boolean := false;
  has_feed_card_shares_realtime boolean := false;
begin
  select exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) into has_publication;

  if not has_publication then
    issues := array_append(issues, 'Missing publication: supabase_realtime');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'posts')
    into has_posts;
  if not has_posts then
    issues := array_append(issues, 'Missing required table: public.posts');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'help_requests')
    into has_help_requests;
  if not has_help_requests then
    issues := array_append(issues, 'Missing required table: public.help_requests');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'orders')
    into has_orders;
  if not has_orders then
    issues := array_append(issues, 'Missing required table: public.orders');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'connection_requests')
    into has_connection_requests;
  if not has_connection_requests then
    issues := array_append(issues, 'Missing required table: public.connection_requests');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conversations')
    into has_conversations;
  if not has_conversations then
    issues := array_append(issues, 'Missing required table: public.conversations');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'messages')
    into has_messages;
  if not has_messages then
    issues := array_append(issues, 'Missing required table: public.messages');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'notifications')
    into has_notifications;
  if not has_notifications then
    issues := array_append(issues, 'Missing required table: public.notifications');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'provider_presence')
    into has_provider_presence;
  if not has_provider_presence then
    issues := array_append(issues, 'Missing required table: public.provider_presence');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'live_talk_requests')
    into has_live_talk_requests;
  if not has_live_talk_requests then
    issues := array_append(issues, 'Missing required table: public.live_talk_requests');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'feed_card_saves')
    into has_feed_card_saves;
  if not has_feed_card_saves then
    issues := array_append(issues, 'Missing required table: public.feed_card_saves');
  end if;

  select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'feed_card_shares')
    into has_feed_card_shares;
  if not has_feed_card_shares then
    issues := array_append(issues, 'Missing required table: public.feed_card_shares');
  end if;

  select exists (select 1 from storage.buckets where id = 'post-media')
    into has_post_media_bucket;
  if not has_post_media_bucket then
    issues := array_append(issues, 'Missing required storage bucket: post-media');
  end if;

  select exists (select 1 from storage.buckets where id = 'profile-avatars')
    into has_profile_avatar_bucket;
  if not has_profile_avatar_bucket then
    issues := array_append(issues, 'Missing required storage bucket: profile-avatars');
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_insert_own'
  ) into has_posts_insert_policy;
  if not has_posts_insert_policy then
    issues := array_append(issues, 'Missing policy: public.posts -> posts_insert_own');
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'help_requests' and policyname = 'help_requests_insert_own'
  ) into has_help_requests_insert_policy;
  if has_help_requests and not has_help_requests_insert_policy then
    issues := array_append(issues, 'Missing policy: public.help_requests -> help_requests_insert_own');
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'connection_requests' and policyname = 'connection_requests_insert_requester'
  ) into has_connection_requests_insert_policy;
  if has_connection_requests and not has_connection_requests_insert_policy then
    issues := array_append(issues, 'Missing policy: public.connection_requests -> connection_requests_insert_requester');
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'notifications_select_own'
  ) into has_notifications_select_policy;
  if has_notifications and not has_notifications_select_policy then
    issues := array_append(issues, 'Missing policy: public.notifications -> notifications_select_own');
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'live_talk_requests' and policyname = 'live_talk_requests_insert_caller'
  ) into has_live_talk_insert_policy;
  if has_live_talk_requests and not has_live_talk_insert_policy then
    issues := array_append(issues, 'Missing policy: public.live_talk_requests -> live_talk_requests_insert_caller');
  end if;

  select exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'feed_card_saves' and policyname = 'feed_card_saves_insert_own'
  ) into has_feed_saves_insert_policy;
  if has_feed_card_saves and not has_feed_saves_insert_policy then
    issues := array_append(issues, 'Missing policy: public.feed_card_saves -> feed_card_saves_insert_own');
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'mark_all_notifications_read'
      and oidvectortypes(p.proargtypes) = ''
  ) into has_mark_all_notifications_read;
  if not has_mark_all_notifications_read then
    issues := array_append(issues, 'Missing function: public.mark_all_notifications_read()');
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'clear_all_notifications'
      and oidvectortypes(p.proargtypes) = ''
  ) into has_clear_all_notifications;
  if not has_clear_all_notifications then
    issues := array_append(issues, 'Missing function: public.clear_all_notifications()');
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'send_connection_request'
      and oidvectortypes(p.proargtypes) = 'uuid'
  ) into has_send_connection_request;
  if not has_send_connection_request then
    issues := array_append(issues, 'Missing function: public.send_connection_request(uuid)');
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'respond_to_connection_request'
      and oidvectortypes(p.proargtypes) = 'uuid, text'
  ) into has_respond_to_connection_request;
  if not has_respond_to_connection_request then
    issues := array_append(issues, 'Missing function: public.respond_to_connection_request(uuid, text)');
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'upsert_provider_presence'
      and oidvectortypes(p.proargtypes) = 'boolean, text, integer'
  ) into has_upsert_provider_presence;
  if not has_upsert_provider_presence then
    issues := array_append(issues, 'Missing function: public.upsert_provider_presence(boolean, text, integer)');
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_feed_card_metrics'
      and oidvectortypes(p.proargtypes) = 'text[]'
  ) into has_get_feed_card_metrics;
  if not has_get_feed_card_metrics then
    issues := array_append(issues, 'Missing function: public.get_feed_card_metrics(text[])');
  end if;

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) into has_posts_realtime;
  if has_publication and not has_posts_realtime then
    issues := array_append(issues, 'Missing realtime publication entry: public.posts');
  end if;

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) into has_notifications_realtime;
  if has_publication and not has_notifications_realtime then
    issues := array_append(issues, 'Missing realtime publication entry: public.notifications');
  end if;

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'provider_presence'
  ) into has_provider_presence_realtime;
  if has_publication and not has_provider_presence_realtime then
    issues := array_append(issues, 'Missing realtime publication entry: public.provider_presence');
  end if;

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'connection_requests'
  ) into has_connection_requests_realtime;
  if has_publication and not has_connection_requests_realtime then
    issues := array_append(issues, 'Missing realtime publication entry: public.connection_requests');
  end if;

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_talk_requests'
  ) into has_live_talk_requests_realtime;
  if has_publication and not has_live_talk_requests_realtime then
    issues := array_append(issues, 'Missing realtime publication entry: public.live_talk_requests');
  end if;

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feed_card_saves'
  ) into has_feed_card_saves_realtime;
  if has_publication and not has_feed_card_saves_realtime then
    issues := array_append(issues, 'Missing realtime publication entry: public.feed_card_saves');
  end if;

  select exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'feed_card_shares'
  ) into has_feed_card_shares_realtime;
  if has_publication and not has_feed_card_shares_realtime then
    issues := array_append(issues, 'Missing realtime publication entry: public.feed_card_shares');
  end if;

  checks := jsonb_build_object(
    'supabase_realtime_publication', has_publication,
    'posts_table', has_posts,
    'help_requests_table', has_help_requests,
    'orders_table', has_orders,
    'connection_requests_table', has_connection_requests,
    'conversations_table', has_conversations,
    'messages_table', has_messages,
    'notifications_table', has_notifications,
    'provider_presence_table', has_provider_presence,
    'live_talk_requests_table', has_live_talk_requests,
    'feed_card_saves_table', has_feed_card_saves,
    'feed_card_shares_table', has_feed_card_shares,
    'post_media_bucket', has_post_media_bucket,
    'profile_avatar_bucket', has_profile_avatar_bucket,
    'posts_insert_policy', has_posts_insert_policy,
    'help_requests_insert_policy', has_help_requests_insert_policy,
    'connection_requests_insert_policy', has_connection_requests_insert_policy,
    'notifications_select_policy', has_notifications_select_policy,
    'live_talk_requests_insert_policy', has_live_talk_insert_policy,
    'feed_card_saves_insert_policy', has_feed_saves_insert_policy,
    'mark_all_notifications_read_rpc', has_mark_all_notifications_read,
    'clear_all_notifications_rpc', has_clear_all_notifications,
    'send_connection_request_rpc', has_send_connection_request,
    'respond_to_connection_request_rpc', has_respond_to_connection_request,
    'upsert_provider_presence_rpc', has_upsert_provider_presence,
    'get_feed_card_metrics_rpc', has_get_feed_card_metrics,
    'posts_realtime', has_posts_realtime,
    'notifications_realtime', has_notifications_realtime,
    'provider_presence_realtime', has_provider_presence_realtime,
    'connection_requests_realtime', has_connection_requests_realtime,
    'live_talk_requests_realtime', has_live_talk_requests_realtime,
    'feed_card_saves_realtime', has_feed_card_saves_realtime,
    'feed_card_shares_realtime', has_feed_card_shares_realtime
  );

  return jsonb_build_object(
    'ok', coalesce(array_length(issues, 1), 0) = 0,
    'issues', to_jsonb(issues),
    'checks', checks
  );
end;
$$;

grant execute on function public.get_platform_startup_diagnostics() to authenticated, service_role;

do $$
declare
  realtime_table text;
  realtime_tables text[] := array[
    'posts',
    'service_listings',
    'product_catalog',
    'profiles',
    'reviews',
    'orders',
    'conversations',
    'conversation_participants',
    'messages',
    'notifications',
    'task_events',
    'help_requests',
    'help_request_matches',
    'provider_presence',
    'connection_requests',
    'live_talk_requests',
    'feed_card_saves',
    'feed_card_shares'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach realtime_table in array realtime_tables loop
      if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = realtime_table
      ) then
        begin
          execute format('alter publication supabase_realtime add table public.%I', realtime_table);
        exception
          when duplicate_object then
            null;
        end;
      end if;
    end loop;
  end if;
end $$;

commit;


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

  if not public.is_connection_accepted(actor_id, target_user_id) then
    raise exception 'Connect before starting a direct chat';
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


create or replace function public.is_help_request_provider(
  target_help_request_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.help_request_matches hrm
    where hrm.help_request_id = target_help_request_id
      and hrm.provider_id = target_user_id
  );
$$;

grant execute on function public.is_help_request_provider(uuid, uuid) to authenticated;

drop policy if exists help_requests_select_visible on public.help_requests;

create policy help_requests_select_visible
on public.help_requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or public.is_help_request_provider(id, auth.uid())
);


begin;

create table if not exists public.business_launchpad_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft',
  input_source text not null default 'manual',
  answers jsonb not null default '{}'::jsonb,
  import_payload jsonb not null default '{}'::jsonb,
  generated_profile jsonb not null default '{}'::jsonb,
  generated_services jsonb not null default '[]'::jsonb,
  generated_products jsonb not null default '[]'::jsonb,
  generated_faq jsonb not null default '[]'::jsonb,
  generated_service_areas jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_business_launchpad_drafts_owner_updated
  on public.business_launchpad_drafts (owner_id, updated_at desc);

drop trigger if exists trg_business_launchpad_drafts_updated_at on public.business_launchpad_drafts;
create trigger trg_business_launchpad_drafts_updated_at
before update on public.business_launchpad_drafts
for each row
execute function public.set_updated_at();

alter table public.business_launchpad_drafts enable row level security;

drop policy if exists business_launchpad_drafts_select_own on public.business_launchpad_drafts;
drop policy if exists business_launchpad_drafts_insert_own on public.business_launchpad_drafts;
drop policy if exists business_launchpad_drafts_update_own on public.business_launchpad_drafts;
drop policy if exists business_launchpad_drafts_delete_own on public.business_launchpad_drafts;

create policy business_launchpad_drafts_select_own
on public.business_launchpad_drafts
for select
to authenticated
using (owner_id = auth.uid());

create policy business_launchpad_drafts_insert_own
on public.business_launchpad_drafts
for insert
to authenticated
with check (owner_id = auth.uid());

create policy business_launchpad_drafts_update_own
on public.business_launchpad_drafts
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy business_launchpad_drafts_delete_own
on public.business_launchpad_drafts
for delete
to authenticated
using (owner_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.business_launchpad_drafts';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;


begin;

create table if not exists public.quote_drafts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  help_request_id uuid references public.help_requests(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  consumer_id uuid references auth.users(id) on delete cascade,
  status text not null default 'draft'
    check (lower(status) in ('draft', 'sent', 'accepted', 'expired', 'cancelled')),
  summary text,
  notes text,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  expires_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.quote_drafts
  drop constraint if exists quote_drafts_single_target;

alter table public.quote_drafts
  add constraint quote_drafts_single_target
  check ((order_id is null) <> (help_request_id is null));

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_drafts(id) on delete cascade,
  label text not null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_quote_drafts_provider_updated
  on public.quote_drafts (provider_id, updated_at desc);

create index if not exists idx_quote_drafts_consumer_updated
  on public.quote_drafts (consumer_id, updated_at desc);

create index if not exists idx_quote_drafts_order_updated
  on public.quote_drafts (order_id, updated_at desc);

create index if not exists idx_quote_drafts_help_request_updated
  on public.quote_drafts (help_request_id, updated_at desc);

create unique index if not exists idx_quote_drafts_provider_order_unique
  on public.quote_drafts (provider_id, order_id)
  where order_id is not null;

create unique index if not exists idx_quote_drafts_provider_help_request_unique
  on public.quote_drafts (provider_id, help_request_id)
  where help_request_id is not null;

create index if not exists idx_quote_line_items_quote_sort
  on public.quote_line_items (quote_id, sort_order asc, created_at asc);

drop trigger if exists trg_quote_drafts_updated_at on public.quote_drafts;
create trigger trg_quote_drafts_updated_at
before update on public.quote_drafts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_quote_line_items_updated_at on public.quote_line_items;
create trigger trg_quote_line_items_updated_at
before update on public.quote_line_items
for each row
execute function public.set_updated_at();

alter table public.quote_drafts enable row level security;
alter table public.quote_line_items enable row level security;

drop policy if exists quote_drafts_select_party on public.quote_drafts;
drop policy if exists quote_drafts_insert_provider on public.quote_drafts;
drop policy if exists quote_drafts_update_provider on public.quote_drafts;
drop policy if exists quote_drafts_delete_provider on public.quote_drafts;

create policy quote_drafts_select_party
on public.quote_drafts
for select
to authenticated
using (provider_id = auth.uid() or consumer_id = auth.uid());

create policy quote_drafts_insert_provider
on public.quote_drafts
for insert
to authenticated
with check (provider_id = auth.uid());

create policy quote_drafts_update_provider
on public.quote_drafts
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

create policy quote_drafts_delete_provider
on public.quote_drafts
for delete
to authenticated
using (provider_id = auth.uid());

drop policy if exists quote_line_items_select_party on public.quote_line_items;
drop policy if exists quote_line_items_insert_provider on public.quote_line_items;
drop policy if exists quote_line_items_update_provider on public.quote_line_items;
drop policy if exists quote_line_items_delete_provider on public.quote_line_items;

create policy quote_line_items_select_party
on public.quote_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and (qd.provider_id = auth.uid() or qd.consumer_id = auth.uid())
  )
);

create policy quote_line_items_insert_provider
on public.quote_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
);

create policy quote_line_items_update_provider
on public.quote_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
);

create policy quote_line_items_delete_provider
on public.quote_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.quote_drafts';
    exception when duplicate_object then null;
    end;

    begin
      execute 'alter publication supabase_realtime add table public.quote_line_items';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;


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



