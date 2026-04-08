begin;

alter table if exists public.help_request_matches
  drop constraint if exists help_request_matches_status_check;

alter table if exists public.help_request_matches
  add constraint help_request_matches_status_check
  check (lower(status) in ('open', 'interested', 'accepted', 'in_progress', 'completed', 'withdrawn', 'cancelled', 'rejected'));

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
    status = public.help_request_matches.status,
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
    status = case
      when provider_id = actor_id then 'accepted'
      when lower(coalesce(status, 'open')) in ('completed', 'cancelled', 'withdrawn') then status
      else 'rejected'
    end,
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

commit;
