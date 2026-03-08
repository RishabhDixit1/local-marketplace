-- Focused task-history demo seed for /dashboard/tasks visualization
-- Safe to re-run (deterministic IDs + conflict handling).
--
-- Seeds:
--   1) orders
--   2) task_events
--
-- Prerequisites:
--   - At least one row in auth.users
--   - Prefer running seed_dashboard_demo.sql first so listings/posts exist

begin;

do $$
begin
  if not exists (select 1 from auth.users) then
    raise notice 'No users found in auth.users. Create at least one account, then re-run this script.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) ORDERS
-- ---------------------------------------------------------------------------
with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 8
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6,
    max(case when rn = 7 then id end) as u7,
    max(case when rn = 8 then id end) as u8
  from base_users
),
service_candidates as (
  select id, provider_id, coalesce(price, 899) as price, row_number() over (order by id) as rn
  from public.service_listings
  limit 4
),
product_candidates as (
  select id, provider_id, coalesce(price, 499) as price, row_number() over (order by id) as rn
  from public.product_catalog
  limit 2
),
post_candidates as (
  select id, user_id, row_number() over (order by created_at desc nulls last, id) as rn
  from public.posts
  where coalesce(lower(status), 'open') = 'open'
  limit 2
),
resolved as (
  select
    coalesce(s.u8, s.u7, s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as fallback_consumer,
    coalesce(s.u2, s.u1) as fallback_provider,
    sc1.id as service_1_id,
    sc1.provider_id as service_1_provider,
    sc1.price as service_1_price,
    sc2.id as service_2_id,
    sc2.provider_id as service_2_provider,
    sc2.price as service_2_price,
    sc3.id as service_3_id,
    sc3.provider_id as service_3_provider,
    sc3.price as service_3_price,
    pc1.id as product_1_id,
    pc1.provider_id as product_1_provider,
    pc1.price as product_1_price,
    pc2.id as product_2_id,
    pc2.provider_id as product_2_provider,
    pc2.price as product_2_price,
    p1.id as demand_1_id,
    p1.user_id as demand_1_consumer,
    p2.id as demand_2_id,
    p2.user_id as demand_2_consumer
  from slots s
  left join service_candidates sc1 on sc1.rn = 1
  left join service_candidates sc2 on sc2.rn = 2
  left join service_candidates sc3 on sc3.rn = 3
  left join product_candidates pc1 on pc1.rn = 1
  left join product_candidates pc2 on pc2.rn = 2
  left join post_candidates p1 on p1.rn = 1
  left join post_candidates p2 on p2.rn = 2
),
order_seed as (
  select
    '00000000-0000-4000-8000-000000000451'::uuid as id,
    r.service_1_id as listing_id,
    'service'::text as listing_type,
    case
      when r.fallback_consumer = r.service_1_provider then coalesce(r.fallback_provider, r.service_1_provider)
      else r.fallback_consumer
    end as consumer_id,
    r.service_1_provider as provider_id,
    r.service_1_price as price,
    'new_lead'::text as status
  from resolved r
  where r.service_1_id is not null and r.service_1_provider is not null

  union all

  select
    '00000000-0000-4000-8000-000000000452'::uuid,
    r.service_2_id,
    'service'::text,
    case
      when r.fallback_consumer = r.service_2_provider then coalesce(r.fallback_provider, r.service_2_provider)
      else r.fallback_consumer
    end,
    r.service_2_provider,
    r.service_2_price,
    'in_progress'::text
  from resolved r
  where r.service_2_id is not null and r.service_2_provider is not null

  union all

  select
    '00000000-0000-4000-8000-000000000453'::uuid,
    r.product_1_id,
    'product'::text,
    case
      when r.fallback_consumer = r.product_1_provider then coalesce(r.fallback_provider, r.product_1_provider)
      else r.fallback_consumer
    end,
    r.product_1_provider,
    r.product_1_price,
    'completed'::text
  from resolved r
  where r.product_1_id is not null and r.product_1_provider is not null

  union all

  select
    '00000000-0000-4000-8000-000000000454'::uuid,
    r.demand_1_id,
    'demand'::text,
    r.demand_1_consumer,
    coalesce(r.service_1_provider, r.fallback_provider),
    1750::numeric,
    'cancelled'::text
  from resolved r
  where r.demand_1_id is not null and r.demand_1_consumer is not null

  union all

  select
    '00000000-0000-4000-8000-000000000455'::uuid,
    r.service_3_id,
    'service'::text,
    case
      when r.fallback_consumer = r.service_3_provider then coalesce(r.fallback_provider, r.service_3_provider)
      else r.fallback_consumer
    end,
    r.service_3_provider,
    r.service_3_price,
    'closed'::text
  from resolved r
  where r.service_3_id is not null and r.service_3_provider is not null

  union all

  select
    '00000000-0000-4000-8000-000000000456'::uuid,
    coalesce(r.product_2_id, r.demand_2_id),
    case when r.product_2_id is not null then 'product' else 'demand' end::text,
    case
      when r.product_2_id is not null then
        case
          when r.fallback_consumer = r.product_2_provider then coalesce(r.fallback_provider, r.product_2_provider)
          else r.fallback_consumer
        end
      else r.demand_2_consumer
    end as consumer_id,
    coalesce(r.product_2_provider, r.service_2_provider, r.fallback_provider) as provider_id,
    coalesce(r.product_2_price, 2100::numeric) as price,
    'rejected'::text
  from resolved r
  where (r.product_2_id is not null or r.demand_2_id is not null)
)
insert into public.orders as o (
  id,
  listing_id,
  listing_type,
  consumer_id,
  provider_id,
  price,
  status
)
select
  os.id,
  os.listing_id,
  os.listing_type,
  os.consumer_id,
  os.provider_id,
  os.price,
  os.status
from order_seed os
where os.consumer_id is not null
  and os.provider_id is not null
on conflict (id) do update
set
  listing_id = excluded.listing_id,
  listing_type = excluded.listing_type,
  consumer_id = excluded.consumer_id,
  provider_id = excluded.provider_id,
  price = excluded.price,
  status = excluded.status;

-- ---------------------------------------------------------------------------
-- 2) TASK EVENTS
-- ---------------------------------------------------------------------------
delete from public.task_events
where order_id in (
  '00000000-0000-4000-8000-000000000451'::uuid,
  '00000000-0000-4000-8000-000000000452'::uuid,
  '00000000-0000-4000-8000-000000000453'::uuid,
  '00000000-0000-4000-8000-000000000454'::uuid,
  '00000000-0000-4000-8000-000000000455'::uuid,
  '00000000-0000-4000-8000-000000000456'::uuid
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
  metadata,
  created_at
)
select
  o.id,
  o.consumer_id,
  o.provider_id,
  case
    when e.actor_role = 'provider' then o.provider_id
    else o.consumer_id
  end as actor_id,
  e.event_type,
  e.previous_status,
  e.next_status,
  e.title,
  e.description,
  jsonb_build_object('seed', 'task_history_demo'),
  timezone('utc', now()) - e.offset_interval
