begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Fixtures: seed as postgres
-- ---------------------------------------------------------------------------

insert into auth.users (id)
values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');

-- Alice's existing block
insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '11111111-1111-1111-1111-111111111111',
  null,
  '2026-01-02 09:00:00+00',
  '2026-01-02 09:30:00+00',
  1800
);

-- Bob's existing block
insert into public.time_blocks (
  id,
  user_id,
  activity_id,
  started_at,
  ended_at,
  duration_seconds
)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '22222222-2222-2222-2222-222222222222',
  null,
  '2026-01-02 09:00:00+00',
  '2026-01-02 09:30:00+00',
  1800
);

-- ---------------------------------------------------------------------------
-- Act as Alice
-- ---------------------------------------------------------------------------

set local request.jwt.claim.sub =
  '11111111-1111-1111-1111-111111111111';

set local role authenticated;

-- SELECT: Alice sees her row, not Bob's.
select results_eq(
  'select id from public.time_blocks',
  array['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'::uuid],
  'Alice reads her own time block and not Bob''s'
);

-- INSERT positive control.
select lives_ok(
  $$
    insert into public.time_blocks (
      id,
      user_id,
      activity_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      '11111111-1111-1111-1111-111111111111',
      null,
      '2026-01-02 10:00:00+00',
      '2026-01-02 10:30:00+00',
      1800
    )
  $$,
  'Alice can create her own time block'
);

-- INSERT ownership violation.
-- The same INSERT privilege exists, but WITH CHECK must reject Bob ownership.
select throws_ok(
  $$
    insert into public.time_blocks (
      id,
      user_id,
      activity_id,
      started_at,
      ended_at,
      duration_seconds
    )
    values (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      '22222222-2222-2222-2222-222222222222',
      null,
      '2026-01-02 10:00:00+00',
      '2026-01-02 10:30:00+00',
      1800
    )
  $$,
  '42501',
  null::text,
  'Alice cannot create a time block owned by Bob'
);

-- UPDATE positive control.
select lives_ok(
  $$
    update public.time_blocks
    set duration_seconds = 1200
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  $$,
  'Alice can update her own time block'
);

-- Prove the UPDATE actually matched a row.
select is(
  (
    select duration_seconds
    from public.time_blocks
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  ),
  1200,
  'Alice update affected her time block'
);

-- Alice must not be able to transfer ownership of her own row to Bob.
-- Use the 10:00–10:30 block so no exclusion-constraint overlap can
-- obscure the expected RLS failure.
select throws_ok(
  $$
    update public.time_blocks
    set user_id = '22222222-2222-2222-2222-222222222222'
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'
  $$,
  '42501',
  null::text,
  'Alice cannot reassign her time block to Bob'
);

-- UPDATE against Bob should be silently filtered by USING.
select lives_ok(
  $$
    update public.time_blocks
    set duration_seconds = 1200
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  $$,
  'Updating Bob''s hidden time block does not raise'
);

-- Inspect as postgres to prove Bob's row was untouched.
reset role;

select is(
  (
    select duration_seconds
    from public.time_blocks
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  ),
  1800,
  'Alice cannot update Bob''s time block'
);

set local role authenticated;

-- DELETE positive control.
select lives_ok(
  $$
    delete from public.time_blocks
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  $$,
  'Alice can delete her own time block'
);

reset role;

-- Verify against actual database state, not Alice's RLS-visible state.
select is(
  (
    select count(*)
    from public.time_blocks
    where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
  ),
  0::bigint,
  'Alice delete removed her time block'
);

set local role authenticated;

-- DELETE against Bob should also be silently filtered.
select lives_ok(
  $$
    delete from public.time_blocks
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  $$,
  'Deleting Bob''s hidden time block does not raise'
);

-- Inspect privileged state to prove Bob survived Alice's DELETE.
reset role;

select is(
  (
    select count(*)
    from public.time_blocks
    where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
  ),
  1::bigint,
  'Alice cannot delete Bob''s time block'
);

select * from finish();

rollback;