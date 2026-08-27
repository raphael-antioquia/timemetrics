import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseAnalyticsRangePreset } from "@/lib/analytics/analytics-range-preset";
import {
  buildRangeComparison,
  type DurationChange,
} from "@/lib/analytics/build-range-comparison";
import { DailyActivityChart } from "@/lib/analytics/daily-activity-chart";
import { getRangeAnalytics } from "@/lib/analytics/get-range-analytics";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/time/format-duration";
import { getUserTimezone } from "@/lib/time/get-user-timezone";
import {
  getLastSevenDayRange,
  getLastThirtyDayRange,
  getPreviousDateRange,
} from "@/lib/time/ranges";

type AnalyticsPageProps = {
  searchParams: Promise<{
    range?: string | string[];
  }>;
};

function formatAnalyticsDuration(
  seconds: number,
): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function assertNever(value: never): never {
  throw new Error(
    `Unhandled comparison change: ${JSON.stringify(value)}`,
  );
}

function DurationChangeValue({
  currentSeconds,
  previousSeconds,
  change,
}: {
  currentSeconds: number;
  previousSeconds: number;
  change: DurationChange;
}) {
  switch (change.kind) {
    case "new": {
      const duration =
        formatAnalyticsDuration(currentSeconds);

      return (
        <span
          aria-label={`Increased from zero to ${duration}`}
        >
          <span aria-hidden="true">↑ </span>
          {duration}
        </span>
      );
    }

    case "cleared": {
      const duration =
        formatAnalyticsDuration(previousSeconds);

      return (
        <span
          aria-label={`Decreased from ${duration} to zero`}
        >
          <span aria-hidden="true">↓ </span>
          {duration}
        </span>
      );
    }

    case "none":
      return <span aria-label="No change">—</span>;

    case "delta": {
      const increased =
        change.absoluteSeconds > 0;

      const duration = formatAnalyticsDuration(
        Math.abs(change.absoluteSeconds),
      );

      const percent = Math.round(
        Math.abs(change.percent),
      );

      return (
        <span
          aria-label={`${
            increased ? "Increased" : "Decreased"
          } by ${duration}, ${percent} percent`}
        >
          <span aria-hidden="true">
            {increased ? "↑" : "↓"}{" "}
          </span>

          {duration} ({percent}%)
        </span>
      );
    }

    default:
      return assertNever(change);
  }
}

function CountChangeValue({
  change,
}: {
  change: number;
}) {
  if (change === 0) {
    return <span aria-label="No change">—</span>;
  }

  const increased = change > 0;
  const amount = Math.abs(change);

  return (
    <span
      aria-label={`${
        increased ? "Increased" : "Decreased"
      } by ${amount}`}
    >
      <span aria-hidden="true">
        {increased ? "↑" : "↓"}{" "}
      </span>

      {amount}
    </span>
  );
}

function AverageSessionChangeValue({
  currentSessions,
  previousSessions,
  currentSeconds,
  previousSeconds,
  change,
}: {
  currentSessions: number;
  previousSessions: number;
  currentSeconds: number;
  previousSeconds: number;
  change: DurationChange;
}) {
  if (
    currentSessions === 0 &&
    previousSessions === 0
  ) {
    return <span aria-label="No change">—</span>;
  }

  if (previousSessions === 0) {
    return <span>No baseline</span>;
  }

  if (currentSessions === 0) {
    return <span>No current sessions</span>;
  }

  return (
    <DurationChangeValue
      currentSeconds={currentSeconds}
      previousSeconds={previousSeconds}
      change={change}
    />
  );
}

