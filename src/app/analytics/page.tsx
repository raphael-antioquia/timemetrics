import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRangeAnalytics } from "@/lib/analytics/get-range-analytics";
import { createClient } from "@/lib/supabase/server";
import { formatDayLabel } from "@/lib/time/format-day-label";
import { formatDuration } from "@/lib/time/format-duration";
import { getUserTimezone } from "@/lib/time/get-user-timezone";
import { getLastSevenDayRange } from "@/lib/time/ranges";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const timeZone = await getUserTimezone(user.id);

  const range = getLastSevenDayRange(timeZone);

  const analytics = await getRangeAnalytics({
    ...range,
    timeZone,
  });

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const startDateLabel = dateFormatter.format(
    new Date(`${range.startDate}T00:00:00Z`),
  );

  const endDateLabel = dateFormatter.format(
    new Date(`${range.endDate}T00:00:00Z`),
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Analytics
        </h1>
        <p className="text-muted-foreground">
          Last 7 days · {startDateLabel} – {endDateLabel}
        </p>
      </header>

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
                  analytics.summary.totalSeconds,
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
                {analytics.summary.activeDays}{" "}
                <span className="text-lg text-muted-foreground">
                  of {analytics.days.length}
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

          <CardContent>
            <ul className="divide-y">
              {analytics.days.map((day) => (
                <li
                  key={day.date}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <span className="font-medium">
                    {formatDayLabel(day.date)}
                  </span>

                  <span className="text-muted-foreground tabular-nums">
                    {day.totalSeconds === 0
                      ? "—"
                      : formatDuration(day.totalSeconds)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
            <CardContent>
            <p className="text-sm text-muted-foreground">
              {analytics.summary.sessionCount} time{" "}
              {analytics.summary.sessionCount === 1
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
            {analytics.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity tracked during this period.
              </p>
            ) : (
              <ul className="divide-y">
                {analytics.activities.map((activity) => {
                  const percentage =
                    analytics.summary.totalSeconds === 0
                      ? 0
                      : (activity.totalSeconds /
                          analytics.summary.totalSeconds) *
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