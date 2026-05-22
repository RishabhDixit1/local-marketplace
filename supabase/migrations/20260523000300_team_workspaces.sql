begin;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  logo_url text,
  business_type text,
  phone text,
  email text,
  website text,
  is_active boolean not null default true,
  max_members integer not null default 5,
  settings jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_workspaces_owner_slug
  on public.workspaces (owner_id, slug);

create index if not exists idx_workspaces_is_active
  on public.workspaces (is_active) where is_active = true;

create table if not exists public.workspace_branches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  address text,
  latitude double precision,
  longitude double precision,
  phone text,
  email text,
  service_area_radius_km numeric not null default 5,
  operating_hours jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workspace_branches_location
  on public.workspace_branches (workspace_id, latitude, longitude);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (lower(role) in ('owner', 'admin', 'member', 'viewer')),
  branch_id uuid references public.workspace_branches(id) on delete set null,
  is_active boolean not null default true,
  joined_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user
  on public.workspace_members (user_id, is_active);

create index if not exists idx_workspace_members_branch
  on public.workspace_members (branch_id) where branch_id is not null;

create table if not exists public.workspace_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  branch_id uuid references public.workspace_branches(id) on delete cascade,
  name text not null,
  category text,
  priority integer not null default 100,
  max_distance_km numeric,
  max_leads_per_member integer not null default 10,
  round_robin boolean not null default true,
  sla_minutes integer not null default 15,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workspace_assignment_rules_category
  on public.workspace_assignment_rules (workspace_id, category, priority);

create table if not exists public.workspace_activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  member_id uuid references public.workspace_members(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_workspace_activity_log_workspace
  on public.workspace_activity_log (workspace_id, created_at desc);

create index if not exists idx_workspace_activity_log_member
  on public.workspace_activity_log (workspace_id, member_id) where member_id is not null;

-- triggers
drop trigger if exists trg_workspaces_updated_at on public.workspaces;
create trigger trg_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_members_updated_at on public.workspace_members;
create trigger trg_workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_branches_updated_at on public.workspace_branches;
create trigger trg_workspace_branches_updated_at
before update on public.workspace_branches
for each row execute function public.set_updated_at();

drop trigger if exists trg_workspace_assignment_rules_updated_at on public.workspace_assignment_rules;
create trigger trg_workspace_assignment_rules_updated_at
before update on public.workspace_assignment_rules
for each row execute function public.set_updated_at();

-- RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_branches enable row level security;
alter table public.workspace_assignment_rules enable row level security;
alter table public.workspace_activity_log enable row level security;

-- workspaces: owner full access, members read
create policy workspaces_select_owner on public.workspaces
  for select to authenticated using (owner_id = auth.uid());
create policy workspaces_select_member on public.workspaces
  for select to authenticated using (
    exists (select 1 from public.workspace_members wm where wm.workspace_id = id and wm.user_id = auth.uid())
  );
create policy workspaces_insert_own on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());
create policy workspaces_update_owner on public.workspaces
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy workspaces_delete_owner on public.workspaces
  for delete to authenticated using (owner_id = auth.uid());

-- workspace_members: members of the workspace can see each other
create policy workspace_members_select on public.workspace_members
  for select to authenticated using (
    workspace_id in (
      select wm2.workspace_id from public.workspace_members wm2 where wm2.user_id = auth.uid()
    )
    or workspace_id in (
      select id from public.workspaces where owner_id = auth.uid()
    )
  );
create policy workspace_members_insert_admin on public.workspace_members
  for insert to authenticated with check (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id and wm2.user_id = auth.uid()
        and lower(wm2.role) in ('owner', 'admin')
    )
    or exists (
      select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()
    )
  );
create policy workspace_members_update_admin on public.workspace_members
  for update to authenticated using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id and wm2.user_id = auth.uid()
        and lower(wm2.role) in ('owner', 'admin')
    )
    or exists (
      select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()
    )
  );
create policy workspace_members_delete_admin on public.workspace_members
  for delete to authenticated using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id and wm2.user_id = auth.uid()
        and lower(wm2.role) in ('owner', 'admin')
    )
    or exists (
      select 1 from public.workspaces where id = workspace_id and owner_id = auth.uid()
    )
  );

-- workspace_branches: members can read, admins can manage
create policy workspace_branches_select on public.workspace_branches
  for select to authenticated using (
    workspace_id in (
      select wm2.workspace_id from public.workspace_members wm2 where wm2.user_id = auth.uid()
    )
    or workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );
create policy workspace_branches_insert on public.workspace_branches
  for insert to authenticated with check (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );
create policy workspace_branches_update on public.workspace_branches
  for update to authenticated using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );
create policy workspace_branches_delete on public.workspace_branches
  for delete to authenticated using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

-- workspace_assignment_rules: members read, owner manage
create policy workspace_assignment_rules_select on public.workspace_assignment_rules
  for select to authenticated using (
    workspace_id in (select wm2.workspace_id from public.workspace_members wm2 where wm2.user_id = auth.uid())
    or workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );
create policy workspace_assignment_rules_insert on public.workspace_assignment_rules
  for insert to authenticated with check (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );
create policy workspace_assignment_rules_update on public.workspace_assignment_rules
  for update to authenticated using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );
create policy workspace_assignment_rules_delete on public.workspace_assignment_rules
  for delete to authenticated using (
    workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

-- workspace_activity_log: members read
create policy workspace_activity_log_select on public.workspace_activity_log
  for select to authenticated using (
    workspace_id in (select wm2.workspace_id from public.workspace_members wm2 where wm2.user_id = auth.uid())
    or workspace_id in (select id from public.workspaces where owner_id = auth.uid())
  );

-- realtime
do $$ begin if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
  begin execute 'alter publication supabase_realtime add table public.workspaces'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.workspace_members'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.workspace_branches'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.workspace_assignment_rules'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.workspace_activity_log'; exception when duplicate_object then null; end;
end if; end $$;

commit;
