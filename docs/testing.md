# TimeMetrics Testing

TimeMetrics has two automated test layers:

1. a Vitest suite for TypeScript library behavior and selected server-side adapters; and
2. a PostgreSQL/pgTAP suite for database authorization, table and routine privileges, relational integrity, profile-timezone integrity, and RPC isolation.

These layers run independently. There is currently no browser, component, or end-to-end test suite connecting the rendered Next.js application to a real Supabase instance.

## Test Boundaries

| Layer     | Runs against                                         | Responsibility                                                                                                                                                                                                              |
| --------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest    | Node.js with mocked external boundaries where needed | Calendar and timezone utilities, profile-timezone validation/loading, analytics transformations and comparisons, timer-state validation, formatting, UUID validation, and the behavior of selected Supabase-facing helpers. |
| pgTAP     | The local PostgreSQL 17 instance managed by Supabase | RLS behavior, table/column and routine grants, default privileges, Auth identity simulation, cross-tenant isolation, foreign-key tenancy, profile-timezone integrity, deletion semantics, and analytics function security.  |
| CI checks | GitHub Actions                                       | Runs linting, TypeScript checking, Vitest, a production build, and the pgTAP suite in separate jobs.                                                                                                                        |

The repository structure suggests a deliberate boundary: deterministic calculations are tested as fast TypeScript units, while rules implemented by PostgreSQL are tested inside PostgreSQL. The latter cannot be established by mocking a Supabase client. A mock can confirm which RPC name or parameters application code uses, but it cannot prove that RLS filters rows, a role lacks a column or routine privilege, a trigger rejects invalid state, a future routine inherits safe default privileges, or a foreign key rejects a privileged cross-tenant write.

For the database rules themselves, see [Database](./database.md).

## Vitest Suite

[`vitest.config.ts`](../vitest.config.ts) discovers `src/**/*.test.{ts,tsx}` and uses TypeScript path aliases through `vite-tsconfig-paths`. No browser or DOM environment is configured, so these are Node-based tests rather than component tests.

The test process pins `TZ=America/Toronto`, a non-UTC timezone with daylight-saving transitions. This prevents date logic from passing only because a developer or CI machine happens to use UTC.

### Date, time, and timezone coverage

| Test file                                                                                    | Current coverage                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`format-datetime-local.test.ts`](../src/lib/time/format-datetime-local.test.ts)             | UTC-to-local conversion in standard and daylight time, previous-day rollover, invalid values, unambiguous round trips, and characterization of ambiguous fall-back and nonexistent spring-forward local times. It also asserts that the suite is actually running in `America/Toronto`.                                                                                                                 |
| [`ranges.test.ts`](../src/lib/time/ranges.test.ts)                                           | Seven- and 30-day trailing calendar ranges, local dates on either side of UTC, DST, month/year boundaries, leap day, invalid ranges, and the adjacency/equal-length invariant for previous comparison periods.                                                                                                                                                                                          |
| [`format-day-label.test.ts`](../src/lib/time/format-day-label.test.ts)                       | Stable calendar-date labels across week, month, and year boundaries plus malformed or impossible dates.                                                                                                                                                                                                                                                                                                 |
| [`format-duration.test.ts`](../src/lib/time/format-duration.test.ts)                         | Timer duration formatting, durations beyond 24 hours, analytics minute rounding, and hour-boundary behavior.                                                                                                                                                                                                                                                                                            |
| [`is-allowed-profile-timezone.test.ts`](../src/lib/time/is-allowed-profile-timezone.test.ts) | The application timezone policy for canonical and case-insensitive named zones, invalid identifiers, fixed-offset forms, case-insensitive `Etc/*` rejection, and empty/whitespace input. The suite also characterizes accepted aliases such as `EST` and application-only rejection such as `Factory`.                                                                                                  |
| [`get-user-timezone.test.ts`](../src/lib/time/get-user-timezone.test.ts)                     | Profile timezone retrieval, invalid stored-value detection with UTC fallback and Sentry warning, and Supabase error capture/rethrow behavior. The Supabase server client and Sentry are mocked.                                                                                                                                                                                                         |
| [`persisted-timer.test.ts`](../src/lib/time/persisted-timer.test.ts)                         | Restoration and rejection of browser-persisted running, paused, and pending-stop timer state, including authenticated-user ownership, legacy version-1 payload rejection, foreign-user rejection, invalid owner IDs, malformed JSON, unsupported schema versions, UUIDs, timestamp ordering, accumulated-time bounds, five-minute clock-skew tolerance, 24-hour expiry, and pending payload validation. |

