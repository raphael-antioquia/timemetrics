begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- This file tests calendar behavior through the same authenticated/RLS
-- boundary used by the application. Fixtures are seeded as postgres, then
-- reporting functions are invoked as authenticated users with JWT subjects.

-- ---------------------------------------------------------------------------
-- Fixtures: users
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333');

-- Alice and Bob are used only for the dynamic "today" test.
-- Charlie owns the fixed-date analytics fixtures so those rows can never
-- collide with today's fixtures under time_blocks_no_overlap.

insert into public.activities (
  id,
  user_id,
  name
)
values (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '33333333-3333-3333-3333-333333333333',
  'Calendar Focus'
);

-- ---------------------------------------------------------------------------
-- Fixtures: time_blocks_for_today
-- ---------------------------------------------------------------------------
--
-- Derive Toronto's current local-day bounds from the same transaction-level
-- now() used by the STABLE function. PostgreSQL's now() is fixed at the
-- transaction start, so the fixture and function cannot disagree even if the
-- test happens to run across local midnight.
--
-- Alice gets:
--   - one block immediately before today: excluded
--   - one starting exactly at local midnight: included
--   - one later in the day: included
--   - one starting exactly at the next local midnight: excluded
--
-- Bob gets a block matching Alice's in-day block. It must remain invisible
-- when Alice invokes the SECURITY INVOKER function.
--
-- UUID literals are explicitly cast because UNION ALL resolves branch types
-- before the INSERT target columns can provide assignment context.

with bounds as (
  select
    date_trunc(
      'day',
      now() at time zone 'America/Toronto'
    ) at time zone 'America/Toronto' as lower_bound,
    (
      date_trunc(
        'day',
        now() at time zone 'America/Toronto'
      ) + interval '1 day'
    ) at time zone 'America/Toronto' as upper_bound
)
insert into public.time_blocks (
  id,
  user_id,
  started_at,
  ended_at,
  duration_seconds
)
select
  'a1000000-0000-0000-0000-000000000001'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  lower_bound - interval '30 minutes',
  lower_bound,
  1800
from bounds

union all

select
  'a1000000-0000-0000-0000-000000000002'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  lower_bound,
  lower_bound + interval '15 minutes',
  900
from bounds

union all

select
  'a1000000-0000-0000-0000-000000000003'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  lower_bound + interval '1 hour',
  lower_bound + interval '1 hour 15 minutes',
  900
from bounds

union all

select
  'a1000000-0000-0000-0000-000000000004'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  upper_bound,
  upper_bound + interval '15 minutes',
  900
from bounds

union all

select
  'b1000000-0000-0000-0000-000000000001'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  lower_bound + interval '1 hour',
  lower_bound + interval '1 hour 15 minutes',
  900
from bounds;

-- ---------------------------------------------------------------------------
-- Fixtures: ordinary non-UTC boundary
-- ---------------------------------------------------------------------------
--
-- Toronto is UTC-05:00 in January.
--
-- 2026-01-05 04:30Z = 2026-01-04 23:30 Toronto
-- 2026-01-05 05:00Z = 2026-01-05 00:00 Toronto
--
-- A query for January 4 must include only the first row.

insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-01-05 04:30:00+00',
    '2026-01-05 04:45:00+00',
    900
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-01-05 05:00:00+00',
    '2026-01-05 05:15:00+00',
    900
  );

-- ---------------------------------------------------------------------------
-- Fixtures: Toronto spring DST transition
-- ---------------------------------------------------------------------------
--
-- March 8, 2026 is a 23-hour Toronto calendar day:
--
-- [2026-03-08 05:00Z, 2026-03-09 04:00Z)
--
-- The rows immediately outside each boundary remain valid database rows but
-- must be excluded from a March 8 analytics request.

insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-03-08 04:59:00+00',
    '2026-03-08 05:00:00+00',
    60
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-03-08 05:00:00+00',
    '2026-03-08 05:10:00+00',
    600
  ),
  (
    'c2000000-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-03-08 06:30:00+00',
    '2026-03-08 06:40:00+00',
    600
  ),
  (
    'c2000000-0000-0000-0000-000000000004',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-03-08 07:30:00+00',
    '2026-03-08 07:40:00+00',
    600
  ),
  (
    'c2000000-0000-0000-0000-000000000005',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-03-09 03:59:00+00',
    '2026-03-09 04:00:00+00',
    60
  ),
  (
    'c2000000-0000-0000-0000-000000000006',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-03-09 04:00:00+00',
    '2026-03-09 04:10:00+00',
    600
  );

-- ---------------------------------------------------------------------------
-- Fixtures: Toronto fall DST transition
-- ---------------------------------------------------------------------------
--
-- November 1, 2026 is a 25-hour Toronto calendar day:
--
-- [2026-11-01 04:00Z, 2026-11-02 05:00Z)
--
-- 05:30Z is the first local 01:30 (EDT).
-- 06:30Z is the repeated local 01:30 (EST).
-- Both must be counted as distinct sessions on November 1.

insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-11-01 04:00:00+00',
    '2026-11-01 04:10:00+00',
    600
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-11-01 05:30:00+00',
    '2026-11-01 05:40:00+00',
    600
  ),
  (
    'c3000000-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-11-01 06:30:00+00',
    '2026-11-01 06:40:00+00',
    600
  ),
  (
    'c3000000-0000-0000-0000-000000000004',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-11-02 04:59:00+00',
    '2026-11-02 05:00:00+00',
    60
  ),
  (
    'c3000000-0000-0000-0000-000000000005',
    '33333333-3333-3333-3333-333333333333',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '2026-11-02 05:00:00+00',
    '2026-11-02 05:10:00+00',
    600
  );

-- ---------------------------------------------------------------------------
-- Fixtures: block crossing local midnight
-- ---------------------------------------------------------------------------
--
-- February 14 is EST (UTC-05:00):
--
-- 2026-02-15 04:30Z = February 14 23:30 Toronto
-- 2026-02-15 05:30Z = February 15 00:30 Toronto
--
-- Analytics assigns the entire block to the local date containing started_at.
-- It does not split duration across calendar dates.

insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values (
  'c4000000-0000-0000-0000-000000000001',
  '33333333-3333-3333-3333-333333333333',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '2026-02-15 04:30:00+00',
  '2026-02-15 05:30:00+00',
  3600
);

-- ---------------------------------------------------------------------------
-- Alice: time_blocks_for_today
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- Do not add an outer ORDER BY here. results_eq is order-sensitive, and the
-- function's own started_at DESC ordering is part of the contract under test.

select results_eq(
  $$
    select id
    from public.time_blocks_for_today('America/Toronto')
  $$,
  $$
    select id
    from (
      values
        (
          1,
          'a1000000-0000-0000-0000-000000000003'::uuid
        ),
        (
          2,
          'a1000000-0000-0000-0000-000000000002'::uuid
        )
    ) as expected(sort_order, id)
    order by sort_order
  $$,
  'Toronto today includes local midnight and in-day rows, excludes both day boundaries, preserves newest-first order, and isolates Alice'
);

select throws_ok(
  $$
    select *
    from public.time_blocks_for_today(
      'Definitely/Not-A-Timezone'
    )
  $$,
  '22023',
  null,
  'time_blocks_for_today rejects an unrecognized timezone'
);

reset role;

-- ---------------------------------------------------------------------------
-- Charlie: get_daily_activity_totals
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '33333333-3333-3333-3333-333333333333';

set local role authenticated;

-- Ordinary non-UTC bucketing:
-- 04:30Z on January 5 is still January 4 in Toronto, while 05:00Z is the
-- exclusive next-local-midnight boundary.

select results_eq(
  $$
    select
      day,
      activity_id,
      activity_name,
      total_seconds,
      session_count
    from public.get_daily_activity_totals(
      '2026-01-04',
      '2026-01-04',
      'America/Toronto'
    )
  $$,
  $$
    values (
      '2026-01-04'::date,
      'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
      'Calendar Focus'::text,
      900::bigint,
      1::bigint
    )
  $$,
  'analytics bucket UTC instants by Toronto calendar date and exclude the next local midnight'
);

-- Spring-forward day:
-- included durations are 600 + 600 + 600 + 60 = 1860 seconds.
-- The 04:59Z row is before Toronto March 8.
-- The 04:00Z March 9 row is the exclusive next local midnight.

select results_eq(
  $$
    select
      day,
      activity_id,
      activity_name,
      total_seconds,
      session_count
    from public.get_daily_activity_totals(
      '2026-03-08',
      '2026-03-08',
      'America/Toronto'
    )
  $$,
  $$
    values (
      '2026-03-08'::date,
      'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
      'Calendar Focus'::text,
      1860::bigint,
      4::bigint
    )
  $$,
  'analytics use the 23-hour Toronto spring DST day'
);

-- Fall-back day:
-- both UTC instants representing the two local 01:30 occurrences must count.
-- Included durations are 600 + 600 + 600 + 60 = 1860 seconds.

select results_eq(
  $$
    select
      day,
      activity_id,
      activity_name,
      total_seconds,
      session_count
    from public.get_daily_activity_totals(
      '2026-11-01',
      '2026-11-01',
      'America/Toronto'
    )
  $$,
  $$
    values (
      '2026-11-01'::date,
      'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
      'Calendar Focus'::text,
      1860::bigint,
      4::bigint
    )
  $$,
  'analytics use the 25-hour Toronto fall DST day and count both repeated-hour sessions'
);

-- Cross-midnight blocks are assigned wholly by started_at.
-- Query both local dates so a split implementation would produce an extra row.

select results_eq(
  $$
    select
      day,
      activity_id,
      activity_name,
      total_seconds,
      session_count
    from public.get_daily_activity_totals(
      '2026-02-14',
      '2026-02-15',
      'America/Toronto'
    )
  $$,
  $$
    values (
      '2026-02-14'::date,
      'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
      'Calendar Focus'::text,
      3600::bigint,
      1::bigint
    )
  $$,
  'cross-midnight blocks are attributed wholly to the Toronto date containing started_at'
);

select throws_ok(
  $$
    select *
    from public.get_daily_activity_totals(
      '2026-01-04',
      '2026-01-04',
      'Definitely/Not-A-Timezone'
    )
  $$,
  '22023',
  null,
  'get_daily_activity_totals rejects an unrecognized timezone'
);

reset role;

select * from finish();

rollback;