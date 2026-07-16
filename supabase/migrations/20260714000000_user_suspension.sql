-- Add suspension columns to profiles
alter table public.profiles
  add column if not exists is_suspended boolean not null default false;

alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add column if not exists suspended_reason text;

-- Prevent suspended users from inserting/updating via RLS
-- (The auth middleware already blocks API calls, but this is defense-in-depth)

-- Create a helper to check suspension status
create or replace function public.is_user_suspended(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_suspended from public.profiles where id = uid),
    false
  );
$$;

-- Suspend: deny all writes for suspended users on key tables
-- These policies are additive with existing policies (RLS uses OR logic across permissive policies)

-- Orders: suspended users cannot create or update orders
drop policy if exists orders_insert_suspended_block on public.orders;
create policy orders_insert_suspended_block
on public.orders for insert to authenticated
with check (not public.is_user_suspended(auth.uid()));

drop policy if exists orders_update_suspended_block on public.orders;
create policy orders_update_suspended_block
on public.orders for update to authenticated
using (not public.is_user_suspended(auth.uid()));

-- Messages: suspended users cannot send messages
drop policy if exists messages_insert_suspended_block on public.messages;
create policy messages_insert_suspended_block
on public.messages for insert to authenticated
with check (not public.is_user_suspended(auth.uid()));

-- Help requests: suspended users cannot create help requests
drop policy if exists help_requests_insert_suspended_block on public.help_requests;
create policy help_requests_insert_suspended_block
on public.help_requests for insert to authenticated
with check (not public.is_user_suspended(auth.uid()));
