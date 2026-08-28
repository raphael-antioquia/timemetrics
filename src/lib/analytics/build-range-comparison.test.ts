import { describe, expect, it } from "vitest";

import { buildRangeComparison } from "@/lib/analytics/build-range-comparison";
import type {
  ActivityBreakdown,
  RangeAnalytics,
} from "@/lib/analytics/types";

type MakeRangeAnalyticsOptions = {
  totalSeconds?: number;
  sessionCount?: number;
  activeDays?: number;
  dayCount?: number;
  activities?: ActivityBreakdown[];
};

function makeRangeAnalytics({
  totalSeconds = 0,
  sessionCount = 0,
  activeDays = 0,
  dayCount = 7,
  activities = [],
}: MakeRangeAnalyticsOptions = {}): RangeAnalytics {
  const days = Array.from(
    { length: dayCount },
    (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, "0")}`,
      totalSeconds: 0,
      sessionCount: 0,
      activities: [],
    }),
  );

  return {
    startDate: "2026-08-01",
    endDate: `2026-08-${String(dayCount).padStart(2, "0")}`,
    summary: {
      totalSeconds,
      sessionCount,
      activeDays,
    },
    days,
    activities,
  };
}

function makeActivity(
  activityId: string | null,
  activityName: string,
  totalSeconds: number,
): ActivityBreakdown {
  return {
    activityId,
    activityName,
    totalSeconds,
    sessionCount: 1,
  };
}

describe("buildRangeComparison", () => {
  describe("tracked time", () => {
    it("calculates an increasing duration change", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 6 * 60 * 60,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 8 * 60 * 60,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      const change = comparison.trackedTime.change;

      expect(change.kind).toBe("delta");

      if (change.kind !== "delta") {
        throw new Error("Expected delta change");
      }

      expect(change.absoluteSeconds).toBe(7_200);
      expect(change.percent).toBeCloseTo(
        33.333,
        2,
      );
    });

    it("calculates a decreasing duration change", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 8 * 60 * 60,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 6 * 60 * 60,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      const change = comparison.trackedTime.change;

      expect(change.kind).toBe("delta");

      if (change.kind !== "delta") {
        throw new Error("Expected delta change");
      }

      expect(change.absoluteSeconds).toBe(-7_200);
      expect(change.percent).toBeCloseTo(-25, 2);
    });

    it("returns new when the previous duration is zero", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 0,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 3_600,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.trackedTime.change).toEqual({
        kind: "new",
      });
    });

    it("returns cleared when the current duration is zero", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 3_600,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 0,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.trackedTime.change).toEqual({
        kind: "cleared",
      });
    });

    it("returns none when both durations are zero", () => {
      const previous = makeRangeAnalytics();
      const current = makeRangeAnalytics();

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.trackedTime.change).toEqual({
        kind: "none",
      });
    });

    it("returns none when both durations are equal and nonzero", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 3_600,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 3_600,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.trackedTime.change).toEqual({
        kind: "none",
      });
    });
  });

  describe("summary counts", () => {
    it("compares active days and includes the range length", () => {
      const previous = makeRangeAnalytics({
        activeDays: 4,
        dayCount: 7,
      });

      const current = makeRangeAnalytics({
        activeDays: 6,
        dayCount: 7,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.activeDays).toEqual({
        current: 6,
        previous: 4,
        totalDays: 7,
        change: 2,
      });
    });

    it("calculates a signed session count change", () => {
      const previous = makeRangeAnalytics({
        sessionCount: 14,
      });

      const current = makeRangeAnalytics({
        sessionCount: 9,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.sessions).toEqual({
        current: 9,
        previous: 14,
        change: -5,
      });
    });
  });

  describe("average session", () => {
    it("calculates average session duration for both periods", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 7_200,
        sessionCount: 4,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 10_800,
        sessionCount: 4,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(
        comparison.averageSession.currentSeconds,
      ).toBe(2_700);

      expect(
        comparison.averageSession.previousSeconds,
      ).toBe(1_800);

      const change =
        comparison.averageSession.change;

      expect(change.kind).toBe("delta");

      if (change.kind !== "delta") {
        throw new Error("Expected delta change");
      }

      expect(change.absoluteSeconds).toBe(900);
      expect(change.percent).toBeCloseTo(50, 2);
    });

    it("returns new when the previous period has no sessions", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 0,
        sessionCount: 0,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 3_600,
        sessionCount: 2,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.averageSession).toEqual({
        currentSeconds: 1_800,
        previousSeconds: 0,
        change: {
          kind: "new",
        },
      });
    });

    it("returns cleared when the current period has no sessions", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 3_600,
        sessionCount: 2,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 0,
        sessionCount: 0,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.averageSession).toEqual({
        currentSeconds: 0,
        previousSeconds: 1_800,
        change: {
          kind: "cleared",
        },
      });
    });

    it("rounds average session duration to whole seconds", () => {
      const previous = makeRangeAnalytics({
        totalSeconds: 10,
        sessionCount: 3,
      });

      const current = makeRangeAnalytics({
        totalSeconds: 11,
        sessionCount: 3,
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(
        comparison.averageSession.previousSeconds,
      ).toBe(3);

      expect(
        comparison.averageSession.currentSeconds,
      ).toBe(4);
    });
  });

  describe("activity comparisons", () => {
    it("compares an activity present in both periods", () => {
      const previous = makeRangeAnalytics({
        activities: [
          makeActivity(
            "coding",
            "Coding",
            6 * 60 * 60,
          ),
        ],
      });

      const current = makeRangeAnalytics({
        activities: [
          makeActivity(
            "coding",
            "Coding",
            8 * 60 * 60,
          ),
        ],
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.activities).toHaveLength(1);

      const activity = comparison.activities[0];

      expect(activity.activityId).toBe("coding");
      expect(activity.activityName).toBe("Coding");
      expect(activity.currentSeconds).toBe(
        8 * 60 * 60,
      );
      expect(activity.previousSeconds).toBe(
        6 * 60 * 60,
      );

      expect(activity.change.kind).toBe("delta");

      if (activity.change.kind !== "delta") {
        throw new Error("Expected delta change");
      }

      expect(
        activity.change.absoluteSeconds,
      ).toBe(7_200);

      expect(activity.change.percent).toBeCloseTo(
        33.333,
        2,
      );
    });

    it("includes an activity present only in the current period", () => {
      const previous = makeRangeAnalytics();

      const current = makeRangeAnalytics({
        activities: [
          makeActivity(
            "coding",
            "Coding",
            3_600,
          ),
        ],
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.activities).toEqual([
        {
          activityId: "coding",
          activityName: "Coding",
          currentSeconds: 3_600,
          previousSeconds: 0,
          change: {
            kind: "new",
          },
        },
      ]);
    });

    it("includes an activity present only in the previous period", () => {
      const previous = makeRangeAnalytics({
        activities: [
          makeActivity(
            "job-search",
            "Job Search",
            7_200,
          ),
        ],
      });

      const current = makeRangeAnalytics();

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.activities).toEqual([
        {
          activityId: "job-search",
          activityName: "Job Search",
          currentSeconds: 0,
          previousSeconds: 7_200,
          change: {
            kind: "cleared",
          },
        },
      ]);
    });

    it("merges the unlabeled activity across both periods", () => {
      const previous = makeRangeAnalytics({
        activities: [
          makeActivity(
            null,
            "Unlabeled",
            1_800,
          ),
        ],
      });

      const current = makeRangeAnalytics({
        activities: [
          makeActivity(
            null,
            "Unlabeled",
            3_600,
          ),
        ],
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.activities).toHaveLength(1);

      expect(comparison.activities[0]).toMatchObject({
        activityId: null,
        activityName: "Unlabeled",
        currentSeconds: 3_600,
        previousSeconds: 1_800,
      });
    });

    it("handles an unlabeled activity present in only one period", () => {
      const previous = makeRangeAnalytics({
        activities: [
          makeActivity(
            null,
            "Unlabeled",
            1_800,
          ),
        ],
      });

      const current = makeRangeAnalytics();

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(comparison.activities).toEqual([
        {
          activityId: null,
          activityName: "Unlabeled",
          currentSeconds: 0,
          previousSeconds: 1_800,
          change: {
            kind: "cleared",
          },
        },
      ]);
    });

    it("uses the current activity name when the activity was renamed", () => {
      const previous = makeRangeAnalytics({
        activities: [
          makeActivity(
            "coding",
            "Programming",
            3_600,
          ),
        ],
      });

      const current = makeRangeAnalytics({
        activities: [
          makeActivity(
            "coding",
            "Coding",
            3_600,
          ),
        ],
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(
        comparison.activities[0].activityName,
      ).toBe("Coding");
    });

    it("sorts by the larger duration across either period", () => {
      const previous = makeRangeAnalytics({
        activities: [
          makeActivity(
            "coding",
            "Coding",
            5 * 60 * 60,
          ),
          makeActivity(
            "job-search",
            "Job Search",
            4 * 60 * 60,
          ),
          makeActivity(
            "learning",
            "Learning",
            2 * 60 * 60,
          ),
        ],
      });

      const current = makeRangeAnalytics({
        activities: [
          makeActivity(
            "coding",
            "Coding",
            6 * 60 * 60,
          ),
          makeActivity(
            "learning",
            "Learning",
            3 * 60 * 60,
          ),
        ],
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(
        comparison.activities.map(
          (activity) => activity.activityName,
        ),
      ).toEqual([
        "Coding",
        "Job Search",
        "Learning",
      ]);
    });

    it("sorts equal-duration activities alphabetically", () => {
      const previous = makeRangeAnalytics();

      const current = makeRangeAnalytics({
        activities: [
          makeActivity(
            "beta",
            "Beta",
            3_600,
          ),
          makeActivity(
            "alpha",
            "Alpha",
            3_600,
          ),
        ],
      });

      const comparison = buildRangeComparison(
        current,
        previous,
      );

      expect(
        comparison.activities.map(
          (activity) => activity.activityName,
        ),
      ).toEqual(["Alpha", "Beta"]);
    });
  });

  it("rejects comparison ranges with different lengths", () => {
    const current = makeRangeAnalytics({
      dayCount: 7,
    });

    const previous = makeRangeAnalytics({
      dayCount: 30,
    });

    expect(() =>
      buildRangeComparison(current, previous),
    ).toThrow(
      "Comparison ranges must contain the same number of days",
    );
  });
});