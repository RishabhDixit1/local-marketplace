-- Round 11 launch-grade polish: storefront content integrity + feed data hygiene.
--
-- Root causes fixed here (found in the Phase 1 audit):
-- 1. 20260818000000_storefronts_and_products.sql seeded every storefront with
--    the same templated About line ("Quality services and products available
--    at X. Visit us or order online."), a null cover, and the identical three
--    placeholder products regardless of what the business sells.
-- 2. Test/garbage posts ("Need 2 red bull / 1 gold flake", "ytrfghj",
--    "test mobile", plus two internal meta posts) sat at status='open' and
--    rendered on every feed surface.
-- 3. One scraped provider name was garbled beyond readability
--    ("Ro sevice ro repair ro water purifire").
-- 4. "The tailor shop" existed twice (manual entry + Google Places import,
--    coordinates ~2m apart). The older copy had no orders/reviews/storefront.

-- ---------------------------------------------------------------------------
-- 1. Storefronts: real category + factual About line derived from business data
-- ---------------------------------------------------------------------------
update public.storefronts s
set category = v.category,
    description = v.description,
    updated_at = timezone('utc', now())
from (values
  ('Purushottam Mobile & Watch Repairs', 'Mobile Repair',
    'Mobile phone and watch repair shop at Paramount Spectrum Complex, Crossings Republik. Screen and battery replacements, software fixes, and watch servicing - walk in or send a message to check availability.'),
  ('BAM BAM BHOLE MOBILE SHOP', 'Mobile Shop',
    'Mobile shop near Noida Extension, Shahberi. Handsets, covers, chargers, and everyday accessories plus repair support - message to check stock before you visit.'),
  ('S M Cool Ac Repair Service, Installation & Rent', 'AC & Cooling',
    'AC repair, installation, and rental service based in Shahberi, Greater Noida. Doorstep visits for split and window ACs across nearby societies, with same-day service on request.'),
  ('Aashif Interior Shop', 'Interior & Furniture',
    'Interior and furniture shop at Mahagun Mascot, Crossings Republik. Fittings, wallpaper, false ceiling, and custom interior work - visit the shop or enquire for a site visit.'),
  ('Durga Ro tech', 'RO Service',
    'RO and water purifier service center on Chipiyana Bujurg Road, Ghaziabad. Installation, routine servicing, filter replacement, and repairs for all major brands.')
) as v(name, category, description)
where s.name = v.name;

-- ---------------------------------------------------------------------------
-- 2. Products: replace the universal 3-product template with per-category sets
-- ---------------------------------------------------------------------------
delete from public.product_catalog
where storefront_id is not null
  and title in ('Basic Service Package', 'Premium Service Package', 'Spare Parts Kit');

-- Purushottam Mobile & Watch Repairs (Mobile Repair)
insert into public.product_catalog (provider_id, storefront_id, title, description, category, price, stock, delivery_method)
select s.owner_id, s.id, v.title, v.description, v.category, v.price, v.stock, v.delivery_method
from public.storefronts s, (values
  ('Screen Replacement', 'Grade-A screen replacement for Android phones, fitted while you wait', 'Mobile Repair', 999::numeric, 15, 'both'),
  ('Battery Replacement', 'Original-specification battery swap with 6-month service warranty', 'Mobile Repair', 649::numeric, 20, 'both'),
  ('Watch Service', 'Watch battery change, strap replacement, and minor repairs', 'Mobile Repair', 299::numeric, 25, 'both')
) as v(title, description, category, price, stock, delivery_method)
where s.name = 'Purushottam Mobile & Watch Repairs';

-- BAM BAM BHOLE MOBILE SHOP (Mobile Shop)
insert into public.product_catalog (provider_id, storefront_id, title, description, category, price, stock, delivery_method)
select s.owner_id, s.id, v.title, v.description, v.category, v.price, v.stock, v.delivery_method
from public.storefronts s, (values
  ('Tempered Glass', 'Scratch-resistant tempered glass, fitted free with purchase', 'Mobile Accessories', 99::numeric, 50, 'both'),
  ('Back Cover', 'Assorted back covers for popular models - ask for your device', 'Mobile Accessories', 199::numeric, 40, 'both'),
  ('Charger & Cable Combo', 'Fast-charging wall adapter with braided cable', 'Mobile Accessories', 449::numeric, 30, 'delivery')
) as v(title, description, category, price, stock, delivery_method)
where s.name = 'BAM BAM BHOLE MOBILE SHOP';

-- S M Cool Ac Repair Service, Installation & Rent (AC & Cooling)
insert into public.product_catalog (provider_id, storefront_id, title, description, category, price, stock, delivery_method)
select s.owner_id, s.id, v.title, v.description, v.category, v.price, v.stock, v.delivery_method
from public.storefronts s, (values
  ('Split AC Service', 'Jet-wash deep cleaning of filters, coil, and drain line', 'AC & Cooling', 549::numeric, 10, 'both'),
  ('AC Installation or Uninstallation', 'Standard split-AC install or removal including piping check', 'AC & Cooling', 1499::numeric, 5, 'both'),
  ('AC Gas Refill', 'R32 gas top-up with leak check for split ACs', 'AC & Cooling', 2499::numeric, 5, 'both')
) as v(title, description, category, price, stock, delivery_method)
where s.name = 'S M Cool Ac Repair Service, Installation & Rent';

-- Aashif Interior Shop (Interior & Furniture)
insert into public.product_catalog (provider_id, storefront_id, title, description, category, price, stock, delivery_method)
select s.owner_id, s.id, v.title, v.description, v.category, v.price, v.stock, v.delivery_method
from public.storefronts s, (values
  ('Wallpaper Installation', 'Per-wall wallpaper fitting with premium finishes', 'Interior & Furniture', 899::numeric, 12, 'both'),
  ('False Ceiling Work', 'Gypsum false ceiling, priced per square foot including material', 'Interior & Furniture', 95::numeric, 8, 'both'),
  ('Interior Site Visit', 'On-site measurement and design consultation adjusted against final bill', 'Interior & Furniture', 499::numeric, 10, 'both')
) as v(title, description, category, price, stock, delivery_method)
where s.name = 'Aashif Interior Shop';

-- Durga Ro tech (RO Service)
insert into public.product_catalog (provider_id, storefront_id, title, description, category, price, stock, delivery_method)
select s.owner_id, s.id, v.title, v.description, v.category, v.price, v.stock, v.delivery_method
from public.storefronts s, (values
  ('RO Service & Filter Check', 'Full servicing with sediment and carbon filter inspection', 'RO Service', 399::numeric, 15, 'both'),
  ('Complete Filter Set Replacement', 'Pre-carbon, RO membrane, and post-carbon replaced in one visit', 'RO Service', 1499::numeric, 10, 'both'),
  ('New RO Installation', 'Wall-mount installation of a new purifier including tubing', 'RO Service', 799::numeric, 10, 'both')
) as v(title, description, category, price, stock, delivery_method)
where s.name = 'Durga Ro tech';

-- ---------------------------------------------------------------------------
-- 3. Feed hygiene: soft-delete test/garbage/internal posts (status='deleted'
--    matches existing practice; feed surfaces only render status='open')
-- ---------------------------------------------------------------------------
update public.posts
set status = 'deleted', updated_at = timezone('utc', now())
where status = 'open'
  and id in (
    'f0285cd7-5fa6-40a6-9fd9-592b45a3f3d2', -- "Need 2 red bull / 1 gold flake..." shopping-list junk
    'e386cae4-9829-45b8-b5c6-6ecbf3e43d25', -- "ytrfghj" keyboard mash
    '69231a9e-dfbb-4ba0-befe-8a9643781127', -- "test mobile"
    'd44ae97a-2b57-4abe-9064-6ad554cf1be9', -- internal release announcement
    '2973e26c-15e2-446f-8e03-8e905b888b01'  -- internal meta post ("What's ServiQ?")
  );

-- ---------------------------------------------------------------------------
-- 4. Listing name hygiene + true duplicate removal
-- ---------------------------------------------------------------------------
-- Garbled scraped name -> readable professional name (same shop, Mahagun Mart).
update public.profiles
set full_name = 'RO Service Point - Mahagun Mart',
    updated_at = timezone('utc', now())
where id = '11b9a05a-04fd-4a75-b540-8cd42ea9b913'
  and full_name = 'Ro sevice ro repair ro water purifire';

-- Remove the older duplicate of The Tailor Shop (coords ~2m apart; the May 24
-- import is kept). Guarded so re-runs stay safe.
delete from public.profiles
where id = 'fceceed7-c8ce-4a57-a383-fbb6265ea104'
  and exists (
    select 1 from public.profiles newer
    where newer.id = '563c15ff-96aa-446c-9df3-cdd9d4ce5040'
      and newer.full_name ilike '%tailor shop%'
  );
