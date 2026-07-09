begin;

-- Backfill zone_id for existing Crossing Republik localities.
-- All CR localities use the b* UUID prefix, making this safe.
update public.localities
set zone_id = 'a0000000-0000-0000-0000-000000000001'
where id::text like 'b%'
  and zone_id is null;

commit;
