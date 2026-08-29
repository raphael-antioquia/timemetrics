begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- This is a constraint-layer test, not an RLS test.
-- Running as `authenticated` would cause the existing WITH CHECK policy
-- to reject cross-tenant writes with 42501, masking the missing FK invariant.
select is(
  current_user,
  'postgres',
  'integrity tests run as postgres, outside RLS'
);

-- ---------------------------------------------------------------------------
-- Fixtures
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
    'Alice integrity activity'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Bob integrity activity'
  );

-- ---------------------------------------------------------------------------
-- Control
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    insert into public.time_blocks (
      id,
      user_id,
      activity_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000001',
      '11111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '2040-01-01 10:00:00+00',
      '2040-01-01 11:00:00+00',
      3600
    )
  $$,
  'time block may reference an activity owned by the same user'
);

-- ---------------------------------------------------------------------------
-- INSERT invariant
-- ---------------------------------------------------------------------------
--
-- Alice's time block must not be able to reference Bob's activity.
-- A separate day keeps time_blocks_no_overlap out of the test.
-- We specifically require 23503: foreign_key_violation.

select throws_ok(
  $$
    insert into public.time_blocks (
      id,
      user_id,
      activity_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      'aaaaaaaa-0000-0000-0000-000000000002',
      '11111111-1111-1111-1111-111111111111',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '2040-01-02 10:00:00+00',
      '2040-01-02 11:00:00+00',
      3600
    )
  $$,
  '23503',
  null,
  'INSERT cannot reference an activity owned by another user'
);

-- ---------------------------------------------------------------------------
-- UPDATE invariant
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    update public.time_blocks
       set activity_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     where id = 'aaaaaaaa-0000-0000-0000-000000000001'
  $$,
  '23503',
  null,
  'UPDATE cannot repoint a time block at another user''s activity'
);

select * from finish();

rollback;
