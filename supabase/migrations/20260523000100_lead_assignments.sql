begin;

create table if not exists public.lead_assignments (
  id uuid primary key default gen_random_uuid(),
  help_request_id uuid not null references public.help_requests(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  workspace_member_id uuid references auth.users(id) on delete set null,
  score numeric not null default 0,
  score_breakdown jsonb not null default '{}'::jsonb,
  assigned_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  status text not null default 'assigned'
    check (lower(status) in ('assigned', 'viewed', 'responded', 'expired', 'converted', 'lost')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_lead_assignments_provider_status
  on public.lead_assignments (provider_id, status, assigned_at desc);

create index if not exists idx_lead_assignments_help_request
  on public.lead_assignments (help_request_id, assigned_at desc);

create index if not exists idx_lead_assignments_score
  on public.lead_assignments (score desc) where status = 'assigned';

drop trigger if exists trg_lead_assignments_updated_at on public.lead_assignments;
create trigger trg_lead_assignments_updated_at
before update on public.lead_assignments
for each row
execute function public.set_updated_at();

alter table public.lead_assignments enable row level security;

drop policy if exists lead_assignments_select_provider on public.lead_assignments;
drop policy if exists lead_assignments_select_consumer on public.lead_assignments;
drop policy if exists lead_assignments_insert_system on public.lead_assignments;
drop policy if exists lead_assignments_update_own on public.lead_assignments;

create policy lead_assignments_select_provider
on public.lead_assignments
for select
to authenticated
using (provider_id = auth.uid());

create policy lead_assignments_select_consumer
on public.lead_assignments
for select
to authenticated
using (
  exists (
    select 1 from public.help_requests hr
    where hr.id = help_request_id
      and hr.requester_id = auth.uid()
  )
);

create policy lead_assignments_insert_system
on public.lead_assignments
for insert
to authenticated
with check (
  provider_id = auth.uid()
);

create policy lead_assignments_update_own
on public.lead_assignments
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.lead_assignments';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
