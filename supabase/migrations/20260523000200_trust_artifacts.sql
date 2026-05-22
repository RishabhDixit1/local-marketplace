begin;

create table if not exists public.trust_artifacts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  artifact_type text not null
    check (lower(artifact_type) in (
      'badge', 'certification', 'proof_of_work', 'customer_testimonial',
      'training', 'portfolio', 'insurance', 'guarantee'
    )),
  title text not null,
  description text,
  media_url text,
  media_type text,
  is_verified boolean not null default false,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_trust_artifacts_provider_type
  on public.trust_artifacts (provider_id, artifact_type, created_at desc);

create index if not exists idx_trust_artifacts_verified
  on public.trust_artifacts (provider_id, is_verified) where is_verified = true;

drop trigger if exists trg_trust_artifacts_updated_at on public.trust_artifacts;
create trigger trg_trust_artifacts_updated_at
before update on public.trust_artifacts
for each row
execute function public.set_updated_at();

alter table public.trust_artifacts enable row level security;

drop policy if exists trust_artifacts_select_public on public.trust_artifacts;
drop policy if exists trust_artifacts_insert_own on public.trust_artifacts;
drop policy if exists trust_artifacts_update_own on public.trust_artifacts;
drop policy if exists trust_artifacts_delete_own on public.trust_artifacts;

create policy trust_artifacts_select_public
on public.trust_artifacts
for select
to anon, authenticated
using (true);

create policy trust_artifacts_insert_own
on public.trust_artifacts
for insert
to authenticated
with check (provider_id = auth.uid());

create policy trust_artifacts_update_own
on public.trust_artifacts
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

create policy trust_artifacts_delete_own
on public.trust_artifacts
for delete
to authenticated
using (provider_id = auth.uid());

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.trust_artifacts';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
