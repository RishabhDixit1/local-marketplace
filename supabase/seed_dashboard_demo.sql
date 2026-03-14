-- ServiQ demo seed for unified dashboard visuals
-- Safe to re-run (upserts by deterministic IDs).
--
-- What this seeds:
--   1) profiles
--   2) service_listings
--   3) product_catalog
--   4) posts
--   5) help_requests (+ starter matches when table exists)
--
-- Important:
--   - This script reuses existing auth.users IDs to satisfy common FK setups.
--   - Create at least one user first (via app magic-link auth), then run this script.
--   - With more users, data is distributed across more provider accounts.

begin;

do $$
begin
  if not exists (select 1 from auth.users) then
    raise notice 'No rows found in auth.users. Create at least one account, then re-run this seed script.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1) PROFILES
-- ---------------------------------------------------------------------------
with base_users as (
  select id, email, row_number() over (order by created_at asc) as rn
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
profile_templates as (
  select *
  from (
    values
      (1, 1, 'Aditi Electricals', 'business', 'Koramangala, Bengaluru', 12.935200::double precision, 77.624500::double precision,
       'Licensed electrician for homes, offices, and emergency fixes. Fast onsite support.',
       array['Electrician','Wiring','Emergency Repair']::text[],
       'available', '+91 98765 11111', 'https://aditi-electricals.example',
       'https://i.pravatar.cc/300?img=12'),

      (2, 2, 'Rahul Plumbing Works', 'business', 'HSR Layout, Bengaluru', 12.911600::double precision, 77.647300::double precision,
       'Trusted plumbing expert for leakage, bathroom fittings, and pipeline repairs.',
       array['Plumber','Leak Fix','Bathroom Fittings']::text[],
       'available', '+91 98765 22222', 'https://rahul-plumbing.example',
       'https://i.pravatar.cc/300?img=32'),

      (3, 3, 'Meera Clean Team', 'provider', 'Indiranagar, Bengaluru', 12.978400::double precision, 77.640800::double precision,
       'Deep cleaning and move-in cleaning for homes and small offices.',
       array['Cleaning','Deep Clean','Move-in Service']::text[],
       'busy', '+91 98765 33333', 'https://meera-clean.example',
       'https://i.pravatar.cc/300?img=47'),

      (4, 4, 'QuickFix Appliance Care', 'provider', 'BTM Layout, Bengaluru', 12.916600::double precision, 77.610100::double precision,
       'Appliance troubleshooting and same-day repair support for AC, fridge, and washing machine.',
       array['Repair','AC Service','Appliance Care']::text[],
       'available', '+91 98765 44444', 'https://quickfix-care.example',
       'https://i.pravatar.cc/300?img=19'),

      (5, 5, 'FreshCart Local', 'provider', 'Jayanagar, Bengaluru', 12.925000::double precision, 77.593800::double precision,
       'Local grocery and essentials with fast neighborhood delivery slots.',
       array['Grocery','Delivery','Daily Essentials']::text[],
       'available', '+91 98765 55555', 'https://freshcart-local.example',
       'https://i.pravatar.cc/300?img=56'),

      (6, 6, 'Local Buyer', 'seeker', 'Bengaluru', 12.971600::double precision, 77.594600::double precision,
       'Looking for reliable local providers for home tasks and quick requirements.',
       array['Home Services']::text[],
       'available', '+91 98765 66666', 'https://local-buyer.example',
       'https://i.pravatar.cc/300?img=8')
  ) as t(seed_key, user_slot, name, role, location, latitude, longitude, bio, services, availability, phone, website, avatar_url)
),
resolved_profiles as (
  select
    t.seed_key,
    case t.user_slot
      when 1 then s.u1
      when 2 then coalesce(s.u2, s.u1)
      when 3 then coalesce(s.u3, s.u2, s.u1)
      when 4 then coalesce(s.u4, s.u3, s.u2, s.u1)
      when 5 then coalesce(s.u5, s.u4, s.u3, s.u2, s.u1)
      else coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1)
    end as user_id,
    t.name,
    t.role,
    t.location,
    t.latitude,
    t.longitude,
    t.bio,
    t.services,
    t.availability,
    t.phone,
    t.website,
    t.avatar_url
  from profile_templates t
  cross join slots s
)
insert into public.profiles as p (
  id,
  name,
  role,
  location,
  latitude,
  longitude,
  bio,
  services,
  availability,
  email,
  phone,
  website,
  avatar_url
)
select
  rp.user_id,
  rp.name,
  rp.role,
  rp.location,
  rp.latitude,
  rp.longitude,
  rp.bio,
  rp.services,
  rp.availability,
  coalesce(u.email, 'demo+' || rp.seed_key::text || '@serviq.test'),
  rp.phone,
  rp.website,
  rp.avatar_url
