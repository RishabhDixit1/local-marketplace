begin;

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  consumer_id uuid references auth.users(id) on delete cascade,
  provider_id uuid references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null
    check (lower(event_type) in ('created', 'status_changed', 'assignment_changed', 'price_updated')),
  previous_status text,
  next_status text,
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_task_events_order_created
  on public.task_events (order_id, created_at desc);

create index if not exists idx_task_events_consumer_created
  on public.task_events (consumer_id, created_at desc);

create index if not exists idx_task_events_provider_created
  on public.task_events (provider_id, created_at desc);

alter table public.task_events enable row level security;

drop policy if exists task_events_select_own on public.task_events;

create policy task_events_select_own
on public.task_events
for select
to authenticated
using (auth.uid() = consumer_id or auth.uid() = provider_id);

create or replace function public.log_task_order_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  previous_status_label text;
  next_status_label text;
  event_title text;
  event_description text;
begin
  next_status_label := initcap(replace(coalesce(new.status, 'new_lead'), '_', ' '));

  if tg_op = 'INSERT' then
    event_title := case lower(coalesce(new.status, 'new_lead'))
      when 'quoted' then 'Quote queued'
      when 'accepted' then 'Task accepted'
      when 'in_progress' then 'Work started'
      when 'completed' then 'Task completed'
      when 'closed' then 'Task closed'
      when 'cancelled' then 'Task cancelled'
      when 'rejected' then 'Task rejected'
      else 'Task created'
    end;

    event_description := format(
      'Order entered the operations pipeline as %s.',
      next_status_label
    );

    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.consumer_id, new.provider_id),
      'created',
      new.status,
      event_title,
      event_description,
      jsonb_build_object(
        'listing_type', to_jsonb(new) ->> 'listing_type',
        'price', to_jsonb(new) -> 'price',
        'source', 'trigger'
      )
    );

    return new;
  end if;

  if new.status is distinct from old.status then
    previous_status_label := initcap(replace(coalesce(old.status, 'new_lead'), '_', ' '));

    event_title := case lower(coalesce(new.status, 'new_lead'))
      when 'quoted' then 'Quote sent'
      when 'accepted' then 'Quote accepted'
      when 'in_progress' then 'Work started'
      when 'completed' then 'Task completed'
      when 'closed' then 'Task closed'
      when 'cancelled' then 'Task cancelled'
      when 'rejected' then 'Task rejected'
      else 'Status updated'
    end;

    event_description := format(
      'Status moved from %s to %s.',
      previous_status_label,
      next_status_label
    );

    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'status_changed',
      old.status,
      new.status,
      event_title,
      event_description,
      jsonb_build_object(
        'listing_type', to_jsonb(new) ->> 'listing_type',
        'price', to_jsonb(new) -> 'price',
        'source', 'trigger'
      )
    );
  end if;

  if new.provider_id is distinct from old.provider_id then
    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'assignment_changed',
      old.status,
      new.status,
      case when new.provider_id is null then 'Provider unassigned' else 'Provider assigned' end,
      case
        when new.provider_id is null then 'The order was moved back to the open pipeline.'
        else 'A provider is now attached to this task.'
      end,
      jsonb_build_object(
        'previous_provider_id', old.provider_id,
        'next_provider_id', new.provider_id,
        'source', 'trigger'
      )
    );
  end if;

  if new.price is distinct from old.price then
    insert into public.task_events (
      order_id,
      consumer_id,
      provider_id,
      actor_id,
      event_type,
      previous_status,
      next_status,
      title,
      description,
      metadata
    )
    values (
      new.id,
      new.consumer_id,
      new.provider_id,
      coalesce(actor_id, new.provider_id, new.consumer_id),
      'price_updated',
      old.status,
      new.status,
      'Quote amount updated',
      format(
        'Task value changed from %s to %s.',
        coalesce(old.price::text, 'not set'),
        coalesce(new.price::text, 'not set')
      ),
      jsonb_build_object(
        'previous_price', old.price,
        'next_price', new.price,
        'source', 'trigger'
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_task_order_event on public.orders;

create trigger trg_log_task_order_event
after insert or update on public.orders
for each row
execute function public.log_task_order_event();

insert into public.task_events (
  order_id,
  consumer_id,
  provider_id,
  actor_id,
  event_type,
  next_status,
  title,
  description,
  metadata
)
select
  o.id,
  o.consumer_id,
  o.provider_id,
  coalesce(o.consumer_id, o.provider_id),
  'created',
  o.status,
  case lower(coalesce(o.status, 'new_lead'))
    when 'quoted' then 'Quote queued'
    when 'accepted' then 'Task accepted'
    when 'in_progress' then 'Work started'
    when 'completed' then 'Task completed'
    when 'closed' then 'Task closed'
    when 'cancelled' then 'Task cancelled'
    when 'rejected' then 'Task rejected'
    else 'Task created'
  end,
  format(
    'Order entered the operations pipeline as %s.',
    initcap(replace(coalesce(o.status, 'new_lead'), '_', ' '))
  ),
  jsonb_build_object(
    'listing_type', to_jsonb(o) ->> 'listing_type',
    'price', to_jsonb(o) -> 'price',
    'source', 'backfill'
  )
from public.orders o
where not exists (
  select 1
  from public.task_events te
  where te.order_id = o.id
    and te.event_type = 'created'
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      execute 'alter publication supabase_realtime add table public.task_events';
    exception
      when duplicate_object then
        null;
    end;
  end if;
end $$;

commit;
