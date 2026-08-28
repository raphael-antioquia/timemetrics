begin;

select plan(1);

select ok(
  true,
  'database test harness is working'
);

select * from finish();

rollback;
