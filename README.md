# TimeMetrics

TimeMetrics is a personal time-tracking application for recording focused work and understanding how that time is distributed across activities. It combines a live timer and manual entry with recent history, daily analytics, and comparisons against the previous equivalent period.

## The problem

Timers are useful while work is happening, while manual logs are useful after the fact. TimeMetrics brings both workflows together so an individual can maintain one consistent activity history and review patterns without moving data between separate tools.

## Features

* Email and password authentication through Supabase Auth.
* Activity creation, renaming, and deletion.
* A start, pause, resume, and stop timer that survives page reloads through user-scoped browser storage.
* Retry support for timer sessions that fail to save, including reassignment when the original activity was deleted.
* Manual time entry plus editing and deletion of existing sessions.
* A dashboard with today's tracked total and recent sessions.
* Recent history grouped by calendar day in the user's stored timezone.
* Seven- and 30-day analytics with tracked time, active days, session count, average session duration, daily activity, and per-activity totals.
* Current-period comparisons against the immediately preceding period of equal length.

## Technology stack

| Area                    | Technology                                                          |
| ----------------------- | ------------------------------------------------------------------- |
| Application             | Next.js 16 App Router, React 19, TypeScript                         |
| UI                      | Tailwind CSS 4, Base UI, shadcn components                          |
| Authentication and data | Supabase Auth, Supabase SSR, Supabase JavaScript client, PostgreSQL |
| Observability           | Sentry for client, server, and request errors                       |
| Testing                 | Vitest, V8 coverage, pgTAP database tests                           |
| Automation              | GitHub Actions                                                      |

The local Supabase configuration uses PostgreSQL 17.

## Architecture overview

TimeMetrics uses a server-first Next.js architecture:

* Protected App Router pages authenticate the request and load user data in Server Components.
* Interactive Client Components manage forms, dialogs, and timer state, then call Server Actions for mutations.
* Supabase SSR stores the user session in cookies; a Next.js proxy validates and refreshes that session.
* Application queries use the publishable Supabase client under the signed-in user's identity, so PostgreSQL Row Level Security and least-privilege SQL grants remain active.
* PostgreSQL functions aggregate timezone-aware daily data; TypeScript fills empty days and builds current-versus-previous comparisons for presentation.

## Technical highlights

* **Layered authorization:** server-side identity checks and explicit ownership filters are backed by RLS policies on every application table. Authenticated table privileges are further restricted by operation and column, anonymous roles have no table access, and direct routine execution follows an explicit authenticated allowlist.
* **Default-deny routine access:** `PUBLIC`, `anon`, and `service_role` have no direct `EXECUTE` on current `public` routines. `authenticated` may execute only the routines required by current application workflows, and future routines created by `postgres` no longer inherit the previous broad client or `PUBLIC` execution defaults.
* **User-scoped timer persistence:** persisted timer state includes the authenticated user ID and is restored only for that user. Legacy or foreign-user timer payloads are rejected and removed, while normal sign-out clearing provides an additional layer of cleanup.
* **Database-enforced time integrity:** PostgreSQL requires a positive duration, a valid start/end range, and a duration no greater than that range. A GiST exclusion constraint prevents overlapping time blocks for the same user while allowing adjacent sessions.
* **Tenant-safe relationships:** a composite foreign key prevents a time block from referencing another user's activity, independently of application checks and RLS.
* **History preservation:** deleting an activity sets the reference on existing time blocks to `NULL`; the time remains in history and analytics as `Unlabeled`.
* **Timezone-safe reporting:** profiles default to UTC and are initialized from the browser timezone. PostgreSQL rejects unsupported stored timezone values, while the application defensively falls back to UTC and reports the condition if PostgreSQL and `Intl.DateTimeFormat` disagree. SQL RPCs convert local calendar boundaries to UTC and group sessions by their local start day.
* **Comparison-period analytics:** seven- and 30-day ranges are compared with the immediately preceding equal-length range, including duration, active-day, session, average-session, and per-activity changes.
* **Database security and integrity tests:** transactional pgTAP tests exercise RLS ownership, anonymous denial, table and column grants, routine execution grants, future routine defaults, cross-tenant references, time-block CHECK and overlap constraints, profile-timezone integrity, deletion semantics, and timezone-aware reporting behavior across non-UTC and DST boundaries.

