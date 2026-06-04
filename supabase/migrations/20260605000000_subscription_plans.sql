begin;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_paise integer not null,
  interval text not null default 'month' check (interval in ('month', 'year')),
  features jsonb not null default '[]'::jsonb,
  highlighted boolean not null default false,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'past_due')),
  razorpay_order_id text,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  cancelled_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_provider_subscriptions_provider_id on public.provider_subscriptions(provider_id);
create index if not exists idx_provider_subscriptions_status on public.provider_subscriptions(status);
create index if not exists idx_provider_subscriptions_active on public.provider_subscriptions(provider_id) where status = 'active';

alter table public.subscription_plans enable row level security;
alter table public.provider_subscriptions enable row level security;

create policy "subscription_plans_select_all"
  on public.subscription_plans for select
  using (true);

create policy "provider_subscriptions_select_own"
  on public.provider_subscriptions for select
  using (auth.uid() = provider_id);

create policy "provider_subscriptions_insert_own"
  on public.provider_subscriptions for insert
  with check (auth.uid() = provider_id);

create policy "provider_subscriptions_update_own"
  on public.provider_subscriptions for update
  using (auth.uid() = provider_id);

insert into public.subscription_plans (name, description, price_paise, interval, features, highlighted, sort_order) values
  ('Free', 'Get started with basic visibility in your neighborhood', 0, 'month', '["Basic profile", "1 service listing", "Standard search ranking", "Community feed access"]'::jsonb, false, 0),
  ('Essential', 'Stand out and attract more customers', 29900, 'month', '["Verified badge", "5 service listings", "Priority search ranking", "Analytics dashboard", "Customer reviews"]'::jsonb, true, 1),
  ('Premium', 'Maximum visibility and growth tools', 99900, 'month', '["All Essential features", "Unlimited service listings", "Featured placement in searches", "AI Launchpad access", "Premium support", "Boost promotions (10/mo)"]'::jsonb, false, 2)
on conflict do nothing;

commit;
