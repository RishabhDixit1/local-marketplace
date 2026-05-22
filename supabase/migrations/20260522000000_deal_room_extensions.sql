begin;

-- Add missing status values to quote_drafts
alter table public.quote_drafts
  drop constraint if exists quote_drafts_status_check;

alter table public.quote_drafts
  add constraint quote_drafts_status_check
  check (lower(status) in ('draft', 'sent', 'accepted', 'expired', 'cancelled', 'rejected', 'countered'));

-- Quote versions table (immutable snapshots of quote_drafts)
create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_drafts(id) on delete cascade,
  version_number integer not null default 1,
  status text not null
    check (lower(status) in ('draft', 'sent', 'accepted', 'expired', 'cancelled', 'rejected', 'countered')),
  summary text,
  notes text,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  expires_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  rejected_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Quote version line items
create table if not exists public.quote_version_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
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

-- Quote attachments / proof of work
create table if not exists public.quote_attachments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote_drafts(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  help_request_id uuid references public.help_requests(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'attachment'
    check (lower(kind) in ('attachment', 'proof_of_work', 'receipt', 'contract', 'other')),
  file_name text not null,
  file_path text not null,
  file_url text not null,
  file_size_bytes bigint,
  mime_type text,
  title text,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists idx_quote_versions_quote
  on public.quote_versions (quote_id, version_number desc);

create unique index if not exists idx_quote_versions_quote_number_unique
  on public.quote_versions (quote_id, version_number);

create index if not exists idx_quote_version_line_items_version
  on public.quote_version_line_items (quote_version_id, sort_order asc, created_at asc);

create index if not exists idx_quote_attachments_quote
  on public.quote_attachments (quote_id, created_at desc);

create index if not exists idx_quote_attachments_order
  on public.quote_attachments (order_id, created_at desc);

create index if not exists idx_quote_attachments_help_request
  on public.quote_attachments (help_request_id, created_at desc);

-- Triggers for updated_at
drop trigger if exists trg_quote_versions_updated_at on public.quote_versions;
create trigger trg_quote_versions_updated_at
before update on public.quote_versions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_quote_version_line_items_updated_at on public.quote_version_line_items;
create trigger trg_quote_version_line_items_updated_at
before update on public.quote_version_line_items
for each row
execute function public.set_updated_at();

drop trigger if exists trg_quote_attachments_updated_at on public.quote_attachments;
create trigger trg_quote_attachments_updated_at
before update on public.quote_attachments
for each row
execute function public.set_updated_at();

-- RLS
alter table public.quote_versions enable row level security;
alter table public.quote_version_line_items enable row level security;
alter table public.quote_attachments enable row level security;

-- Policies: quote_versions (same visibility as quote_drafts)
drop policy if exists quote_versions_select_party on public.quote_versions;
create policy quote_versions_select_party
on public.quote_versions
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

-- quote_version_line_items
drop policy if exists quote_version_line_items_select_party on public.quote_version_line_items;
create policy quote_version_line_items_select_party
on public.quote_version_line_items
for select
to authenticated
using (
  exists (
    select 1
    from public.quote_versions qv
    join public.quote_drafts qd on qd.id = qv.quote_id
    where qv.id = quote_version_id
      and (qd.provider_id = auth.uid() or qd.consumer_id = auth.uid())
  )
);

-- quote_attachments
drop policy if exists quote_attachments_select_party on public.quote_attachments;
create policy quote_attachments_select_party
on public.quote_attachments
for select
to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and (qd.provider_id = auth.uid() or qd.consumer_id = auth.uid())
  )
);

drop policy if exists quote_attachments_insert_party on public.quote_attachments;
create policy quote_attachments_insert_party
on public.quote_attachments
for insert
to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (
    select 1
    from public.quote_drafts qd
    where qd.id = quote_id
      and (qd.provider_id = auth.uid() or qd.consumer_id = auth.uid())
  )
);

drop policy if exists quote_attachments_update_own on public.quote_attachments;
create policy quote_attachments_update_own
on public.quote_attachments
for update
to authenticated
using (uploaded_by = auth.uid())
with check (uploaded_by = auth.uid());

drop policy if exists quote_attachments_delete_own on public.quote_attachments;
create policy quote_attachments_delete_own
on public.quote_attachments
for delete
to authenticated
using (uploaded_by = auth.uid());

-- Realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.quote_versions';
    exception when duplicate_object then null;
    end;

    begin
      execute 'alter publication supabase_realtime add table public.quote_version_line_items';
    exception when duplicate_object then null;
    end;

    begin
      execute 'alter publication supabase_realtime add table public.quote_attachments';
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
