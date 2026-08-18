import { redirect } from "next/navigation";

import { getRangeAnalytics } from "@/lib/analytics/get-range-analytics";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/time/format-duration";
import { getUserTimezone } from "@/lib/time/get-user-timezone";
import { getLastSevenDayRange } from "@/lib/time/ranges";
import { formatDayLabel } from "@/lib/time/format-day-label";

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

  return (
    <main>
      <h1>Analytics</h1>
      <p>Last 7 days</p>

      <section>
        <h2>Summary</h2>

        <p>
          Total tracked:{" "}
          {formatDuration(analytics.summary.totalSeconds)}
        </p>

        <p>Active days: {analytics.summary.activeDays} of 7</p>
      </section>

      <section>
        <h2>Daily</h2>

        <ul>
          {analytics.days.map((day) => (
            <li key={day.date}>
              {formatDayLabel(day.date)}:{" "}
              {day.totalSeconds === 0
                ? "—"
                : formatDuration(day.totalSeconds)}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Activities</h2>

        {analytics.activities.length === 0 ? (
          <p>No activity tracked during this period.</p>
        ) : (
          <ul>
            {analytics.activities.map((activity) => {
              const percentage =
                analytics.summary.totalSeconds === 0
                  ? 0
                  : (activity.totalSeconds /
                      analytics.summary.totalSeconds) *
                    100;

              return (
                <li key={activity.activityId ?? "unlabeled"}>
                  {activity.activityName}:{" "}
                  {formatDuration(activity.totalSeconds)} (
                  {percentage < 1 && percentage > 0
                    ? "<1"
                    : Math.round(percentage)}
                  %)
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>Details</h2>

        <p>Time blocks: {analytics.summary.sessionCount}</p>
      </section>
    </main>
  );
}