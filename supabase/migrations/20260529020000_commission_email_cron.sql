begin;

alter table public.orders add column if not exists platform_fee_paise integer;
alter table public.orders add column if not exists provider_payout_paise integer;
alter table public.orders add column if not exists commission_rate numeric not null default 5.0;

comment on column public.orders.platform_fee_paise is e'Platform commission fee in paise (1 INR = 100 paise). Calculated on order completion.';
comment on column public.orders.provider_payout_paise is e'Provider payout after platform fee deduction, in paise.';
comment on column public.orders.commission_rate is e'Commission percentage rate (e.g. 5.0 = 5%).';

commit;
