begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

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
    'Alice Activity'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '22222222-2222-2222-2222-222222222222',
    'Bob Activity'
  );

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
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '2026-01-05 09:00:00+00',
    '2026-01-05 09:30:00+00',
    1800
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '22222222-2222-2222-2222-222222222222',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '2026-01-05 10:00:00+00',
    '2026-01-05 10:30:00+00',
    1800
  );

-- 1. Alice's relationship exists before deletion.
select is(
  (
    select activity_id
    from public.time_blocks
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  ),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'Alice time block initially references her activity'
);

-- 2. Delete Alice's activity.
select lives_ok(
  $$
    delete from public.activities
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  $$,
  'Alice activity can be deleted'
);

-- 3. Alice's activity is actually gone.
select is(
  (
    select count(*)
    from public.activities
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  ),
  0::bigint,
  'Alice activity was deleted'
);

-- 4. Alice's historical block survives, keeps its owner,
-- and only loses the deleted activity reference.
select results_eq(
  $$
    select user_id, activity_id
    from public.time_blocks
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  $$,
  $$
    values (
      '11111111-1111-1111-1111-111111111111'::uuid,
      null::uuid
    )
  $$,
  'deleting Alice''s activity preserves her time block and nulls only activity_id'
);

-- 5. Bob's unrelated block remains completely untouched.
select results_eq(
  $$
    select user_id, activity_id
    from public.time_blocks
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
  $$,
  $$
    values (
      '22222222-2222-2222-2222-222222222222'::uuid,
      'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
    )
  $$,
  'deleting Alice''s activity does not affect Bob''s time block'
);

select * from finish();

rollback;
