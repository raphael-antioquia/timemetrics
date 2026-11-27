import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createClient } from "@supabase/supabase-js";

import {
  seedDemo,
  summarizeDemoData,
} from "./seed-demo";

import type {
  DemoDataset,
} from "./generate-demo-data";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const LOCAL_URL = "http://127.0.0.1:54321";
const TEST_KEY = "test-publishable-key";
const TIME_ZONE = "America/Toronto";

const USER_ID =
  "11111111-1111-4111-8111-111111111111";

const DEVELOPMENT_ID =
  "22222222-2222-4222-8222-222222222222";

const ARCHIVED_ID =
  "33333333-3333-4333-8333-333333333333";

const SESSION = {
  user: { id: USER_ID },
};

const DATASET: DemoDataset = {
  activities: [
    {
      key: "development",
      name: "Software Development",
    },
    {
      key: "archived",
      name: "Archived Project",
    },
  ],
  timeBlocks: [
    {
      activityKey: "archived",
      startedAt: "2026-09-28T13:00:00.000Z",
      endedAt: "2026-09-28T14:00:00.000Z",
      durationSeconds: 3600,
    },
    {
      activityKey: "development",
      startedAt: "2026-11-25T14:00:00.000Z",
      endedAt: "2026-11-25T15:00:00.000Z",
      durationSeconds: 3000,
    },
  ],
};

function mockClient() {
  const signIn = vi.fn().mockResolvedValue({
    data: { session: SESSION },
    error: null,
  });

  const signUp = vi.fn().mockResolvedValue({
    data: { session: SESSION },
    error: null,
  });

  const readActivities = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  });

  const readBlocks = vi.fn().mockResolvedValue({
    data: [],
    error: null,
  });

  const activitiesReadEq = vi.fn().mockReturnValue({
    limit: readActivities,
  });

  const blocksReadEq = vi.fn().mockReturnValue({
    limit: readBlocks,
  });

  const profileResult = vi.fn().mockResolvedValue({
    data: { id: USER_ID },
    error: null,
  });

  const profileEq = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: profileResult,
    }),
  });

  const updateProfile = vi.fn().mockReturnValue({
    eq: profileEq,
  });

  const activityResult = vi.fn().mockResolvedValue({
    // Reverse order intentionally: mapping must
    // not depend on the order of returned records.
    data: [
      {
        id: ARCHIVED_ID,
        name: "Archived Project",
      },
      {
        id: DEVELOPMENT_ID,
        name: "Software Development",
      },
    ],
    error: null,
  });

  const insertActivities = vi.fn().mockReturnValue({
    select: activityResult,
  });

  const insertBlocks = vi.fn().mockResolvedValue({
    error: null,
  });

  const archiveResult = vi.fn().mockResolvedValue({
    data: { id: ARCHIVED_ID },
    error: null,
  });

  const archiveUserEq = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: archiveResult,
    }),
  });

  const archiveIdEq = vi.fn().mockReturnValue({
    eq: archiveUserEq,
  });

  const deleteActivity = vi.fn().mockReturnValue({
    eq: archiveIdEq,
  });

  const from = vi.fn((table: string) => {
    switch (table) {
      case "profiles":
        return {
          update: updateProfile,
        };

      case "activities":
        return {
          select: vi.fn().mockReturnValue({
            eq: activitiesReadEq,
          }),
          insert: insertActivities,
          delete: deleteActivity,
        };

      case "time_blocks":
        return {
          select: vi.fn().mockReturnValue({
            eq: blocksReadEq,
          }),
          insert: insertBlocks,
        };

      default:
        throw new Error(`Unexpected table: ${table}`);
    }
  });

  const client = {
    auth: {
      signInWithPassword: signIn,
      signUp,
    },
    from,
  };

  vi.mocked(createClient).mockReturnValue(
    client as unknown as ReturnType<typeof createClient>,
  );

  return {
    signIn,
    signUp,
    from,
    readActivities,
    readBlocks,
    activitiesReadEq,
    blocksReadEq,
    profileResult,
    profileEq,
    updateProfile,
    activityResult,
    insertActivities,
    insertBlocks,
    archiveResult,
    archiveIdEq,
    archiveUserEq,
    deleteActivity,
  };
}

