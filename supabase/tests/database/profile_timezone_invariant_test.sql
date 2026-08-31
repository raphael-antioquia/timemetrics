begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

-- ---------------------------------------------------------------------------
-- Fixture: auth.users insert creates public.profiles through
-- on_auth_user_created.
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values ('11111111-1111-1111-1111-111111111111');

-- ---------------------------------------------------------------------------
-- Act as Alice.
--
-- These writes intentionally use the authenticated role because authenticated
-- clients have direct UPDATE(timezone) privileges. The database invariant must
-- protect this boundary independently of application validation.
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Harness
-- ---------------------------------------------------------------------------

select is(
  current_user::text,
  'authenticated',
  'harness runs as the authenticated role'
);

select is(
  (select auth.uid()),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'harness acts as Alice'
);

-- ---------------------------------------------------------------------------
-- Valid profile timezones
-- ---------------------------------------------------------------------------

select lives_ok(
  $$
    update public.profiles
    set timezone = 'America/Toronto'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  'A canonical named timezone is accepted'
);

select is(
  (
    select timezone
    from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  ),
  'America/Toronto',
  'A canonical named timezone is stored'
);

select lives_ok(
  $$
    update public.profiles
    set timezone = 'america/toronto'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  'Timezone resolution is case-insensitive'
);

select is(
  (
    select timezone
    from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  ),
  'america/toronto',
  'A lowercase zone is stored verbatim, not canonicalized'
);

select lives_ok(
  $$
    update public.profiles
    set timezone = 'UTC'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  'UTC remains an allowed profile timezone'
);

select is(
  (
    select timezone
    from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'
  ),
  'UTC',
  'UTC remains stored as an allowed profile timezone'
);

-- ---------------------------------------------------------------------------
-- Invalid profile timezones
-- ---------------------------------------------------------------------------

select throws_ok(
  $$
    update public.profiles
    set timezone = 'Definitely/Not-A-Timezone'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '22023',
  'invalid profile timezone',
  'An unresolvable timezone is rejected'
);

select throws_ok(
  $$
    update public.profiles
    set timezone = 'Etc/GMT+5'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '22023',
  'invalid profile timezone',
  'Etc timezones are rejected'
);

select throws_ok(
  $$
    update public.profiles
    set timezone = 'etc/GMT+5'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '22023',
  'invalid profile timezone',
  'Etc timezone rejection is case-insensitive'
);

select throws_ok(
  $$
    update public.profiles
    set timezone = 'UTC+05:00'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '22023',
  'invalid profile timezone',
  'UTC fixed-offset timezone forms are rejected'
);

select throws_ok(
  $$
    update public.profiles
    set timezone = '+05:00'
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '22023',
  'invalid profile timezone',
  'Bare fixed-offset timezone forms are rejected'
);

select throws_ok(
  $$
    update public.profiles
    set timezone = ''
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '22023',
  'invalid profile timezone',
  'An empty timezone is rejected'
);

select throws_ok(
  $$
    update public.profiles
    set timezone = '   '
    where id = '11111111-1111-1111-1111-111111111111'
  $$,
  '22023',
  'invalid profile timezone',
  'A whitespace-only timezone is rejected'
);

-- PostgreSQL and Intl.DateTimeFormat do not recognize exactly the same
-- timezone identifiers. For example, PostgreSQL may resolve 'Factory' while
-- Intl rejects it. That deliberate cross-runtime gap is handled by the
-- application read-side fallback and is not asserted as a database rejection.

reset role;

select * from finish();

rollback;