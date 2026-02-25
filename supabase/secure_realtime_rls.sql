-- Security hardening + unread model for realtime marketplace tables
--
-- Scope:
--   - orders
--   - messages
--   - conversations
--   - conversation_participants
--   - reviews
--   - notifications
--   - help_requests
--   - help_request_matches
--
-- Also adds unread persistence support:
--   - conversation_participants.last_read_at
--   - notifications read/clear model
--
-- Also adds geo primitives:
--   - profiles.latitude
--   - profiles.longitude
--
-- Also adds structured help matching:
--   - help request schema
--   - provider matching + ranking
--   - realtime provider/requester notifications

begin;

-- ---------------------------------------------------------------------------
-- Unread model primitives
-- ---------------------------------------------------------------------------
alter table if exists public.conversation_participants
  add column if not exists last_read_at timestamptz;

update public.conversation_participants
set last_read_at = coalesce(last_read_at, timezone('utc', now()));

alter table if exists public.conversation_participants
  alter column last_read_at set default timezone('utc', now());

-- Remove duplicate participant rows before adding unique index.
delete from public.conversation_participants cp
using public.conversation_participants dup
where cp.ctid < dup.ctid
  and cp.conversation_id = dup.conversation_id
  and cp.user_id = dup.user_id;

create unique index if not exists uq_conversation_participants_conversation_user
  on public.conversation_participants (conversation_id, user_id);

create index if not exists idx_conversation_participants_user_conversation
  on public.conversation_participants (user_id, conversation_id);

create index if not exists idx_conversation_participants_conversation
  on public.conversation_participants (conversation_id);

create index if not exists idx_messages_conversation_created_at
  on public.messages (conversation_id, created_at desc);

create index if not exists idx_orders_consumer
  on public.orders (consumer_id);

create index if not exists idx_orders_provider
  on public.orders (provider_id);

create index if not exists idx_reviews_provider
  on public.reviews (provider_id);

create index if not exists idx_reviews_reviewer
  on public.reviews (reviewer_id);

alter table if exists public.profiles
  add column if not exists latitude double precision;

alter table if exists public.profiles
  add column if not exists longitude double precision;

create index if not exists idx_profiles_lat_lng
  on public.profiles (latitude, longitude);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('order', 'message', 'review', 'system')),
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.notifications
  drop constraint if exists notifications_user_id_fkey;

alter table if exists public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read_at, created_at desc)
  where cleared_at is null;

create index if not exists idx_notifications_entity
  on public.notifications (entity_type, entity_id);

create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null,
  title text not null,
  details text not null,
  category text not null default 'General',
  urgency text not null default 'urgent' check (urgency in ('urgent', 'today', '24h', 'week', 'flexible')),
  needed_by timestamptz,
  budget_min numeric(10,2),
  budget_max numeric(10,2),
  location_label text,
  latitude double precision,
  longitude double precision,
  radius_km integer not null default 8 check (radius_km between 1 and 100),
  status text not null default 'open' check (status in ('open', 'matched', 'in_progress', 'fulfilled', 'cancelled')),
  source_post_id text,
  metadata jsonb not null default '{}'::jsonb,
  matched_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.help_requests
  drop constraint if exists help_requests_requester_id_fkey;

alter table if exists public.help_requests
  add constraint help_requests_requester_id_fkey
  foreign key (requester_id) references auth.users(id) on delete cascade;

create index if not exists idx_help_requests_requester_created
  on public.help_requests (requester_id, created_at desc);

create index if not exists idx_help_requests_status_created
  on public.help_requests (status, created_at desc);

create index if not exists idx_help_requests_category_status
  on public.help_requests (lower(category), status);

create index if not exists idx_help_requests_lat_lng
  on public.help_requests (latitude, longitude);

create table if not exists public.help_request_matches (
  id uuid primary key default gen_random_uuid(),
  help_request_id uuid not null,
  provider_id uuid not null,
  score double precision not null default 0,
  distance_km double precision,
  reason text,
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'declined', 'expired')),
  conversation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz
);

alter table if exists public.help_request_matches
  drop constraint if exists help_request_matches_help_request_id_fkey;

alter table if exists public.help_request_matches
  add constraint help_request_matches_help_request_id_fkey
  foreign key (help_request_id) references public.help_requests(id) on delete cascade;

alter table if exists public.help_request_matches
  drop constraint if exists help_request_matches_provider_id_fkey;

alter table if exists public.help_request_matches
  add constraint help_request_matches_provider_id_fkey
  foreign key (provider_id) references auth.users(id) on delete cascade;

alter table if exists public.help_request_matches
  drop constraint if exists help_request_matches_conversation_id_fkey;

alter table if exists public.help_request_matches
  add constraint help_request_matches_conversation_id_fkey
  foreign key (conversation_id) references public.conversations(id) on delete set null;

alter table if exists public.help_request_matches
  drop constraint if exists uq_help_request_matches_request_provider;