The DST cases in `format-datetime-local.test.ts` are characterization tests as well as regression tests. They make the platform behavior explicit: a `datetime-local` value cannot preserve which occurrence of a repeated fall-back hour produced it, and JavaScript normalizes a nonexistent spring-forward wall time forward.

The profile-timezone tests deliberately do not claim that JavaScript and PostgreSQL recognize identical timezone sets. `isAllowedProfileTimezone` defines the application-side policy, while the database suite verifies the PostgreSQL-side write invariant. `getUserTimezone()` is the defensive drift detector between those runtimes.

### Analytics and comparison coverage

| Test file                                                                               | Current coverage                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`analytics-range-preset.test.ts`](../src/lib/analytics/analytics-range-preset.test.ts) | Defaults, supported presets, invalid query values, and repeated query parameters.                                                                                                                                                                                   |
| [`build-range-analytics.test.ts`](../src/lib/analytics/build-range-analytics.test.ts)   | Converting RPC rows into summaries, daily and per-activity totals, zero-filled dates, ordering, reconciliation of activity segments, and aggregation of null activities as `Unlabeled`.                                                                             |
| [`build-range-comparison.test.ts`](../src/lib/analytics/build-range-comparison.test.ts) | Increasing/decreasing/equal/empty tracked-time states, active-day and session deltas, average-session rounding, current-only and previous-only activities, unlabeled activity merging, rename behavior, sorting, and rejection of unequal comparison-range lengths. |
| [`get-range-analytics.test.ts`](../src/lib/analytics/get-range-analytics.test.ts)       | The application-to-RPC adapter passes the requested dates/timezone to `get_daily_activity_totals`, delegates returned rows to the builder, and captures/normalizes RPC errors. Supabase, the builder, and Sentry are mocked.                                        |

The database implementation of the analytics RPC is covered separately by pgTAP; the adapter test does not claim to validate its SQL, RLS, routine grants, or timezone conversion.

### Other application-level coverage

[`uuid.test.ts`](../src/lib/validation/uuid.test.ts) tests the UUID pattern used by Server Actions, including uppercase input, malformed values, surrounding whitespace, and the currently unsupported UUIDv7 form.

`src/app/actions/time-blocks.test.ts` exercises time-block creation through the public Server Actions with a mocked Supabase boundary. It covers successful inserts, exact-match recovery after `23P01`, genuine overlaps, recovery-query failures, non-overlap insert failures, and the shared manual-entry persistence path.

There are no direct tests for React components, pages, authentication actions/routes, activity Server Actions, the interactive timer lifecycle, or browser `localStorage` integration beyond the persisted-state parser. In particular, the `readPersistedTimer` path that removes invalid or foreign-user state from `localStorage` is not covered by an automated browser test.

### Manual verification

The persisted-timer ownership change was also smoke-tested through the abnormal account-transition path that bypasses normal sign-out cleanup:

1. A timer was started as user A and its version-2, user-owned payload was confirmed in `localStorage`.
2. Supabase authentication cookies were removed without using the application's sign-out flow, leaving the persisted timer intact.
3. After reloading, user B signed in using the same browser.
4. The timer rendered idle rather than restoring user A's state.
5. The foreign-user timer payload was removed from `localStorage`.
6. User B could start and save a new timer normally.

