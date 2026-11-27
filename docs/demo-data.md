# TimeMetrics Demo Data

The demo utility generates synthetic productivity history for local
demonstrations, screenshots, and manual application verification.

It is a development utility, not a production data-import feature.

## Quick Start

### Preview without Supabase

Install the locked dependencies using Node.js 24:

```bash
npm ci
```

Generate a preview:

```bash
DEMO_PREVIEW=1 npm run seed:demo
```

Preview mode does not require a running Supabase instance or an
`.env.local` file. It generates and summarizes the dataset without
authenticating or making database requests.

### Persist demo data

Complete the local Supabase setup described in the
[README](../README.md).

```bash
npm run seed:demo
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in:

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | demo@example.com            |
| Password | TimeMetrics-Local-Demo-2026! |

These credentials are intentionally public and disposable.
Never reuse them for a hosted account.

The seed command automatically creates the demo account when needed
or authenticates an existing account.

## Configuration

| Variable       | Default | Description                         |
| -------------- | ------- | ----------------------------------- |
| `DEMO_SEED`    | `42`    | Unsigned 32-bit integer seed.       |
| `DEMO_PREVIEW` | Unset   | Set to `1` for preview-only mode.   |

Seeds must use decimal digits without whitespace, leading zeros
(except for `0`), signs, or alternative numeric notation.

The accepted range is 0 through 4294967295, inclusive.
Invalid seeds are rejected before generation.

The default dataset covers 60 local calendar days, including today,
using the `America/Toronto` timezone.

Activity weights and duration ranges are defined in
[`generate-demo-data.ts`](../scripts/generate-demo-data.ts).

### Trying different seeds

```bash
DEMO_PREVIEW=1 DEMO_SEED=7 npm run seed:demo
DEMO_PREVIEW=1 DEMO_SEED=42 npm run seed:demo
DEMO_PREVIEW=1 DEMO_SEED=43 npm run seed:demo
```

The summary includes session count, active days, tracked hours,
and current-versus-previous seven- and 30-day comparisons.

Once a suitable dataset is selected, persist it:

```bash
DEMO_SEED=7 npm run seed:demo
```

Persistence requires an empty or nonexistent demo account.
Ensure `DEMO_PREVIEW` is not set to `1` in your shell or `.env.local`.

## Determinism

Identical seed, reference time, timezone, and calendar-day count
produce identical generated datasets.

The command uses the current time as its reference timestamp.
Running the same seed on a different day may change which calendar
dates receive sessions. Running it at a different time on the same
day may change how many of today's sessions fit before the cutoff.

Consequently, the seed alone does not guarantee identical totals
across separate executions.

Database-generated UUIDs and metadata are not part of the
deterministic output.

The terminal summary describes the generated dataset.
The final success message indicates that the requested persistence
operations completed.

## Safety and Limitations

The persistence script accepts only these local Supabase endpoints:

- `http://127.0.0.1:54321`
- `http://localhost:54321`

Unexpected endpoints are rejected before constructing the Supabase
client. This protects against accidental hosted-project targeting
in a trusted local development environment.

Persistence uses the publishable Supabase client under the demo
account's authenticated identity. Existing RLS policies, table
grants, and database constraints remain active.

No service-role or secret key is required.

The script refuses to seed demo accounts that already contain activities
or time blocks. Failed or indeterminate existence queries also stop
the operation.

The oldest two generated sessions are assigned to a temporary
Archived Project activity. Deleting that activity exercises the
database's foreign-key deletion behavior, preserving the sessions
as `Unlabeled`.

The complete persistence workflow is not a single transaction.
A failure may leave partially seeded data.

The command does not automatically overwrite, roll back, or clean
up existing records. Concurrent seed executions are unsupported.

See [Testing](testing.md) for the automated and manual
verification boundaries.

## Regenerating Demo Data

A second execution against a populated demo account is
intentionally rejected.

If the entire local database is disposable, rebuild it from the
committed migrations and regenerate:

```bash
npx supabase db reset --no-seed && npm run seed:demo
```

To regenerate with a selected seed:

```bash
npx supabase db reset --no-seed && DEMO_SEED=7 npm run seed:demo
```

**Warning:** Resetting the local database removes all local
accounts and application data, not just the demo account.
Do not run this command if local data needs to be preserved.

The seed command automatically provisions the demo account again.
Its database identity may differ from the previous account.

Sign out of any previous browser session before signing into
the recreated account.

## Preparing a Demonstration

1. Preview a few seeds on the recording day.
2. Select a dataset with useful recent activity and comparison periods.
3. Persist the selected dataset to an empty demo account.
4. Verify the dashboard, history, and both analytics ranges.
5. Capture screenshots before changing the generated data.
6. Use the reserved recent time window for live demonstrations.

The most recent hour is excluded from generated sessions.
Today's sessions are generated only when sufficient working time
has elapsed.

Compare the rendered analytics against the successful persistence
execution's summary before modifying sessions or crossing into
another local calendar day.

All generated records are synthetic demonstration data.
