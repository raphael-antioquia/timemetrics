import "server-only";

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { buildRangeAnalytics } from "@/lib/analytics/build-range-analytics";
import type { DailyActivityTotalRow, RangeAnalytics } from "@/lib/analytics/types";

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

  const { data, error } = await supabase
    .rpc("get_daily_activity_totals", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_time_zone: timeZone,
    })
    .overrideTypes<DailyActivityTotalRow[], { merge: false }>();

  if (error) {
    Sentry.captureException(error, {
      tags: {
        operation: "get_daily_activity_totals",
      },
    });

    throw new Error("Failed to load analytics");
  }

  return buildRangeAnalytics(data, startDate, endDate);
}