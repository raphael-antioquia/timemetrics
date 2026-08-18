import { redirect } from "next/navigation";

import { getRangeAnalytics } from "@/lib/analytics/get-range-analytics";
import { createClient } from "@/lib/supabase/server";
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
        <p>Sessions: {analytics.summary.sessionCount}</p>
        <p>
          Average session:{" "}
          {formatDuration(
            analytics.summary.averageSessionSeconds,
          )}
        </p>
      </section>

      <section>
        <h2>Daily</h2>
        <ul>
          {analytics.days.map((day) => (
            <li key={day.date}>
              {day.date}: {formatDuration(day.totalSeconds)} (
              {day.sessionCount} sessions)
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
            {analytics.activities.map((activity) => (
              <li key={activity.activityId ?? "unlabeled"}>
                {activity.activityName}:{" "}
                {formatDuration(activity.totalSeconds)} (
                {activity.sessionCount} sessions)
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}