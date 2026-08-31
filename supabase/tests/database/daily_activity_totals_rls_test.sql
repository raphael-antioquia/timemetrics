begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- ---------------------------------------------------------------------------
-- Function security contract
-- ---------------------------------------------------------------------------

-- PostgreSQL functions are SECURITY INVOKER by default.
-- prosecdef = false proves this function has not been changed to
-- SECURITY DEFINER.
select is(
  (
    select prosecdef
    from pg_proc
    where oid =
      'public.get_daily_activity_totals(date,date,text)'::regprocedure
  ),
  false,
  'get_daily_activity_totals runs as security invoker'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_daily_activity_totals(date,date,text)',
    'EXECUTE'
  ),
  'authenticated can execute get_daily_activity_totals'
);

-- ---------------------------------------------------------------------------
-- Fixtures: seed Alice and Bob as postgres
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.activities (
  id,
  user_id,
  name
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Alice Focus'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Bob Secret'
  );

-- Alice:
--   Alice Focus: 1800 + 1200 = 3000 seconds, 2 sessions
--   Unlabelled:    900 seconds, 1 session
--
-- Aggregate totals are deliberately distinct so the function's
-- total_seconds DESC ordering is deterministic for this fixture.
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
    'a0000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-01-04 09:00:00+00',
    '2026-01-04 09:30:00+00',
    1800
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    null,
    '2026-01-04 10:00:00+00',
    '2026-01-04 10:15:00+00',
    900
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-01-04 11:00:00+00',
    '2026-01-04 11:20:00+00',
    1200
  );

-- Bob deliberately has data in the exact same requested day.
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
    'b0000000-0000-0000-0000-000000000001',
    '22222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '2026-01-04 09:00:00+00',
    '2026-01-04 10:00:00+00',
    3600
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '22222222-2222-2222-2222-222222222222',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '2026-01-04 11:00:00+00',
    '2026-01-04 11:30:00+00',
    1800
  );

-- ---------------------------------------------------------------------------
-- Anon
-- ---------------------------------------------------------------------------

-- anon can reach this SECURITY INVOKER function, but the function cannot read
-- its underlying tables with anon's deliberately empty table grants.
set local role anon;

select throws_ok(
  $$
    select *
    from public.get_daily_activity_totals(
      '2026-01-04',
      '2026-01-04',
      'UTC'
    )
  $$,
  '42501',
  null::text,
  'anon cannot read analytics through the RPC'
);

reset role;

-- ---------------------------------------------------------------------------
-- Alice
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

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
      'UTC'
    )
  $$,
  $$
    select *
    from (
      values
        (
          '2026-01-04'::date,
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
          'Alice Focus'::text,
          3000::bigint,
          2::bigint
        ),
        (
          '2026-01-04'::date,
          null::uuid,
          null::text,
          900::bigint,
          1::bigint
        )
    ) as expected(
      day,
      activity_id,
      activity_name,
      total_seconds,
      session_count
    )
    order by day, total_seconds desc
  $$,
  'Alice analytics contain only Alice activity and unlabelled sessions'
);

-- ---------------------------------------------------------------------------
-- Bob
-- ---------------------------------------------------------------------------

reset role;

set local request.jwt.claim.sub =
  '22222222-2222-2222-2222-222222222222';

set local role authenticated;

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
      'UTC'
    )
  $$,
  $$
    values (
      '2026-01-04'::date,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
      'Bob Secret'::text,
      5400::bigint,
      2::bigint
    )
  $$,
  'Bob analytics contain only Bob sessions'
);

reset role;

select * from finish();

rollback;
