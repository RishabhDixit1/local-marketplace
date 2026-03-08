-- Realtime tab demo seed for Chat / Tasks / People
-- Safe to re-run (deterministic IDs + conflict handling).
--
-- Seeds:
--   1) orders
--   2) task_events
--   3) reviews
--   4) conversations
--   5) conversation_participants
--   6) messages
--
-- Prerequisites:
--   - At least one row in auth.users
--   - Prefer running seed_dashboard_demo.sql first for richer listings/posts

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
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
service_candidates as (
  select id, provider_id, price, row_number() over (order by id) as rn
  from public.service_listings
  limit 3
),
product_candidates as (
  select id, provider_id, price, row_number() over (order by id) as rn
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
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as fallback_consumer,
    coalesce(s.u2, s.u1) as fallback_provider,
    sc1.id as service_1_id,
    sc1.provider_id as service_1_provider,
    coalesce(sc1.price, 699) as service_1_price,
    sc2.id as service_2_id,
    sc2.provider_id as service_2_provider,
    coalesce(sc2.price, 999) as service_2_price,
    pc1.id as product_1_id,
    pc1.provider_id as product_1_provider,
    coalesce(pc1.price, 349) as product_1_price,
    p1.id as demand_1_id,
    p1.user_id as demand_1_consumer,
    p2.id as demand_2_id,
    p2.user_id as demand_2_consumer
  from slots s
  left join service_candidates sc1 on sc1.rn = 1
  left join service_candidates sc2 on sc2.rn = 2
  left join product_candidates pc1 on pc1.rn = 1
  left join post_candidates p1 on p1.rn = 1
  left join post_candidates p2 on p2.rn = 2
),
order_seed as (
  select
    '00000000-0000-4000-8000-000000000401'::uuid as id,
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
    '00000000-0000-4000-8000-000000000402'::uuid as id,
    r.service_2_id as listing_id,
    'service'::text as listing_type,
    case
      when r.fallback_consumer = r.service_2_provider then coalesce(r.fallback_provider, r.service_2_provider)
      else r.fallback_consumer
    end as consumer_id,
    r.service_2_provider as provider_id,
    r.service_2_price as price,
    'accepted'::text as status
  from resolved r
  where r.service_2_id is not null and r.service_2_provider is not null

  union all

  select
    '00000000-0000-4000-8000-000000000403'::uuid as id,
    r.product_1_id as listing_id,
    'product'::text as listing_type,
    case
      when r.fallback_consumer = r.product_1_provider then coalesce(r.fallback_provider, r.product_1_provider)
      else r.fallback_consumer
    end as consumer_id,
    r.product_1_provider as provider_id,
    r.product_1_price as price,
    'completed'::text as status
  from resolved r
  where r.product_1_id is not null and r.product_1_provider is not null

  union all

  select
    '00000000-0000-4000-8000-000000000404'::uuid as id,
    r.demand_1_id as listing_id,
    'demand'::text as listing_type,
    r.demand_1_consumer as consumer_id,
    coalesce(r.service_1_provider, r.fallback_provider) as provider_id,
    1800::numeric as price,
    'quoted'::text as status
  from resolved r
  where r.demand_1_id is not null and r.demand_1_consumer is not null

  union all

  select
    '00000000-0000-4000-8000-000000000405'::uuid as id,
    r.demand_2_id as listing_id,
    'demand'::text as listing_type,
    r.demand_2_consumer as consumer_id,
    coalesce(r.service_2_provider, r.fallback_provider) as provider_id,
    2400::numeric as price,
    'cancelled'::text as status
  from resolved r
  where r.demand_2_id is not null and r.demand_2_consumer is not null
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
where os.consumer_id is not null and os.provider_id is not null
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
  '00000000-0000-4000-8000-000000000401'::uuid,
  '00000000-0000-4000-8000-000000000402'::uuid,
  '00000000-0000-4000-8000-000000000403'::uuid,
  '00000000-0000-4000-8000-000000000404'::uuid,
  '00000000-0000-4000-8000-000000000405'::uuid
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
    when e.event_type in ('status_changed', 'price_updated') then coalesce(o.provider_id, o.consumer_id)
    else o.consumer_id
  end,
  e.event_type,
  e.previous_status,
  e.next_status,
  e.title,
  e.description,
  jsonb_build_object('seed', 'realtime_tabs_demo'),
  timezone('utc', now()) - e.offset_interval
from public.orders o
join (
  values
    (
      '00000000-0000-4000-8000-000000000401'::uuid,
      'created'::text,
      null::text,
      'new_lead'::text,
      'Task created'::text,
      'Weekend cleaning request entered the live queue.'::text,
      interval '5 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000402'::uuid,
      'created'::text,
      null::text,
      'new_lead'::text,
      'Task created'::text,
      'Emergency plumbing request entered the live queue.'::text,
      interval '2 hours 20 minutes'
    ),
    (
      '00000000-0000-4000-8000-000000000402'::uuid,
      'status_changed'::text,
      'new_lead'::text,
      'accepted'::text,
      'Quote accepted'::text,
      'The provider accepted the emergency visit and moved it into execution.'::text,
      interval '2 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000402'::uuid,
      'price_updated'::text,
      'accepted'::text,
      'accepted'::text,
      'Quote amount updated'::text,
      'The final visit value was confirmed for the provider workflow.'::text,
      interval '1 hour 50 minutes'
    ),
    (
      '00000000-0000-4000-8000-000000000403'::uuid,
      'created'::text,
      null::text,
      'accepted'::text,
      'Task accepted'::text,
      'Switchboard safety kit order entered the delivery pipeline.'::text,
      interval '2 days 4 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000403'::uuid,
      'status_changed'::text,
      'accepted'::text,
      'completed'::text,
      'Task completed'::text,
      'The product order was delivered and confirmed by the requester.'::text,
      interval '2 days'
    ),
    (
      '00000000-0000-4000-8000-000000000404'::uuid,
      'created'::text,
      null::text,
      'quoted'::text,
      'Quote sent'::text,
      'A provider responded to the open demand with a structured quote.'::text,
      interval '7 hours'
    ),
    (
      '00000000-0000-4000-8000-000000000405'::uuid,
      'created'::text,
      null::text,
      'cancelled'::text,
      'Task cancelled'::text,
      'The requester closed this demand before the workflow started.'::text,
      interval '1 day 3 hours'
    )
) as e(order_id, event_type, previous_status, next_status, title, description, offset_interval)
  on e.order_id = o.id;

-- ---------------------------------------------------------------------------
-- 3) REVIEWS
-- ---------------------------------------------------------------------------
-- Keep seeded comments deterministic; remove/reinsert by seed marker.
delete from public.reviews where comment like '[seed-demo] %';

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
review_seed as (
  select *
  from (
    values
      (1, 1, 6, 5, '[seed-demo] Excellent response time and clear communication.'),
      (2, 2, 6, 4, '[seed-demo] Good quality work, arrived on schedule.'),
      (3, 3, 6, 5, '[seed-demo] Professional and reliable service.'),
      (4, 1, 2, 4, '[seed-demo] Completed task well and explained every step.'),
      (5, 2, 1, 5, '[seed-demo] Smooth experience, would book again.')
  ) as t(seed_key, provider_slot, reviewer_slot, rating, comment)
),
resolved_reviews as (
  select
    case rs.provider_slot
      when 1 then s.u1
      when 2 then coalesce(s.u2, s.u1)
      when 3 then coalesce(s.u3, s.u2, s.u1)
      when 4 then coalesce(s.u4, s.u3, s.u2, s.u1)
      else coalesce(s.u5, s.u4, s.u3, s.u2, s.u1)
    end as provider_id,
    case rs.reviewer_slot
      when 1 then s.u1
      when 2 then coalesce(s.u2, s.u1)
      when 3 then coalesce(s.u3, s.u2, s.u1)
      when 4 then coalesce(s.u4, s.u3, s.u2, s.u1)
      when 5 then coalesce(s.u5, s.u4, s.u3, s.u2, s.u1)
      else coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1)
    end as reviewer_id,
    rs.rating,
    rs.comment
  from review_seed rs
  cross join slots s
)
insert into public.reviews (
  provider_id,
  reviewer_id,
  rating,
  comment
)
select
  rr.provider_id,
  rr.reviewer_id,
  rr.rating,
  rr.comment
