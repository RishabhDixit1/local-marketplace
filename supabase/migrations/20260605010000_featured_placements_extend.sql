-- Extend featured_placements with listing targeting and payment tracking

alter table public.featured_placements
  add column if not exists listing_id uuid references public.service_listings(id) on delete set null,
  add column if not exists price_paise integer not null default 0,
  add column if not exists payment_id text,
  add column if not exists razorpay_order_id text;

create index if not exists idx_featured_placements_listing
  on public.featured_placements (listing_id);

-- RLS: providers can insert their own
drop policy if exists featured_placements_insert_own on public.featured_placements;
create policy featured_placements_insert_own
  on public.featured_placements
  for insert
  to authenticated
  with check (provider_id = auth.uid());