This verifies the browser wiring for cross-account timer isolation manually. It does not replace automated browser or end-to-end coverage.

### Coverage reports

The configured V8 coverage command includes `src/lib/**/*.ts`, excludes test files, and produces text and HTML reports. The generated `coverage` directory is ignored by Git.

No minimum coverage thresholds are configured, and CI runs the ordinary Vitest command rather than the coverage command. Coverage output is therefore diagnostic, not a merge gate.

## PostgreSQL and pgTAP Suite

The SQL tests live in [`supabase/tests/database`](../supabase/tests/database). Each file uses a transaction and ends with `ROLLBACK`, so fixtures and mutations do not persist. The files declare their expected assertion count with pgTAP `plan(...)` and call `finish()` before rollback.

### Security and integrity coverage

| Test file                                                                                                   | Current coverage                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`smoke_test.sql`](../supabase/tests/database/smoke_test.sql)                                               | Confirms the pgTAP harness executes.                                                                                                                                                                                                                                       |
| [`rls_harness_test.sql`](../supabase/tests/database/rls_harness_test.sql)                                   | Asserts every current `public` table has RLS enabled and proves the simulated session uses the intended `authenticated` role and `auth.uid()`.                                                                                                                             |
| [`profiles_rls_test.sql`](../supabase/tests/database/profiles_rls_test.sql)                                 | Automatic profile creation through the Auth trigger, own-profile visibility, own-timezone updates, isolation from another user's profile, and denial of `plan_id` updates by column privilege.                                                                             |
| [`profile_timezone_invariant_test.sql`](../supabase/tests/database/profile_timezone_invariant_test.sql)     | Runs through the real authenticated write boundary, verifies canonical and lowercase named timezones persist, and rejects unresolvable identifiers, case-insensitive `Etc/*` forms, fixed-offset forms, empty strings, and whitespace-only values with SQLSTATE `22023`.   |
| [`activities_rls_test.sql`](../supabase/tests/database/activities_rls_test.sql)                             | Own-row select/insert/update/delete behavior and isolation from another user's activity.                                                                                                                                                                                   |
| [`time_blocks_rls_test.sql`](../supabase/tests/database/time_blocks_rls_test.sql)                           | Own-row select/insert/update/delete behavior and isolation from another user's time block.                                                                                                                                                                                 |
| [`rls_ownership_test.sql`](../supabase/tests/database/rls_ownership_test.sql)                               | Activity ownership checks in time-block insert/update RLS policies.                                                                                                                                                                                                        |
| [`anon_access_test.sql`](../supabase/tests/database/anon_access_test.sql)                                   | The `anon` role has no authenticated identity and cannot read profiles, activities, or time blocks.                                                                                                                                                                        |
| [`table_grants_test.sql`](../supabase/tests/database/table_grants_test.sql)                                 | Exact table and column privileges for `anon` and `authenticated`, database-controlled fields, plan protection, the limited category read grant, schema-wide anonymous denial, and default denial for a newly created public table.                                         |
| [`function_grants_test.sql`](../supabase/tests/database/function_grants_test.sql)                           | Schema-wide routine privilege policy: no current `PUBLIC`, `anon`, or `service_role` execution; an exact three-routine authenticated allowlist; verification that the test runs under the `postgres` creator role; and default denial for a newly created public function. |
| [`time_blocks_activity_tenancy_test.sql`](../supabase/tests/database/time_blocks_activity_tenancy_test.sql) | The composite foreign key rejects cross-user activity references on insert and update even when the test runs as `postgres` outside RLS.                                                                                                                                   |
| [`activity_delete_semantics_test.sql`](../supabase/tests/database/activity_delete_semantics_test.sql)       | Deleting an activity preserves its historical time block, nulls only `activity_id`, retains ownership, and leaves another user's data untouched.                                                                                                                           |
| [`daily_activity_totals_rls_test.sql`](../supabase/tests/database/daily_activity_totals_rls_test.sql)       | The analytics function is security-invoker, authenticated users may execute it, anonymous callers are rejected at the function boundary, aggregates include unlabeled rows, and results remain isolated per user.                                                          |

