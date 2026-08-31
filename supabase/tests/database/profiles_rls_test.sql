begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- ---------------------------------------------------------------------------
-- Fixtures: seed as postgres
--
-- auth.users inserts automatically create public.profiles rows through
-- on_auth_user_created.
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values
  ('11111111-1111-1111-1111-111111111111'), -- Alice
  ('22222222-2222-2222-2222-222222222222'); -- Bob

-- ---------------------------------------------------------------------------
-- Act as Alice
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- 1. SELECT: Alice sees her profile and not Bob's.
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
-- Pin the error message because both the column-grant layer and RLS return
-- SQLSTATE 42501; the message proves which protection rejected it. This is a
-- Postgres internal rather than a stable API, so a major version upgrade or
-- non-English lc_messages can change it.
select throws_ok(
  $$
    update public.profiles
    set plan_id = 'pro'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '42501',
  'permission denied for table profiles',
  'Alice cannot update her own plan'
);

reset role;

select * from finish();

rollback;
