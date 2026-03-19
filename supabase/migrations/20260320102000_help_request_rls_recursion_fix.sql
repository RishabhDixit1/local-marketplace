create or replace function public.is_help_request_provider(
  target_help_request_id uuid,
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
    from public.help_request_matches hrm
    where hrm.help_request_id = target_help_request_id
      and hrm.provider_id = target_user_id
  );
$$;

grant execute on function public.is_help_request_provider(uuid, uuid) to authenticated;

drop policy if exists help_requests_select_visible on public.help_requests;

create policy help_requests_select_visible
on public.help_requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or public.is_help_request_provider(id, auth.uid())
);
