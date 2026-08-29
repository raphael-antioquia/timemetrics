-- The activities.id primary key already makes id globally unique.
-- This composite unique constraint exists so PostgreSQL can use
-- (id, user_id) as the referenced key for the tenancy-aware FK.
alter table public.activities
  add constraint activities_id_user_id_key
  unique (id, user_id);

-- Replace the activity-only FK with a tenancy-aware composite FK.
alter table public.time_blocks
  drop constraint time_blocks_activity_id_fkey;

alter table public.time_blocks
  add constraint time_blocks_activity_user_id_fkey
  foreign key (activity_id, user_id)
  references public.activities (id, user_id)
  on delete set null (activity_id);