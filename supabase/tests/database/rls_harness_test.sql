begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

-- Every table exposed through public must have RLS enabled.
select is_empty(
  $$select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename not in (
        select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relrowsecurity
      )$$,
  'every table in public has RLS enabled'
);

-- Simulate Alice's authenticated session.
-- Configure claims before dropping privileges.
set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- Prove auth.uid() is reading the identity we supplied.
select is(
  auth.uid(),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'session is acting as Alice'
);

-- Prove RLS queries will not execute as postgres/superuser.
select is(
  current_user::text,
  'authenticated',
  'session is using the authenticated role'
);

-- Return to the original role before pgTAP cleanup.
reset role;

select * from finish();

rollback;