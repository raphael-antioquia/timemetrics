import type {
  ActivityBreakdown,
  RangeAnalytics,
} from "@/lib/analytics/types";

export type DurationChange =
  | { kind: "new" }
  | { kind: "cleared" }
  | { kind: "none" }
  | {
      kind: "delta";
      absoluteSeconds: number;
      percent: number;
    };

type DurationComparison = {
  currentSeconds: number;
  previousSeconds: number;
  change: DurationChange;
};

type CountComparison = {
  current: number;
  previous: number;
  change: number;
};

type ActiveDaysComparison = CountComparison & {
  totalDays: number;
};

export type ActivityComparison = {
  activityId: string | null;
  activityName: string;
  currentSeconds: number;
  previousSeconds: number;
  change: DurationChange;
};

export type RangeComparison = {
  trackedTime: DurationComparison;
  activeDays: ActiveDaysComparison;
  sessions: CountComparison;
  averageSession: DurationComparison;
  activities: ActivityComparison[];
};

function buildDurationChange(
  currentSeconds: number,
  previousSeconds: number,
): DurationChange {
  if (previousSeconds === 0 && currentSeconds > 0) {
    return { kind: "new" };
  }

  if (previousSeconds > 0 && currentSeconds === 0) {
    return { kind: "cleared" };
  }

  if (currentSeconds === previousSeconds) {
    return { kind: "none" };
  }

  const absoluteSeconds =
    currentSeconds - previousSeconds;

  const percent =
    (absoluteSeconds / previousSeconds) * 100;

  return {
    kind: "delta",
    absoluteSeconds,
    percent,
  };
}

function getAverageSessionSeconds(
  analytics: RangeAnalytics,
): number {
  if (analytics.summary.sessionCount === 0) {
    return 0;
  }

  return Math.round(
    analytics.summary.totalSeconds /
      analytics.summary.sessionCount,
  );
}

export function buildRangeComparison(
  current: RangeAnalytics,
  previous: RangeAnalytics,
): RangeComparison {
  if (current.days.length !== previous.days.length) {
    throw new Error(
      "Comparison ranges must contain the same number of days",
    );
  }

  const currentAverageSession =
    getAverageSessionSeconds(current);

  const previousAverageSession =
    getAverageSessionSeconds(previous);

  const activitiesById = new Map<
    string | null,
    {
      current?: ActivityBreakdown;
      previous?: ActivityBreakdown;
    }
  >();

  for (const activity of current.activities) {
    activitiesById.set(activity.activityId, {
      current: activity,
    });
  }

  for (const activity of previous.activities) {
    const existing =
      activitiesById.get(activity.activityId);

    if (existing) {
      existing.previous = activity;
    } else {
      activitiesById.set(activity.activityId, {
        previous: activity,
      });
    }
  }

  const activities: ActivityComparison[] =
    Array.from(activitiesById.values())
      .map(({ current: currentActivity, previous: previousActivity }) => {
        const currentSeconds =
          currentActivity?.totalSeconds ?? 0;

        const previousSeconds =
          previousActivity?.totalSeconds ?? 0;

        return {
          activityId:
            currentActivity?.activityId ??
            previousActivity?.activityId ??
            null,
          activityName:
            currentActivity?.activityName ??
            previousActivity?.activityName ??
            "Unlabeled",
          currentSeconds,
          previousSeconds,
          change: buildDurationChange(
            currentSeconds,
            previousSeconds,
          ),
        };
      })
      .sort((a, b) => {
        const byMax =
          Math.max(
            b.currentSeconds,
            b.previousSeconds,
          ) -
          Math.max(
            a.currentSeconds,
            a.previousSeconds,
          );

        if (byMax !== 0) {
          return byMax;
        }

        return a.activityName.localeCompare(
          b.activityName,
        );
      });

  return {
    trackedTime: {
      currentSeconds: current.summary.totalSeconds,
      previousSeconds:
        previous.summary.totalSeconds,
      change: buildDurationChange(
        current.summary.totalSeconds,
        previous.summary.totalSeconds,
      ),
    },

    activeDays: {
      current: current.summary.activeDays,
      previous: previous.summary.activeDays,
      totalDays: current.days.length,
      change:
        current.summary.activeDays -
        previous.summary.activeDays,
    },

    sessions: {
      current: current.summary.sessionCount,
      previous: previous.summary.sessionCount,
      change:
        current.summary.sessionCount -
        previous.summary.sessionCount,
    },

    averageSession: {
      currentSeconds: currentAverageSession,
      previousSeconds: previousAverageSession,
      change: buildDurationChange(
        currentAverageSession,
        previousAverageSession,
      ),
    },

    activities,
  };
}