from resolved_profiles rp
left join auth.users u on u.id = rp.user_id
where rp.user_id is not null
on conflict (id) do update
set
  role = coalesce(nullif(p.role, ''), excluded.role),
  location = coalesce(nullif(p.location, ''), excluded.location),
  latitude = coalesce(p.latitude, excluded.latitude),
  longitude = coalesce(p.longitude, excluded.longitude),
  bio = case when coalesce(length(trim(p.bio)), 0) = 0 then excluded.bio else p.bio end,
  services = case when coalesce(array_length(p.services, 1), 0) = 0 then excluded.services else p.services end,
  availability = coalesce(nullif(p.availability, ''), excluded.availability),
  email = coalesce(nullif(p.email, ''), excluded.email),
  phone = coalesce(nullif(p.phone, ''), excluded.phone),
  website = coalesce(nullif(p.website, ''), excluded.website),
  avatar_url = coalesce(nullif(p.avatar_url, ''), excluded.avatar_url);

-- ---------------------------------------------------------------------------
-- 2) SERVICE LISTINGS
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
    max(case when rn = 5 then id end) as u5
  from base_users
),
service_seed as (
  select *
  from (
    values
      ('00000000-0000-4000-8000-000000000101'::uuid, 1, 'Emergency Electrician Visit',
       'Same-day diagnosis for tripping, short circuit, or wiring issue.',
       'Electrician', 'fixed', 699::numeric, 'available'),

      ('00000000-0000-4000-8000-000000000102'::uuid, 2, 'Kitchen Leakage Repair',
       'Leak detection and pipe/faucet fixes with quick turnaround.',
       'Plumber', 'fixed', 799::numeric, 'available'),

      ('00000000-0000-4000-8000-000000000103'::uuid, 3, '2BHK Deep Cleaning',
       'Room-by-room deep cleaning with equipment and supplies included.',
       'Cleaning', 'fixed', 1499::numeric, 'busy'),

      ('00000000-0000-4000-8000-000000000104'::uuid, 4, 'Split AC Service & Checkup',
       'Filter cleaning, coil check, and cooling performance tune-up.',
       'Repair', 'fixed', 999::numeric, 'available'),

      ('00000000-0000-4000-8000-000000000105'::uuid, 5, 'Neighborhood Grocery Delivery',
       'Doorstep delivery for essentials within 60-90 minutes.',
       'Delivery', 'negotiable', 199::numeric, 'available')
  ) as t(id, provider_slot, title, description, category, pricing_type, price, availability)
),
resolved_services as (
  select
    s.id,
    case s.provider_slot
      when 1 then sl.u1
      when 2 then coalesce(sl.u2, sl.u1)
      when 3 then coalesce(sl.u3, sl.u2, sl.u1)
      when 4 then coalesce(sl.u4, sl.u3, sl.u2, sl.u1)
      else coalesce(sl.u5, sl.u4, sl.u3, sl.u2, sl.u1)
    end as provider_id,
    s.title,
    s.description,
    s.category,
    s.pricing_type,
    s.price,
    s.availability
  from service_seed s
  cross join slots sl
)
insert into public.service_listings as sl (
  id,
  provider_id,
  title,
  description,
  category,
  pricing_type,
  price,
  availability
)
select
  rs.id,
  rs.provider_id,
  rs.title,
  rs.description,
  rs.category,
  rs.pricing_type,
  rs.price,
  rs.availability
from resolved_services rs
where rs.provider_id is not null
on conflict (id) do update
set
  provider_id = excluded.provider_id,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  pricing_type = excluded.pricing_type,
  price = excluded.price,
  availability = excluded.availability;

-- ---------------------------------------------------------------------------
-- 3) PRODUCT CATALOG
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
    max(case when rn = 5 then id end) as u5
  from base_users
),
product_seed as (
  select *
  from (
    values
      ('00000000-0000-4000-8000-000000000201'::uuid, 5, 'Daily Essentials Combo',
       'Milk, bread, eggs, and pantry basics for quick same-day fulfillment.',
       'Grocery', 349::numeric, 20::integer, 'delivery',
       'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80'),

      ('00000000-0000-4000-8000-000000000202'::uuid, 4, 'AC Cleaning Kit',
       'Technician-grade cleaning kit for seasonal AC maintenance.',
       'Home Maintenance', 599::numeric, 14::integer, 'both',
       'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80'),

      ('00000000-0000-4000-8000-000000000203'::uuid, 2, 'Premium Bathroom Fittings Set',
       'Durable faucet and shower fittings for modern bathroom upgrades.',
       'Plumbing', 1499::numeric, 8::integer, 'pickup',
       'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&q=80'),

      ('00000000-0000-4000-8000-000000000204'::uuid, 1, 'Switchboard Safety Kit',
       'Essential electrical safety set for preventive home maintenance.',
       'Electrical', 899::numeric, 11::integer, 'both',
       'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=1200&q=80')
  ) as t(id, provider_slot, title, description, category, price, stock, delivery_method, image_url)
),
resolved_products as (
  select
    p.id,
    case p.provider_slot
      when 1 then sl.u1
      when 2 then coalesce(sl.u2, sl.u1)
      when 3 then coalesce(sl.u3, sl.u2, sl.u1)
      when 4 then coalesce(sl.u4, sl.u3, sl.u2, sl.u1)
      else coalesce(sl.u5, sl.u4, sl.u3, sl.u2, sl.u1)
    end as provider_id,
    p.title,
    p.description,
    p.category,
    p.price,
    p.stock,
    p.delivery_method,
    p.image_url
  from product_seed p
  cross join slots sl
)
insert into public.product_catalog as pc (
  id,
  provider_id,
  title,
  description,
  category,
  price,
  stock,
  delivery_method,
  image_url
)
select
  rp.id,
  rp.provider_id,
  rp.title,
  rp.description,
  rp.category,
  rp.price,
  rp.stock,
  rp.delivery_method,
  rp.image_url
