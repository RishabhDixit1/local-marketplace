begin;

create table if not exists public.manual_offerings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  thumbnail_url text,
  price numeric,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_manual_offerings_profile_id
  on public.manual_offerings (profile_id, sort_order, created_at desc);

alter table public.manual_offerings enable row level security;

create policy "Anyone can view manual offerings"
  on public.manual_offerings
  for select
  using (true);

create policy "Owners can insert their own offerings"
  on public.manual_offerings
  for insert
  with check (profile_id = auth.uid());

create policy "Owners can update their own offerings"
  on public.manual_offerings
  for update
  using (profile_id = auth.uid());

create policy "Owners can delete their own offerings"
  on public.manual_offerings
  for delete
  using (profile_id = auth.uid());

create or replace trigger set_manual_offerings_updated_at
  before update on public.manual_offerings
  for each row
  execute procedure public.set_updated_at();

commit;
