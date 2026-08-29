begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

-- ---------------------------------------------------------------------------
-- Fixtures: seed as postgres
--
-- auth.users inserts automatically create public.profiles rows through
-- on_auth_user_created.
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values
  ('11111111-1111-1111-1111-111111111111'), -- Alice
  ('22222222-2222-2222-2222-222222222222'), -- Bob
  ('33333333-3333-3333-3333-333333333333'); -- Charlie

-- ---------------------------------------------------------------------------
-- Act as Alice
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- 1. SELECT: Alice sees her profile and not Bob's or Charlie's.
select results_eq(
  'select id from public.profiles',
  array['11111111-1111-1111-1111-111111111111'::uuid],
  'Alice reads her own profile and not other users'' profiles'
);

-- ---------------------------------------------------------------------------
-- UPDATE
-- ---------------------------------------------------------------------------

-- 2. Alice can update the only column granted for UPDATE: timezone.
select lives_ok(
  $$
    update public.profiles
    set timezone = 'America/Toronto'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  'Alice can update her own timezone'
);

-- 3. Verify the update actually matched and changed Alice's row.
select is(
  (
    select timezone
    from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  ),
  'America/Toronto',
  'Alice timezone update affected her profile'
);

-- 4. Bob's profile is hidden by the UPDATE USING policy, so this should
-- affect zero rows rather than raise.
select lives_ok(
  $$
    update public.profiles
    set timezone = 'America/Vancouver'
    where id = '22222222-2222-2222-2222-222222222222'
  $$,
  'Updating Bob''s hidden profile does not raise'
);

-- 5. Inspect privileged state to prove Bob was untouched.
reset role;

select is(
  (
    select timezone
    from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'
  ),
  'UTC',
  'Alice cannot update Bob''s timezone'
);

set local role authenticated;

-- 6. authenticated only has UPDATE(timezone), not UPDATE(plan_id).
-- This should be blocked by column privileges before RLS is relevant.
select throws_ok(
  $$
    update public.profiles
    set plan_id = 'pro'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '42501',
  null::text,
  'Alice cannot update her own plan'
);

-- ---------------------------------------------------------------------------
-- DELETE
--
-- authenticated has the table DELETE privilege, but profiles has no DELETE
-- RLS policy. RLS therefore filters every profile from DELETE.
-- ---------------------------------------------------------------------------

-- 7. Alice's own DELETE should execute without an exception but affect 0 rows.
select lives_ok(
  $$
    delete from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  'Deleting Alice''s profile does not raise'
);

-- 8. Verify Alice's profile still exists using the privileged role.
reset role;

select is(
  (
    select count(*)
    from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  ),
  1::bigint,
  'Alice cannot delete her own profile'
);

set local role authenticated;

-- 9. Bob's profile is also inaccessible to DELETE.
select lives_ok(
  $$
    delete from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'
  $$,
  'Deleting Bob''s profile does not raise'
);

-- 10. Verify Bob's profile survived.
reset role;

select is(
  (
    select count(*)
    from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'
  ),
  1::bigint,
  'Alice cannot delete Bob''s profile'
);

-- ---------------------------------------------------------------------------
-- INSERT
--
-- Remove only Alice's and Charlie's trigger-created profiles as postgres.
-- Bob remains untouched so the earlier Bob isolation assertions remain
-- conceptually and physically true for the whole test.
-- ---------------------------------------------------------------------------

reset role;

delete from public.profiles
where id in (
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333'
);

-- auth.uid() is still Alice; only the database role was reset.
set local role authenticated;

-- 11. Alice may create her own profile when the plan is free.
select lives_ok(
  $$
    insert into public.profiles (
      id,
      plan_id
    )
    values (
      '11111111-1111-1111-1111-111111111111',
      'free'
    )
  $$,
  'Alice can create her own free profile'
);

-- 12. Alice may not create a profile belonging to Charlie.
select throws_ok(
  $$
    insert into public.profiles (
      id,
      plan_id
    )
    values (
      '33333333-3333-3333-3333-333333333333',
      'free'
    )
  $$,
  '42501',
  null::text,
  'Alice cannot create Charlie''s profile'
);

-- 13. Charlie owns this ID, but users may only create free profiles.
reset role;

set local request.jwt.claim.sub =
  '33333333-3333-3333-3333-333333333333';

set local role authenticated;

select throws_ok(
  $$
    insert into public.profiles (
      id,
      plan_id
    )
    values (
      '33333333-3333-3333-3333-333333333333',
      'pro'
    )
  $$,
  '42501',
  null::text,
  'Charlie cannot create his own profile with a pro plan'
);

reset role;

select * from finish();

rollback;