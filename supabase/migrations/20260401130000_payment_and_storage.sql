-- ============================================================
-- ServiQ: Payment columns + listing-images Storage bucket
-- ============================================================

-- Add Razorpay payment tracking columns to orders
alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists notes text;

-- listing-images Storage bucket (created via Supabase Storage API,
-- this migration sets up the RLS policy so authenticated users can
-- upload their own images and everyone can read them publicly).

-- The bucket itself must be created in the Supabase dashboard:
--   Storage → New bucket → Name: listing-images → Public: ON

-- RLS: anyone can read listing images
drop policy if exists "listing_images_public_read" on storage.objects;
create policy "listing_images_public_read"
  on storage.objects for select
  using ( bucket_id = 'listing-images' );

-- RLS: authenticated user can upload to their own folder
drop policy if exists "listing_images_auth_insert" on storage.objects;
create policy "listing_images_auth_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS: owner can delete their own images
drop policy if exists "listing_images_owner_delete" on storage.objects;
create policy "listing_images_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
