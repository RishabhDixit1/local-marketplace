-- Provider trust scoring: completion rate must reflect actual job completion,
-- not profile completeness. Adds accepted_jobs / repeat_consumers to order stats,
-- recomputes trust scores from real order history, and refreshes metrics when
-- order status changes.

create or replace function public.calculate_job_completion_rate(completed_jobs bigint, accepted_jobs bigint)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(accepted_jobs, 0) <= 0 then 0
    else least(100, greatest(0, (coalesce(completed_jobs, 0)::numeric / accepted_jobs::numeric) * 100))
  end;
$$;

grant execute on function public.calculate_job_completion_rate(bigint, bigint) to authenticated;
grant execute on function public.calculate_job_completion_rate(bigint, bigint) to anon;

drop function if exists public.get_provider_order_stats(uuid[]);

create or replace function public.get_provider_order_stats(provider_ids uuid[])
returns table (
  provider_id uuid,
  completed_jobs bigint,
  open_leads bigint,
  accepted_jobs bigint,
  repeat_consumers bigint
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
    )::bigint as open_leads,
    count(*) filter (
      where lower(coalesce(o.status, '')) in ('accepted', 'in_progress', 'completed', 'closed')
    )::bigint as accepted_jobs,
    (
      select count(*)
      from (
        select consumer_id
        from public.orders booked
        where booked.provider_id = requested_provider_ids.provider_id
          and lower(coalesce(booked.status, '')) in ('accepted', 'in_progress', 'completed', 'closed')
        group by consumer_id
        having count(*) >= 2
      ) repeat_bookings
    )::bigint as repeat_consumers
  from requested_provider_ids
  left join public.orders o on o.provider_id = requested_provider_ids.provider_id
  group by requested_provider_ids.provider_id;
$$;

revoke all on function public.get_provider_order_stats(uuid[]) from public;
grant execute on function public.get_provider_order_stats(uuid[]) to anon;
grant execute on function public.get_provider_order_stats(uuid[]) to authenticated;

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
  completed_jobs bigint := 0;
  accepted_jobs bigint := 0;
  repeat_consumer_count bigint := 0;
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

  select
    count(*) filter (where lower(coalesce(o.status, '')) in ('completed', 'closed')),
    count(*) filter (where lower(coalesce(o.status, '')) in ('accepted', 'in_progress', 'completed', 'closed'))
  into completed_jobs, accepted_jobs
  from public.orders o
  where o.provider_id = target_profile_id;

  select count(*) into repeat_consumer_count
  from (
    select consumer_id
    from public.orders booked
    where booked.provider_id = target_profile_id
      and lower(coalesce(booked.status, '')) in ('accepted', 'in_progress', 'completed', 'closed')
    group by consumer_id
    having count(*) >= 2
  ) repeat_bookings;

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
  completion_score := public.calculate_job_completion_rate(completed_jobs, accepted_jobs);
  on_time_score := least(100, greatest(0, coalesce(profile_row.on_time_rate, 0)));
  repeat_clients_score := public.marketplace_repeat_clients_score(repeat_consumer_count::integer);
  verification_score := public.marketplace_verification_score(profile_row.verification_level);
  response_time_score := public.marketplace_response_time_score(profile_row.response_time_minutes);

  trust_score_value := public.calculate_marketplace_trust_score(
    avg_rating,
    completion_score,
    on_time_score,
    repeat_consumer_count::integer,
    profile_row.verification_level,
    profile_row.response_time_minutes
  );

  update public.profiles
  set
    profile_completion_percent = completion_percent,
    repeat_clients_count = repeat_consumer_count,
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

create or replace function public.sync_profile_metrics_from_order()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_profile_marketplace_metrics(old.provider_id);
    return old;
  end if;

  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform public.refresh_profile_marketplace_metrics(new.provider_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_sync_metrics on public.orders;
create trigger trg_orders_sync_metrics
after insert or update on public.orders
for each row
execute function public.sync_profile_metrics_from_order();
