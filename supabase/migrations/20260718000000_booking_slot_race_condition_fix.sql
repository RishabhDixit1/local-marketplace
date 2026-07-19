-- Migration: Booking Slot Race Condition Fix
-- Adds a GiST exclusion constraint on booking_slots to prevent overlapping
-- confirmed bookings for the same provider, closing the TOCTOU race between
-- the check_booking_slot_available() RPC and the INSERT.

begin;

-- btree_gist is required for the uuid equality term in the exclusion index
create extension if not exists btree_gist;

-- Partial exclusion constraint: two rows with status='confirmed' for the same
-- provider on the same date must not have overlapping time ranges.
-- Uses tsrange on (scheduled_date + start_time, scheduled_date + end_time).
alter table public.booking_slots
  add constraint booking_slots_no_overlap
  exclude using gist (
    provider_id       with =,
    tsrange(
      scheduled_date + start_time,
      scheduled_date + end_time,
      '[)'
    )                 with &&
  ) where (status = 'confirmed');

commit;
