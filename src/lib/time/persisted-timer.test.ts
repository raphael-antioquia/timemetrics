import { describe, expect, it } from "vitest";

import {
  parsePersistedTimer,
  type PersistedTimer,
} from "./persisted-timer";

const ACTIVITY_ID =
  "123e4567-e89b-12d3-a456-426614174000";

const NOW = Date.UTC(2026, 7, 30, 20, 0, 0);

const FIVE_MINUTES = 5 * 60 * 1000;
const TWENTY_FOUR_HOURS =
  24 * 60 * 60 * 1000;

const USER_ID =
  "223e4567-e89b-12d3-a456-426614174000";

const OTHER_USER_ID =
  "323e4567-e89b-12d3-a456-426614174000";

function createPersistedTimer(
  overrides: Partial<PersistedTimer> = {},
): PersistedTimer {
  return {
    version: 2,
    ownerUserId: USER_ID,
    sessionActivityId: ACTIVITY_ID,
    sessionStartedAt: NOW - 60_000,
    segmentStartedAt: NOW - 30_000,
    accumulatedMilliseconds: 30_000,
    pendingTimeBlock: null,
    ...overrides,
  };
}

const invalidPendingTimeBlocks: Array<
  [string, Record<string, unknown>]
> = [
  [
    "non-UUID activity",
    {
      activityId: "nope",
    },
  ],
  [
    "non-string startedAt",
    {
      startedAt: 12345,
    },
  ],
  [
    "fractional duration",
    {
      durationSeconds: 45.5,
    },
  ],
  [
    "negative duration",
    {
      durationSeconds: -1,
    },
  ],
];

describe("parsePersistedTimer", () => {
  it("returns null when no persisted timer exists", () => {
    expect(
      parsePersistedTimer(null, NOW, USER_ID),
    ).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(
      parsePersistedTimer(
        "{not-valid-json",
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("returns null for an unsupported version", () => {
    const timer = {
      ...createPersistedTimer(),
      version: 3,
    };

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("returns null for an invalid activity ID", () => {
    const timer = createPersistedTimer({
      sessionActivityId: "not-a-uuid",
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("returns null when the current segment starts before the session", () => {
    const sessionStartedAt = NOW - 60_000;

    const timer = createPersistedTimer({
      sessionStartedAt,
      segmentStartedAt:
        sessionStartedAt - 1,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("returns null when the current segment is too far in the future", () => {
    const timer = createPersistedTimer({
      segmentStartedAt:
        NOW + FIVE_MINUTES + 1,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("returns null when accumulated time exceeds the session lifetime", () => {
    const timer = createPersistedTimer({
      sessionStartedAt: NOW - 60_000,
      segmentStartedAt: null,

      // One minute of session lifetime plus five
      // minutes of clock-skew tolerance, then
      // one millisecond beyond the allowed limit.
      accumulatedMilliseconds:
        6 * 60 * 1000 + 1,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("accepts a timer exactly 24 hours old", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW - TWENTY_FOUR_HOURS,
      segmentStartedAt: null,
      accumulatedMilliseconds: 0,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toEqual(timer);
  });

  it("returns null when the timer is older than 24 hours", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW - TWENTY_FOUR_HOURS - 1,
      segmentStartedAt: null,
      accumulatedMilliseconds: 0,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("accepts an ordinary backward clock correction within tolerance", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW + 60_000,
      segmentStartedAt:
        NOW + 60_000,
      accumulatedMilliseconds: 0,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toEqual(timer);
  });

  it("accepts a session start exactly at the backward clock-skew boundary", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW + FIVE_MINUTES,
      segmentStartedAt:
        NOW + FIVE_MINUTES,
      accumulatedMilliseconds: 0,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toEqual(timer);
  });

  it("returns null when the session start exceeds the backward clock-skew tolerance", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW + FIVE_MINUTES + 1,
      segmentStartedAt:
        NOW + FIVE_MINUTES + 1,
      accumulatedMilliseconds: 0,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("restores a valid running timer", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW - 120_000,
      segmentStartedAt:
        NOW - 30_000,
      accumulatedMilliseconds: 45_000,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toEqual(timer);
  });

  it("restores a valid paused timer", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW - 120_000,
      segmentStartedAt: null,
      accumulatedMilliseconds: 45_000,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toEqual(timer);
  });

  it("restores a valid pending stopped timer", () => {
    const timer = createPersistedTimer({
      sessionStartedAt:
        NOW - 120_000,
      segmentStartedAt: null,
      accumulatedMilliseconds: 45_000,
      pendingTimeBlock: {
        activityId: ACTIVITY_ID,
        startedAt: new Date(
          NOW - 120_000,
        ).toISOString(),
        endedAt: new Date(
          NOW,
        ).toISOString(),
        durationSeconds: 45,
      },
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toEqual(timer);
  });

  it.each(invalidPendingTimeBlocks)(
    "rejects a pending block with %s",
    (_label, patch) => {
      const validPendingTimeBlock = {
        activityId: ACTIVITY_ID,
        startedAt: new Date(
          NOW - 60_000,
        ).toISOString(),
        endedAt: new Date(
          NOW,
        ).toISOString(),
        durationSeconds: 45,
      };

      const timer = {
        ...createPersistedTimer({
          segmentStartedAt: null,
        }),
        pendingTimeBlock: {
          ...validPendingTimeBlock,
          ...patch,
        },
      };

      expect(
        parsePersistedTimer(
          JSON.stringify(timer),
          NOW,
          USER_ID,
        ),
      ).toBeNull();
    },
  );

  it("returns null when the persisted timer belongs to another user", () => {
    const timer = createPersistedTimer({
      ownerUserId: OTHER_USER_ID,
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("returns null for an invalid owner user ID", () => {
    const timer = createPersistedTimer({
      ownerUserId: "not-a-uuid",
    });

    expect(
      parsePersistedTimer(
        JSON.stringify(timer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });

  it("returns null for a legacy version-1 payload with no owner", () => {
    const legacyTimer = {
      version: 1,
      sessionActivityId: ACTIVITY_ID,
      sessionStartedAt: NOW - 60_000,
      segmentStartedAt: NOW - 30_000,
      accumulatedMilliseconds: 30_000,
      pendingTimeBlock: null,
    };

    expect(
      parsePersistedTimer(
        JSON.stringify(legacyTimer),
        NOW,
        USER_ID,
      ),
    ).toBeNull();
  });
});