### Routine privilege coverage

`function_grants_test.sql` treats routine access as a schema-wide invariant rather than asserting individual deny rules for each internal function.

It verifies that:

* no current routine in `public` grants `EXECUTE` to `PUBLIC`;
* `anon` cannot execute any current `public` routine;
* `authenticated` can execute exactly:

  * `get_daily_activity_totals(date,date,text)`;
  * `time_blocks_for_today(text)`; and
  * `is_allowed_profile_timezone(text)`;
* `service_role` has no direct execution on current `public` routines under the application schema policy;
* the test connection is running as `postgres`, matching the role whose future default privileges are hardened; and
* a probe function created inside the test transaction does not automatically become executable by `PUBLIC`, `anon`, `authenticated`, or `service_role`.

The probe checks effective privileges rather than assuming that a null ACL means no access. For routines, a null `proacl` means PostgreSQL's built-in defaults still apply, so the test uses `acldefault('f', owner)` when evaluating `PUBLIC` execution.

This coverage protects both the existing routine surface and the default-privilege policy applied to future routines created by `postgres`.

### Catalog policy and runtime behavior

Routine privilege coverage deliberately uses two different kinds of test:

* [`function_grants_test.sql`](../supabase/tests/database/function_grants_test.sql) verifies the catalog/effective privilege state.
* [`daily_activity_totals_rls_test.sql`](../supabase/tests/database/daily_activity_totals_rls_test.sql) exercises the analytics RPC and verifies the runtime result.

Before routine hardening, `anon` was allowed to execute `get_daily_activity_totals` but then failed when the security-invoker function attempted to read `time_blocks`.

After hardening, the anonymous call is rejected earlier with SQLSTATE `42501` and the PostgreSQL message `permission denied for function get_daily_activity_totals`.

The message is intentionally asserted in addition to the SQLSTATE because both table-level and function-level privilege denials use `42501`; the message distinguishes which boundary rejected the request.

### Simulating authenticated behavior

RLS tests create fixture users and data while running as the privileged test connection. Inserting into `auth.users` also exercises the real `on_auth_user_created` trigger that creates profiles.

To act as a user, a test sets the JWT subject claim and then changes to the actual Data API role:

```sql
set local request.jwt.claim.sub = '<fixture-user-uuid>';
set local role authenticated;
```

`auth.uid()` reads that local subject claim, so the migrated RLS policy expressions execute without being replaced or mocked. Anonymous behavior is exercised with `SET LOCAL ROLE anon` and no subject claim.

Several tests use `RESET ROLE` temporarily to inspect physical database state after an operation. This distinguishes a row that remained unchanged from a row that merely became invisible through RLS. The constraint-layer tenancy test deliberately remains `postgres`: if it used `authenticated`, RLS could reject the write first and mask a missing foreign-key guarantee.

Grant tests instead inspect PostgreSQL catalogs and effective privileges directly. The future-routine probe is created while `current_user = postgres` because `ALTER DEFAULT PRIVILEGES` rules are tied to the object-creating role.

Tests also pin SQLSTATEs or PostgreSQL error messages where necessary to distinguish privilege denial from RLS denial when both use `42501`. The cross-tenant constraint test expects foreign-key violation `23503`. The profile-timezone invariant test pins SQLSTATE `22023` and the stable message `invalid profile timezone` so product-invalid values share one database error contract even when the rejection reason differs.

### Why these tests belong in PostgreSQL

RLS policies, table/column grants, routine grants, default privileges, triggers, and constraints are security and integrity boundaries even if application validation is bypassed. Testing them through pgTAP verifies the deployed database objects and PostgreSQL role semantics directly:

