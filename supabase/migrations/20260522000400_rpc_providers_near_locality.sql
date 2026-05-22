begin;

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
  trust_score numeric,
  completed_jobs integer,
  response_time_minutes numeric,
  created_at timestamptz
)
language plpgsql
stable
as $$
begin
  return query
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.locality_id,
    l.name::text as locality_name,
    p.service_category_ids,
    p.trust_score,
    p.completed_jobs,
    p.response_time_minutes,
    p.created_at
  from public.profiles p
  left join public.localities l on l.id = p.locality_id
  where
    p.role = 'provider'
    and (
      p.locality_id = p_locality_id
      or p_locality_id = any(p.service_zone_ids)
    )
    and (
      p_category_id is null
      or p_category_id = any(p.service_category_ids)
    )
  order by p.trust_score desc nulls last, p.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- Grant execute
grant execute on function public.providers_near_locality to anon, authenticated;

commit;
