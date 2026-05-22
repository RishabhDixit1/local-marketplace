begin;

create table if not exists public.google_business_tokens (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scope text,
  google_account_email text,
  google_account_name text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_gbt_provider on public.google_business_tokens(provider_id) where is_active = true;
create index idx_gbt_expires on public.google_business_tokens(token_expires_at) where is_active = true;

alter table public.google_business_tokens enable row level security;

-- Only the owner can see their own tokens
create policy "Provider selects own tokens"
  on public.google_business_tokens for select
  using (provider_id = auth.uid());

-- Insert allowed for own id
create policy "Provider inserts own tokens"
  on public.google_business_tokens for insert
  with check (provider_id = auth.uid());

-- Update allowed for own tokens
create policy "Provider updates own tokens"
  on public.google_business_tokens for update
  using (provider_id = auth.uid());

-- Delete allowed for own tokens
create policy "Provider deletes own tokens"
  on public.google_business_tokens for delete
  using (provider_id = auth.uid());

-- Trigger for updated_at
create trigger set_updated_at before update on public.google_business_tokens
  for each row execute function public.set_updated_at();

alter publication supabase_realtime add table public.google_business_tokens;

commit;