function runSeed() {
  return seedDemo(
    LOCAL_URL,
    TEST_KEY,
    DATASET,
    TIME_ZONE,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("seedDemo", () => {
  it.each([
    "https://example.supabase.co",
    "http://localhost.example.com:54321",
    "http://localhost:54322",
    "http://localhost:54321/rest/v1",
    "http://user:password@localhost:54321",
  ])("rejects an unexpected URL: %s", async (url) => {
    await expect(
      seedDemo(url, TEST_KEY, DATASET, TIME_ZONE),
    ).rejects.toThrow("restricted to local Supabase");

    expect(createClient).not.toHaveBeenCalled();
  });

  it("reuses an existing authenticated demo account", async () => {
    const db = mockClient();

    await runSeed();

    expect(db.signIn).toHaveBeenCalledTimes(1);
    expect(db.signUp).not.toHaveBeenCalled();
    expect(db.insertBlocks).toHaveBeenCalledTimes(1);
  });

  it("provisions an account after invalid_credentials", async () => {
    const db = mockClient();

    db.signIn.mockResolvedValue({
      data: { session: null },
      error: {
        code: "invalid_credentials",
        message: "Authentication rejected",
      },
    });

    await runSeed();

    expect(db.signUp).toHaveBeenCalledTimes(1);
    expect(db.insertBlocks).toHaveBeenCalledTimes(1);
  });

  it("does not attempt signup after an unexpected auth error", async () => {
    const db = mockClient();

    db.signIn.mockResolvedValue({
      data: { session: null },
      error: {
        code: "unexpected_failure",
        message: "Service unavailable",
      },
    });

    await expect(runSeed()).rejects.toThrow(
      "unexpected_failure",
    );

    expect(db.signUp).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects an existing account with mismatched credentials", async () => {
    const db = mockClient();

    db.signIn.mockResolvedValue({
      data: { session: null },
      error: {
        code: "invalid_credentials",
        message: "Authentication rejected",
      },
    });

    db.signUp.mockResolvedValue({
      data: { session: null },
      error: {
        code: "user_already_exists",
        message: "Account exists",
      },
    });

    await expect(runSeed()).rejects.toThrow(
      "credentials do not match",
    );

    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects signup when no authenticated session is returned", async () => {
    const db = mockClient();

    db.signIn.mockResolvedValue({
      data: { session: null },
      error: {
        code: "invalid_credentials",
        message: "Authentication rejected",
      },
    });

    db.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(runSeed()).rejects.toThrow(
      "returned no session",
    );

    expect(db.from).not.toHaveBeenCalled();
  });

  it.each([
    "activities",
    "time_blocks",
  ])("refuses to seed when %s already contains data", async (table) => {
    const db = mockClient();

    const read =
      table === "activities"
        ? db.readActivities
        : db.readBlocks;

    read.mockResolvedValue({
      data: [{ id: "existing-record" }],
      error: null,
    });

    await expect(runSeed()).rejects.toThrow(
      "already contains data",
    );

    expect(db.updateProfile).not.toHaveBeenCalled();
    expect(db.insertActivities).not.toHaveBeenCalled();
    expect(db.insertBlocks).not.toHaveBeenCalled();
    expect(db.deleteActivity).not.toHaveBeenCalled();
  });

  it("does not interpret a failed existence check as an empty account", async () => {
    const db = mockClient();

    db.readActivities.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Permission denied",
      },
    });

    await expect(runSeed()).rejects.toThrow(
      "42501",
    );

    expect(db.updateProfile).not.toHaveBeenCalled();
    expect(db.insertActivities).not.toHaveBeenCalled();
  });

  it("does not seed when account emptiness cannot be established", async () => {
    const db = mockClient();

    db.readBlocks.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(runSeed()).rejects.toThrow(
      "Could not verify",
    );

    expect(db.updateProfile).not.toHaveBeenCalled();
    expect(db.insertActivities).not.toHaveBeenCalled();
    expect(db.insertBlocks).not.toHaveBeenCalled();
  });

  it("maps activity IDs and inserts all blocks in one request", async () => {
    const db = mockClient();

    await runSeed();

    expect(db.activitiesReadEq).toHaveBeenCalledWith(
      "user_id",
      USER_ID,
    );

    expect(db.blocksReadEq).toHaveBeenCalledWith(
      "user_id",
      USER_ID,
    );

    expect(db.updateProfile).toHaveBeenCalledWith({
      timezone: TIME_ZONE,
    });

    expect(db.profileEq).toHaveBeenCalledWith(
      "id",
      USER_ID,
    );

    expect(db.insertActivities).toHaveBeenCalledTimes(1);

    expect(db.insertActivities).toHaveBeenCalledWith([
      {
        user_id: USER_ID,
        name: "Software Development",
      },
      {
        user_id: USER_ID,
        name: "Archived Project",
      },
    ]);

    expect(db.insertBlocks).toHaveBeenCalledTimes(1);

    expect(db.insertBlocks).toHaveBeenCalledWith([
      {
        user_id: USER_ID,
        activity_id: ARCHIVED_ID,
        started_at: "2026-09-28T13:00:00.000Z",
        ended_at: "2026-09-28T14:00:00.000Z",
        duration_seconds: 3600,
      },
      {
        user_id: USER_ID,
        activity_id: DEVELOPMENT_ID,
        started_at: "2026-11-25T14:00:00.000Z",
        ended_at: "2026-11-25T15:00:00.000Z",
        duration_seconds: 3000,
      },
    ]);

    expect(db.deleteActivity).toHaveBeenCalledTimes(1);

    expect(db.archiveIdEq).toHaveBeenCalledWith(
      "id",
      ARCHIVED_ID,
    );

    expect(db.archiveUserEq).toHaveBeenCalledWith(
      "user_id",
      USER_ID,
    );

    expect(
      db.insertBlocks.mock.invocationCallOrder[0],
    ).toBeLessThan(
      db.deleteActivity.mock.invocationCallOrder[0],
    );
  });

  it("stops if updating the profile fails", async () => {
    const db = mockClient();

    db.profileResult.mockResolvedValue({
      data: null,
      error: {
        code: "22023",
        message: "Invalid timezone",
      },
    });

    await expect(runSeed()).rejects.toThrow(
      "Profile timezone update",
    );

    expect(db.insertActivities).not.toHaveBeenCalled();
    expect(db.insertBlocks).not.toHaveBeenCalled();
  });

  it("stops if inserting activities fails", async () => {
    const db = mockClient();

    db.activityResult.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: "Duplicate activity",
      },
    });

    await expect(runSeed()).rejects.toThrow(
      "Activity insertion",
    );

    expect(db.insertBlocks).not.toHaveBeenCalled();
    expect(db.deleteActivity).not.toHaveBeenCalled();
  });

  it("does not delete the archived activity after a failed block insert", async () => {
    const db = mockClient();

    db.insertBlocks.mockResolvedValue({
      error: {
        code: "23P01",
        message: "Overlapping time block",
      },
    });

    await expect(runSeed()).rejects.toThrow(
      "Time block insertion",
    );

    expect(db.deleteActivity).not.toHaveBeenCalled();
  });

  it("reports failure if archived activity deletion fails", async () => {
    const db = mockClient();

    db.archiveResult.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "Permission denied",
      },
    });

    await expect(runSeed()).rejects.toThrow(
      "Archived activity deletion",
    );
  });
});

