begin;

-- ---------------------------------------------------------------------------
-- 1. Add timezone to provider_availability_slots
-- ---------------------------------------------------------------------------
alter table if exists public.provider_availability_slots
  add column if not exists timezone text not null default 'Asia/Kolkata';

-- ---------------------------------------------------------------------------
-- 2. Availability exceptions table (date-specific overrides)
-- ---------------------------------------------------------------------------
create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  exception_date date not null,
  start_time time,
  end_time time,
  is_available boolean not null default false,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider_id, exception_date)
);

create index if not exists idx_availability_exceptions_provider_date
  on public.availability_exceptions (provider_id, exception_date desc);

-- ---------------------------------------------------------------------------
-- 3. RLS for availability_exceptions
-- ---------------------------------------------------------------------------
alter table public.availability_exceptions enable row level security;

create policy "Anyone can read availability exceptions"
  on public.availability_exceptions for select
  using (true);

create policy "Provider can CRUD own exceptions"
  on public.availability_exceptions for insert
  with check (auth.uid() = provider_id);

create policy "Provider can update own exceptions"
  on public.availability_exceptions for update
  using (auth.uid() = provider_id);

create policy "Provider can delete own exceptions"
  on public.availability_exceptions for delete
  using (auth.uid() = provider_id);

-- ---------------------------------------------------------------------------
-- 4. Updated conflict check function (respects exceptions + timezone)
-- ---------------------------------------------------------------------------
create or replace function public.check_booking_slot_available(
  p_provider_id uuid,
  p_scheduled_date date,
  p_start_time time,
  p_end_time time
) returns boolean
language plpgsql
security definer
as $$
declare
  v_day_of_week int;
  v_has_exception boolean;
  v_exception_available boolean;
  v_has_slot boolean;
begin
  v_day_of_week := extract(dow from p_scheduled_date);

  -- Check for date-specific exception first
  select exists(
    select 1 from public.availability_exceptions
    where provider_id = p_provider_id
      and exception_date = p_scheduled_date
  ) into v_has_exception;

  if v_has_exception then
    select is_available into v_exception_available
    from public.availability_exceptions
    where provider_id = p_provider_id
      and exception_date = p_scheduled_date;

    if not v_exception_available then
      return false;
    end if;

    -- Exception with custom hours overrides weekly slot check
    return not exists(
      select 1 from public.booking_slots
      where provider_id = p_provider_id
        and scheduled_date = p_scheduled_date
        and status in ('confirmed', 'rescheduled')
        and start_time < p_end_time
        and end_time > p_start_time
    );
  end if;

  -- Check weekly availability slot exists
  select exists(
    select 1 from public.provider_availability_slots
    where provider_id = p_provider_id
      and day_of_week = v_day_of_week
      and is_active = true
      and start_time <= p_start_time
      and end_time >= p_end_time
  ) into v_has_slot;

  if not v_has_slot then
    return false;
  end if;

  -- Check for no conflicting bookings
  return not exists(
    select 1 from public.booking_slots
    where provider_id = p_provider_id
      and scheduled_date = p_scheduled_date
      and status in ('confirmed', 'rescheduled')
      and start_time < p_end_time
      and end_time > p_start_time
  );
end;
$$;

commit;
