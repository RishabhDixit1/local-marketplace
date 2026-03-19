begin;

create table if not exists public.quote_drafts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  help_request_id uuid references public.help_requests(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  consumer_id uuid references auth.users(id) on delete cascade,
  status text not null default 'draft'
    check (lower(status) in ('draft', 'sent', 'accepted', 'expired', 'cancelled')),
  summary text,
  notes text,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  expires_at timestamptz,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.quote_drafts
  drop constraint if exists quote_drafts_single_target;

alter table public.quote_drafts
  add constraint quote_drafts_single_target
  check ((order_id is null) <> (help_request_id is null));

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_drafts(id) on delete cascade,
  label text not null,
  description text,
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_quote_drafts_provider_updated
  on public.quote_drafts (provider_id, updated_at desc);

create index if not exists idx_quote_drafts_consumer_updated
  on public.quote_drafts (consumer_id, updated_at desc);

create index if not exists idx_quote_drafts_order_updated
  on public.quote_drafts (order_id, updated_at desc);

create index if not exists idx_quote_drafts_help_request_updated
  on public.quote_drafts (help_request_id, updated_at desc);

create unique index if not exists idx_quote_drafts_provider_order_unique
  on public.quote_drafts (provider_id, order_id)
  where order_id is not null;

create unique index if not exists idx_quote_drafts_provider_help_request_unique
  on public.quote_drafts (provider_id, help_request_id)
  where help_request_id is not null;

create index if not exists idx_quote_line_items_quote_sort
  on public.quote_line_items (quote_id, sort_order asc, created_at asc);

drop trigger if exists trg_quote_drafts_updated_at on public.quote_drafts;
create trigger trg_quote_drafts_updated_at
before update on public.quote_drafts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_quote_line_items_updated_at on public.quote_line_items;
create trigger trg_quote_line_items_updated_at
before update on public.quote_line_items
for each row
execute function public.set_updated_at();

alter table public.quote_drafts enable row level security;
alter table public.quote_line_items enable row level security;

drop policy if exists quote_drafts_select_party on public.quote_drafts;
drop policy if exists quote_drafts_insert_provider on public.quote_drafts;
drop policy if exists quote_drafts_update_provider on public.quote_drafts;
drop policy if exists quote_drafts_delete_provider on public.quote_drafts;

create policy quote_drafts_select_party
on public.quote_drafts
for select
to authenticated
using (provider_id = auth.uid() or consumer_id = auth.uid());

create policy quote_drafts_insert_provider
on public.quote_drafts
for insert
to authenticated
with check (provider_id = auth.uid());

create policy quote_drafts_update_provider
on public.quote_drafts
for update
to authenticated
using (provider_id = auth.uid())
with check (provider_id = auth.uid());

create policy quote_drafts_delete_provider
on public.quote_drafts
for delete
to authenticated
using (provider_id = auth.uid());

drop policy if exists quote_line_items_select_party on public.quote_line_items;
drop policy if exists quote_line_items_insert_provider on public.quote_line_items;
drop policy if exists quote_line_items_update_provider on public.quote_line_items;
drop policy if exists quote_line_items_delete_provider on public.quote_line_items;

create policy quote_line_items_select_party
on public.quote_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and (qd.provider_id = auth.uid() or qd.consumer_id = auth.uid())
  )
);

create policy quote_line_items_insert_provider
on public.quote_line_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
);

create policy quote_line_items_update_provider
on public.quote_line_items
for update
to authenticated
using (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
);

create policy quote_line_items_delete_provider
on public.quote_line_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and qd.provider_id = auth.uid()
  )
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.quote_drafts';
    exception when duplicate_object then null;
    end;

    begin
      execute 'alter publication supabase_realtime add table public.quote_line_items';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
