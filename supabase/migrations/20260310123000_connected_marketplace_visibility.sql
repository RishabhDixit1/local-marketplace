begin;

create table if not exists public.live_talk_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (lower(status) in ('pending', 'accepted', 'declined', 'ended', 'cancelled')),
  mode text not null default 'audio_video'
    check (lower(mode) in ('audio_video')),
  metadata jsonb not null default '{}'::jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (caller_id <> recipient_id)
);

alter table public.live_talk_requests add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.live_talk_requests add column if not exists caller_id uuid references auth.users(id) on delete cascade;
alter table public.live_talk_requests add column if not exists recipient_id uuid references auth.users(id) on delete cascade;
alter table public.live_talk_requests add column if not exists status text not null default 'pending';
alter table public.live_talk_requests add column if not exists mode text not null default 'audio_video';
alter table public.live_talk_requests add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.live_talk_requests add column if not exists responded_at timestamptz;
alter table public.live_talk_requests add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.live_talk_requests add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists idx_live_talk_requests_conversation_created
  on public.live_talk_requests (conversation_id, created_at desc);

create index if not exists idx_live_talk_requests_recipient_status
  on public.live_talk_requests (recipient_id, status, created_at desc);

create unique index if not exists idx_live_talk_requests_pending_conversation
  on public.live_talk_requests (conversation_id)
  where lower(status) = 'pending';

drop trigger if exists trg_live_talk_requests_updated_at on public.live_talk_requests;
create trigger trg_live_talk_requests_updated_at
before update on public.live_talk_requests
for each row
execute function public.set_updated_at();

create or replace function public.is_connection_accepted(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.connection_requests cr
    where lower(coalesce(cr.status, 'pending')) = 'accepted'
      and (
        (cr.requester_id = user_a and cr.recipient_id = user_b)
        or
        (cr.requester_id = user_b and cr.recipient_id = user_a)
      )
  );
$$;

grant execute on function public.is_connection_accepted(uuid, uuid) to authenticated;

create or replace function public.get_or_create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  conversation_id uuid;
  direct_conversation_key text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = actor_id then
    raise exception 'A different recipient is required';
  end if;

  if not public.is_connection_accepted(actor_id, target_user_id) then
    raise exception 'Connect before starting a direct chat';
  end if;

  direct_conversation_key := public.make_direct_conversation_key(actor_id, target_user_id);

  insert into public.conversations (kind, created_by, direct_key, metadata)
  values ('direct', actor_id, direct_conversation_key, jsonb_build_object('participant_count', 2))
  on conflict (direct_key) do update
    set updated_at = timezone('utc', now())
  returning id into conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (conversation_id, actor_id),
    (conversation_id, target_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return conversation_id;
end;
$$;

grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

drop policy if exists posts_select_visible on public.posts;

create policy posts_select_visible
on public.posts
for select
to authenticated
using (
  auth.uid() = user_id
  or auth.uid() = author_id
  or auth.uid() = created_by
  or auth.uid() = requester_id
  or auth.uid() = owner_id
  or auth.uid() = provider_id
  or (
    lower(coalesce(status, state, 'open')) not in ('cancelled', 'canceled', 'closed', 'completed', 'fulfilled', 'archived', 'deleted', 'draft', 'hidden')
    and (
      lower(coalesce(visibility, 'public')) in ('public', 'community', 'marketplace')
      or (
        lower(coalesce(visibility, 'public')) in ('connections', 'network', 'contacts')
        and public.is_connection_accepted(
          auth.uid(),
          coalesce(user_id, author_id, created_by, requester_id, owner_id, provider_id)
        )
      )
    )
  )
);

drop policy if exists conversation_participants_insert_self_or_creator on public.conversation_participants;

create policy conversation_participants_insert_self_or_creator
on public.conversation_participants
for insert
to authenticated
with check (user_id = auth.uid());

alter table public.live_talk_requests enable row level security;

drop policy if exists live_talk_requests_select_participant on public.live_talk_requests;
drop policy if exists live_talk_requests_insert_caller on public.live_talk_requests;
drop policy if exists live_talk_requests_update_participant on public.live_talk_requests;
drop policy if exists live_talk_requests_delete_participant on public.live_talk_requests;

create policy live_talk_requests_select_participant
on public.live_talk_requests
for select
to authenticated
using (auth.uid() = caller_id or auth.uid() = recipient_id);

create policy live_talk_requests_insert_caller
on public.live_talk_requests
for insert
to authenticated
with check (
  caller_id = auth.uid()
  and caller_id <> recipient_id
  and public.is_conversation_participant(conversation_id, caller_id)
  and public.is_conversation_participant(conversation_id, recipient_id)
  and public.is_connection_accepted(caller_id, recipient_id)
);

create policy live_talk_requests_update_participant
on public.live_talk_requests
for update
to authenticated
using (auth.uid() = caller_id or auth.uid() = recipient_id)
with check (auth.uid() = caller_id or auth.uid() = recipient_id);

create policy live_talk_requests_delete_participant
on public.live_talk_requests
for delete
to authenticated
using (auth.uid() = caller_id or auth.uid() = recipient_id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.live_talk_requests';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