from resolved_reviews rr
where rr.provider_id is not null
  and rr.reviewer_id is not null
  and rr.provider_id <> rr.reviewer_id;

-- ---------------------------------------------------------------------------
-- 4) CONVERSATIONS + PARTICIPANTS + MESSAGES
-- ---------------------------------------------------------------------------
with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.conversations as c (id, created_by)
select
  '00000000-0000-4000-8000-000000000501'::uuid,
  r.consumer
from resolved r
where r.consumer is not null
on conflict (id) do update
set created_by = excluded.created_by;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.conversations as c (id, created_by)
select
  '00000000-0000-4000-8000-000000000502'::uuid,
  r.consumer
from resolved r
where r.consumer is not null
on conflict (id) do update
set created_by = excluded.created_by;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.conversation_participants (conversation_id, user_id)
select '00000000-0000-4000-8000-000000000501'::uuid, r.consumer
from resolved r
where r.consumer is not null
on conflict do nothing;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.conversation_participants (conversation_id, user_id)
select '00000000-0000-4000-8000-000000000501'::uuid, r.provider_1
from resolved r
where r.provider_1 is not null
on conflict do nothing;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.conversation_participants (conversation_id, user_id)
select '00000000-0000-4000-8000-000000000502'::uuid, r.consumer
from resolved r
where r.consumer is not null
on conflict do nothing;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.conversation_participants (conversation_id, user_id)
select '00000000-0000-4000-8000-000000000502'::uuid, r.provider_2
from resolved r
where r.provider_2 is not null
on conflict do nothing;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.messages as m (id, conversation_id, sender_id, content)
select
  '00000000-0000-4000-8000-000000000601'::uuid,
  '00000000-0000-4000-8000-000000000501'::uuid,
  r.consumer,
  '[seed-demo] Hi, are you available today for a quick visit?'
