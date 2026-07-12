-- =============================================================================
-- TimeMetrics: Auto-create profile on signup + security hardening
-- =============================================================================

-- Function: runs automatically after a new auth.users row is created.
-- Inserts a matching profiles row so the app never has to handle
-- "user exists but has no profile" as a state.
create or replace function public.handle_new_user()
returns trigger                    -- only callable as a trigger, not via API/RPC
language plpgsql
security definer                   -- runs as the function owner (privileged),
                                    -- not as the new user — needed because RLS
                                    -- would otherwise block this insert
set search_path = ''               -- prevents schema-hijacking; forces fully
                                    -- qualified table names below
as $$
begin
  insert into public.profiles (id)
  values (new.id);                 -- new.id = the id of the auth.users row
                                    -- that was just inserted. plan_id defaults
                                    -- to 'free' automatically (table default),
                                    -- so it's never set here or by the client.

  return new;                      -- required for AFTER triggers
end;
$$;

-- Drop any prior version of this trigger first so this script is safe to
-- rerun without erroring on "trigger already exists."
drop trigger if exists on_auth_user_created on auth.users;

-- Wires the function to fire automatically on every signup.
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Verification query
-- -----------------------------------------------------------------------------
-- Confirms the trigger actually ran: every recent auth user should have a
-- matching profiles row with plan_id = 'free'. If a user appears in
-- auth.users but is missing here, the trigger didn't fire.
select u.id, u.email, p.plan_id, p.created_at
from auth.users u
join public.profiles p on p.id = u.id
order by u.created_at desc
limit 5;


-- -----------------------------------------------------------------------------
-- Security hardening: revoke public/API execute access
-- -----------------------------------------------------------------------------

-- rls_auto_enable() is a Supabase-internal function that Security Advisor
-- flagged as callable by anon/authenticated via /rest/v1/rpc/rls_auto_enable.
-- Since it's security definer, anyone calling it directly would run it with
-- elevated privileges. Revoking execute closes this off. This was a real,
-- actionable warning.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- handle_new_user() is also security definer, so it's revoked here too as
-- defense-in-depth / consistency. NOTE: this isn't closing an active hole —
-- because the function is declared `returns trigger`, Postgres itself
-- refuses to let it be called directly via RPC regardless of grants. This
-- revoke just makes that explicit and protects against future changes
-- (e.g. if the return type is ever changed and this protection is forgotten).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;