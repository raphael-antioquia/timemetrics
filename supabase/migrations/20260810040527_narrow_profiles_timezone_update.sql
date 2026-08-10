revoke update
on table public.profiles
from authenticated;

grant update (timezone)
on table public.profiles
to authenticated;

create policy "Users can update own timezone"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);