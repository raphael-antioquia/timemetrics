import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import {
  createManualTimeBlock,
  createTimeBlock,
} from "./time-blocks";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

type MockedSupabase = Awaited<
  ReturnType<typeof createClient>
>;

type Harness = {
  client: MockedSupabase;
  insert: ReturnType<typeof vi.fn>;
  existingEq: ReturnType<typeof vi.fn>;
};

const USER_ID =
  "11111111-1111-4111-8111-111111111111";

const ACTIVITY_ID =
  "22222222-2222-4222-8222-222222222222";

const EXISTING_TIME_BLOCK_ID =
  "33333333-3333-4333-8333-333333333333";

const timerInput = {
  activityId: ACTIVITY_ID,
  startedAt: "2026-01-01T15:00:00.000Z",
  endedAt: "2026-01-01T16:00:00.000Z",
  durationSeconds: 3000,
};

function createHarness({
  insertError = null,
  existingTimeBlock = null,
  existingTimeBlockError = null,
}: {
  insertError?: { code: string } | null;
  existingTimeBlock?: { id: string } | null;
  existingTimeBlockError?: Error | null;
} = {}): Harness {
  const activityMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: ACTIVITY_ID,
    },
    error: null,
  });

  const activityUserEq = vi.fn().mockReturnValue({
    maybeSingle: activityMaybeSingle,
  });

  const activityIdEq = vi.fn().mockReturnValue({
    eq: activityUserEq,
  });

  const activitySelect = vi.fn().mockReturnValue({
    eq: activityIdEq,
  });

  const insert = vi.fn().mockResolvedValue({
    error: insertError,
  });

  const existingMaybeSingle = vi.fn().mockResolvedValue({
    data: existingTimeBlock,
    error: existingTimeBlockError,
  });

  const existingQuery = {
    eq: vi.fn(),
    maybeSingle: existingMaybeSingle,
  };

  existingQuery.eq.mockReturnValue(existingQuery);

  const timeBlockSelect = vi
    .fn()
    .mockReturnValue(existingQuery);

  const from = vi.fn((table: string) => {
    if (table === "activities") {
      return {
        select: activitySelect,
      };
    }

    if (table === "time_blocks") {
      return {
        insert,
        select: timeBlockSelect,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  const getUser = vi.fn().mockResolvedValue({
    data: {
      user: {
        id: USER_ID,
      },
    },
    error: null,
  });

  return {
    client: {
      auth: {
        getUser,
      },
      from,
    } as unknown as MockedSupabase,
    insert,
    existingEq: existingQuery.eq,
  };
}

describe("createTimeBlock", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns success when the time block is inserted", async () => {
    
    const harness = createHarness();

    vi.mocked(createClient).mockResolvedValue(
      harness.client,
    );

    await expect(
      createTimeBlock(timerInput),
    ).resolves.toEqual({
      status: "success",
      message: "Time session saved.",
    });

    expect(harness.insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      activity_id: ACTIVITY_ID,
      started_at: "2026-01-01T15:00:00.000Z",
      ended_at: "2026-01-01T16:00:00.000Z",
      duration_seconds: 3000,
    });

    expect(revalidatePath).toHaveBeenCalledWith("/");

    expect(
      Sentry.captureException,
    ).not.toHaveBeenCalled();
  });

  it("treats an exact existing time block as success after an overlap violation", async () => {
    const harness = createHarness({
      insertError: {
        code: "23P01",
      },
      existingTimeBlock: {
        id: EXISTING_TIME_BLOCK_ID,
      },
    });

    vi.mocked(createClient).mockResolvedValue(
      harness.client,
    );

    await expect(
      createTimeBlock(timerInput),
    ).resolves.toEqual({
      status: "success",
      message: "Time session saved.",
    });

    expect(harness.existingEq).toHaveBeenCalledTimes(5);

    expect(harness.existingEq.mock.calls).toEqual(
      expect.arrayContaining([
        ["user_id", USER_ID],
        ["activity_id", ACTIVITY_ID],
        [
          "started_at",
          "2026-01-01T15:00:00.000Z",
        ],
        [
          "ended_at",
          "2026-01-01T16:00:00.000Z",
        ],
        ["duration_seconds", 3000],
      ]),
    );

    expect(revalidatePath).toHaveBeenCalledWith("/");

    expect(
      Sentry.captureException,
    ).not.toHaveBeenCalled();
  });

  it("returns an overlap error when no exact existing time block matches", async () => {
    const harness = createHarness({
      insertError: {
        code: "23P01",
      },
      existingTimeBlock: null,
    });

    vi.mocked(createClient).mockResolvedValue(
      harness.client,
    );

    await expect(
      createTimeBlock(timerInput),
    ).resolves.toEqual({
      status: "error",
      message:
        "This time range overlaps an existing session.",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a retryable error when exact-match verification fails", async () => {
    const verificationError = new Error(
      "Failed to verify existing time block",
    );

    const harness = createHarness({
      insertError: {
        code: "23P01",
      },
      existingTimeBlockError: verificationError,
    });

    vi.mocked(createClient).mockResolvedValue(
      harness.client,
    );

    await expect(
      createTimeBlock(timerInput),
    ).resolves.toEqual({
      status: "error",
      message:
        "We couldn't verify whether this time session was saved. Please try again.",
    });

    expect(
      Sentry.captureException,
    ).toHaveBeenCalledWith(
      verificationError,
      {
        tags: {
          operation: "verify_time_block_retry",
        },
      },
    );

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("treats an exact existing time block as success for manual entries", async () => {
    const harness = createHarness({
      insertError: {
        code: "23P01",
      },
      existingTimeBlock: {
        id: EXISTING_TIME_BLOCK_ID,
      },
    });

    vi.mocked(createClient).mockResolvedValue(
      harness.client,
    );

    await expect(
      createManualTimeBlock({
        activityId: ACTIVITY_ID,
        startedAt: "2026-01-01T15:00:00.000Z",
        endedAt: "2026-01-01T16:00:00.000Z",
      }),
    ).resolves.toEqual({
      status: "success",
      message: "Time session saved.",
    });

    expect(harness.existingEq.mock.calls).toEqual(
      expect.arrayContaining([
        ["duration_seconds", 3600],
      ]),
    );
  });
});
