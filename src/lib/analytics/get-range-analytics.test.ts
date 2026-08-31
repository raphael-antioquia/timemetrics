import { beforeEach, describe, expect, it, vi } from "vitest";

import * as Sentry from "@sentry/nextjs";

import { buildRangeAnalytics } from "@/lib/analytics/build-range-analytics";
import type {
  DailyActivityTotalRow,
  RangeAnalytics,
} from "@/lib/analytics/types";
import { createClient } from "@/lib/supabase/server";

import { getRangeAnalytics } from "./get-range-analytics";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/analytics/build-range-analytics", () => ({
  buildRangeAnalytics: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

type MockedSupabase = Awaited<
  ReturnType<typeof createClient>
>;

function mockClient(rpc: unknown): MockedSupabase {
  return { rpc } as unknown as MockedSupabase;
}

describe("getRangeAnalytics", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the requested range and builds analytics from the returned rows", async () => {
    const rows: DailyActivityTotalRow[] = [
      {
        day: "2026-08-24",
        activity_id:
          "550e8400-e29b-41d4-a716-446655440000",
        activity_name: "Deep work",
        total_seconds: 5400,
        session_count: 2,
      },
      {
        day: "2026-08-24",
        activity_id: null,
        activity_name: null,
        total_seconds: 900,
        session_count: 1,
      },
    ];

    const expectedAnalytics =
      {} as unknown as RangeAnalytics;

    const overrideTypes = vi
      .fn()
      .mockResolvedValue({
        data: rows,
        error: null,
      });

    const rpc = vi.fn().mockReturnValue({
      overrideTypes,
    });

    vi.mocked(createClient).mockResolvedValue(
      mockClient(rpc),
    );

    vi.mocked(
      buildRangeAnalytics,
    ).mockReturnValue(expectedAnalytics);

    const result = await getRangeAnalytics({
      startDate: "2026-08-24",
      endDate: "2026-08-30",
      timeZone: "America/Toronto",
    });

    expect(rpc).toHaveBeenCalledWith(
      "get_daily_activity_totals",
      {
        p_start_date: "2026-08-24",
        p_end_date: "2026-08-30",
        p_time_zone: "America/Toronto",
      },
    );

    expect(
      buildRangeAnalytics,
    ).toHaveBeenCalledWith(
      rows,
      "2026-08-24",
      "2026-08-30",
    );

    expect(result).toBe(expectedAnalytics);

    expect(
      Sentry.captureException,
    ).not.toHaveBeenCalled();
  });

  it("captures an RPC error and throws a user-facing analytics error", async () => {
    const error = new Error(
      "Failed to execute analytics RPC",
    );

    const overrideTypes = vi
      .fn()
      .mockResolvedValue({
        data: null,
        error,
      });

    const rpc = vi.fn().mockReturnValue({
      overrideTypes,
    });

    vi.mocked(createClient).mockResolvedValue(
      mockClient(rpc),
    );

    await expect(
      getRangeAnalytics({
        startDate: "2026-08-24",
        endDate: "2026-08-30",
        timeZone: "America/Toronto",
      }),
    ).rejects.toThrow("Failed to load analytics");

    expect(
      Sentry.captureException,
    ).toHaveBeenCalledWith(error, {
      tags: {
        operation: "get_daily_activity_totals",
      },
    });

    expect(
      buildRangeAnalytics,
    ).not.toHaveBeenCalled();
  });
});