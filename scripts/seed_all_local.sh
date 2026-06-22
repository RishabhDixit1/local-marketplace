#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Detect local Supabase DB connection
if command -v supabase >/dev/null 2>&1; then
  DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
else
  echo "supabase CLI not found. Is local Supabase running?"
  exit 1
fi

psql_exec() {
  PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "=== Step 1: Creating 6 test users in auth.users ==="
psql_exec -c "
INSERT INTO auth.users (id, email, email_confirmed_at, role, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT * FROM (VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'provider1@serviq.test'::text, now(), 'authenticated'::text, now(), now(),
   '{\"provider\": \"email\"}'::jsonb, '{\"name\": \"Aditi Electricals\"}'::jsonb),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'provider2@serviq.test'::text, now(), 'authenticated'::text, now(), now(),
   '{\"provider\": \"email\"}'::jsonb, '{\"name\": \"Rahul Plumbing\"}'::jsonb),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'provider3@serviq.test'::text, now(), 'authenticated'::text, now(), now(),
   '{\"provider\": \"email\"}'::jsonb, '{\"name\": \"Meera Clean\"}'::jsonb),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'provider4@serviq.test'::text, now(), 'authenticated'::text, now(), now(),
   '{\"provider\": \"email\"}'::jsonb, '{\"name\": \"QuickFix Appliance\"}'::jsonb),
  ('00000000-0000-0000-0000-000000000005'::uuid, 'provider5@serviq.test'::text, now(), 'authenticated'::text, now(), now(),
   '{\"provider\": \"email\"}'::jsonb, '{\"name\": \"FreshCart Local\"}'::jsonb),
  ('00000000-0000-0000-0000-000000000006'::uuid, 'seeker1@serviq.test'::text, now(), 'authenticated'::text, now(), now(),
   '{\"provider\": \"email\"}'::jsonb, '{\"name\": \"Local Buyer\"}'::jsonb)
) AS t(id, email, email_confirmed_at, role, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = t.email)
ON CONFLICT (id) DO NOTHING;
"
echo "Users created."

echo "=== Step 2: Applying dashboard seed ==="
psql_exec -f supabase/seed_dashboard_demo.sql
echo "Dashboard seed done."

echo "=== Step 3: Applying realtime tabs seed ==="
psql_exec -f supabase/seed_realtime_tabs_demo.sql
echo "Realtime tabs seed done."

echo "=== Step 4: Seeding provider_presence ==="
psql_exec -c "
INSERT INTO public.provider_presence (provider_id, is_online, availability, response_sla_minutes, completed_jobs)
SELECT id, true, 'available', 15, 42 FROM auth.users WHERE email = 'provider1@serviq.test'
ON CONFLICT (provider_id) DO NOTHING;
INSERT INTO public.provider_presence (provider_id, is_online, availability, response_sla_minutes, completed_jobs)
SELECT id, true, 'available', 10, 87 FROM auth.users WHERE email = 'provider2@serviq.test'
ON CONFLICT (provider_id) DO NOTHING;
INSERT INTO public.provider_presence (provider_id, is_online, availability, response_sla_minutes, completed_jobs)
SELECT id, false, 'busy', 30, 156 FROM auth.users WHERE email = 'provider3@serviq.test'
ON CONFLICT (provider_id) DO NOTHING;
INSERT INTO public.provider_presence (provider_id, is_online, availability, response_sla_minutes, completed_jobs)
SELECT id, true, 'available', 20, 203 FROM auth.users WHERE email = 'provider4@serviq.test'
ON CONFLICT (provider_id) DO NOTHING;
INSERT INTO public.provider_presence (provider_id, is_online, availability, response_sla_minutes, completed_jobs)
SELECT id, true, 'available', 25, 612 FROM auth.users WHERE email = 'provider5@serviq.test'
ON CONFLICT (provider_id) DO NOTHING;
"
echo "Provider presence seeded."

echo "=== Step 5: Linking providers to Crossing Republik localities ==="
# Get the first 5 society locality IDs
psql_exec -c "
WITH provider_list AS (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 5
), locality_list AS (
  SELECT id FROM public.localities WHERE zone_type = 'society' ORDER BY name LIMIT 5
)
UPDATE public.profiles p
SET locality_id = l.id,
    service_area_radius_km = 5.0,
    location = 'Crossing Republik, Ghaziabad',
    latitude = 28.647,
    longitude = 77.440
FROM (SELECT row_number() OVER () AS rn, id FROM provider_list) pu
JOIN (SELECT row_number() OVER () AS rn, id FROM locality_list) l ON pu.rn = l.rn
WHERE p.id = pu.id;
"
echo "Localities linked."

echo ""
echo "=== Seeding complete! ==="
echo "Test accounts (OTP sign-in via http://localhost:3000):"
echo "  provider1@serviq.test  (Electrician)"
echo "  provider2@serviq.test  (Plumber)"
echo "  provider3@serviq.test  (Cleaning)"
echo "  provider4@serviq.test  (Appliance Repair)"
echo "  provider5@serviq.test  (Grocery/Delivery)"
echo "  seeker1@serviq.test    (Buyer/Seeker)"