from resolved_products rp
where rp.provider_id is not null
on conflict (id) do update
set
  provider_id = excluded.provider_id,
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  price = excluded.price,
  stock = excluded.stock,
  delivery_method = excluded.delivery_method,
  image_url = excluded.image_url;

-- ---------------------------------------------------------------------------
-- 4) POSTS (demand-first content for marketplace feed)
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
post_seed as (
  select *
  from (
    values
      ('00000000-0000-4000-8000-000000000301'::uuid, 6,
       'Need Electrician for Frequent Power Tripping',
       'Need inspection and fix for frequent MCB tripping in a 2BHK apartment.',
       'Within 24 hours', 2500::numeric, 'Electrician', 'Koramangala'),

      ('00000000-0000-4000-8000-000000000302'::uuid, 6,
       'Urgent Kitchen Leakage Repair Needed',
       'Water leakage under sink and near pipe joint, need urgent help today.',
       'Today', 1800::numeric, 'Plumber', 'HSR Layout'),

      ('00000000-0000-4000-8000-000000000303'::uuid, 6,
       'Weekend Deep Cleaning for 2BHK',
       'Looking for a reliable team for deep cleaning before guests arrive.',
       'This week', 2200::numeric, 'Cleaning', 'Indiranagar'),

      ('00000000-0000-4000-8000-000000000304'::uuid, 6,
       'Need AC Service Before Summer Starts',
       'Split AC cooling is weak. Need full service and checkup.',
       'Within 24 hours', 1600::numeric, 'Repair', 'BTM Layout')
  ) as t(id, author_slot, title, details, needed_window, budget, category, location)
),
resolved_posts as (
  select
    p.id,
    case p.author_slot
      when 1 then s.u1
      when 2 then coalesce(s.u2, s.u1)
      when 3 then coalesce(s.u3, s.u2, s.u1)
      when 4 then coalesce(s.u4, s.u3, s.u2, s.u1)
      when 5 then coalesce(s.u5, s.u4, s.u3, s.u2, s.u1)
      else coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1)
    end as author_id,
    p.title,
    p.details,
    p.needed_window,
    p.budget,
    p.category,
    p.location,
    (
      p.title || ' | ' ||
      p.details || ' | ' ||
      'Type: need | ' ||
      'Mode: urgent | ' ||
      'Needed: ' || p.needed_window || ' | ' ||
      'Budget: INR ' || p.budget::text || ' | ' ||
      'Category: ' || p.category || ' | ' ||
      'Location: ' || p.location || ' | ' ||
      'Timing: Fixed | ' ||
      'Media: None'
    ) as composed_text
  from post_seed p
  cross join slots s
)
insert into public.posts as p (
  id,
  user_id,
  type,
  post_type,
  status,
  title,
  text,
  content,
  description
)
select
  rp.id,
  rp.author_id,
  'need',
  'need',
  'open',
  rp.title,
  rp.composed_text,
  rp.composed_text,
  rp.composed_text
from resolved_posts rp
where rp.author_id is not null
on conflict (id) do update
set
  user_id = excluded.user_id,
  type = excluded.type,
  post_type = excluded.post_type,
  status = excluded.status,
  title = excluded.title,
  text = excluded.text,
  content = excluded.content,
  description = excluded.description;

