-- New market zone localities (phase 2 — upcoming)
-- Safe to re-run (upserts by deterministic IDs).
--
-- What this seeds:
--   1) Shahberi — commercial markets (Ghaziabad, UP, zone a000...002)
--   2) Gaur City 1 — commercial markets (Ghaziabad, UP, zone a000...003)
--   3) Gaur City 2 — commercial markets (Ghaziabad, UP, zone a000...004)
--   4) Greater Noida West — expansion sector commercial areas (Greater Noida, UP, zone a000...005)
--
-- NOTE: society localities for these zones are currently unresearched.
-- TODO: add society rows once names are confirmed.
--
-- All rows are phase=2 (not live yet).
--
-- Run this in the Supabase SQL editor after migrations and the original CR seed.

begin;

insert into public.localities (id, name, slug, zone_type, phase, lat, lng, radius_km, city, state, zone_id)
values
  -- ═══════════════════════════════════════════
  -- Shahberi — Ghaziabad, Uttar Pradesh
  -- ═══════════════════════════════════════════
  ('e2100001-0000-0000-0000-000000000001', 'Shahberi Main Market', 'shahberi-main-market', 'market', 2, 28.642, 77.392, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000002'),
  ('e2100001-0000-0000-0000-000000000002', 'Shahberi Sabzi Market', 'shahberi-sabzi-market', 'market', 2, 28.641, 77.390, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000002'),
  ('e2100001-0000-0000-0000-000000000003', 'Shahberi Furniture Market', 'shahberi-furniture-market', 'market', 2, 28.643, 77.391, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000002'),
  ('e2100001-0000-0000-0000-000000000004', 'Shahberi Building Material Market', 'shahberi-building-material-market', 'market', 2, 28.640, 77.393, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000002'),
  ('e2100001-0000-0000-0000-000000000005', 'Shahberi Daily Needs Market', 'shahberi-daily-needs-market', 'market', 2, 28.641, 77.391, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000002'),
  ('e2100001-0000-0000-0000-000000000006', 'Shahberi Main Road Commercial Stretch', 'shahberi-main-road-commercial-stretch', 'market', 2, 28.642, 77.389, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000002'),

  -- ═══════════════════════════════════════════
  -- Gaur City 1 — Ghaziabad, Uttar Pradesh
  -- ═══════════════════════════════════════════
  ('e2200001-0000-0000-0000-000000000001', 'Gaur City Plaza', 'gaur-city-plaza', 'market', 2, 28.601, 77.428, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000003'),
  ('e2200001-0000-0000-0000-000000000002', 'Gaur City Centre', 'gaur-city-centre', 'market', 2, 28.600, 77.429, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000003'),
  ('e2200001-0000-0000-0000-000000000003', 'Galaxy Plaza', 'galaxy-plaza', 'market', 2, 28.602, 77.427, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000003'),
  ('e2200001-0000-0000-0000-000000000004', 'Gaur City 1 Commercial Arcades', 'gaur-city-1-commercial-arcades', 'market', 2, 28.600, 77.426, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000003'),
  ('e2200001-0000-0000-0000-000000000005', 'Gaur City 1 Food Streets', 'gaur-city-1-food-streets', 'market', 2, 28.603, 77.428, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000003'),

  -- ═══════════════════════════════════════════
  -- Gaur City 2 — Ghaziabad, Uttar Pradesh
  -- ═══════════════════════════════════════════
  ('e2300001-0000-0000-0000-000000000001', 'Gaur City Mall', 'gaur-city-mall', 'market', 2, 28.592, 77.421, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000004'),
  ('e2300001-0000-0000-0000-000000000002', 'Gaur City Commercial Belt', 'gaur-city-commercial-belt', 'market', 2, 28.591, 77.420, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000004'),
  ('e2300001-0000-0000-0000-000000000003', 'Gaur City 2 Retail Plaza', 'gaur-city-2-retail-plaza', 'market', 2, 28.593, 77.422, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000004'),
  ('e2300001-0000-0000-0000-000000000004', 'Gaur City 2 Food Court & Restaurant Zone', 'gaur-city-2-food-court-restaurant-zone', 'market', 2, 28.590, 77.421, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000004'),
  ('e2300001-0000-0000-0000-000000000005', 'Gaur City 2 Daily Needs Market', 'gaur-city-2-daily-needs-market', 'market', 2, 28.591, 77.423, 0.3, 'Ghaziabad', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000004'),

  -- ═══════════════════════════════════════════
  -- Greater Noida West — Greater Noida, Uttar Pradesh
  -- ═══════════════════════════════════════════
  ('e2400001-0000-0000-0000-000000000001', 'Techzone 4 Market', 'techzone-4-market', 'market', 2, 28.565, 77.453, 0.3, 'Greater Noida', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000005'),
  ('e2400001-0000-0000-0000-000000000002', 'Noida Extension Market', 'noida-extension-market', 'market', 2, 28.568, 77.455, 0.3, 'Greater Noida', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000005'),
  ('e2400001-0000-0000-0000-000000000003', 'Sector 1 Commercial Area', 'sector-1-commercial-area', 'market', 2, 28.560, 77.450, 0.3, 'Greater Noida', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000005'),
  ('e2400001-0000-0000-0000-000000000004', 'Sector 2 Commercial Area', 'sector-2-commercial-area', 'market', 2, 28.562, 77.452, 0.3, 'Greater Noida', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000005'),
  ('e2400001-0000-0000-0000-000000000005', 'Sector 16B Commercial Area', 'sector-16b-commercial-area', 'market', 2, 28.563, 77.451, 0.3, 'Greater Noida', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000005'),
  ('e2400001-0000-0000-0000-000000000006', 'Sector 10 Commercial Area', 'sector-10-commercial-area', 'market', 2, 28.561, 77.454, 0.3, 'Greater Noida', 'Uttar Pradesh', 'a0000000-0000-0000-0000-000000000005')

on conflict (id) do nothing;

commit;