describe("summarizeDemoData", () => {
  it("compares periods using local start dates", () => {
    const dataset: DemoDataset = {
      activities: [],
      timeBlocks: [
        {
          activityKey: "development",
          startedAt: "2026-10-27T03:00:00.000Z",
          endedAt: "2026-10-27T03:15:00.000Z",
          durationSeconds: 900,
        },
        {
          activityKey: "development",
          startedAt: "2026-11-19T04:00:00.000Z",
          endedAt: "2026-11-19T04:30:00.000Z",
          durationSeconds: 1800,
        },
        {
          activityKey: "development",
          startedAt: "2026-11-19T05:00:00.000Z",
          endedAt: "2026-11-19T06:00:00.000Z",
          durationSeconds: 3600,
        },
      ],
    };

    const summary = summarizeDemoData(dataset, {
      seed: 42,
      now: new Date("2026-11-26T03:00:00Z"),
      timeZone: TIME_ZONE,
      days: 60,
    });

    expect(summary.sessions).toBe(3);
    expect(summary.activeDays).toBe(3);
    expect(summary.totalSeconds).toBe(6300);

    expect(summary.periods).toEqual([
      {
        days: 7,
        currentSeconds: 3600,
        previousSeconds: 1800,
        changePercent: 100,
      },
      {
        days: 30,
        currentSeconds: 5400,
        previousSeconds: 900,
        changePercent: 500,
      },
    ]);
  });

  it("returns no percentage when the previous period is empty", () => {
    const summary = summarizeDemoData(
      {
        activities: [],
        timeBlocks: [],
      },
      {
        seed: 42,
        now: new Date("2026-11-26T20:00:00Z"),
        timeZone: TIME_ZONE,
        days: 60,
      },
    );

    expect(
      summary.periods.every(
        (period) => period.changePercent === null,
      ),
    ).toBe(true);
  });
});
