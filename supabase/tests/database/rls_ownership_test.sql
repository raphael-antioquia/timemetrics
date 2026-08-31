begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- ---------------------------------------------------------------------------
-- Fixtures
--
-- Seed as postgres before switching to the authenticated role.
-- Inserting auth.users automatically creates public.profiles through
-- the on_auth_user_created trigger.
-- ---------------------------------------------------------------------------

-- Alice
insert into auth.users (id)
values ('11111111-1111-1111-1111-111111111111');

-- Bob
insert into auth.users (id)
values ('22222222-2222-2222-2222-222222222222');

-- Alice's activities
insert into public.activities (
  id,
  user_id,
  name
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    'Alice Activity A'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '11111111-1111-1111-1111-111111111111',
    'Alice Activity B'
  );

-- Bob's activity
insert into public.activities (
  id,
  user_id,
  name
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'Bob Activity'
);

-- Existing legitimate Alice block.
-- Keep all test windows distinct because time_blocks has a
-- per-user exclusion constraint preventing overlaps.
insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '2026-01-01 09:00:00+00',
  '2026-01-01 09:30:00+00',
  1800
);

-- ---------------------------------------------------------------------------
-- Act as Alice
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- ---------------------------------------------------------------------------
-- INSERT
-- ---------------------------------------------------------------------------

-- Positive control:
-- prove Alice has INSERT permission and can reference her own activity.
select lives_ok(
  $$
    insert into public.time_blocks (
      user_id,
      activity_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
      '2026-01-01 10:00:00+00',
      '2026-01-01 10:30:00+00',
      1800
    )
  $$,
  'Alice can create a time block against her own activity'
);

-- Ownership check:
-- same operation and grants, but Bob's activity must be rejected
-- by the INSERT WITH CHECK policy.
select throws_ok(
  $$
    insert into public.time_blocks (
      user_id,
      activity_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      '2026-01-01 11:00:00+00',
      '2026-01-01 11:30:00+00',
      1800
    )
  $$,
  '42501',
  null::text,
  'Alice cannot create a time block against Bob''s activity'
);

-- ---------------------------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------------------------

-- Positive control:
-- prove Alice has UPDATE permission on activity_id and can move her
-- existing block from one Alice-owned activity to another.
select lives_ok(
  $$
    update public.time_blocks
    set activity_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
  $$,
  'Alice can update her time block to another activity she owns'
);

-- lives_ok would also succeed on UPDATE 0, so verify the row actually changed.
select is(
  (
    select activity_id
    from public.time_blocks
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
  ),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'::uuid,
  'Alice activity update affected the expected time block'
);

-- Ownership check:
-- Alice still owns the time block, but Bob owns the proposed activity.
-- The UPDATE WITH CHECK policy must reject the new row.
select throws_ok(
  $$
    update public.time_blocks
    set activity_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
  $$,
  '42501',
  null::text,
  'Alice cannot update her time block to Bob''s activity'
);

-- Return to postgres before pgTAP cleanup.
reset role;

select * from finish();

rollback;
