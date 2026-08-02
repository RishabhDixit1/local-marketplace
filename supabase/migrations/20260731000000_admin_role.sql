-- Add is_admin column to profiles for server-side admin role verification
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Grant service_role can update is_admin
create policy profiles_update_admin_only on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
