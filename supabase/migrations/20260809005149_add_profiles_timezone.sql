-- Add a reporting timezone to profiles.
--
-- RLS controls WHICH ROW a user may update.
-- Column privileges control WHICH COLUMNS they may update.
-- These are paired deliberately: the policy alone would expose every column
-- the `authenticated` role holds UPDATE on, including plan_id.

alter table public.profiles
  add column timezone text;

-- The table-level UPDATE grant must be revoked first: revoking a table-level
-- privilege also clears the corresponding column privileges, so a narrow
-- grant issued beforehand would be wiped.
revoke update on table public.profiles
  from anon, authenticated;

grant update (timezone) on table public.profiles
  to authenticated;

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);