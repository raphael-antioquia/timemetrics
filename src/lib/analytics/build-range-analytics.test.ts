import { describe, expect, it } from "vitest";
import { buildRangeAnalytics } from "./build-range-analytics";
import type { DailyActivityTotalRow } from "./types";

describe("buildRangeAnalytics", () => {
  it("derives range analytics from daily activity rows", () => {
    const rows: DailyActivityTotalRow[] = [
      {
        day: "2026-08-07",
        activity_id: null,
        activity_name: null,
        total_seconds: 1384,
        session_count: 2,
      },
      {
        day: "2026-08-10",
        activity_id: "d543f389-2483-49bd-81af-03e68ffb11d2",
        activity_name: "Test",
        total_seconds: 10800,
        session_count: 1,
      },
      {
        day: "2026-08-10",
        activity_id: "371a76a3-4c16-4479-b3fe-c474ba7c2fc9",
        activity_name: "Paused",
        total_seconds: 9,
        session_count: 1,
      },
      {
        day: "2026-08-12",
        activity_id: "371a76a3-4c16-4479-b3fe-c474ba7c2fc9",
        activity_name: "Paused",
        total_seconds: 7260,
        session_count: 1,
      },
      {
        day: "2026-08-12",
        activity_id: "70a3bc6c-d45e-4f61-901b-f85a3f4ba9fe",
        activity_name: "Pickleball New",
        total_seconds: 3797,
        session_count: 1,
      },
      {
        day: "2026-08-12",
        activity_id: "5217cd88-f4e7-4f06-ba13-015123573d33",
        activity_name: "Test4",
        total_seconds: 30,
        session_count: 1,
      },
      {
        day: "2026-08-16",
        activity_id: "371a76a3-4c16-4479-b3fe-c474ba7c2fc9",
        activity_name: "Paused",
        total_seconds: 25,
        session_count: 2,
      },
      {
        day: "2026-08-16",
        activity_id: "70a3bc6c-d45e-4f61-901b-f85a3f4ba9fe",
        activity_name: "Pickleball New",
        total_seconds: 9,
        session_count: 1,
      },
      {
        day: "2026-08-16",
        activity_id: null,
        activity_name: null,
        total_seconds: 9,
        session_count: 2,
      },
      {
        day: "2026-08-16",
        activity_id: "074bc51e-53d7-40be-87d9-75427504e11b",
        activity_name: "Massage",
        total_seconds: 7,
        session_count: 1,
      },
    ];

    const result = buildRangeAnalytics(
      rows,
      "2026-08-07",
      "2026-08-17",
    );

    expect(result.summary.totalSeconds).toBe(23330);
    expect(result.summary.sessionCount).toBe(13);
    expect(result.summary.activeDays).toBe(4);

    expect(
      result.days.find((day) => day.date === "2026-08-12"),
    ).toEqual({
      date: "2026-08-12",
      totalSeconds: 11087,
      sessionCount: 3,
    });

    expect(
      result.days.find((day) => day.date === "2026-08-13"),
    ).toEqual({
      date: "2026-08-13",
      totalSeconds: 0,
      sessionCount: 0,
    });

    expect(result.activities[0]).toMatchObject({
      activityName: "Test",
      totalSeconds: 10800,
      sessionCount: 1,
    });

    expect(
      result.activities.find((a) => a.activityId === null),
    ).toEqual({
      activityId: null,
      activityName: "Unlabeled",
      totalSeconds: 1393,
      sessionCount: 4,
    });
  });
});