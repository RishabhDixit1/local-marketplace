-- Aggregated feed interaction metrics for welcome feed cards.
-- Safe to re-run.

begin;

create or replace function public.get_feed_card_metrics(card_ids text[])
returns table (
  card_id text,
  saves bigint,
  shares bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with requested as (
    select distinct unnest(coalesce(card_ids, '{}'::text[])) as card_id
  ),
  save_counts as (
    select s.card_id, count(*)::bigint as saves
    from public.feed_card_saves s
    join requested r on r.card_id = s.card_id
    group by s.card_id
  ),
  share_counts as (
    select sh.card_id, count(*)::bigint as shares
    from public.feed_card_shares sh
    join requested r on r.card_id = sh.card_id
    group by sh.card_id
  )
  select
    r.card_id,
    coalesce(sc.saves, 0)::bigint as saves,
    coalesce(shc.shares, 0)::bigint as shares
  from requested r
  left join save_counts sc on sc.card_id = r.card_id
  left join share_counts shc on shc.card_id = r.card_id;
$$;

revoke all on function public.get_feed_card_metrics(text[]) from public;
grant execute on function public.get_feed_card_metrics(text[]) to anon;
grant execute on function public.get_feed_card_metrics(text[]) to authenticated;

commit;
