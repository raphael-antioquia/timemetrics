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
    RangeAnalytics["days"][number]
  >();

  const activityTotals = new Map<
    string | null,
    RangeAnalytics["activities"][number]
  >();

  let totalSeconds = 0;
  let sessionCount = 0;

  for (const row of rows) {
    const activity = {
      activityId: row.activity_id,
      activityName: row.activity_name ?? "Unlabeled",
      totalSeconds: row.total_seconds,
      sessionCount: row.session_count,
    };

    const existingDay = dayTotals.get(row.day);

    if (existingDay) {
      existingDay.totalSeconds += row.total_seconds;
      existingDay.sessionCount += row.session_count;
      existingDay.activities.push(activity);
    } else {
      dayTotals.set(row.day, {
        date: row.day,
        totalSeconds: row.total_seconds,
        sessionCount: row.session_count,
        activities: [activity],
      });
    }

    const existingActivity = activityTotals.get(row.activity_id);

    if (existingActivity) {
      existingActivity.totalSeconds += row.total_seconds;
      existingActivity.sessionCount += row.session_count;
    } else {
      activityTotals.set(row.activity_id, { ...activity });
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

    days.push(
      totals ?? {
        date,
        totalSeconds: 0,
        sessionCount: 0,
        activities: [],
      },
    );

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