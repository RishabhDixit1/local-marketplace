begin;

create table if not exists public.business_launchpad_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft',
  input_source text not null default 'manual',
  answers jsonb not null default '{}'::jsonb,
  import_payload jsonb not null default '{}'::jsonb,
  generated_profile jsonb not null default '{}'::jsonb,
  generated_services jsonb not null default '[]'::jsonb,
  generated_products jsonb not null default '[]'::jsonb,
  generated_faq jsonb not null default '[]'::jsonb,
  generated_service_areas jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_business_launchpad_drafts_owner_updated
  on public.business_launchpad_drafts (owner_id, updated_at desc);

drop trigger if exists trg_business_launchpad_drafts_updated_at on public.business_launchpad_drafts;
create trigger trg_business_launchpad_drafts_updated_at
before update on public.business_launchpad_drafts
for each row
execute function public.set_updated_at();

alter table public.business_launchpad_drafts enable row level security;

drop policy if exists business_launchpad_drafts_select_own on public.business_launchpad_drafts;
drop policy if exists business_launchpad_drafts_insert_own on public.business_launchpad_drafts;
drop policy if exists business_launchpad_drafts_update_own on public.business_launchpad_drafts;
drop policy if exists business_launchpad_drafts_delete_own on public.business_launchpad_drafts;

create policy business_launchpad_drafts_select_own
on public.business_launchpad_drafts
for select
to authenticated
using (owner_id = auth.uid());

create policy business_launchpad_drafts_insert_own
on public.business_launchpad_drafts
for insert
to authenticated
with check (owner_id = auth.uid());

create policy business_launchpad_drafts_update_own
on public.business_launchpad_drafts
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy business_launchpad_drafts_delete_own
on public.business_launchpad_drafts
for delete
to authenticated
using (owner_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.business_launchpad_drafts';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