alter table if exists public.help_request_matches
  add constraint uq_help_request_matches_request_provider
  unique (help_request_id, provider_id);

create index if not exists idx_help_request_matches_request_score
  on public.help_request_matches (help_request_id, score desc);

create index if not exists idx_help_request_matches_provider_status
  on public.help_request_matches (provider_id, status, created_at desc);

create or replace function public.calculate_distance_km(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select case
    when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else (
      6371 * 2 * asin(
        sqrt(
          power(sin(radians(lat2 - lat1) / 2), 2) +
          cos(radians(lat1)) * cos(radians(lat2)) *
          power(sin(radians(lon2 - lon1) / 2), 2)
        )
      )
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Helper functions for policy checks
-- ---------------------------------------------------------------------------
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
      where lower(coalesce(o.status, 'pending')) not in ('completed', 'cancelled', 'closed')
    )::bigint as open_leads
  from requested_provider_ids
  left join public.orders o on o.provider_id = requested_provider_ids.provider_id
  group by requested_provider_ids.provider_id;
$$;

revoke all on function public.get_provider_order_stats(uuid[]) from public;
grant execute on function public.get_provider_order_stats(uuid[]) to anon;
grant execute on function public.get_provider_order_stats(uuid[]) to authenticated;

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

create or replace function public.match_help_request(
  target_help_request_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row record;
  requester_name text;
  inserted_count integer := 0;
begin
  select
    hr.*,
    p.latitude as requester_latitude,
    p.longitude as requester_longitude,
    coalesce(nullif(p.name, ''), 'Someone nearby') as requester_name_value
  into request_row
  from public.help_requests hr
  left join public.profiles p on p.id = hr.requester_id
  where hr.id = target_help_request_id;

  if not found then
    return 0;
  end if;

  if lower(coalesce(request_row.status, 'open')) in ('cancelled', 'fulfilled') then
    return coalesce(request_row.matched_count, 0);
  end if;

  requester_name := coalesce(request_row.requester_name_value, 'Someone nearby');

  delete from public.help_request_matches
  where help_request_id = request_row.id;

  with request_base as (
    select
      request_row.id as request_id,
      request_row.requester_id as requester_id,
      lower(coalesce(request_row.category, '')) as request_category,
      greatest(1, least(coalesce(request_row.radius_km, 8), 100)) as request_radius_km,
      coalesce(request_row.latitude, request_row.requester_latitude) as request_latitude,
      coalesce(request_row.longitude, request_row.requester_longitude) as request_longitude
  ),
  listing_catalog as (
    select provider_id, lower(coalesce(category, '')) as category
    from public.service_listings
    where provider_id is not null
    union all
    select provider_id, lower(coalesce(category, '')) as category
    from public.product_catalog
    where provider_id is not null
  ),
  listing_agg as (
    select
      provider_id,
      array_remove(array_agg(distinct nullif(category, '')), null) as categories,
      count(*)::int as listing_count
    from listing_catalog
    group by provider_id
  ),
  rating_agg as (
    select
      provider_id,
      avg(rating)::double precision as avg_rating,
      count(*)::int as review_count
    from public.reviews
    where provider_id is not null
    group by provider_id
  ),
  completed_order_agg as (
    select
      provider_id,
      count(*) filter (
        where lower(coalesce(status, '')) in ('completed', 'closed')
      )::int as completed_jobs
    from public.orders
    where provider_id is not null
    group by provider_id
  ),
  candidates as (
    select
      p.id as provider_id,
      coalesce(public.calculate_distance_km(
        rb.request_latitude,
        rb.request_longitude,
        p.latitude,
        p.longitude
      ), 9999) as distance_km,
      case
        when rb.request_category = '' then false
        when coalesce(array_length(la.categories, 1), 0) = 0 then false
        else exists (
          select 1
          from unnest(la.categories) as provider_category
          where provider_category like '%' || rb.request_category || '%'
            or rb.request_category like '%' || provider_category || '%'
        )
      end as category_match,
      coalesce(ra.avg_rating, 4.2) as avg_rating,
      coalesce(ra.review_count, 0) as review_count,
      coalesce(oa.completed_jobs, 0) as completed_jobs,
      lower(coalesce(p.availability, 'available')) as availability,
      coalesce(la.listing_count, 0) as listing_count
    from request_base rb
    join public.profiles p on p.id <> rb.requester_id
    left join listing_agg la on la.provider_id = p.id
    left join rating_agg ra on ra.provider_id = p.id
    left join completed_order_agg oa on oa.provider_id = p.id
    where p.id is not null
      and coalesce(la.listing_count, 0) > 0
      and lower(coalesce(p.availability, 'available')) <> 'offline'
      and (
        rb.request_latitude is null
        or rb.request_longitude is null
        or p.latitude is null
        or p.longitude is null
        or public.calculate_distance_km(
          rb.request_latitude,
          rb.request_longitude,
          p.latitude,
          p.longitude
        ) <= rb.request_radius_km
      )
  ),
  ranked as (
    select
      provider_id,
      distance_km,
      greatest(
        0,
        100
        - (least(distance_km, 60) * 1.4)
        + (case when category_match then 20 else 0 end)
        + (avg_rating * 7)
        + (least(completed_jobs, 120) * 0.12)
        + (case
            when availability = 'available' then 10
            when availability = 'busy' then 2
            else 0
          end)
      ) as score,
      case
        when category_match and distance_km <= 5 then 'Great category + nearby fit'
        when category_match then 'Strong category fit'
        when distance_km <= 3 then 'Very close distance'
        when avg_rating >= 4.6 then 'Highly rated provider'
        else 'Good available provider'
      end as reason
    from candidates
    order by score desc, distance_km asc
    limit 5
  )
  insert into public.help_request_matches (
    help_request_id,
    provider_id,
    score,
    distance_km,
    reason,
    status,
    metadata
  )
  select
    request_row.id,
    ranked.provider_id,
    ranked.score,
    ranked.distance_km,
    ranked.reason,
    'suggested',
    jsonb_build_object(
      'category', request_row.category,
      'urgency', request_row.urgency
    )
  from ranked;

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

  -- Prevent duplicate provider alerts when match_help_request is retriggered.
  delete from public.notifications n
  where n.entity_type = 'help_request'
    and n.entity_id = request_row.id
    and n.kind = 'system'
    and n.user_id in (
      select provider_id
      from public.help_request_matches
      where help_request_id = request_row.id
    );

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
    'New help request nearby',
    format('%s needs help in %s.', requester_name, coalesce(nullif(request_row.category, ''), 'your area')),
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

  if not exists (
    select 1
    from public.notifications n
    where n.user_id = request_row.requester_id
      and n.entity_type = 'help_request'
      and n.entity_id = request_row.id
      and n.title = 'Provider matches ready'
  ) then
    perform public.enqueue_notification(
      request_row.requester_id,
      'system',
      'Provider matches ready',
      format('%s provider matches are ready for "%s".', inserted_count, left(coalesce(request_row.title, 'your request'), 80)),
      'help_request',
      request_row.id,
      jsonb_build_object(
        'help_request_id', request_row.id,
        'matched_count', inserted_count
      )
    );
  end if;

  return inserted_count;
end;
$$;

revoke all on function public.match_help_request(uuid) from public;
grant execute on function public.match_help_request(uuid) to authenticated;

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
    case when target_kind in ('order', 'message', 'review', 'system') then target_kind else 'system' end,
    coalesce(nullif(target_title, ''), 'Notification'),
    coalesce(nullif(target_message, ''), 'You have a new notification.'),
    target_entity_type,
    target_entity_id,
    coalesce(target_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.enqueue_notification(uuid, text, text, text, text, uuid, jsonb) from public;
grant execute on function public.enqueue_notification(uuid, text, text, text, text, uuid, jsonb) to authenticated;

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

    if new.consumer_id is not null then
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
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(new.status, '') is distinct from coalesce(old.status, '') then
    if new.consumer_id is not null then
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
      end if;
    end if;

    if new.provider_id is not null and next_status in ('cancelled', 'rejected') then
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

-- ---------------------------------------------------------------------------
-- Reset policies for target tables (hard reset on scope tables)
-- ---------------------------------------------------------------------------
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'orders',
        'messages',
        'conversations',
        'conversation_participants',
        'reviews',
        'notifications',
        'help_requests',
        'help_request_matches'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end $$;

alter table if exists public.orders enable row level security;
alter table if exists public.messages enable row level security;
alter table if exists public.conversations enable row level security;
alter table if exists public.conversation_participants enable row level security;
alter table if exists public.reviews enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.help_requests enable row level security;
alter table if exists public.help_request_matches enable row level security;

-- ---------------------------------------------------------------------------
-- orders policies
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- conversations policies
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- conversation_participants policies
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- messages policies
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- reviews policies
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- notifications policies
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- help_requests policies
-- ---------------------------------------------------------------------------
create policy help_requests_select_visible
on public.help_requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or public.is_help_request_provider(id, auth.uid())
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
using (requester_id = auth.uid())
with check (requester_id = auth.uid());

create policy help_requests_delete_own
on public.help_requests
for delete
to authenticated
using (requester_id = auth.uid());

-- ---------------------------------------------------------------------------
-- help_request_matches policies
-- ---------------------------------------------------------------------------
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

create policy help_request_matches_update_provider
on public.help_request_matches
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

drop trigger if exists trg_notify_order_events on public.orders;
create trigger trg_notify_order_events
after insert or update of status on public.orders
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
after update of category, radius_km, latitude, longitude, urgency on public.help_requests
for each row
execute function public.handle_help_request_matching();

commit;
