-- Crossing Republik locality zones seed
-- Safe to re-run (upserts by deterministic IDs).
--
-- What this seeds:
--   1) Societies (residential zones, phase 1)
--   2) Markets (commercial zones, phase 1)
--   3) Supply areas (service/warehouse zones, phase 1)
--   4) Expansion zones (upcoming, phase 2)
--
-- Run this in the Supabase SQL editor after migrations are applied.
-- Then set locality_id on existing provider profiles to link them to zones.

begin;

insert into public.localities (id, name, slug, zone_type, phase, lat, lng, radius_km, city, state)
values
  -- Societies (phase 1)
  ('b1000000-0000-0000-0000-000000000001', 'Mahagun Mascot', 'mahagun-mascot', 'society', 1, 28.649, 77.441, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000002', 'Mahagun Montage', 'mahagun-montage', 'society', 1, 28.651, 77.438, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000003', 'Panchsheel Wellington', 'panchsheel-wellington', 'society', 1, 28.645, 77.437, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000004', 'Supertech Livingston', 'supertech-livingston', 'society', 1, 28.648, 77.435, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000005', 'Assotech The Nest', 'assotech-the-nest', 'society', 1, 28.644, 77.442, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000006', 'Ajnara Gen X', 'ajnara-gen-x', 'society', 1, 28.644, 77.438, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000007', 'Saviour Greenisle', 'saviour-greenisle', 'society', 1, 28.647, 77.440, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000008', 'Paramount Symphony', 'paramount-symphony', 'society', 1, 28.646, 77.437, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-000000000009', 'Exotica Eastern Court', 'exotica-eastern-court', 'society', 1, 28.650, 77.443, 0.5, 'Ghaziabad', 'Uttar Pradesh'),
  ('b1000000-0000-0000-0000-00000000000a', 'Arihant Ambience', 'arihant-ambience', 'society', 1, 28.643, 77.440, 0.5, 'Ghaziabad', 'Uttar Pradesh'),

  -- Markets (phase 1)
  ('b2000000-0000-0000-0000-000000000001', 'Galleria Market 1', 'galleria-market-1', 'market', 1, 28.643, 77.442, 0.3, 'Ghaziabad', 'Uttar Pradesh'),
  ('b2000000-0000-0000-0000-000000000002', 'Galleria Market 2', 'galleria-market-2', 'market', 1, 28.642, 77.443, 0.3, 'Ghaziabad', 'Uttar Pradesh'),
  ('b2000000-0000-0000-0000-000000000003', 'Avantika Retail Street', 'avantika-retail-street', 'market', 1, 28.641, 77.440, 0.3, 'Ghaziabad', 'Uttar Pradesh'),
  ('b2000000-0000-0000-0000-000000000004', 'Panchsheel Square', 'panchsheel-square', 'market', 1, 28.646, 77.436, 0.3, 'Ghaziabad', 'Uttar Pradesh'),
  ('b2000000-0000-0000-0000-000000000005', 'Paramount Spectrum', 'paramount-spectrum', 'market', 1, 28.647, 77.441, 0.3, 'Ghaziabad', 'Uttar Pradesh'),
  ('b2000000-0000-0000-0000-000000000006', 'City Plaza', 'city-plaza', 'market', 1, 28.640, 77.444, 0.3, 'Ghaziabad', 'Uttar Pradesh'),

  -- Supply areas (phase 1)
  ('b3000000-0000-0000-0000-000000000001', 'NH-24 Service Belt', 'nh-24-service-belt', 'supply_area', 1, 28.650, 77.445, 1.0, 'Ghaziabad', 'Uttar Pradesh'),
  ('b3000000-0000-0000-0000-000000000002', 'CR Commercial Zone', 'cr-commercial-zone', 'supply_area', 1, 28.645, 77.444, 0.8, 'Ghaziabad', 'Uttar Pradesh'),

  -- Expansion zones (phase 2 — upcoming)
  ('b4000000-0000-0000-0000-000000000001', 'Phase 2 Residential', 'phase-2-residential', 'expansion', 2, 28.655, 77.435, 1.0, 'Ghaziabad', 'Uttar Pradesh'),
  ('b4000000-0000-0000-0000-000000000002', 'Tech Park Zone', 'tech-park-zone', 'expansion', 2, 28.638, 77.448, 1.0, 'Ghaziabad', 'Uttar Pradesh')
on conflict (id) do nothing;

commit;
