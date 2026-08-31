begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

-- ---------------------------------------------------------------------------
-- Harness sanity.
--
-- This test introspects catalogs rather than switching roles, so there is no
-- deny-all vacuity risk. Assert the subjects exist so typos fail loudly.
-- ---------------------------------------------------------------------------

select has_role('anon');
select has_role('authenticated');
select has_table('public', 'profiles', 'public.profiles exists');
select has_table('public', 'categories', 'public.categories exists');
select has_table('public', 'activities', 'public.activities exists');
select has_table('public', 'time_blocks', 'public.time_blocks exists');

-- ---------------------------------------------------------------------------
-- anon holds nothing on the application tables.
--
-- table_privs_are compares the exact set, so this also proves the absence of
-- privileges such as TRUNCATE, TRIGGER, and REFERENCES rather than only CRUD.
-- ---------------------------------------------------------------------------

select table_privs_are(
  'public',
  'profiles',
  'anon',
  array[]::text[],
  'anon has no table privileges on profiles'
);

select table_privs_are(
  'public',
  'categories',
  'anon',
  array[]::text[],
  'anon has no table privileges on categories'
);

select table_privs_are(
  'public',
  'activities',
  'anon',
  array[]::text[],
  'anon has no table privileges on activities'
);

select table_privs_are(
  'public',
  'time_blocks',
  'anon',
  array[]::text[],
  'anon has no table privileges on time_blocks'
);

-- ---------------------------------------------------------------------------
-- profiles
--
-- Profile creation belongs to the SECURITY DEFINER handle_new_user trigger.
-- Reads and writes are column-scoped because plan_id is privileged.
-- ---------------------------------------------------------------------------

select table_privs_are(
  'public',
  'profiles',
  'authenticated',
  array[]::text[],
  'authenticated has no table-level privileges on profiles'
);

-- This pgTAP build predates PostgreSQL 17's MAINTAIN privilege, so
-- table_privs_are does not include it in its exact-set comparison.
select ok(
  not has_table_privilege(
    'authenticated',
    'public.profiles',
    'MAINTAIN'
  ),
  'authenticated may not maintain profiles'
);

select column_privs_are(
  'public',
  'profiles',
  'id',
  'authenticated',
  array['SELECT'],
  'authenticated may read profiles.id'
);

select column_privs_are(
  'public',
  'profiles',
  'timezone',
  'authenticated',
  array['SELECT', 'UPDATE'],
  'authenticated may read and write profiles.timezone'
);

select column_privs_are(
  'public',
  'profiles',
  'plan_id',
  'authenticated',
  array[]::text[],
  'authenticated may not read or write profiles.plan_id'
);

select column_privs_are(
  'public',
  'profiles',
  'created_at',
  'authenticated',
  array[]::text[],
  'authenticated has no privileges on profiles.created_at'
);

select column_privs_are(
  'public',
  'profiles',
  'updated_at',
  'authenticated',
  array[]::text[],
  'authenticated has no privileges on profiles.updated_at'
);

-- ---------------------------------------------------------------------------
-- categories
--
-- Categories are not used directly by the application. The activities
-- INSERT and UPDATE policies reference id and user_id for ownership checks.
-- ---------------------------------------------------------------------------

select table_privs_are(
  'public',
  'categories',
  'authenticated',
  array[]::text[],
  'authenticated has no table-level privileges on categories'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.categories',
    'MAINTAIN'
  ),
  'authenticated may not maintain categories'
);

select column_privs_are(
  'public',
  'categories',
  'id',
  'authenticated',
  array['SELECT'],
  'authenticated may read categories.id for activity RLS'
);

select column_privs_are(
  'public',
  'categories',
  'user_id',
  'authenticated',
  array['SELECT'],
  'authenticated may read categories.user_id for activity RLS'
);

select column_privs_are(
  'public',
  'categories',
  'name',
  'authenticated',
  array[]::text[],
  'authenticated has no privileges on categories.name'
);

select column_privs_are(
  'public',
  'categories',
  'created_at',
  'authenticated',
  array[]::text[],
  'authenticated has no privileges on categories.created_at'
);

select column_privs_are(
  'public',
  'categories',
  'updated_at',
  'authenticated',
  array[]::text[],
  'authenticated has no privileges on categories.updated_at'
);

