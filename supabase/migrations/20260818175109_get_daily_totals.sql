create or replace function public.get_daily_totals(
  p_start_date date,
  p_end_date date,
  p_time_zone text
)
returns table (
  day date,
  total_seconds bigint,
  session_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      (p_start_date::timestamp at time zone p_time_zone) as range_start,
      ((p_end_date + 1)::timestamp at time zone p_time_zone) as range_end
  ),
  blocks as (
    select
      (tb.started_at at time zone p_time_zone)::date as day,
      tb.duration_seconds
    from public.time_blocks tb
    cross join bounds b
    where tb.user_id = (select auth.uid())
      and tb.started_at >= b.range_start
      and tb.started_at < b.range_end
  ),
  calendar as (
    select
      generate_series(
        p_start_date,
        p_end_date,
        interval '1 day'
      )::date as day
  )
  select
    c.day,
    coalesce(sum(b.duration_seconds), 0)::bigint as total_seconds,
    count(b.day)::bigint as session_count
  from calendar c
  left join blocks b
    on b.day = c.day
  group by c.day
  order by c.day;
$$;

revoke all
on function public.get_daily_totals(date, date, text)
from public;

grant execute
on function public.get_daily_totals(date, date, text)
to authenticated;