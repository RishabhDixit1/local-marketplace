-- Security hardening + unread model for realtime marketplace tables
--
-- Scope:
--   - orders
--   - messages
--   - conversations
--   - conversation_participants
--   - reviews
--   - notifications
--
-- Also adds unread persistence support:
--   - conversation_participants.last_read_at
--   - notifications read/clear model
--
-- Also adds geo primitives:
--   - profiles.latitude
--   - profiles.longitude

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
        'notifications'
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

commit;
