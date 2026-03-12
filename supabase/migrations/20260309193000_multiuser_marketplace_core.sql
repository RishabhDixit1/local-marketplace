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
