create or replace function public.time_blocks_for_today(p_tz text)
returns setof public.time_blocks
language sql
stable
security invoker
set search_path = ''
as $$
  select tb.*
  from public.time_blocks as tb
  where tb.user_id = (select auth.uid())
    and tb.started_at >=
      (
        date_trunc('day', now() at time zone p_tz)
        at time zone p_tz
      )
    and tb.started_at <
      (
        (
          date_trunc('day', now() at time zone p_tz)
          + interval '1 day'
        )
        at time zone p_tz
      )
  order by tb.started_at desc;
$$;

revoke execute
on function public.time_blocks_for_today(text)
from public, anon;

grant execute
on function public.time_blocks_for_today(text)
to authenticated;