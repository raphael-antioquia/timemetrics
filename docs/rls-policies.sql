-- =============================================================================
-- TimeMetrics: Row Level Security (RLS) Policies
-- =============================================================================
-- Purpose: Enforce that every authenticated user can only read, create,
--          update, or delete their OWN data across all core tables.
--
-- Tables covered: profiles, categories, activities, time_blocks
--
-- Notes:
--   - `(select auth.uid())` is wrapped in a subquery (an "initPlan") so
--     Postgres evaluates it once per query instead of once per row.
--     This matters for performance as tables like time_blocks grow.
--   - `profiles` has NO update or delete policy on purpose. This means
--     users currently cannot modify their profile row at all from the
--     client (including plan_id), and deletion is only possible via
--     cascade from auth.users (service role / admin action).
--   - `categories`/`activities`/`time_blocks` all follow the same
--     ownership pattern: select/insert/update/delete gated on
--     `user_id = auth.uid()`.
--   - `activities` and `time_blocks` additionally validate that any
--     foreign key they point to (category_id / activity_id) belongs
--     to the SAME user. Without this check, a user could link their
--     own activity to another user's category (or their own time
--     block to another user's activity) since those FK columns are
--     nullable and not otherwise scoped by ownership.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Enable RLS on all core tables
-- -----------------------------------------------------------------------------
-- RLS is OFF by default in Postgres. Until enabled, table owners and
-- roles with sufficient privileges can bypass policies entirely.
-- Enabling RLS means: no policy = no access (fail closed).

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.activities enable row level security;
alter table public.time_blocks enable row level security;


-- -----------------------------------------------------------------------------
-- 2. Profiles
-- -----------------------------------------------------------------------------
-- Users can read their own profile row, and create it once during signup
-- as a 'free' plan. There is intentionally no UPDATE policy: this
-- prevents any client-side modification of plan_id (or anything else
-- on this row) via the anon/authenticated key. Plan upgrades should be
-- handled server-side (e.g. via service_role after a Stripe webhook).

create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can create own free profile"
on public.profiles
for insert
to authenticated
with check (
  (select auth.uid()) = id
  and plan_id = 'free'::public.plan  -- forces new signups to start on 'free',
                                      -- client cannot insert as 'pro'
);


-- -----------------------------------------------------------------------------
-- 3. Categories
-- -----------------------------------------------------------------------------
-- Standard full-CRUD ownership policy. A user can only see/create/update/
-- delete categories where user_id matches their own auth.uid().

create policy "Users can read own categories"
on public.categories
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own categories"
on public.categories
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own categories"
on public.categories
for update
to authenticated
using ((select auth.uid()) = user_id)       -- row must belong to user BEFORE update
with check ((select auth.uid()) = user_id); -- row must still belong to user AFTER update

create policy "Users can delete own categories"
on public.categories
for delete
to authenticated
using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- 4. Activities
-- -----------------------------------------------------------------------------
-- Same ownership pattern as categories, PLUS a cross-table check:
-- if an activity references a category_id, that category must also
-- belong to the same user. This stops a user from attaching their
-- activity to someone else's category (category_id is a nullable FK
-- and isn't otherwise restricted by a composite ownership constraint).

create policy "Users can read own activities"
on public.activities
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own activities"
on public.activities
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    category_id is null  -- activities without a category are always allowed
    or exists (           -- otherwise, the referenced category must be owned by this user
      select 1
      from public.categories c
      where c.id = category_id
        and c.user_id = (select auth.uid())
    )
  )
);

create policy "Users can update own activities"
on public.activities
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    category_id is null
    or exists (
      select 1
      from public.categories c
      where c.id = category_id
        and c.user_id = (select auth.uid())
    )
  )
);

create policy "Users can delete own activities"
on public.activities
for delete
to authenticated
using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- 5. Time blocks
-- -----------------------------------------------------------------------------
-- Same ownership pattern again, PLUS a cross-table check mirroring the
-- one on activities: if a time block references an activity_id, that
-- activity must belong to the same user. Prevents linking a time block
-- to someone else's activity.

create policy "Users can read own time blocks"
on public.time_blocks
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create own time blocks"
on public.time_blocks
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    activity_id is null  -- time blocks without an activity are always allowed
    or exists (            -- otherwise, the referenced activity must be owned by this user
      select 1
      from public.activities a
      where a.id = activity_id
        and a.user_id = (select auth.uid())
    )
  )
);

create policy "Users can update own time blocks"
on public.time_blocks
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    activity_id is null
    or exists (
      select 1
      from public.activities a
      where a.id = activity_id
        and a.user_id = (select auth.uid())
    )
  )
);

create policy "Users can delete own time blocks"
on public.time_blocks
for delete
to authenticated
using ((select auth.uid()) = user_id);


-- =============================================================================
-- Result: Core security guarantee
-- =============================================================================
-- Users can only ever access (read/write) their own TimeMetrics data:
-- profiles, categories, activities, and time_blocks are all scoped to
-- auth.uid(), and cross-references between tables (category_id,
-- activity_id) are validated to also belong to the same user.
--
-- service_role bypasses RLS entirely — used for admin/server-side logic
-- such as auto-creating a profile row on signup (next step).
-- =============================================================================