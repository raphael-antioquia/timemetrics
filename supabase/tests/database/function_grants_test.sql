begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Harness sanity.
-- ---------------------------------------------------------------------------

select has_role('anon');
select has_role('authenticated');
select has_role('service_role');

-- Default privileges below are specifically for objects created by postgres.
select is(
  current_user::text,
  'postgres',
  'function grant tests run as postgres'
);

-- ---------------------------------------------------------------------------
-- Existing public routines.
--
-- Direct execution is deny-by-default. authenticated may execute only the
-- routines required by current application workflows.
-- ---------------------------------------------------------------------------

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) a
    where n.nspname = 'public'
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  $$,
  'no public routine grants EXECUTE to PUBLIC'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'anon cannot execute public routines'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        has_function_privilege(
          'authenticated',
          p.oid,
          'EXECUTE'
        )
        is distinct from (
          p.oid = any(
            array[
              'public.get_daily_activity_totals(date,date,text)'::regprocedure::oid,
              'public.time_blocks_for_today(text)'::regprocedure::oid,
              'public.is_allowed_profile_timezone(text)'::regprocedure::oid
            ]
          )
        )
      )
  $$,
  'authenticated EXECUTE privileges match the application allowlist'
);

select is_empty(
  $$
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
  $$,
  'service_role cannot execute public routines'
);

-- ---------------------------------------------------------------------------
-- Default privileges for future routines.
--
-- This function is created by postgres inside the transaction so it exercises
-- postgres's actual default privileges. rollback removes it afterward.
-- ---------------------------------------------------------------------------

create function public.zz_default_function_privs_probe()
returns integer
language sql
as $$
  select 1;
$$;

select is_empty(
  $$
    select 1
    from pg_proc p
    cross join lateral aclexplode(
      coalesce(p.proacl, acldefault('f', p.proowner))
    ) a
    where p.oid =
      'public.zz_default_function_privs_probe()'::regprocedure
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  $$,
  'a newly created public function grants PUBLIC no EXECUTE'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.zz_default_function_privs_probe()',
    'EXECUTE'
  ),
  'a newly created public function grants anon no EXECUTE'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.zz_default_function_privs_probe()',
    'EXECUTE'
  ),
  'a newly created public function grants authenticated no EXECUTE'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.zz_default_function_privs_probe()',
    'EXECUTE'
  ),
  'a newly created public function grants service_role no EXECUTE'
);

select * from finish();

rollback;