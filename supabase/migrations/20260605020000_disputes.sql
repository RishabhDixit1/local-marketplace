-- Proper disputes table replacing the feed_card_feedback metadata hack

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  filed_by uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'dismissed', 'resolved_for_consumer', 'resolved_for_provider')),
  resolution_note text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_disputes_order on public.disputes (order_id);
create index if not exists idx_disputes_status on public.disputes (status);

drop trigger if exists trg_disputes_updated_at on public.disputes;
create trigger trg_disputes_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

alter table public.disputes enable row level security;

drop policy if exists disputes_select_participant on public.disputes;
create policy disputes_select_participant
  on public.disputes for select
  to authenticated
  using (
    filed_by = auth.uid()
    or exists (
      select 1 from public.orders
      where orders.id = disputes.order_id
      and (orders.consumer_id = auth.uid() or orders.provider_id = auth.uid())
    )
  );

drop policy if exists disputes_insert_own on public.disputes;
create policy disputes_insert_own
  on public.disputes for insert
  to authenticated
  with check (filed_by = auth.uid());