from public.orders o
join (
  values
    (
      '00000000-0000-4000-8000-000000000451'::uuid,
      'consumer'::text,
      'created'::text,
      null::text,
      'new_lead'::text,
      'Task created'::text,
      'A fresh booking entered the queue and is waiting for provider action.'::text,
      interval '35 minutes'
    ),
    (
      '00000000-0000-4000-8000-000000000452'::uuid,
      'consumer'::text,
      'created'::text,
      null::text,
      'accepted'::text,
      'Task created'::text,
      'A scheduled service visit entered the live operations board.'::text,
      interval '5 hours 20 minutes'
    ),
    (
      '00000000-0000-4000-8000-000000000452'::uuid,
      'provider'::text,
      'status_changed'::text,
      'accepted'::text,
      'in_progress'::text,
      'Work started'::text,
      'The provider moved this order into active execution.'::text,
      interval '2 hours 40 minutes'
    ),
    (
      '00000000-0000-4000-8000-000000000453'::uuid,
      'consumer'::text,
      'created'::text,
      null::text,
      'accepted'::text,
      'Task accepted'::text,
      'A product order entered the fulfillment pipeline.'::text,
      interval '2 days 9 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000453'::uuid,
      'provider'::text,
      'status_changed'::text,
      'accepted'::text,
      'completed'::text,
      'Order completed'::text,
      'Delivery was confirmed and marked complete.'::text,
      interval '2 days 2 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000454'::uuid,
      'consumer'::text,
      'created'::text,
      null::text,
      'quoted'::text,
      'Quote received'::text,
      'A provider replied to the demand with a structured quote.'::text,
      interval '3 days 8 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000454'::uuid,
      'consumer'::text,
      'status_changed'::text,
      'quoted'::text,
      'cancelled'::text,
      'Order cancelled'::text,
      'The requester cancelled before the job started.'::text,
      interval '3 days 5 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000455'::uuid,
      'consumer'::text,
      'created'::text,
      null::text,
      'accepted'::text,
      'Task accepted'::text,
      'A historical service order entered the board for fulfillment.'::text,
      interval '5 days 12 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000455'::uuid,
      'provider'::text,
      'status_changed'::text,
      'accepted'::text,
      'completed'::text,
      'Task completed'::text,
      'The provider finished the service and requested closure.'::text,
      interval '5 days 7 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000455'::uuid,
      'consumer'::text,
      'status_changed'::text,
      'completed'::text,
      'closed'::text,
      'Order closed'::text,
      'The requester acknowledged completion and archived the workflow.'::text,
      interval '5 days 5 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000456'::uuid,
      'consumer'::text,
      'created'::text,
      null::text,
      'quoted'::text,
      'Quote under review'::text,
      'A second demand stayed in review while the provider adjusted pricing.'::text,
      interval '7 days 10 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000456'::uuid,
      'provider'::text,
      'price_updated'::text,
      'quoted'::text,
      'quoted'::text,
      'Quote revised'::text,
      'The provider revised the quote after reviewing the scope.'::text,
      interval '7 days 8 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000456'::uuid,
      'provider'::text,
      'status_changed'::text,
      'quoted'::text,
      'rejected'::text,
      'Order rejected'::text,
      'The provider declined the request after the scope changed.'::text,
      interval '7 days 6 hours'
    )
) as e(order_id, actor_role, event_type, previous_status, next_status, title, description, offset_interval)
  on e.order_id = o.id;

commit;
