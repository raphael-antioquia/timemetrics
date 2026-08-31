begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- ---------------------------------------------------------------------------
-- Fixtures: prove rows genuinely exist before testing anon visibility.
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values ('11111111-1111-1111-1111-111111111111');

-- auth.users trigger creates Alice's profile automatically.

insert into public.activities (
  id,
  user_id,
  name
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Alice Activity'
);

insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '11111111-1111-1111-1111-111111111111',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2026-01-03 09:00:00+00',
  '2026-01-03 09:30:00+00',
  1800
);

-- ---------------------------------------------------------------------------
-- Act as an unauthenticated caller.
-- ---------------------------------------------------------------------------

set local role anon;

-- Prove the harness is genuinely running as anon.
select is(
  current_user::text,
  'anon',
  'session is using the anon role'
);

select ok(
  auth.uid() is null,
  'anon session has no authenticated user id'
);

-- Table grants reject anonymous reads before RLS is evaluated.
select throws_ok(
  'select id from public.profiles',
  '42501',
  null::text,
  'anon cannot read profiles'
);

select throws_ok(
  'select id from public.activities',
  '42501',
  null::text,
  'anon cannot read activities'
);

select throws_ok(
  'select id from public.time_blocks',
  '42501',
  null::text,
  'anon cannot read time blocks'
);

reset role;

select * from finish();

rollback;
