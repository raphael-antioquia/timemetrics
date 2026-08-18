import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityTotalRow,
  RangeAnalytics,
} from "@/lib/analytics/types";

type GetRangeAnalyticsParams = {
  startDate: string;
  endDate: string;
  timeZone: string;
};

export async function getRangeAnalytics({
  startDate,
  endDate,
  timeZone,
}: GetRangeAnalyticsParams): Promise<RangeAnalytics> {
  const supabase = await createClient();

  const dailyQuery = supabase.rpc("get_daily_totals", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_time_zone: timeZone,
  });

  const activityQuery = supabase
    .rpc("get_activity_totals", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_time_zone: timeZone,
    })
    .overrideTypes<ActivityTotalRow[], { merge: false }>();

  const [dailyResult, activityResult] = await Promise.all([
    dailyQuery,
    activityQuery,
  ]);

  if (dailyResult.error) {
    Sentry.captureException(dailyResult.error, {
      tags: {
        operation: "get_daily_totals",
      },
    });

    throw new Error("Failed to load daily analytics");
  }

  if (activityResult.error) {
    Sentry.captureException(activityResult.error, {
      tags: {
        operation: "get_activity_totals",
      },
    });

    throw new Error("Failed to load activity analytics");
  }

  const days = dailyResult.data.map((row) => ({
    date: row.day,
    totalSeconds: row.total_seconds,
    sessionCount: row.session_count,
  }));

  const activities = activityResult.data.map((row) => ({
    activityId: row.activity_id,
    activityName: row.activity_name ?? "Unlabeled",
    totalSeconds: row.total_seconds,
    sessionCount: row.session_count,
  }));

  const totalSeconds = days.reduce(
    (sum, day) => sum + day.totalSeconds,
    0,
  );

  const sessionCount = days.reduce(
    (sum, day) => sum + day.sessionCount,
    0,
  );

  const activitySeconds = activities.reduce(
    (sum, activity) => sum + activity.totalSeconds,
    0,
  );

  const activitySessionCount = activities.reduce(
    (sum, activity) => sum + activity.sessionCount,
    0,
  );

  if (
    totalSeconds !== activitySeconds ||
    sessionCount !== activitySessionCount
  ) {
    Sentry.captureMessage(
      "analytics: daily/activity aggregates disagree",
      {
        level: "warning",
        tags: {
          operation: "get_range_analytics",
        },
        extra: {
          startDate,
          endDate,
          totalSeconds,
          activitySeconds,
          sessionCount,
          activitySessionCount,
        },
      },
    );
  }

  return {
    startDate,
    endDate,
    summary: {
      totalSeconds,
      sessionCount,
      averageSessionSeconds:
        sessionCount === 0
          ? 0
          : Math.round(totalSeconds / sessionCount),
    },
    days,
    activities,
  };
}