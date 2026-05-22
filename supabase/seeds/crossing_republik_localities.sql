-- Seed data: Crossing Republik, Ghaziabad localities
-- Deterministic UUIDs for idempotent re-runs
-- Area center: ~28.6380° N, 77.5120° E

insert into public.localities (id, name, slug, zone_type, phase, lat, lng, radius_km) values
  -- Societies (phase=1)
  ('b0000000-0000-0000-0000-000000000001', 'Mahagun Mascot', 'mahagun-mascot', 'society', 1, 28.6401, 77.5098, 1.0),
  ('b0000000-0000-0000-0000-000000000002', 'Mahagun Mascot Phase II', 'mahagun-mascot-2', 'society', 1, 28.6408, 77.5103, 1.0),
  ('b0000000-0000-0000-0000-000000000003', 'Mahagun Montage', 'mahagun-montage', 'society', 1, 28.6395, 77.5112, 1.0),
  ('b0000000-0000-0000-0000-000000000004', 'Panchsheel Wellington', 'panchsheel-wellington', 'society', 1, 28.6372, 77.5134, 1.0),
  ('b0000000-0000-0000-0000-000000000005', 'Panchsheel Wellington II', 'panchsheel-wellington-2', 'society', 1, 28.6368, 77.5141, 1.0),
  ('b0000000-0000-0000-0000-000000000006', 'Supertech Livingston', 'supertech-livingston', 'society', 1, 28.6389, 77.5087, 1.0),
  ('b0000000-0000-0000-0000-000000000007', 'Assotech The Nest', 'assotech-nest', 'society', 1, 28.6412, 77.5076, 1.0),
  ('b0000000-0000-0000-0000-000000000008', 'Ajnara Gen X', 'ajnara-genx', 'society', 1, 28.6356, 77.5159, 1.0),
  ('b0000000-0000-0000-0000-000000000009', 'Ajnara Gen 10', 'ajnara-gen10', 'society', 1, 28.6349, 77.5166, 1.0),
  ('b0000000-0000-0000-0000-000000000010', 'Saviour Greenisle', 'saviour-greenisle', 'society', 1, 28.6421, 77.5065, 1.0),
  ('b0000000-0000-0000-0000-000000000011', 'Crossings Republic GH-7', 'cr-gh7', 'society', 1, 28.6380, 77.5120, 1.0),
  ('b0000000-0000-0000-0000-000000000012', 'Paramount Symphony', 'paramount-symphony', 'society', 1, 28.6345, 77.5178, 1.0),
  ('b0000000-0000-0000-0000-000000000013', 'Shrishti Society', 'shrishti-society', 'society', 1, 28.6433, 77.5054, 1.0),
  ('b0000000-0000-0000-0000-000000000014', 'Exotica Eastern Court', 'exotica-eastern-court', 'society', 1, 28.6337, 77.5190, 1.0),
  ('b0000000-0000-0000-0000-000000000015', 'Arihant Ambience', 'arihant-ambience', 'society', 1, 28.6440, 77.5043, 1.0),
  ('b0000000-0000-0000-0000-000000000016', 'Gardenia Square', 'gardenia-square', 'society', 1, 28.6328, 77.5201, 1.0),
  ('b0000000-0000-0000-0000-000000000017', 'Clement City', 'clement-city', 'society', 1, 28.6447, 77.5032, 1.0),
  ('b0000000-0000-0000-0000-000000000018', 'Crossing Infra cluster', 'crossing-infra', 'society', 1, 28.6362, 77.5148, 1.0),

  -- Markets (phase=1)
  ('b0000000-0000-0000-0000-000000000101', 'Galleria Market 1', 'galleria-1', 'market', 1, 28.6375, 77.5115, 0.5),
  ('b0000000-0000-0000-0000-000000000102', 'Galleria Market 2', 'galleria-2', 'market', 1, 28.6370, 77.5110, 0.5),
  ('b0000000-0000-0000-0000-000000000103', 'Avantika Retail Street', 'avantika-retail', 'market', 1, 28.6385, 77.5095, 0.5),
  ('b0000000-0000-0000-0000-000000000104', 'Panchsheel Square', 'panchsheel-square', 'market', 1, 28.6360, 77.5140, 0.5),
  ('b0000000-0000-0000-0000-000000000105', 'Paramount Spectrum', 'paramount-spectrum', 'market', 1, 28.6350, 77.5160, 0.5),
  ('b0000000-0000-0000-0000-000000000106', 'City Plaza', 'city-plaza', 'market', 1, 28.6390, 77.5085, 0.5),
  ('b0000000-0000-0000-0000-000000000107', 'The Core Mall', 'core-mall', 'market', 1, 28.6395, 77.5080, 0.5),
  ('b0000000-0000-0000-0000-000000000108', 'TRG The Mall', 'trg-mall', 'market', 1, 28.6400, 77.5075, 0.5),

  -- Supply areas (phase=1)
  ('b0000000-0000-0000-0000-000000000201', 'Dundahera', 'dundahera', 'supply_area', 1, 28.6450, 77.5020, 1.5),
  ('b0000000-0000-0000-0000-000000000202', 'Village Dundahera', 'village-dundahera', 'supply_area', 1, 28.6460, 77.5010, 1.5),
  ('b0000000-0000-0000-0000-000000000203', 'Shahberi', 'shahberi', 'supply_area', 1, 28.6320, 77.5210, 1.5),
  ('b0000000-0000-0000-0000-000000000204', 'Chipiyana Buzurg', 'chipiyana-buzurg', 'supply_area', 1, 28.6290, 77.5240, 1.5),
  ('b0000000-0000-0000-0000-000000000205', 'Balaji Enclave', 'balaji-enclave', 'supply_area', 1, 28.6470, 77.5000, 1.5),
  ('b0000000-0000-0000-0000-000000000206', 'New Vijay Nagar', 'new-vijay-nagar', 'supply_area', 1, 28.6480, 77.4990, 1.5),

  -- Phase 2 expansion
  ('b0000000-0000-0000-0000-000000000301', 'Noida Extension', 'noida-extension', 'expansion', 2, 28.6200, 77.5350, 3.0),
  ('b0000000-0000-0000-0000-000000000302', 'Indirapuram', 'indirapuram', 'expansion', 2, 28.6600, 77.4900, 3.0),
  ('b0000000-0000-0000-0000-000000000303', 'Vasundhara', 'vasundhara', 'expansion', 2, 28.6700, 77.4800, 3.0),
  ('b0000000-0000-0000-0000-000000000304', 'Siddharth Vihar', 'siddharth-vihar', 'expansion', 2, 28.6250, 77.5300, 3.0),
  ('b0000000-0000-0000-0000-000000000305', 'Pratap Vihar', 'pratap-vihar', 'expansion', 2, 28.6280, 77.5270, 3.0),
  ('b0000000-0000-0000-0000-000000000306', 'Gaur City', 'gaur-city', 'expansion', 2, 28.6150, 77.5400, 3.0)
on conflict (id) do nothing;