-- ---------------------------------------------------------------------------
-- 5) HELP REQUESTS + STARTER MATCHES
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
help_request_seed as (
  select *
  from (
    values
      ('00000000-0000-4000-8000-000000000401'::uuid, 6,
       'Need urgent electrician for short-circuit issue',
       'Main switch trips repeatedly. Need inspection and fix quickly.',
       'Electrician', 'urgent', 1500::numeric, 3000::numeric,
       'Koramangala, Bengaluru', 12.935200::double precision, 77.624500::double precision, 8::integer, 'matched'),

      ('00000000-0000-4000-8000-000000000402'::uuid, 6,
       'Looking for deep cleaning team this weekend',
       '2BHK deep cleaning before family event, preferred Saturday morning.',
       'Cleaning', 'week', 1800::numeric, 2800::numeric,
       'Indiranagar, Bengaluru', 12.978400::double precision, 77.640800::double precision, 10::integer, 'matched')
  ) as t(id, requester_slot, title, details, category, urgency, budget_min, budget_max, location_label, latitude, longitude, radius_km, status)
),
resolved_help_requests as (
  select
    h.id,
    case h.requester_slot
      when 1 then s.u1
      when 2 then coalesce(s.u2, s.u1)
      when 3 then coalesce(s.u3, s.u2, s.u1)
      when 4 then coalesce(s.u4, s.u3, s.u2, s.u1)
      when 5 then coalesce(s.u5, s.u4, s.u3, s.u2, s.u1)
      else coalesce(s.u6, s.u5, s.u4, s.u3, s.u2, s.u1)
    end as requester_id,
    h.title,
    h.details,
    h.category,
    h.urgency,
    h.budget_min,
    h.budget_max,
    h.location_label,
    h.latitude,
    h.longitude,
    h.radius_km,
    h.status
  from help_request_seed h
  cross join slots s
)
insert into public.help_requests as hr (
  id,
  requester_id,
  title,
  details,
  category,
  urgency,
  budget_min,
  budget_max,
  location_label,
  latitude,
  longitude,
  radius_km,
  status,
  metadata,
  matched_count
)
select
  rh.id,
  rh.requester_id,
  rh.title,
  rh.details,
  rh.category,
  rh.urgency,
  rh.budget_min,
  rh.budget_max,
  rh.location_label,
  rh.latitude,
  rh.longitude,
  rh.radius_km,
  rh.status,
  jsonb_build_object('seed', true),
  2
from resolved_help_requests rh
where rh.requester_id is not null
on conflict (id) do update
set
  requester_id = excluded.requester_id,
  title = excluded.title,
  details = excluded.details,
  category = excluded.category,
  urgency = excluded.urgency,
  budget_min = excluded.budget_min,
  budget_max = excluded.budget_max,
  location_label = excluded.location_label,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  radius_km = excluded.radius_km,
  status = excluded.status,
  metadata = excluded.metadata;

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
    max(case when rn = 5 then id end) as u5
  from base_users
),
match_seed as (
  select *
  from (
    values
      ('00000000-0000-4000-8000-000000000401'::uuid, 1, 94::double precision, 1.8::double precision, 'Great category + nearby fit'),
      ('00000000-0000-4000-8000-000000000401'::uuid, 4, 88::double precision, 3.4::double precision, 'Fast response and strong completion'),
      ('00000000-0000-4000-8000-000000000402'::uuid, 3, 93::double precision, 1.2::double precision, 'Strong category fit'),
      ('00000000-0000-4000-8000-000000000402'::uuid, 5, 81::double precision, 4.6::double precision, 'Nearby provider')
  ) as t(help_request_id, provider_slot, score, distance_km, reason)
),
resolved_matches as (
  select
    m.help_request_id,
    case m.provider_slot
      when 1 then s.u1
      when 2 then coalesce(s.u2, s.u1)
      when 3 then coalesce(s.u3, s.u2, s.u1)
      when 4 then coalesce(s.u4, s.u3, s.u2, s.u1)
      else coalesce(s.u5, s.u4, s.u3, s.u2, s.u1)
    end as provider_id,
    m.score,
    m.distance_km,
    m.reason
  from match_seed m
  cross join slots s
)
insert into public.help_request_matches as hrm (
  help_request_id,
  provider_id,
  score,
  distance_km,
  reason,
  status,
  metadata
)
select
  rm.help_request_id,
  rm.provider_id,
  rm.score,
  rm.distance_km,
  rm.reason,
  'suggested',
  jsonb_build_object('seed', true)
from resolved_matches rm
where rm.provider_id is not null
on conflict (help_request_id, provider_id) do update
set
  score = excluded.score,
  distance_km = excluded.distance_km,
  reason = excluded.reason,
  status = excluded.status,
  metadata = excluded.metadata;

update public.help_requests hr
set
  matched_count = (
    select count(*)
    from public.help_request_matches hrm
    where hrm.help_request_id = hr.id
  ),
  status = case
    when exists (select 1 from public.help_request_matches hrm where hrm.help_request_id = hr.id) then 'matched'
    else hr.status
  end
where hr.id in (
  '00000000-0000-4000-8000-000000000401'::uuid,
  '00000000-0000-4000-8000-000000000402'::uuid
);

commit;
