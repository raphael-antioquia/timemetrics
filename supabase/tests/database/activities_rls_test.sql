begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

-- ---------------------------------------------------------------------------
-- Fixtures: seed as postgres
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

insert into public.activities (
  id,
  user_id,
  category_id,
  name
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '11111111-1111-1111-1111-111111111111',
    null,
    'Alice Activity'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '22222222-2222-2222-2222-222222222222',
    null,
    'Bob Activity'
  );

-- ---------------------------------------------------------------------------
-- Act as Alice
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- SELECT: prove identity, not merely row count.
select results_eq(
  'select id from public.activities',
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid],
  'Alice reads her own activity and not Bob''s'
);

-- INSERT positive control.
select lives_ok(
  $$
    insert into public.activities (
      user_id,
      name
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'Alice Inserted Activity'
    )
  $$,
  'Alice can create her own activity'
);

-- Alice cannot create an activity owned by Bob.
-- Pin the Postgres-internal message because both grants and RLS use 42501;
-- this assertion specifically proves rejection by the RLS policy.
select throws_ok(
  $$
    insert into public.activities (
      user_id,
      name
    )
    values (
      '22222222-2222-2222-2222-222222222222',
      'Injected Bob Activity'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "activities"',
  'Alice cannot create an activity owned by Bob'
);

-- UPDATE positive control.
select lives_ok(
  $$
    update public.activities
    set name = 'Alice Activity Updated'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  $$,
  'Alice can update her own activity'
);

-- Prove the update actually affected the row.
select is(
  (
    select name
    from public.activities
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  ),
  'Alice Activity Updated',
  'Alice update affected her activity'
);

-- Bob's hidden activity should be filtered by UPDATE USING.
select lives_ok(
  $$
    update public.activities
    set name = 'Alice Tried To Rename Bob Activity'
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  $$,
  'Updating Bob''s hidden activity does not raise'
);

-- Inspect actual database state as postgres.
reset role;

select is(
  (
    select name
    from public.activities
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  ),
  'Bob Activity',
  'Alice cannot update Bob''s activity'
);

set local role authenticated;

-- DELETE positive control.
select lives_ok(
  $$
    delete from public.activities
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  $$,
  'Alice can delete her own activity'
);

reset role;

-- Verify physical deletion, not just RLS invisibility.
select is(
  (
    select count(*)
    from public.activities
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  ),
  0::bigint,
  'Alice delete removed her activity'
);

set local role authenticated;

-- Bob's hidden activity should be filtered by DELETE USING.
select lives_ok(
  $$
    delete from public.activities
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  $$,
  'Deleting Bob''s hidden activity does not raise'
);

reset role;

select is(
  (
    select count(*)
    from public.activities
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  ),
  1::bigint,
  'Alice cannot delete Bob''s activity'
);

select * from finish();

rollback;