## Documentation

* [Architecture](docs/architecture.md) explains runtime responsibilities and the main request, timer, authentication, and analytics flows.
* [Database](docs/database.md) documents the schema, PostgreSQL invariants, table and routine grants, RLS policies, triggers, and RPCs.
* [Testing](docs/testing.md) describes the implemented Vitest and pgTAP coverage and how to run it.

## Local development

### Prerequisites

* Node.js 24
* npm
* Docker or another container runtime supported by the Supabase CLI

### Setup

Install dependencies and start the local Supabase stack:

```bash
npm ci
npx supabase start
```

Create `.env.local` in the repository root using the client-safe values reported by the Supabase CLI:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-publishable-key>
```

Do not commit real credentials. The committed database schema, functions, RLS policies, grants, and default privileges are defined by the migrations in [`supabase/migrations`](supabase/migrations).

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account to begin tracking time.

### Demo data

A local-only generator populates a demo account with 60 calendar days of
synthetic productivity history for demonstrations and screenshots.

After completing the local setup above, run:

```bash
npm run seed:demo
npm run dev
```

Sign in with `demo@example.com` / `TimeMetrics-Local-Demo-2026!`
(intentionally public, local-only credentials; never reuse them for hosted accounts).

Preview a dataset without accessing Supabase:

```bash
DEMO_PREVIEW=1 DEMO_SEED=7 npm run seed:demo
```

The generator accepts only local Supabase endpoints, writes through the
authenticated client, and refuses to seed populated demo accounts.
See [Demo data](docs/demo-data.md) for configuration, safety, and regeneration.

## Commands

| Command                 | Purpose                                                  |
| ----------------------- | -------------------------------------------------------- |
| `npm run dev`           | Start the Next.js development server                     |
| `npm run build`         | Create a production build                                |
| `npm run start`         | Run a completed production build                         |
| `npm run lint`          | Run ESLint with zero warnings allowed                    |
| `npm run lint:fix`      | Apply ESLint fixes                                       |
| `npm run typecheck`     | Run TypeScript without emitting files                    |
| `npm test`              | Run the Vitest suite once                                |
| `npm run test:coverage` | Run Vitest with the configured V8 coverage report        |
| `npm run seed:demo`     | Generate and persist local demo data                     |
| `npx supabase start`    | Start the local Supabase stack                           |
| `npx supabase test db`  | Run the pgTAP database test suite against local Supabase |

Database tests require the local Supabase stack to be running.

## Testing

The Vitest suite covers the analytics transformation and comparison logic, calendar and timezone-sensitive date utilities, duration formatting, UUID validation, profile-timezone validation/loading, and persisted-timer validation, including legacy payload rejection and authenticated-user ownership checks.

The demo utility has deterministic generation tests, mocked persistence
tests, and executable regression tests for environment configuration,
preview mode, and local-only endpoint validation.

The pgTAP suite tests the database as real `anon` and `authenticated` roles where appropriate. It verifies RLS, least-privilege table, column, and routine grants, ownership isolation, foreign-key tenancy, time-block duration, range, adjacency, and overlap invariants, profile-timezone integrity, activity deletion behavior, future routine default privileges, and timezone-aware reporting behavior. Calendar-function coverage includes Toronto local-day boundaries, non-UTC analytics bucketing, 23-hour spring-forward and 25-hour fall-back days, repeated-hour sessions, and cross-midnight attribution by `started_at`. Anonymous analytics execution is rejected at the function boundary rather than reaching the underlying tables. GitHub Actions runs linting, type checking, Vitest, a production build, and the database suite on pushes and pull requests to `main`.

## Deployment

This repository does not prescribe a hosting provider or contain a production deployment workflow. A deployment requires:

* A Node.js 24-compatible Next.js runtime.
* `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured for the target Supabase project.
* The committed Supabase migrations applied to that project.

The repository's CI verifies `npm run build`; the standard Node runtime is started with `npm run start`.

## License

Copyright © 2026 Raphael Antioquia. All rights reserved.

TimeMetrics is proprietary software made publicly available for portfolio demonstration and educational reference.

See [LICENSE](LICENSE) for details.
