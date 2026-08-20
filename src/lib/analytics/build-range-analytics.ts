import type {
  DailyActivityTotalRow,
  RangeAnalytics,
} from "@/lib/analytics/types";

export function buildRangeAnalytics(
  rows: DailyActivityTotalRow[],
  startDate: string,
  endDate: string,
): RangeAnalytics {
  const dayTotals = new Map<
    string,
    {
      totalSeconds: number;
      sessionCount: number;
    }
  >();

  const activityTotals = new Map<
    string | null,
    {
      activityId: string | null;
      activityName: string;
      totalSeconds: number;
      sessionCount: number;
    }
  >();

  let totalSeconds = 0;
  let sessionCount = 0;

  for (const row of rows) {
    const existingDay = dayTotals.get(row.day);

    if (existingDay) {
      existingDay.totalSeconds += row.total_seconds;
      existingDay.sessionCount += row.session_count;
    } else {
      dayTotals.set(row.day, {
        totalSeconds: row.total_seconds,
        sessionCount: row.session_count,
      });
    }

    const existingActivity = activityTotals.get(row.activity_id);

    if (existingActivity) {
      existingActivity.totalSeconds += row.total_seconds;
      existingActivity.sessionCount += row.session_count;
    } else {
      activityTotals.set(row.activity_id, {
        activityId: row.activity_id,
        activityName: row.activity_name ?? "Unlabeled",
        totalSeconds: row.total_seconds,
        sessionCount: row.session_count,
      });
    }

    totalSeconds += row.total_seconds;
    sessionCount += row.session_count;
  }

  const days: RangeAnalytics["days"] = [];

  const currentDate = new Date(`${startDate}T00:00:00Z`);
  const finalDate = new Date(`${endDate}T00:00:00Z`);

  while (currentDate <= finalDate) {
    const date = currentDate.toISOString().slice(0, 10);
    const totals = dayTotals.get(date);

    days.push({
      date,
      totalSeconds: totals?.totalSeconds ?? 0,
      sessionCount: totals?.sessionCount ?? 0,
    });

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  const activeDays = days.filter(
    (day) => day.totalSeconds > 0,
  ).length;

  const activities = Array.from(activityTotals.values()).sort(
    (a, b) => b.totalSeconds - a.totalSeconds,
  );

  return {
    startDate,
    endDate,
    summary: {
      totalSeconds,
      sessionCount,
      activeDays,
    },
    days,
    activities,
  };
}