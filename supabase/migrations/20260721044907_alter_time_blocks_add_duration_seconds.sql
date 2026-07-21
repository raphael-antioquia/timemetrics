alter table public.time_blocks
  alter column ended_at set not null;

alter table public.time_blocks
  add column duration_seconds integer not null;

alter table public.time_blocks
  drop constraint if exists time_blocks_valid_time_range;

alter table public.time_blocks
  add constraint time_blocks_valid_time_range
    check (ended_at > started_at);

alter table public.time_blocks
  add constraint time_blocks_duration_positive
    check (duration_seconds > 0);

alter table public.time_blocks
  add constraint time_blocks_duration_within_range
    check (
      duration_seconds <=
      extract(epoch from (ended_at - started_at))
    );