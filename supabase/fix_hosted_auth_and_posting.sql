-- Hosted reliability patch:
-- 1) Ensure posts policies allow authenticated users to read open posts and insert/update/delete their own rows.
-- 2) Ensure help_requests are visible in open marketplace feeds for authenticated users.
-- 3) Ensure post-media storage bucket + object policies exist for authenticated uploads.

begin;

do $$
declare
  posts_exists boolean;
  has_status boolean;
  has_state boolean;
  owner_columns text[] := array[]::text[];
  owner_column text;
  owner_check text := 'true';
  open_check text := 'true';
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'posts'
  ) into posts_exists;

  if not posts_exists then
    raise notice 'public.posts table not found; skipping posts policy patch.';
    return;
  end if;

  execute 'alter table public.posts enable row level security';

  foreach owner_column in array array['user_id', 'created_by', 'author_id', 'requester_id', 'owner_id', 'provider_id'] loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'posts'
        and column_name = owner_column
    ) then
      owner_columns := array_append(owner_columns, owner_column);
    end if;
  end loop;

  if coalesce(array_length(owner_columns, 1), 0) > 0 then
    select string_agg(format('(%I::text = auth.uid()::text)', col_name), ' or ')
    into owner_check
    from unnest(owner_columns) as col_name;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'status'
  ) into has_status;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'posts'
      and column_name = 'state'
  ) into has_state;

  if has_status and has_state then
    open_check := '(coalesce(lower(status::text), lower(state::text), ''open'') = ''open'')';
  elsif has_status then
    open_check := '(coalesce(lower(status::text), ''open'') = ''open'')';
  elsif has_state then
    open_check := '(coalesce(lower(state::text), ''open'') = ''open'')';
  end if;

  execute 'drop policy if exists posts_select_visible on public.posts';
  execute 'drop policy if exists posts_insert_own on public.posts';
  execute 'drop policy if exists posts_update_own on public.posts';
  execute 'drop policy if exists posts_delete_own on public.posts';

  execute format(
    'create policy posts_select_visible on public.posts for select to authenticated using ((%s) or (%s))',
    open_check,
    owner_check
  );

  execute format(
    'create policy posts_insert_own on public.posts for insert to authenticated with check (%s)',
    owner_check
  );

  execute format(
    'create policy posts_update_own on public.posts for update to authenticated using (%s) with check (%s)',
    owner_check,
    owner_check
  );

  execute format(
    'create policy posts_delete_own on public.posts for delete to authenticated using (%s)',
    owner_check
  );
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'help_requests'
  ) then
    execute 'alter table public.help_requests enable row level security';

    execute 'drop policy if exists help_requests_select_visible on public.help_requests';
    execute 'drop policy if exists help_requests_insert_own on public.help_requests';
    execute 'drop policy if exists help_requests_update_own on public.help_requests';
    execute 'drop policy if exists help_requests_delete_own on public.help_requests';

    if exists (
      select 1
      from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'is_help_request_provider'
    ) then
      execute '
        create policy help_requests_select_visible
        on public.help_requests
        for select
        to authenticated
        using (
          lower(coalesce(status, ''open'')) = ''open''
          or requester_id = auth.uid()
          or public.is_help_request_provider(id, auth.uid())
        )
      ';
    else
      execute '
        create policy help_requests_select_visible
        on public.help_requests
        for select
        to authenticated
        using (
          lower(coalesce(status, ''open'')) = ''open''
          or requester_id = auth.uid()
        )
      ';
    end if;

    execute '
      create policy help_requests_insert_own
      on public.help_requests
      for insert
      to authenticated
      with check (requester_id = auth.uid())
    ';

    execute '
      create policy help_requests_update_own
      on public.help_requests
      for update
      to authenticated
      using (requester_id = auth.uid())
      with check (requester_id = auth.uid())
    ';

    execute '
      create policy help_requests_delete_own
      on public.help_requests
      for delete
      to authenticated
      using (requester_id = auth.uid())
    ';
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit)
values ('post-media', 'post-media', true, 26214400)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

drop policy if exists post_media_read_public on storage.objects;
drop policy if exists post_media_insert_authenticated on storage.objects;
drop policy if exists post_media_update_authenticated on storage.objects;
drop policy if exists post_media_delete_authenticated on storage.objects;

create policy post_media_read_public
on storage.objects
for select
to public
using (bucket_id = 'post-media');

create policy post_media_insert_authenticated
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy post_media_update_authenticated
on storage.objects
for update
to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy post_media_delete_authenticated
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'post-media'
  and (storage.foldername(name))[1] = 'posts'
  and (storage.foldername(name))[2] = auth.uid()::text
);

commit;
