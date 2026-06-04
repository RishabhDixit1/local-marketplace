begin;

-- Add completed_jobs column if not exists (for the RPC join)
alter table public.profiles add column if not exists completed_jobs integer default 0;

create or replace function public.providers_near_locality(
  p_locality_id uuid,
  p_category_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  locality_id uuid,
  locality_name text,
  service_category_ids uuid[],
  trust_score integer,
  completed_jobs integer,
  response_time_minutes integer,
  created_at timestamptz
)
language plpgsql
security definer
as $$
begin
  return query
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.locality_id,
    l.name::text as locality_name,
    coalesce(p.service_category_ids, '{}') as service_category_ids,
    coalesce(p.trust_score, 0)::integer as trust_score,
    coalesce(p.completed_jobs, 0)::integer as completed_jobs,
    coalesce(p.response_time_minutes, 0)::integer as response_time_minutes,
    p.created_at
  from public.profiles p
  left join public.localities l on l.id = p.locality_id
  where
    p.locality_id = p_locality_id
    and p.role = 'provider'
    and (
      p_category_id is null
      or p_category_id = any(p.service_category_ids)
    )
  order by coalesce(p.trust_score, 0) desc, p.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

grant execute on function public.providers_near_locality to anon, authenticated, service_role;

commit;
