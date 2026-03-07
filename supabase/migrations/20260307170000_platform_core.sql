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
