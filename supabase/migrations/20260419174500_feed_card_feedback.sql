begin;

create table if not exists public.feed_card_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id text not null,
  focus_id text not null,
  card_type text not null check (card_type in ('demand', 'service', 'product')),
  feedback_type text not null check (feedback_type in ('hide', 'report')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.feed_card_feedback add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.feed_card_feedback add column if not exists card_id text;
alter table public.feed_card_feedback add column if not exists focus_id text;
alter table public.feed_card_feedback add column if not exists card_type text;
alter table public.feed_card_feedback add column if not exists feedback_type text;
alter table public.feed_card_feedback add column if not exists reason text;
alter table public.feed_card_feedback add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.feed_card_feedback add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.feed_card_feedback add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists idx_feed_card_feedback_user_feedback_card
  on public.feed_card_feedback (user_id, feedback_type, card_id);

create index if not exists idx_feed_card_feedback_user_created
  on public.feed_card_feedback (user_id, created_at desc);

create index if not exists idx_feed_card_feedback_focus_type
  on public.feed_card_feedback (focus_id, feedback_type);

drop trigger if exists trg_feed_card_feedback_updated_at on public.feed_card_feedback;
create trigger trg_feed_card_feedback_updated_at
before update on public.feed_card_feedback
for each row
execute function public.set_updated_at();

alter table public.feed_card_feedback enable row level security;

drop policy if exists feed_card_feedback_select_own on public.feed_card_feedback;
create policy feed_card_feedback_select_own
on public.feed_card_feedback
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists feed_card_feedback_insert_own on public.feed_card_feedback;
create policy feed_card_feedback_insert_own
on public.feed_card_feedback
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists feed_card_feedback_update_own on public.feed_card_feedback;
create policy feed_card_feedback_update_own
on public.feed_card_feedback
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists feed_card_feedback_delete_own on public.feed_card_feedback;
create policy feed_card_feedback_delete_own
on public.feed_card_feedback
for delete
to authenticated
using (user_id = auth.uid());

do $$
begin
  if exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'feed_card_feedback'
  ) then
    null;
  else
    alter publication supabase_realtime add table public.feed_card_feedback;
  end if;
exception
  when undefined_object then
    null;
end $$;

commit;
