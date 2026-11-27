import { describe, expect, it } from "vitest";
import {
  createRandom,
  generateDemoData,
  ARCHIVED_ACTIVITY,
  type GeneratorConfig,
} from "./generate-demo-data";

describe("createRandom", () => {
  it("produces the same sequence for the same seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);

    const seqA = Array.from({ length: 5 }, a);
    const seqB = Array.from({ length: 5 }, b);

    expect(seqA).toEqual(seqB);
    expect(seqA.every((n) => n >= 0 && n < 1)).toBe(true);
  });

  it("produces different sequences for different seeds", () => {
    expect(createRandom(42)()).not.toBe(createRandom(43)());
  });
});

const CONFIG: GeneratorConfig = {
  seed: 42,
  now: new Date("2026-11-26T20:00:00Z"),
  timeZone: "America/Toronto",
  days: 60,
};

function localDate(
  timestamp: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function localTime(
  timestamp: string,
  timeZone: string,
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

describe("generateDemoData", () => {
  it("produces identical datasets for identical inputs", () => {
    expect(generateDemoData(CONFIG)).toEqual(
      generateDemoData(CONFIG),
    );
  });

  it("produces sorted, non-overlapping time blocks", () => {
    const { timeBlocks } = generateDemoData(CONFIG);

    expect(timeBlocks.length).toBeGreaterThan(1);

    for (let i = 1; i < timeBlocks.length; i++) {
      const previousEnd = Date.parse(
        timeBlocks[i - 1].endedAt,
      );

      const currentStart = Date.parse(
        timeBlocks[i].startedAt,
      );

      expect(currentStart).toBeGreaterThanOrEqual(
        previousEnd,
      );
    }
  });

  it("produces positive integer durations within elapsed ranges", () => {
    const { timeBlocks } = generateDemoData(CONFIG);

    expect(timeBlocks.length).toBeGreaterThan(0);

    for (const block of timeBlocks) {
      const elapsedSeconds =
        (Date.parse(block.endedAt) -
          Date.parse(block.startedAt)) /
        1000;

      expect(elapsedSeconds).toBeGreaterThan(0);

      expect(
        Number.isInteger(block.durationSeconds),
      ).toBe(true);

      expect(block.durationSeconds).toBeGreaterThan(0);

      expect(block.durationSeconds).toBeLessThanOrEqual(
        elapsedSeconds,
      );
    }
  });

  it("keeps sessions within the same local calendar day", () => {
    const { timeBlocks } = generateDemoData(CONFIG);

    expect(timeBlocks.length).toBeGreaterThan(0);

    for (const block of timeBlocks) {
      expect(
        localDate(block.startedAt, CONFIG.timeZone),
      ).toBe(
        localDate(block.endedAt, CONFIG.timeZone),
      );
    }
  });

  it("reserves at least one hour before the reference time", () => {
    const configurations = [
      CONFIG,
      {
        ...CONFIG,
        now: new Date("2026-11-26T05:30:00Z"),
      },
    ];

    for (const config of configurations) {
      const { timeBlocks } = generateDemoData(config);

      const cutoff =
        config.now.getTime() - 60 * 60 * 1000;

      expect(timeBlocks.length).toBeGreaterThan(0);

      for (const block of timeBlocks) {
        expect(
          Date.parse(block.endedAt),
        ).toBeLessThanOrEqual(cutoff);
      }
    }
  });

  it("references only generated activities", () => {
    const { activities, timeBlocks } =
      generateDemoData(CONFIG);

    const keys = new Set(
      activities.map((activity) => activity.key),
    );

    expect(timeBlocks.length).toBeGreaterThan(0);

    for (const block of timeBlocks) {
      expect(keys.has(block.activityKey)).toBe(true);
    }
  });

  it("keeps sessions within the requested calendar range", () => {
    const { timeBlocks } = generateDemoData(CONFIG);

    expect(timeBlocks.length).toBeGreaterThan(0);

    for (const block of timeBlocks) {
      const day = localDate(
        block.startedAt,
        CONFIG.timeZone,
      );

      expect(day >= "2026-09-28").toBe(true);
      expect(day <= "2026-11-26").toBe(true);
    }
  });

  it("preserves local working hours across Toronto DST transitions", () => {
    const transitions = [
      {
        now: new Date("2026-03-12T20:00:00Z"),
        date: "2026-03-08",
        beforeOffsetHours: -5,
        afterOffsetHours: -4,
      },
      {
        now: new Date("2026-11-05T20:00:00Z"),
        date: "2026-11-01",
        beforeOffsetHours: -4,
        afterOffsetHours: -5,
      },
    ];

    for (const transition of transitions) {
      const { timeBlocks } = generateDemoData({
        ...CONFIG,
        now: transition.now,
        days: 14,
      });

      const before = timeBlocks.filter(
        (block) =>
          localDate(block.startedAt, CONFIG.timeZone) <
          transition.date,
      );

      const after = timeBlocks.filter(
        (block) =>
          localDate(block.startedAt, CONFIG.timeZone) >=
          transition.date,
      );

      expect(before.length).toBeGreaterThan(0);
      expect(after.length).toBeGreaterThan(0);

      for (const block of timeBlocks) {
        const day = localDate(
          block.startedAt,
          CONFIG.timeZone,
        );

        const start = localTime(
          block.startedAt,
          CONFIG.timeZone,
        );

        const end = localTime(
          block.endedAt,
          CONFIG.timeZone,
        );

        expect(start >= "08:30").toBe(true);
        expect(end <= "18:00").toBe(true);

        const localAsUtc = Date.parse(
          `${day}T${start}:00Z`,
        );

        const offsetHours =
          (localAsUtc - Date.parse(block.startedAt)) /
          3_600_000;

        expect(offsetHours).toBe(
          day < transition.date
            ? transition.beforeOffsetHours
            : transition.afterOffsetHours,
        );
      }
    }
  });

  it("uses the configured timezone instead of the process timezone", () => {
    const timeZone = "Asia/Tokyo";

    const { timeBlocks } = generateDemoData({
      ...CONFIG,
      timeZone,
    });

    expect(timeBlocks.length).toBeGreaterThan(0);

    for (const block of timeBlocks) {
      const start = localTime(
        block.startedAt,
        timeZone,
      );

      const end = localTime(
        block.endedAt,
        timeZone,
      );

      expect(start >= "08:30").toBe(true);
      expect(end <= "18:00").toBe(true);

      expect(
        localDate(block.startedAt, timeZone),
      ).toBe(
        localDate(block.endedAt, timeZone),
      );
    }
  });

  it("produces useful data for the recording scenario", () => {
    const { timeBlocks } = generateDemoData(CONFIG);

    const localDays = new Set(
      timeBlocks.map((block) =>
        localDate(block.startedAt, CONFIG.timeZone),
      ),
    );

    // Today has data, but not every day is active.
    expect(localDays.has("2026-11-26")).toBe(true);
    expect(localDays.size).toBeLessThan(60);

    // Both 30-day comparison periods have data.
    expect(
      timeBlocks.some(
        (block) =>
          localDate(block.startedAt, CONFIG.timeZone) <
          "2026-10-28",
      ),
    ).toBe(true);

    expect(
      timeBlocks.some(
        (block) =>
          localDate(block.startedAt, CONFIG.timeZone) >=
          "2026-10-28",
      ),
    ).toBe(true);

    // Some sessions contain paused time.
    expect(
      timeBlocks.some(
        (block) =>
          block.durationSeconds <
          (Date.parse(block.endedAt) -
            Date.parse(block.startedAt)) /
            1000,
      ),
    ).toBe(true);

    // Only the oldest two sessions become unlabeled
    // after the temporary activity is deleted.
    const archivedBlocks = timeBlocks.filter(
      (block) =>
        block.activityKey === ARCHIVED_ACTIVITY.key,
    );

    expect(archivedBlocks).toHaveLength(2);
    expect(archivedBlocks).toEqual(
      timeBlocks.slice(0, 2),
    );
  });
});
