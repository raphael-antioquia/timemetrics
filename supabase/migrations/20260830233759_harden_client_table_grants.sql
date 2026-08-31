-- Restrict client-facing TABLE privileges to the operations and columns the
-- V1 application actually performs.
--
-- Scope: table grants only. RLS remains the row-level authorization boundary
-- and is unchanged. Function EXECUTE grants and default function/sequence
-- privileges are deliberately out of scope and tracked separately.
--
-- This is defense-in-depth, not a fix for a known authorization vulnerability:
-- RLS already blocked the operations these grants now prevent from being
-- attempted at all.

-- ---------------------------------------------------------------------------
-- Reset.
--
-- Table-level REVOKE ALL also clears column-level grants, so this subsumes the
-- baseline's GRANT UPDATE(timezone) on profiles. Ordering is load-bearing:
-- every GRANT below must come after this statement.
-- ---------------------------------------------------------------------------
revoke all privileges on table
  public.profiles,
  public.categories,
  public.activities,
  public.time_blocks
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- profiles
--
-- No table-level privileges. Rows are created by the SECURITY DEFINER
-- handle_new_user() trigger, which inserts under the function owner's rights
-- and therefore needs no client grant. Reads are column-scoped because
-- plan_id is a privileged column that must not become client-writable.
-- ---------------------------------------------------------------------------
grant select (id, timezone) on table public.profiles to authenticated;
grant update (timezone) on table public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- categories
--
-- Not accessed by the application. These two columns are readable only
-- because the activities INSERT/UPDATE policies contain a subquery against
-- this table; relation privileges are checked at executor startup, so the
-- category_id IS NULL short-circuit does not avoid the requirement.
--
-- Building a categories feature later requires its own grants.
-- ---------------------------------------------------------------------------
grant select (id, user_id) on table public.categories to authenticated;

-- ---------------------------------------------------------------------------
-- activities
--
-- Table-level SELECT: RLS constrains rows, there is no privileged column, and
-- column-scoping reads would break silently at runtime on the next schema
-- addition. Writes are column-scoped, which is where the protection lives.
-- ---------------------------------------------------------------------------
grant select on table public.activities to authenticated;
grant insert (user_id, name) on table public.activities to authenticated;
grant update (name) on table public.activities to authenticated;
grant delete on table public.activities to authenticated;

-- ---------------------------------------------------------------------------
-- time_blocks
--
-- user_id is writable on INSERT only, so a block cannot be reassigned to
-- another user even if RLS were misconfigured. id, created_at, and
-- updated_at stay database-controlled.
-- ---------------------------------------------------------------------------
grant select on table public.time_blocks to authenticated;
grant insert (
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
) on table public.time_blocks to authenticated;
grant update (
  activity_id,
  started_at,
  ended_at,
  duration_seconds
) on table public.time_blocks to authenticated;
grant delete on table public.time_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- Future tables.
--
-- The baseline granted ALL on every new postgres-created table in public to
-- anon and authenticated, which would regenerate this problem on the next
-- migration. Note this affects only future objects created by postgres;
-- objects created by other roles are unaffected.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated;
