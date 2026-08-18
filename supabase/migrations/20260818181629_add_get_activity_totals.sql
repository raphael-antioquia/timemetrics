create or replace function public.get_activity_totals(
  p_start_date date,
  p_end_date date,
  p_time_zone text
)
returns table (
  activity_id uuid,
  activity_name text,
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
  )
  select
    tb.activity_id,
    a.name as activity_name,
    sum(tb.duration_seconds)::bigint as total_seconds,
    count(*)::bigint as session_count
  from public.time_blocks tb
  cross join bounds b
  left join public.activities a
    on a.id = tb.activity_id
  where tb.user_id = (select auth.uid())
    and tb.started_at >= b.range_start
    and tb.started_at < b.range_end
  group by tb.activity_id, a.name
  order by total_seconds desc;
$$;

revoke all
on function public.get_activity_totals(date, date, text)
from public;

grant execute
on function public.get_activity_totals(date, date, text)
to authenticated;