-- Recurring subscriptions: link Razorpay subscription plans and subscription IDs
alter table if exists public.subscription_plans
  add column if not exists razorpay_plan_id text;

alter table if exists public.provider_subscriptions
  add column if not exists razorpay_subscription_id text;

-- Real payouts: track Razorpay contact/fund account per bank account
alter table if exists public.provider_bank_accounts
  add column if not exists razorpay_contact_id text,
  add column if not exists razorpay_fund_account_id text;

-- Real payouts: track Razorpay payout ID on each payout
alter table if exists public.provider_payouts
  add column if not exists razorpay_payout_id text,
  add column if not exists processed_at timestamptz;

-- Referral payouts: also track razorpay_payout_id
alter table if exists public.referral_payouts
  add column if not exists razorpay_payout_id text;

-- Promo / coupon codes
create table if not exists public.promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  description     text,
  discount_type   text not null check (discount_type in ('percent', 'fixed')),
  discount_value  numeric not null check (discount_value > 0),
  max_uses        integer not null default 0,
  current_uses    integer not null default 0,
  min_order_paise numeric not null default 0,
  max_discount_paise numeric,
  valid_from      timestamptz,
  valid_until     timestamptz,
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default timezone('utc', now())
);

-- Track which orders used which promo codes
create table if not exists public.order_promo_codes (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  promo_code_id   uuid not null references public.promo_codes(id),
  discount_paise  integer not null default 0,
  applied_at      timestamptz not null default timezone('utc', now()),
  unique(order_id)
);

-- Indexes
create index if not exists idx_promo_codes_code on public.promo_codes(code) where is_active = true;
create index if not exists idx_order_promo_codes_order on public.order_promo_codes(order_id);

-- Helper: validate and consume a promo code
create or replace function public.validate_promo_code(p_code text, p_order_paise numeric)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_record public.promo_codes%rowtype;
  v_discount_paise numeric;
begin
  select * into v_record
  from public.promo_codes
  where code = upper(trim(p_code))
    and is_active = true
    and (max_uses = 0 or current_uses < max_uses)
    and (valid_from is null or valid_from <= timezone('utc', now()))
    and (valid_until is null or valid_until >= timezone('utc', now()));

  if not found then
    return jsonb_build_object('ok', false, 'message', 'Invalid or expired promo code');
  end if;

  if p_order_paise < v_record.min_order_paise then
    return jsonb_build_object('ok', false, 'message', 'Minimum order value not met');
  end if;

  if v_record.discount_type = 'percent' then
    v_discount_paise := floor(p_order_paise * v_record.discount_value / 100);
  else
    v_discount_paise := v_record.discount_value;
  end if;

  if v_record.max_discount_paise is not null and v_discount_paise > v_record.max_discount_paise then
    v_discount_paise := v_record.max_discount_paise;
  end if;

  if v_discount_paise > p_order_paise then
    v_discount_paise := p_order_paise;
  end if;

  return jsonb_build_object(
    'ok', true,
    'promo_code_id', v_record.id,
    'code', v_record.code,
    'discount_paise', v_discount_paise,
    'discount_type', v_record.discount_type,
    'discount_value', v_record.discount_value
  );
end;
$$;

-- Helper: consume a promo code usage (called after successful order payment)
create or replace function public.consume_promo_code(p_promo_code_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.promo_codes
  set current_uses = current_uses + 1
  where id = p_promo_code_id;
end;
$$;
