begin;

-- referral codes
create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  times_used integer not null default 0,
  reward_points integer not null default 50,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (code)
);

create index if not exists idx_referral_codes_user on public.referral_codes (user_id, is_active);

-- review requests
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (lower(status) in ('pending', 'sent', 'completed', 'skipped', 'expired')),
  sent_at timestamptz,
  completed_at timestamptz,
  reminder_count integer not null default 0,
  last_reminder_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (order_id, requester_id)
);

create index if not exists idx_review_requests_provider
  on public.review_requests (provider_id, status);

create index if not exists idx_review_requests_pending
  on public.review_requests (status, created_at) where status = 'pending';

-- campaign schedules
create table if not exists public.campaign_schedules (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  campaign_type text not null
    check (lower(campaign_type) in ('reactivation', 'review_request', 'referral', 'promotion', 'onboarding')),
  title text not null,
  message_template text not null,
  channel text not null default 'push'
    check (lower(channel) in ('push', 'email', 'sms', 'whatsapp')),
  target_segment jsonb not null default '{}'::jsonb,
  schedule_type text not null default 'immediate'
    check (lower(schedule_type) in ('immediate', 'delay', 'cron')),
  delay_minutes integer,
  cron_expression text,
  starts_at timestamptz,
  ends_at timestamptz,
  max_executions integer not null default 1,
  executions_count integer not null default 0,
  last_executed_at timestamptz,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_campaign_schedules_active
  on public.campaign_schedules (provider_id, is_active, campaign_type);

create index if not exists idx_campaign_schedules_pending
  on public.campaign_schedules (is_active, starts_at, executions_count, max_executions)
  where is_active = true and executions_count < max_executions;

-- widget embeds
create table if not exists public.widget_embeds (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  widget_type text not null default 'profile'
    check (lower(widget_type) in ('profile', 'services', 'products', 'contact', 'booking')),
  is_active boolean not null default true,
  theme jsonb not null default '{}'::jsonb,
  embed_code text,
  allowed_domains text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_widget_embeds_provider on public.widget_embeds (provider_id, is_active);

-- triggers
drop trigger if exists trg_referral_codes_updated_at on public.referral_codes;
create trigger trg_referral_codes_updated_at
before update on public.referral_codes
for each row execute function public.set_updated_at();

drop trigger if exists trg_review_requests_updated_at on public.review_requests;
create trigger trg_review_requests_updated_at
before update on public.review_requests
for each row execute function public.set_updated_at();

drop trigger if exists trg_campaign_schedules_updated_at on public.campaign_schedules;
create trigger trg_campaign_schedules_updated_at
before update on public.campaign_schedules
for each row execute function public.set_updated_at();

drop trigger if exists trg_widget_embeds_updated_at on public.widget_embeds;
create trigger trg_widget_embeds_updated_at
before update on public.widget_embeds
for each row execute function public.set_updated_at();

-- create a notification on review_requests insert
create or replace function public.notify_review_request_event()
returns trigger as $$
begin
  perform public.enqueue_notification(
    new.requester_id,
    'review_request',
    'How was your experience?',
    'Your order is complete. Leave a review for the provider.',
    'order',
    new.order_id::text,
    jsonb_build_object('review_request_id', new.id, 'provider_id', new.provider_id)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_review_requests_notify on public.review_requests;
create trigger trg_review_requests_notify
after insert on public.review_requests
for each row
execute function public.notify_review_request_event();

-- RLS
alter table public.referral_codes enable row level security;
alter table public.review_requests enable row level security;
alter table public.campaign_schedules enable row level security;
alter table public.widget_embeds enable row level security;

-- referral_codes: owner only
create policy referral_codes_select_own on public.referral_codes
  for select to authenticated using (user_id = auth.uid());
create policy referral_codes_insert_own on public.referral_codes
  for insert to authenticated with check (user_id = auth.uid());
create policy referral_codes_update_own on public.referral_codes
  for update to authenticated using (user_id = auth.uid());

-- review_requests: participants + provider
create policy review_requests_select_participant on public.review_requests
  for select to authenticated using (
    requester_id = auth.uid() or provider_id = auth.uid()
  );
create policy review_requests_insert_system on public.review_requests
  for insert to authenticated with check (
    requester_id = auth.uid() or provider_id = auth.uid()
  );
create policy review_requests_update_participant on public.review_requests
  for update to authenticated using (
    requester_id = auth.uid() or provider_id = auth.uid()
  );

-- campaign_schedules: provider owns
create policy campaign_schedules_select_own on public.campaign_schedules
  for select to authenticated using (provider_id = auth.uid());
create policy campaign_schedules_insert_own on public.campaign_schedules
  for insert to authenticated with check (provider_id = auth.uid());
create policy campaign_schedules_update_own on public.campaign_schedules
  for update to authenticated using (provider_id = auth.uid());
create policy campaign_schedules_delete_own on public.campaign_schedules
  for delete to authenticated using (provider_id = auth.uid());

-- widget_embeds: public read, owner manage
create policy widget_embeds_select_public on public.widget_embeds
  for select to anon, authenticated using (is_active = true);
create policy widget_embeds_select_own on public.widget_embeds
  for select to authenticated using (provider_id = auth.uid());
create policy widget_embeds_insert_own on public.widget_embeds
  for insert to authenticated with check (provider_id = auth.uid());
create policy widget_embeds_update_own on public.widget_embeds
  for update to authenticated using (provider_id = auth.uid());
create policy widget_embeds_delete_own on public.widget_embeds
  for delete to authenticated using (provider_id = auth.uid());

-- realtime
do $$ begin if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
  begin execute 'alter publication supabase_realtime add table public.referral_codes'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.review_requests'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.campaign_schedules'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.widget_embeds'; exception when duplicate_object then null; end;
end if; end $$;

commit;
