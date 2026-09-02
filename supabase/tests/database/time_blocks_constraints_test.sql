begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- This is a constraint-layer test, not an RLS test.
-- Running as `authenticated` would let RLS or column grants reject a row
-- before it ever reaches the invariant we are trying to exercise.
select is(
  current_user,
  'postgres',
  'time block constraint tests run as postgres, outside RLS'
);

-- ---------------------------------------------------------------------------
-- Contract metadata
-- ---------------------------------------------------------------------------
--
-- Behavioral assertions prove a rule fires. These catalog assertions prove
-- which named rule exists, so a renamed or dropped constraint fails loudly
-- instead of silently shifting enforcement to a different check.

select ok(
  exists (
    select 1
      from pg_constraint c
      join pg_class t
        on t.oid = c.conrelid
      join pg_namespace n
        on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'time_blocks'
       and c.conname = 'time_blocks_duration_positive'
       and c.contype = 'c'
  ),
  'time_blocks_duration_positive CHECK constraint exists'
);

select ok(
  exists (
    select 1
      from pg_constraint c
      join pg_class t
        on t.oid = c.conrelid
      join pg_namespace n
        on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'time_blocks'
       and c.conname = 'time_blocks_duration_within_range'
       and c.contype = 'c'
  ),
  'time_blocks_duration_within_range CHECK constraint exists'
);

select ok(
  exists (
    select 1
      from pg_constraint c
      join pg_class t
        on t.oid = c.conrelid
      join pg_namespace n
        on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'time_blocks'
       and c.conname = 'time_blocks_valid_time_range'
       and c.contype = 'c'
  ),
  'time_blocks_valid_time_range CHECK constraint exists'
);

select ok(
  exists (
    select 1
      from pg_constraint c
      join pg_class t
        on t.oid = c.conrelid
      join pg_namespace n
        on n.oid = t.relnamespace
     where n.nspname = 'public'
       and t.relname = 'time_blocks'
       and c.conname = 'time_blocks_no_overlap'
       and c.contype = 'x'
  ),
  'time_blocks_no_overlap exclusion constraint exists'
);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
--
-- The on_auth_user_created trigger supplies the matching profile row.
-- No activities are seeded: activity_id is nullable, so leaving it null keeps
-- the composite activity FK out of every assertion below.

insert into auth.users (id)
values ('11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- Duration controls
-- ---------------------------------------------------------------------------
--
-- duration_seconds is counted time, not wall-clock span. Shorter than elapsed
-- is the normal paused-session case; equal to elapsed is the upper boundary.

select lives_ok(
  $$
    insert into public.time_blocks (
      id,
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      '11111111-1111-1111-1111-111111111111',
      '2040-02-01 10:00:00+00',
      '2040-02-01 11:00:00+00',
      1800
    )
  $$,
  'duration may be shorter than elapsed time'
);

select lives_ok(
  $$
    insert into public.time_blocks (
      id,
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000002',
      '11111111-1111-1111-1111-111111111111',
      '2040-02-02 10:00:00+00',
      '2040-02-02 11:00:00+00',
      3600
    )
  $$,
  'duration may equal elapsed time'
);

-- ---------------------------------------------------------------------------
-- Duration invariants
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      '2040-02-03 10:00:00+00',
      '2040-02-03 11:00:00+00',
      0
    )
  $$,
  '23514',
  null,
  'duration_seconds cannot be zero'
);

select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      '2040-02-04 10:00:00+00',
      '2040-02-04 11:00:00+00',
      -1
    )
  $$,
  '23514',
  null,
  'duration_seconds cannot be negative'
);

select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      '2040-02-05 10:00:00+00',
      '2040-02-05 11:00:00+00',
      3601
    )
  $$,
  '23514',
  null,
  'duration_seconds cannot exceed elapsed time'
);

-- ---------------------------------------------------------------------------
-- Time-range invariant
-- ---------------------------------------------------------------------------
--
-- Equal or reversed timestamps also violate duration_within_range for every
-- positive duration, so PostgreSQL's choice of reported constraint name is not
-- part of the contract. We pin the stable SQLSTATE only; the named condition is
-- proved independently by the catalog assertion above.

select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      '2040-02-06 10:00:00+00',
      '2040-02-06 10:00:00+00',
      1
    )
  $$,
  '23514',
  null,
  'ended_at cannot equal started_at'
);

select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      '2040-02-07 11:00:00+00',
      '2040-02-07 10:00:00+00',
      1
    )
  $$,
  '23514',
  null,
  'ended_at cannot be earlier than started_at'
);

-- ---------------------------------------------------------------------------
-- Overlap invariant
-- ---------------------------------------------------------------------------
--
-- The exclusion constraint ranges are [): start inclusive, end exclusive.
-- Exact adjacency is therefore valid and is the boundary control for the two
-- rejection cases that follow.
--
-- Every row below satisfies the CHECK constraints so an expected failure
-- reaches time_blocks_no_overlap rather than failing an unrelated invariant.

select lives_ok(
  $$
    insert into public.time_blocks (
      id,
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values
      (
        'aaaaaaaa-0000-0000-0000-000000000003',
        '11111111-1111-1111-1111-111111111111',
        '2040-02-10 09:00:00+00',
        '2040-02-10 10:00:00+00',
        3600
      ),
      (
        'aaaaaaaa-0000-0000-0000-000000000004',
        '11111111-1111-1111-1111-111111111111',
        '2040-02-10 10:00:00+00',
        '2040-02-10 11:00:00+00',
        3600
      )
  $$,
  'same-user time blocks may be exactly adjacent'
);

select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      '2040-02-10 09:30:00+00',
      '2040-02-10 10:30:00+00',
      3600
    )
  $$,
  '23P01',
  null,
  'same-user partially overlapping time blocks are rejected'
);

select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      '2040-02-10 08:30:00+00',
      '2040-02-10 11:30:00+00',
      10800
    )
  $$,
  '23P01',
  null,
  'same-user containing time blocks are rejected'
);

select * from finish();

rollback;