* table, column, and routine privileges are checked through PostgreSQL's catalogs and effective-privilege functions;
* future routine defaults are exercised by creating a transactional probe under the actual migration creator role;
* RLS runs against `auth.uid()` under the real `authenticated` role;
* profile-timezone writes exercise the real trigger and validator;
* cross-tenant writes are attempted against the real policies and foreign keys;
* privileged inspection proves that denied updates/deletes did not change hidden rows; and
* the analytics function is checked for invoker security, function-boundary anonymous denial, and tenant-isolated output.

An application-only test with a mocked Supabase response could pass while a migration omitted RLS, broadened a table or routine grant, restored permissive default privileges, removed the timezone trigger, changed a function to `SECURITY DEFINER`, or weakened a foreign key. The pgTAP layer is what protects against those database-specific regressions.

## Running the Tests

### Prerequisites

* Node.js 24.x, as declared in [`package.json`](../package.json)
* npm
* Docker or another container runtime supported by the Supabase CLI

The Supabase CLI is installed as a development dependency and should be invoked with `npx`; a separate global installation is not required. Local Supabase uses PostgreSQL 17 according to [`supabase/config.toml`](../supabase/config.toml).

Install the locked dependencies first:

```bash
npm ci
```

### Vitest

Run the full TypeScript suite once:

```bash
npm test
```

This is the package-script form of `vitest run` and is the command used by CI.

Generate the configured text and HTML coverage reports:

```bash
npm run test:coverage
```

Run one test file when isolating a failure:

```bash
npx vitest run src/lib/time/ranges.test.ts
```

### Database tests

Start the local Supabase containers. A fresh local stack initializes the services and applies the committed migrations:

```bash
npx supabase start
```

Then run all pgTAP files against the local database:

```bash
npx supabase test db
```

The database command requires the local stack to be running. It does not require the Next.js development server or application environment variables.

Run one pgTAP file when isolating a database failure:

```bash
npx supabase test db supabase/tests/database/profiles_rls_test.sql
```

If the local schema needs to be rebuilt from the migration history, use:

```bash
npx supabase db reset --no-seed
```

This reset is destructive to local database data and requires the local stack. `--no-seed` matches the current repository: the Supabase configuration enables a `supabase/seed.sql` path, but no seed file is committed, and every pgTAP file creates its own transactional fixtures. Resetting is not required before every test run; it is useful after migration changes or when local schema state is suspect.

### Full local verification

These are the same application checks used by the `app-checks` CI job:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The production build is a verification step rather than a test suite. It requires the client-safe Supabase URL and publishable-key environment variables described in the project README; Vitest itself does not.

The database suite is a separate CI job because it must start the containerized Supabase stack:

```bash
npx supabase start
npx supabase test db
```

The workflow is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) and runs on pushes and pull requests to `main`.

## Current Coverage Gaps

The repository currently has no automated coverage for:

* browser or end-to-end flows, including sign-up/sign-in, timer interaction, persisted-timer ownership and cleanup across account transitions, manual entry, editing, deletion, navigation, and rendered analytics;
* React component behavior or accessibility interactions;
* Server Actions for authentication, activities, and timezone initialization; time-block creation now has focused mocked-boundary coverage, but update/delete behavior is not directly covered;
* a real TypeScript/Supabase integration path—the Supabase-facing Vitest tests use mocks, while pgTAP calls PostgreSQL directly;
* direct pgTAP assertions for time-block overlap exclusion, positive/range-bounded duration checks, valid range checks, name uniqueness/nonblank checks, or `updated_at` triggers;
* `time_blocks_for_today` behavior and non-UTC/DST boundaries inside the SQL analytics functions;
* category policy CRUD behavior beyond the RLS-enabled and grant-catalog checks; or
* enforced coverage thresholds or coverage publication in CI.

Routine execution privileges and future `postgres`-created routine defaults are now directly regression-tested and are no longer part of the database coverage gap.

These are statements about the current repository, not a proposed testing roadmap. No Playwright configuration or test suite is present.
