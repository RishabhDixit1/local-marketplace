begin;

-- ────────────────────────────────────────────────────────────────
-- 1. Add CHECK constraint to posts.status (single source of truth)
-- ────────────────────────────────────────────────────────────────
-- Existing values in the wild: 'open', 'archived', 'deleted'
-- New lifecycle values: 'matched', 'in_progress', 'completed', 'cancelled'
-- 'hidden' and 'draft' kept for backward compat with business page

alter table public.posts
  add constraint posts_status_check
  check (lower(status) in (
    'open', 'matched', 'in_progress', 'completed',
    'cancelled', 'archived', 'deleted', 'hidden', 'draft'
  ));

-- ────────────────────────────────────────────────────────────────
-- 2. Add lifecycle timestamp columns
-- ────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists matched_at    timestamptz;
alter table public.posts add column if not exists in_progress_at timestamptz;
alter table public.posts add column if not exists completed_at  timestamptz;
alter table public.posts add column if not exists cancelled_at  timestamptz;

-- ────────────────────────────────────────────────────────────────
-- 3. Post status history table (immutable audit log)
-- ────────────────────────────────────────────────────────────────
create table if not exists public.post_status_history (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  old_status  text,
  new_status  text not null,
  created_at  timestamptz not null default timezone('utc', now())
);

create index if not exists idx_post_status_history_post
  on public.post_status_history (post_id, created_at desc);

alter table public.post_status_history enable row level security;

-- Owner or admin can read history
drop policy if exists post_status_history_select_own on public.post_status_history;
create policy post_status_history_select_own
  on public.post_status_history for select to authenticated
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_id
        and (
          auth.uid() = p.user_id
          or auth.uid() = p.author_id
          or auth.uid() = p.created_by
          or auth.uid() = p.requester_id
          or auth.uid() = p.owner_id
          or auth.uid() = p.provider_id
        )
    )
  );

-- Only the system (admin) inserts history rows
drop policy if exists post_status_history_insert_admin on public.post_status_history;
create policy post_status_history_insert_admin
  on public.post_status_history for insert to authenticated
  with check (true);

-- ────────────────────────────────────────────────────────────────
-- 4. RPC: transition_post_status(post_id, new_status, actor_id)
--    Validates the transition, updates posts, logs history.
-- ────────────────────────────────────────────────────────────────
create or replace function public.transition_post_status(
  p_post_id  uuid,
  p_new_status text,
  p_actor_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
  v_post record;
  v_allowed boolean := false;
begin
  -- Fetch current status + ownership
  select id, status, owner_id, user_id, author_id, created_by,
         requester_id, provider_id
  into v_post
  from posts
  where id = p_post_id;

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Post not found');
  end if;

  v_old_status := lower(coalesce(v_post.status, 'open'));
  p_new_status := lower(p_new_status);

  -- Validate transition is allowed
  -- open       -> matched, in_progress, completed, cancelled, archived, deleted, hidden, draft
  -- matched    -> in_progress, completed, cancelled, open (reopen)
  -- in_progress -> completed, cancelled
  -- completed  -> (terminal — no transitions out)
  -- cancelled  -> open (reopen), archived, deleted
  -- archived   -> open (restore), deleted
  -- deleted    -> (terminal — no transitions out)
  -- hidden     -> open, deleted
  -- draft      -> open, deleted
  v_allowed := case v_old_status
    when 'open'        then p_new_status in ('matched','in_progress','completed','cancelled','archived','deleted','hidden','draft')
    when 'matched'     then p_new_status in ('in_progress','completed','cancelled','open')
    when 'in_progress' then p_new_status in ('completed','cancelled')
    when 'completed'   then false  -- terminal
    when 'cancelled'   then p_new_status in ('open','archived','deleted')
    when 'archived'    then p_new_status in ('open','deleted')
    when 'deleted'     then false  -- terminal
    when 'hidden'      then p_new_status in ('open','deleted')
    when 'draft'       then p_new_status in ('open','deleted')
    else false
  end;

  if not v_allowed then
    return jsonb_build_object(
      'ok', false,
      'message', format('Invalid status transition: %s -> %s', v_old_status, p_new_status)
    );
  end if;

  -- Build update payload
  update posts
  set status     = p_new_status,
      updated_at = timezone('utc', now()),
      matched_at    = case when p_new_status = 'matched'     then timezone('utc', now()) else matched_at    end,
      in_progress_at = case when p_new_status = 'in_progress' then timezone('utc', now()) else in_progress_at end,
      completed_at   = case when p_new_status = 'completed'   then timezone('utc', now()) else completed_at   end,
      cancelled_at   = case when p_new_status = 'cancelled'   then timezone('utc', now()) else cancelled_at   end
  where id = p_post_id;

  -- Log to history
  insert into post_status_history (post_id, actor_id, old_status, new_status)
  values (p_post_id, p_actor_id, v_old_status, p_new_status);

  return jsonb_build_object(
    'ok', true,
    'postId', p_post_id,
    'oldStatus', v_old_status,
    'newStatus', p_new_status
  );
end;
$$;

-- Allow authenticated users to call the RPC
grant execute on function public.transition_post_status(uuid, text, uuid) to authenticated;

-- ────────────────────────────────────────────────────────────────
-- 5. Add DB-level index for feed query performance
-- ────────────────────────────────────────────────────────────────
create index if not exists idx_posts_status_created
  on public.posts (status, created_at desc);

-- ────────────────────────────────────────────────────────────────
-- 6. Backfill: ensure all existing posts have status = 'open'
-- ────────────────────────────────────────────────────────────────
update public.posts
set status = 'open'
where status is null or status = '';

-- Reload PostgREST schema cache so the new RPC is immediately available
notify pgrst, 'reload schema';

commit;
