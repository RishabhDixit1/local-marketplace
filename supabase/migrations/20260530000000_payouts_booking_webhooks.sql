-- Payouts, booking slots, and SMS notification tables

-- 1. Provider Payouts for order earnings
create table if not exists provider_payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  fee_paise integer not null default 0,
  net_amount_paise integer not null check (net_amount_paise > 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'processing', 'completed', 'failed', 'cancelled')),
  payout_method text not null default 'bank'
    check (payout_method in ('bank', 'upi', 'wallet')),
  payout_detail text,
  notes text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Link payouts to orders
create table if not exists payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references provider_payouts(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  unique(payout_id, order_id)
);

-- Provider bank/UPI details
create table if not exists provider_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('bank', 'upi')),
  account_holder_name text,
  bank_name text,
  account_number text,
  ifsc_code text,
  upi_handle text,
  is_verified boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Booking slots
create table if not exists provider_availability_slots (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0=Sun, 6=Sat
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists booking_slots (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  consumer_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'completed', 'cancelled', 'rescheduled')),
  rescheduled_from_id uuid references booking_slots(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Razorpay webhook event log (idempotency)
create table if not exists razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null, -- Razorpay's event_id for idempotency
  event_type text not null,
  payload jsonb not null,
  order_id text, -- linked razorpay_order_id
  status text not null default 'processed',
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_provider_payouts_provider on provider_payouts(provider_id, status);
create index if not exists idx_payout_items_payout on payout_items(payout_id);
create index if not exists idx_payout_items_order on payout_items(order_id);
create index if not exists idx_provider_bank_accounts_default on provider_bank_accounts(provider_id, is_default);
create index if not exists idx_provider_availability_slots on provider_availability_slots(provider_id, day_of_week);
create index if not exists idx_booking_slots_order on booking_slots(order_id);
create index if not exists idx_booking_slots_provider_date on booking_slots(provider_id, scheduled_date);
create index if not exists idx_razorpay_webhook_events on razorpay_webhook_events(event_id);

-- Enable RLS
alter table provider_payouts enable row level security;
alter table payout_items enable row level security;
alter table provider_bank_accounts enable row level security;
alter table provider_availability_slots enable row level security;
alter table booking_slots enable row level security;
alter table razorpay_webhook_events enable row level security;

-- Provider payouts: provider can read own, admin can read all
create policy "Provider can read own payouts"
  on provider_payouts for select
  using (auth.uid() = provider_id);

-- Payout items: provider can read items linked to their payouts
create policy "Provider can read own payout items"
  on payout_items for select
  using (exists (
    select 1 from provider_payouts pp
    where pp.id = payout_items.payout_id and pp.provider_id = auth.uid()
  ));

-- Bank accounts: provider can CRUD own
create policy "Provider can manage own bank accounts"
  on provider_bank_accounts for all
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

-- Availability slots: provider can CRUD own
create policy "Provider can manage own availability slots"
  on provider_availability_slots for all
  using (auth.uid() = provider_id)
  with check (auth.uid() = provider_id);

-- Anyone can read availability slots (for display)
create policy "Anyone can read availability slots"
  on provider_availability_slots for select
  using (true);

-- Booking slots: parties can read, provider/consumer can insert
create policy "Parties can read booking slots"
  on booking_slots for select
  using (auth.uid() = provider_id or auth.uid() = consumer_id);

create policy "Provider or consumer can insert booking slots"
  on booking_slots for insert
  with check (auth.uid() = provider_id or auth.uid() = consumer_id);

create policy "Parties can update booking slots"
  on booking_slots for update
  using (auth.uid() = provider_id or auth.uid() = consumer_id)
  with check (auth.uid() = provider_id or auth.uid() = consumer_id);

-- Webhook events: service role only (no RLS policies for anon/auth)
create policy "Service role can manage webhook events"
  on razorpay_webhook_events for all
  using (true)
  with check (true);
