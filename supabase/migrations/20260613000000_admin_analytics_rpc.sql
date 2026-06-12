-- Admin analytics: count_by_day RPC for trend charts
-- Returns daily counts for a given table since a timestamp, filling gaps with zeroes.

create or replace function count_by_day(table_name text, since timestamptz)
returns table (date text, count bigint)
language plpgsql
security definer
as $$
declare
  _query text;
begin
  _query := format(
    'select to_char(d::date, %%L) as date, coalesce(cnt, 0)::bigint as count
     from generate_series(%L::date, now()::date, %%L::interval) d
     left join (
       select created_at::date as day, count(1) as cnt
       from %I
       where created_at >= %L
       group by created_at::date
     ) t on t.day = d::date
     order by d::date',
    'YYYY-MM-DD', since, '1 day', table_name, since
  );
  return query execute _query;
end;
$$;

-- Grant execute to authenticated (admin) users
grant execute on function count_by_day(text, timestamptz) to authenticated, service_role;
