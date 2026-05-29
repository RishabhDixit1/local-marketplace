begin;

-- ── Verification Documents ──
create table if not exists public.verification_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (
    lower(document_type) in ('id_proof', 'address_proof', 'business_license', 'professional_certificate', 'insurance', 'guarantee')
  ),
  file_url text not null,
  status text not null default 'pending' check (
    lower(status) in ('pending', 'approved', 'rejected')
  ),
  reviewer_notes text,
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_verification_documents_profile
  on public.verification_documents (profile_id, status);

-- Add verification_status to profiles
alter table public.profiles
  add column if not exists verification_status text not null default 'unverified'
  check (lower(verification_status) in ('unverified', 'pending', 'verified', 'rejected'));

-- ── Referral Payouts ──
create table if not exists public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  points_redeemed integer not null check (points_redeemed > 0),
  status text not null default 'pending' check (
    lower(status) in ('pending', 'processing', 'completed', 'failed')
  ),
  payout_method text default 'bank' check (
    lower(payout_method) in ('bank', 'upi', 'wallet')
  ),
  payout_detail text,
  processed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_referral_payouts_user
  on public.referral_payouts (user_id, status);

-- Default reward: 50 pts = ₹50
alter table public.referral_codes
  alter column reward_points set default 50;

-- ── SEO-friendly locality slugs ──
alter table public.localities
  add column if not exists meta_title text,
  add column if not exists meta_description text;

-- ── Triggers ──
drop trigger if exists trg_verification_documents_updated_at on public.verification_documents;
create trigger trg_verification_documents_updated_at
  before update on public.verification_documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_referral_payouts_updated_at on public.referral_payouts;
create trigger trg_referral_payouts_updated_at
  before update on public.referral_payouts
  for each row execute function public.set_updated_at();

-- ── RLS ──
alter table public.verification_documents enable row level security;
alter table public.referral_payouts enable row level security;

-- verification_documents: owner read/insert, admin can read all
create policy verification_documents_select_own on public.verification_documents
  for select to authenticated using (profile_id = auth.uid());
create policy verification_documents_insert_own on public.verification_documents
  for insert to authenticated with check (profile_id = auth.uid());
create policy verification_documents_select_admin on public.verification_documents
  for select to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- referral_payouts: owner read/insert, admin all
create policy referral_payouts_select_own on public.referral_payouts
  for select to authenticated using (user_id = auth.uid());
create policy referral_payouts_insert_own on public.referral_payouts
  for insert to authenticated with check (user_id = auth.uid());
create policy referral_payouts_select_admin on public.referral_payouts
  for select to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
create policy referral_payouts_update_admin on public.referral_payouts
  for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── Storage bucket ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS: authenticated can upload to own folder
create policy verification_docs_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: owner can read own docs, admin can read all
create policy verification_docs_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
  );

-- RLS: owner can delete own docs
create policy verification_docs_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Realtime ──
do $$ begin if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
  begin execute 'alter publication supabase_realtime add table public.verification_documents'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.referral_payouts'; exception when duplicate_object then null; end;
end if; end $$;

commit;
