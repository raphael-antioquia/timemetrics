import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DailyActivityChart } from "@/lib/analytics/daily-activity-chart";
import { getRangeAnalytics } from "@/lib/analytics/get-range-analytics";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/time/format-duration";
import { getUserTimezone } from "@/lib/time/get-user-timezone";
import { parseAnalyticsRangePreset } from "@/lib/analytics/analytics-range-preset";
import { buildRangeComparison } from "@/lib/analytics/build-range-comparison";
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

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
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
  
  const previousDateRange = getPreviousDateRange(dateRange);

  const [currentAnalytics, previousAnalytics] =
    await Promise.all([
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

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const startDateLabel = dateFormatter.format(
    new Date(`${dateRange.startDate}T00:00:00Z`),
  );

  const endDateLabel = dateFormatter.format(
    new Date(`${dateRange.endDate}T00:00:00Z`),
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Analytics
          </h1>

          <p className="text-muted-foreground">
            Last {rangePreset} days · {startDateLabel} – {endDateLabel}
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
          aria-current={rangePreset === 7 ? "page" : undefined}
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
          aria-current={rangePreset === 30 ? "page" : undefined}
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
        <h2
          id="summary-heading"
          className="text-lg font-semibold"
        >
          Summary
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total tracked
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                {formatDuration(
                  currentAnalytics.summary.totalSeconds,
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active days
              </CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-3xl font-semibold tracking-tight">
                {currentAnalytics.summary.activeDays}{" "}
                <span className="text-lg text-muted-foreground">
                  of {currentAnalytics.days.length}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
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
              activities={currentAnalytics.activities}
            />

            <p className="text-sm text-muted-foreground">
              {currentAnalytics.summary.sessionCount} time{" "}
              {currentAnalytics.summary.sessionCount === 1
                ? "block"
                : "blocks"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="activities-heading">
        <Card>
          <CardHeader>
            <CardTitle id="activities-heading">
              Time by activity
            </CardTitle>
          </CardHeader>

          <CardContent>
            {currentAnalytics.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity tracked during this period.
              </p>
            ) : (
              <ul className="divide-y">
                {currentAnalytics.activities.map((activity) => {
                  const percentage =
                    currentAnalytics.summary.totalSeconds === 0
                      ? 0
                      : (activity.totalSeconds /
                          currentAnalytics.summary.totalSeconds) *
                        100;

                  const percentageLabel =
                    percentage > 0 && percentage < 1
                      ? "<1%"
                      : `${Math.round(percentage)}%`;

                  return (
                    <li
                      key={
                        activity.activityId ?? "unlabeled"
                      }
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {activity.activityName}
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
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}