import type { CreateTimeBlockInput } from "@/app/actions/time-block-state";
import { UUID_PATTERN } from "@/lib/validation/uuid";

const STORAGE_KEY = "timemetrics.active-timer";

const MAX_PERSISTED_TIMER_AGE_MILLISECONDS =
  24 * 60 * 60 * 1000;

const MAX_CLOCK_SKEW_MILLISECONDS =
  5 * 60 * 1000;

export type PersistedTimer = {
  version: 2;
  ownerUserId: string;
  sessionActivityId: string;
  sessionStartedAt: number;
  segmentStartedAt: number | null;
  accumulatedMilliseconds: number;
  pendingTimeBlock: CreateTimeBlockInput | null;
};

function isCreateTimeBlockInput(
  value: unknown,
): value is CreateTimeBlockInput {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const input = value as Record<string, unknown>;

  return (
    typeof input.activityId === "string" &&
    UUID_PATTERN.test(input.activityId) &&
    typeof input.startedAt === "string" &&
    typeof input.endedAt === "string" &&
    typeof input.durationSeconds === "number" &&
    Number.isInteger(input.durationSeconds) &&
    input.durationSeconds > 0
  );
}

function isPersistedTimer(
  value: unknown,
): value is PersistedTimer {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const timer = value as Record<string, unknown>;

  if (
    timer.version !== 2 ||
    typeof timer.ownerUserId !== "string" ||
    !UUID_PATTERN.test(timer.ownerUserId) ||
    typeof timer.sessionActivityId !== "string" ||
    !UUID_PATTERN.test(timer.sessionActivityId) ||
    typeof timer.sessionStartedAt !== "number" ||
    !Number.isFinite(timer.sessionStartedAt) ||
    typeof timer.accumulatedMilliseconds !== "number" ||
    !Number.isFinite(
      timer.accumulatedMilliseconds,
    ) ||
    timer.accumulatedMilliseconds < 0
  ) {
    return false;
  }

  if (
    timer.segmentStartedAt !== null &&
    (typeof timer.segmentStartedAt !== "number" ||
      !Number.isFinite(timer.segmentStartedAt) ||
      timer.segmentStartedAt <
        timer.sessionStartedAt)
  ) {
    return false;
  }

  return (
    timer.pendingTimeBlock === null ||
    isCreateTimeBlockInput(timer.pendingTimeBlock)
  );
}

export function parsePersistedTimer(
  raw: string | null,
  now: number,
  activeUserId: string,
): PersistedTimer | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isPersistedTimer(parsed)) {
      return null;
    }

    if (parsed.ownerUserId !== activeUserId) {
      return null;
    }

    const age = now - parsed.sessionStartedAt;

    if (
      age < -MAX_CLOCK_SKEW_MILLISECONDS ||
      age > MAX_PERSISTED_TIMER_AGE_MILLISECONDS
    ) {
      return null;
    }

    if (
      parsed.segmentStartedAt !== null &&
      parsed.segmentStartedAt >
        now + MAX_CLOCK_SKEW_MILLISECONDS
    ) {
      return null;
    }

    const maximumTrackedMilliseconds =
      Math.max(
        0,
        now -
          parsed.sessionStartedAt +
          MAX_CLOCK_SKEW_MILLISECONDS,
      );

    if (
      parsed.accumulatedMilliseconds >
      maximumTrackedMilliseconds
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function readPersistedTimer(
  activeUserId: string,
): PersistedTimer | null {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY);

    const timer = parsePersistedTimer(
      raw,
      Date.now(),
      activeUserId,
    );

    if (raw !== null && timer === null) {
      clearPersistedTimer();
    }

    return timer;
  } catch {
    // Access to localStorage can fail when browser
    // storage is unavailable or restricted.
    return null;
  }
}

export function writePersistedTimer(
  timer: PersistedTimer,
): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(timer),
    );
  } catch {
    // Persistence is best-effort. The in-memory timer
    // should continue working if localStorage is unavailable.
  }
}

export function clearPersistedTimer(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Persistence is best-effort.
  }
}