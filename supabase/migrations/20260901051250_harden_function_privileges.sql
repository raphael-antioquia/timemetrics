-- Policy:
--   PUBLIC / anon / service_role -> no direct EXECUTE on public routines
--   authenticated                -> only required application routines
--   postgres owner               -> unaffected
--
-- Default privileges are role-specific. These rules cover routines created
-- by postgres, which is the role used by this project's migrations. Routines
-- created by another role have that role's own default privilege policy.

revoke execute on all routines in schema public
from public, anon, authenticated, service_role;

grant execute
on function public.get_daily_activity_totals(date, date, text)
to authenticated;

grant execute
on function public.time_blocks_for_today(text)
to authenticated;

grant execute
on function public.is_allowed_profile_timezone(text)
to authenticated;

-- Global scope is required because per-schema default privileges cannot
-- subtract PostgreSQL's built-in EXECUTE-to-PUBLIC default.
--
-- This affects future routines created by postgres in any schema, not only
-- public. Extension-installed routines created under postgres are therefore
-- also subject to this default unless the extension establishes its own
-- privileges. Grant EXECUTE explicitly if a future workflow requires it.
alter default privileges for role postgres
revoke execute on routines
from public;

-- Reverse the baseline's schema-scoped client/service grants.
alter default privileges for role postgres in schema public
revoke execute on routines
from anon, authenticated, service_role;