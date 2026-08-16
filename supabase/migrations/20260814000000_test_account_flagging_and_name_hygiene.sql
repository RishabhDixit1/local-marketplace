-- Test-account flagging + name hygiene
-- 1) Add is_test flag so seed/E2E/test accounts can be excluded from public surfaces.
-- 2) Fix the garbled display name on a real user's profile (stored verbatim in the DB).

alter table public.profiles
  add column if not exists is_test boolean not null default false;

create index if not exists profiles_is_test_idx
  on public.profiles (is_test);

-- Known seed / E2E / test accounts (excluded from people directory, feed,
-- marketplace, search, and AI/provider matching).
update public.profiles
set is_test = true
where id in (
  '41cc4048-2b3b-4e6e-90da-2929adb26c17', -- codex-e2e (ServiQ E2E User)
  'fc8c0b0b-ca91-4877-bdaf-6d6f56567a01', -- serviq-e2e-user (ServiQ E2E User)
  '5d4c5cbd-8fac-4293-a789-2515fa5d138b', -- serviq-ui-check (ServiQ E2E User)
  '40b3b38b-9595-4091-a81c-71cc0d4d8645', -- ServiQ Test Provider
  '7189e018-e3e2-4d41-a8dc-00623a617ce3', -- user-7189e018 (ServiQ E2E User)
  '71fed5d4-c080-47dd-a01f-fc4f51c77438', -- Test User 1
  'b4d506fb-483c-4677-a5b3-b87d9c2124be', -- e2e-dashboard
  'e788ac4f-2d4a-438d-beee-a2e694c8ab19', -- Test User 2
  'fe42ee9a-0c04-40d7-9fda-d981810514f9', -- user-fe42ee9a (ServiQ E2E User)
  '5d62f9de-1209-46b7-85ce-1de8b580df76'  -- shukla (seed provider, keyboard-mash bio)
);

-- Real user whose name/bio were stored mangled (chaturvedichakori@gmail.com).
-- Clean name derived from username 'chaturvedichakori' (camel split -> Chaturvedi Chakori);
-- bio was a pasted GitHub/Vercel notification email.
update public.profiles
set name = 'Chaturvedi Chakori',
    full_name = 'Chaturvedi Chakori',
    bio = ''
where id = '94575b6e-258e-47cd-9561-5f4ddfa18a3f';
