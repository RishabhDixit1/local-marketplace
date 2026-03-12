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
