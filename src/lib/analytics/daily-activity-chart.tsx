import type {
  ActivityBreakdown,
  DailyBreakdown,
} from "@/lib/analytics/types";
import { formatDayLabel } from "@/lib/time/format-day-label";
import { formatDuration } from "@/lib/time/format-duration";

type DailyActivityChartProps = {
  days: DailyBreakdown[];
  activities: ActivityBreakdown[];
};

const activityColors = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export function DailyActivityChart({
  days,
  activities,
}: DailyActivityChartProps) {
  const maxSeconds = Math.max(
    0,
    ...days.map((day) => day.totalSeconds),
  );

  const colorByActivityId = new Map<string | null, string>();

  const labeledActivities = activities.filter(
    (activity) => activity.activityId !== null,
  );

  labeledActivities.forEach((activity, index) => {
    colorByActivityId.set(
      activity.activityId,
      activityColors[index % activityColors.length],
    );
  });

  colorByActivityId.set(null, "bg-muted-foreground");

  const rankByActivityId = new Map(
    activities.map((activity, index) => [
      activity.activityId,
      index,
    ]),
  );

  return (
    <div className="space-y-4">
      <div className="flex h-48 items-end gap-3">
        {days.map((day) => {
          const heightPercentage =
            maxSeconds === 0
              ? 0
              : (day.totalSeconds / maxSeconds) * 100;

          const dayLabel = formatDayLabel(day.date);

          const rankedActivities = [...day.activities].sort(
            (a, b) =>
              (rankByActivityId.get(a.activityId) ?? Infinity) -
              (rankByActivityId.get(b.activityId) ?? Infinity),
          );

          return (
            <div
              key={day.date}
              className="flex h-full flex-1 flex-col justify-end gap-2"
            >
              <div className="flex min-h-0 flex-1 items-end">
                {day.totalSeconds > 0 && (
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-md"
                    style={{
                      height: `max(2px, ${heightPercentage}%)`,
                    }}
                  >
                    {rankedActivities.map((activity) => (
                      <div
                        key={
                          activity.activityId ?? "unlabeled"
                        }
                        className={
                          colorByActivityId.get(
                            activity.activityId,
                          ) ?? "bg-muted-foreground"
                        }
                        style={{
                          height: `${
                            (activity.totalSeconds /
                              day.totalSeconds) *
                            100
                          }%`,
                        }}
                        title={`${dayLabel} · ${
                          activity.activityName
                        }: ${formatDuration(
                          activity.totalSeconds,
                        )} · Day total: ${formatDuration(
                          day.totalSeconds,
                        )}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <span className="text-center text-xs text-muted-foreground">
                {dayLabel}
              </span>
            </div>
          );
        })}
      </div>

      {activities.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {activities.map((activity) => (
            <li
              key={activity.activityId ?? "unlabeled"}
              className="flex items-center gap-2"
            >
              <span
                aria-hidden="true"
                className={`size-2.5 shrink-0 rounded-sm ${
                  colorByActivityId.get(
                    activity.activityId,
                  ) ?? "bg-muted-foreground"
                }`}
              />

              <span className="text-xs text-muted-foreground">
                {activity.activityName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}