export default async function AnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { range: rangeParam } = await searchParams;

  const rangePreset =
    parseAnalyticsRangePreset(rangeParam);

  const timeZone = await getUserTimezone(user.id);

  const dateRange =
    rangePreset === 7
      ? getLastSevenDayRange(timeZone)
      : getLastThirtyDayRange(timeZone);

  const previousDateRange =
    getPreviousDateRange(dateRange);

  const [
    currentAnalytics,
    previousAnalytics,
  ] = await Promise.all([
    getRangeAnalytics({
      ...dateRange,
      timeZone,
    }),
    getRangeAnalytics({
      ...previousDateRange,
      timeZone,
    }),
  ]);

  const comparison = buildRangeComparison(
    currentAnalytics,
    previousAnalytics,
  );

  const dateFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  );

  const startDateLabel = dateFormatter.format(
    new Date(
      `${dateRange.startDate}T00:00:00Z`,
    ),
  );

  const endDateLabel = dateFormatter.format(
    new Date(
      `${dateRange.endDate}T00:00:00Z`,
    ),
  );

  const previousStartDateLabel =
    dateFormatter.format(
      new Date(
        `${previousDateRange.startDate}T00:00:00Z`,
      ),
    );

  const previousEndDateLabel =
    dateFormatter.format(
      new Date(
        `${previousDateRange.endDate}T00:00:00Z`,
      ),
    );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Analytics
          </h1>

          <p className="text-muted-foreground">
            Last {rangePreset} days ·{" "}
            {startDateLabel} – {endDateLabel}
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex shrink-0 items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          ← Back to dashboard
        </Link>
      </header>

      <nav
        aria-label="Analytics range"
        className="flex gap-2"
      >
        <Link
          href="/analytics"
          aria-current={
            rangePreset === 7
              ? "page"
              : undefined
          }
          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            rangePreset === 7
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
        >
          7 days
        </Link>

        <Link
          href="/analytics?range=30"
          aria-current={
            rangePreset === 30
              ? "page"
              : undefined
          }
          className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
            rangePreset === 30
              ? "bg-foreground text-background"
              : "hover:bg-muted"
          }`}
        >
          30 days
        </Link>
      </nav>

      <section
        aria-labelledby="summary-heading"
        className="space-y-3"
      >
        <div className="space-y-1">
          <h2
            id="summary-heading"
            className="text-lg font-semibold"
          >
            Summary
          </h2>

          <p className="text-sm text-muted-foreground">
            Compared with {previousStartDateLabel} –{" "}
            {previousEndDateLabel}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-150">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-3 pr-4 font-medium">
                      Metric
                    </th>

                    <th className="px-4 pb-3 text-right font-medium">
                      Current
                    </th>

                    <th className="px-4 pb-3 text-right font-medium">
                      Previous
                    </th>

                    <th className="pb-3 pl-4 text-right font-medium">
                      Change
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  <tr>
                    <th
                      scope="row"
                      className="py-4 pr-4 text-left font-medium"
                    >
                      Tracked time
                    </th>

                    <td className="px-4 py-4 text-right tabular-nums">
                      {formatAnalyticsDuration(
                        comparison.trackedTime
                          .currentSeconds,
                      )}
                    </td>

                    <td className="px-4 py-4 text-right text-muted-foreground tabular-nums">
                      {formatAnalyticsDuration(
                        comparison.trackedTime
                          .previousSeconds,
                      )}
                    </td>

                    <td className="py-4 pl-4 text-right tabular-nums">
                      <DurationChangeValue
                        currentSeconds={
                          comparison.trackedTime
                            .currentSeconds
                        }
                        previousSeconds={
                          comparison.trackedTime
                            .previousSeconds
                        }
                        change={
                          comparison.trackedTime
                            .change
                        }
                      />
                    </td>
                  </tr>

                  <tr>
                    <th
                      scope="row"
                      className="py-4 pr-4 text-left font-medium"
                    >
                      Active days
                    </th>

                    <td className="px-4 py-4 text-right tabular-nums">
                      {
                        comparison.activeDays
                          .current
                      }{" "}
                      /{" "}
                      {
                        comparison.activeDays
                          .totalDays
                      }
                    </td>

                    <td className="px-4 py-4 text-right text-muted-foreground tabular-nums">
                      {
                        comparison.activeDays
                          .previous
                      }{" "}
                      /{" "}
                      {
                        comparison.activeDays
                          .totalDays
                      }
                    </td>

                    <td className="py-4 pl-4 text-right tabular-nums">
                      <CountChangeValue
                        change={
                          comparison.activeDays
                            .change
                        }
                      />
                    </td>
                  </tr>

                  <tr>
                    <th
                      scope="row"
                      className="py-4 pr-4 text-left font-medium"
                    >
                      Sessions
                    </th>

                    <td className="px-4 py-4 text-right tabular-nums">
                      {comparison.sessions.current}
                    </td>

                    <td className="px-4 py-4 text-right text-muted-foreground tabular-nums">
                      {comparison.sessions.previous}
                    </td>

                    <td className="py-4 pl-4 text-right tabular-nums">
                      <CountChangeValue
                        change={
                          comparison.sessions
                            .change
                        }
                      />
                    </td>
                  </tr>

                  <tr>
                    <th
                      scope="row"
                      className="py-4 pr-4 text-left font-medium"
                    >
                      Avg session
                    </th>

                    <td className="px-4 py-4 text-right tabular-nums">
                      {comparison.sessions.current === 0 ? (
                        <span aria-label="No average session">
                          —
                        </span>
                      ) : (
                        formatAnalyticsDuration(
                          comparison.averageSession
                            .currentSeconds,
                        )
                      )}
                    </td>

                    <td className="px-4 py-4 text-right text-muted-foreground tabular-nums">
                      {comparison.sessions.previous ===
                      0 ? (
                        <span aria-label="No average session">
                          —
                        </span>
                      ) : (
                        formatAnalyticsDuration(
                          comparison.averageSession
                            .previousSeconds,
                        )
                      )}
                    </td>

                    <td className="py-4 pl-4 text-right tabular-nums">
                      <AverageSessionChangeValue
                        currentSessions={
                          comparison.sessions.current
                        }
                        previousSessions={
                          comparison.sessions.previous
                        }
                        currentSeconds={
                          comparison.averageSession
                            .currentSeconds
                        }
                        previousSeconds={
                          comparison.averageSession
                            .previousSeconds
                        }
                        change={
                          comparison.averageSession
                            .change
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="daily-heading">
        <Card>
          <CardHeader>
            <CardTitle id="daily-heading">
              Daily activity
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <DailyActivityChart
              days={currentAnalytics.days}
              activities={
                currentAnalytics.activities
              }
            />

            <p className="text-sm text-muted-foreground">
              {
                currentAnalytics.summary
                  .sessionCount
              }{" "}
              time{" "}
              {currentAnalytics.summary
                .sessionCount === 1
                ? "block"
                : "blocks"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby="activities-heading"
      >
        <Card>
          <CardHeader>
            <CardTitle id="activities-heading">
              Time by activity
            </CardTitle>
          </CardHeader>

          <CardContent>
            {currentAnalytics.activities
              .length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity tracked during this
                period.
              </p>
            ) : (
              <ul className="divide-y">
                {currentAnalytics.activities.map(
                  (activity) => {
                    const percentage =
                      currentAnalytics.summary
                        .totalSeconds === 0
                        ? 0
                        : (activity.totalSeconds /
                            currentAnalytics
                              .summary
                              .totalSeconds) *
                          100;

                    const percentageLabel =
                      percentage > 0 &&
                      percentage < 1
                        ? "<1%"
                        : `${Math.round(
                            percentage,
                          )}%`;

                    return (
                      <li
                        key={
                          activity.activityId ??
                          "unlabeled"
                        }
                        className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {
                            activity.activityName
                          }
                        </span>

                        <div className="flex shrink-0 items-center gap-4">
                          <span className="text-muted-foreground tabular-nums">
                            {formatDuration(
                              activity.totalSeconds,
                            )}
                          </span>

                          <span className="w-12 text-right text-sm text-muted-foreground tabular-nums">
                            {percentageLabel}
                          </span>
                        </div>
                      </li>
                    );
                  },
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}