from resolved r
where r.consumer is not null
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sender_id = excluded.sender_id,
  content = excluded.content;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.messages as m (id, conversation_id, sender_id, content)
select
  '00000000-0000-4000-8000-000000000602'::uuid,
  '00000000-0000-4000-8000-000000000501'::uuid,
  r.provider_1,
  '[seed-demo] Yes, I can reach in about 30 minutes.'
from resolved r
where r.provider_1 is not null
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sender_id = excluded.sender_id,
  content = excluded.content;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.messages as m (id, conversation_id, sender_id, content)
select
  '00000000-0000-4000-8000-000000000603'::uuid,
  '00000000-0000-4000-8000-000000000502'::uuid,
  r.consumer,
  '[seed-demo] Can you share a quote for weekend deep cleaning?'
from resolved r
where r.consumer is not null
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sender_id = excluded.sender_id,
  content = excluded.content;

with base_users as (
  select id, row_number() over (order by created_at asc) as rn
  from auth.users
  order by created_at asc
  limit 6
),
slots as (
  select
    max(case when rn = 1 then id end) as u1,
    max(case when rn = 2 then id end) as u2,
    max(case when rn = 3 then id end) as u3,
    max(case when rn = 4 then id end) as u4,
    max(case when rn = 5 then id end) as u5,
    max(case when rn = 6 then id end) as u6
  from base_users
),
resolved as (
  select
    coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1) as consumer,
    coalesce(s.u1, s.u2) as provider_1,
    coalesce(s.u2, s.u1) as provider_2
  from slots s
)
insert into public.messages as m (id, conversation_id, sender_id, content)
select
  '00000000-0000-4000-8000-000000000604'::uuid,
  '00000000-0000-4000-8000-000000000502'::uuid,
  r.provider_2,
  '[seed-demo] Sure, starting at INR 1499 depending on scope.'
from resolved r
where r.provider_2 is not null
on conflict (id) do update
set
  conversation_id = excluded.conversation_id,
  sender_id = excluded.sender_id,
  content = excluded.content;

commit;
