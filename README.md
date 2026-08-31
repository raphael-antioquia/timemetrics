# TimeMetrics

TimeMetrics is a personal time-tracking application for recording focused work and understanding how that time is distributed across activities. It combines a live timer and manual entry with recent history, daily analytics, and comparisons against the previous equivalent period.

## The problem

Timers are useful while work is happening, while manual logs are useful after the fact. TimeMetrics brings both workflows together so an individual can maintain one consistent activity history and review patterns without moving data between separate tools.

## Features

- Email and password authentication through Supabase Auth.
- Activity creation, renaming, and deletion.
- A start, pause, resume, and stop timer that survives page reloads through browser storage.
- Retry support for timer sessions that fail to save, including reassignment when the original activity was deleted.
- Manual time entry plus editing and deletion of existing sessions.
- A dashboard with today's tracked total and recent sessions.
- Recent history grouped by calendar day in the user's stored timezone.
- Seven- and 30-day analytics with tracked time, active days, session count, average session duration, daily activity, and per-activity totals.
- Current-period comparisons against the immediately preceding period of equal length.

## Technology stack

| Area | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, Base UI, shadcn components |
| Authentication and data | Supabase Auth, Supabase SSR, Supabase JavaScript client, PostgreSQL |
| Observability | Sentry for client, server, and request errors |
| Testing | Vitest, V8 coverage, pgTAP database tests |
| Automation | GitHub Actions |

The local Supabase configuration uses PostgreSQL 17.

## Architecture overview

TimeMetrics uses a server-first Next.js architecture:

- Protected App Router pages authenticate the request and load user data in Server Components.
- Interactive Client Components manage forms, dialogs, and timer state, then call Server Actions for mutations.
- Supabase SSR stores the user session in cookies; a Next.js proxy validates and refreshes that session.
- Application queries use the publishable Supabase client under the signed-in user's identity, so PostgreSQL Row Level Security remains the authorization boundary.
- PostgreSQL functions aggregate timezone-aware daily data; TypeScript fills empty days and builds current-versus-previous comparisons for presentation.

## Technical highlights

- **Layered authorization:** server-side identity checks and explicit ownership filters are backed by RLS policies on every application table. Authenticated table privileges are further restricted by operation and column, and anonymous roles have no table access.
- **Database-enforced time integrity:** PostgreSQL requires a positive duration, a valid start/end range, and a duration no greater than that range. A GiST exclusion constraint prevents overlapping time blocks for the same user while allowing adjacent sessions.
- **Tenant-safe relationships:** a composite foreign key prevents a time block from referencing another user's activity, independently of application checks and RLS.
- **History preservation:** deleting an activity sets the reference on existing time blocks to `NULL`; the time remains in history and analytics as `Unlabeled`.
- **Timezone-aware reporting:** profiles default to UTC and are initialized from the browser timezone. SQL RPCs convert local calendar boundaries to UTC and group sessions by their local start day.
- **Comparison-period analytics:** seven- and 30-day ranges are compared with the immediately preceding equal-length range, including duration, active-day, session, average-session, and per-activity changes.
- **Database security tests:** transactional pgTAP tests exercise RLS ownership, anonymous denial, table and column grants, cross-tenant references, deletion semantics, and analytics isolation.

## Documentation

- [Architecture](docs/architecture.md) explains runtime responsibilities and the main request, timer, authentication, and analytics flows.
- [Database](docs/database.md) documents the schema, PostgreSQL invariants, grants, RLS policies, triggers, and RPCs.
- [Testing](docs/testing.md) describes the implemented Vitest and pgTAP coverage and how to run it.

## Local development

### Prerequisites

- Node.js 24
- npm
- Docker or another container runtime supported by the Supabase CLI

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

Do not commit real credentials. The committed database schema, functions, RLS policies, and grants are defined by the migrations in [`supabase/migrations`](supabase/migrations).

Start the application:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account to begin tracking time.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Run a completed production build |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run lint:fix` | Apply ESLint fixes |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Run the Vitest suite once |
| `npm run test:coverage` | Run Vitest with the configured V8 coverage report |
| `npx supabase start` | Start the local Supabase stack |
| `npx supabase test db` | Run the pgTAP database test suite against local Supabase |

Database tests require the local Supabase stack to be running.

## Testing

The Vitest suite covers the analytics transformation and comparison logic, calendar and timezone-sensitive date utilities, duration formatting, UUID validation, profile-timezone loading, and persisted-timer validation.

The pgTAP suite tests the database as real `anon` and `authenticated` roles where appropriate. It verifies RLS, least-privilege grants, ownership isolation, foreign-key tenancy, activity deletion behavior, and analytics RPC isolation. GitHub Actions runs linting, type checking, Vitest, a production build, and the database suite on pushes and pull requests to `main`.

## Deployment

This repository does not prescribe a hosting provider or contain a production deployment workflow. A deployment requires:

- A Node.js 24-compatible Next.js runtime.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured for the target Supabase project.
- The committed Supabase migrations applied to that project.

The repository's CI verifies `npm run build`; the standard Node runtime is started with `npm run start`.
