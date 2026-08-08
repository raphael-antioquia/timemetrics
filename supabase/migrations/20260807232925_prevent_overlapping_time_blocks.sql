create extension if not exists btree_gist
with schema extensions;

-- A user cannot have two time blocks whose session envelopes overlap.
--
-- The envelope is [started_at, ended_at), so back-to-back sessions
-- are allowed.
--
-- Timer pauses are included inside this envelope even though paused
-- time is excluded from duration_seconds.
alter table public.time_blocks
  add constraint time_blocks_no_overlap
  exclude using gist (
    user_id with =,
    tstzrange(started_at, ended_at, '[)') with &&
  );