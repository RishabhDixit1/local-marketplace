-- Persist welcome feed save/share interactions per authenticated user.
-- Safe to re-run.

begin;

create table if not exists public.feed_card_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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

alter table if exists public.feed_card_saves
  drop constraint if exists feed_card_saves_user_id_fkey;

alter table if exists public.feed_card_saves
  add constraint feed_card_saves_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table if exists public.feed_card_saves
  drop constraint if exists uq_feed_card_saves_user_card;

alter table if exists public.feed_card_saves
  add constraint uq_feed_card_saves_user_card
  unique (user_id, card_id);

create index if not exists idx_feed_card_saves_user_created
  on public.feed_card_saves (user_id, created_at desc);

create index if not exists idx_feed_card_saves_focus
  on public.feed_card_saves (focus_id, card_type);

create table if not exists public.feed_card_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_id text not null,
  focus_id text not null,
  card_type text not null check (card_type in ('demand', 'service', 'product')),
  title text not null,
  channel text not null default 'clipboard' check (channel in ('native', 'clipboard')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.feed_card_shares
  drop constraint if exists feed_card_shares_user_id_fkey;

alter table if exists public.feed_card_shares
  add constraint feed_card_shares_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

create index if not exists idx_feed_card_shares_user_created
  on public.feed_card_shares (user_id, created_at desc);

create index if not exists idx_feed_card_shares_card
  on public.feed_card_shares (card_id, created_at desc);

alter table if exists public.feed_card_saves enable row level security;
alter table if exists public.feed_card_shares enable row level security;

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

commit;