-- ---------------------------------------------------------------------------
-- activities
--
-- SELECT and DELETE are table-level. INSERT and UPDATE remain column-scoped.
-- column_privs_are includes inherited table-level grants, so SELECT appears
-- in every column expectation below.
-- ---------------------------------------------------------------------------

select table_privs_are(
  'public',
  'activities',
  'authenticated',
  array['SELECT', 'DELETE'],
  'authenticated may read and delete activities, nothing more table-wide'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.activities',
    'MAINTAIN'
  ),
  'authenticated may not maintain activities'
);

select column_privs_are(
  'public',
  'activities',
  'user_id',
  'authenticated',
  array['SELECT', 'INSERT'],
  'activities.user_id is set on create and never reassigned'
);

select column_privs_are(
  'public',
  'activities',
  'name',
  'authenticated',
  array['SELECT', 'INSERT', 'UPDATE'],
  'activities.name is the only editable field'
);

select column_privs_are(
  'public',
  'activities',
  'id',
  'authenticated',
  array['SELECT'],
  'activities.id is database-controlled'
);

select column_privs_are(
  'public',
  'activities',
  'category_id',
  'authenticated',
  array['SELECT'],
  'activities.category_id is not client-writable while categories is unused'
);

select column_privs_are(
  'public',
  'activities',
  'created_at',
  'authenticated',
  array['SELECT'],
  'activities.created_at is database-controlled'
);

select column_privs_are(
  'public',
  'activities',
  'updated_at',
  'authenticated',
  array['SELECT'],
  'activities.updated_at is owned by the set_updated_at trigger'
);

-- ---------------------------------------------------------------------------
-- time_blocks
-- ---------------------------------------------------------------------------

select table_privs_are(
  'public',
  'time_blocks',
  'authenticated',
  array['SELECT', 'DELETE'],
  'authenticated may read and delete time blocks, nothing more table-wide'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.time_blocks',
    'MAINTAIN'
  ),
  'authenticated may not maintain time blocks'
);

select column_privs_are(
  'public',
  'time_blocks',
  'user_id',
  'authenticated',
  array['SELECT', 'INSERT'],
  'time_blocks.user_id is set on create and cannot be reassigned'
);

select column_privs_are(
  'public',
  'time_blocks',
  'activity_id',
  'authenticated',
  array['SELECT', 'INSERT', 'UPDATE'],
  'time_blocks.activity_id is editable'
);

select column_privs_are(
  'public',
  'time_blocks',
  'started_at',
  'authenticated',
  array['SELECT', 'INSERT', 'UPDATE'],
  'time_blocks.started_at is editable'
);

select column_privs_are(
  'public',
  'time_blocks',
  'ended_at',
  'authenticated',
  array['SELECT', 'INSERT', 'UPDATE'],
  'time_blocks.ended_at is editable'
);

select column_privs_are(
  'public',
  'time_blocks',
  'duration_seconds',
  'authenticated',
  array['SELECT', 'INSERT', 'UPDATE'],
  'time_blocks.duration_seconds is editable'
);

select column_privs_are(
  'public',
  'time_blocks',
  'id',
  'authenticated',
  array['SELECT'],
  'time_blocks.id is database-controlled'
);

select column_privs_are(
  'public',
  'time_blocks',
  'created_at',
  'authenticated',
  array['SELECT'],
  'time_blocks.created_at is database-controlled'
);

select column_privs_are(
  'public',
  'time_blocks',
  'updated_at',
  'authenticated',
  array['SELECT'],
  'time_blocks.updated_at is owned by the set_updated_at trigger'
);

-- ---------------------------------------------------------------------------
-- Schema-wide anon sweep.
--
-- This catches future public relations with either relation- or column-level
-- privileges granted to anon or PUBLIC, which anon inherits.
-- ---------------------------------------------------------------------------

select is_empty(
  $$
    select n.nspname, c.relname, a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.grantee in ('anon'::regrole, 0)
  $$,
  'no relation in public grants table privileges to anon or PUBLIC'
);

select is_empty(
  $$
    select n.nspname, c.relname, att.attname, a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute att
      on att.attrelid = c.oid
     and att.attnum > 0
     and not att.attisdropped
    cross join lateral aclexplode(att.attacl) a
    where n.nspname = 'public'
      and a.grantee in ('anon'::regrole, 0)
  $$,
  'no column in public grants privileges to anon or PUBLIC'
);

select * from finish();

rollback;
