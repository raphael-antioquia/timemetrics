drop policy if exists "Users can update own profile"
on public.profiles;

revoke update (timezone)
on table public.profiles
from authenticated;

alter table public.profiles
drop column if exists timezone;

-- Restore the table-level privileges that existed before
-- the timezone migration.
grant update
on table public.profiles
to anon, authenticated;