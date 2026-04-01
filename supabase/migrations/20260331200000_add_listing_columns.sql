-- Add missing columns to service_listings and product_catalog
-- These columns are referenced in application code but were absent from
-- earlier migrations, causing profile-page queries to fail silently.

-- pricing_type on service_listings (used by buildServiceWritePayload)
alter table public.service_listings
  add column if not exists pricing_type text not null default 'fixed';

-- delivery_method, image_url, image_path on product_catalog
alter table public.product_catalog
  add column if not exists delivery_method text not null default 'delivery';

alter table public.product_catalog
  add column if not exists image_url text;

alter table public.product_catalog
  add column if not exists image_path text;
