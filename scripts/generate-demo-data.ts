export type GeneratorConfig = {
  seed: number;
  now: Date;
  timeZone: string;
  days: number;
};

export type GeneratedActivity = {
  key: string;
  name: string;
};

export type GeneratedTimeBlock = {
  activityKey: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type DemoDataset = {
  activities: GeneratedActivity[];
  timeBlocks: GeneratedTimeBlock[];
};

type ActivityConfig = GeneratedActivity & {
  weight: number;
  minMinutes: number;
  maxMinutes: number;
};

export const ACTIVITY_CONFIG: readonly ActivityConfig[] = [
  {
    key: "development",
    name: "Software Development",
    weight: 40,
    minMinutes: 45,
    maxMinutes: 120,
  },
  {
    key: "learning",
    name: "Technical Learning",
    weight: 25,
    minMinutes: 30,
    maxMinutes: 90,
  },
  {
    key: "career",
    name: "Career Development",
    weight: 15,
    minMinutes: 20,
    maxMinutes: 60,
  },
  {
    key: "reading",
    name: "Reading",
    weight: 15,
    minMinutes: 15,
    maxMinutes: 45,
  },
  {
    key: "planning",
    name: "Planning",
    weight: 5,
    minMinutes: 10,
    maxMinutes: 30,
  },
];

export const ARCHIVED_ACTIVITY: GeneratedActivity = {
  key: "archived",
  name: "Archived Project",
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function createRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(
  random: () => number,
  min: number,
  max: number,
): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pickActivity(
  random: () => number,
): ActivityConfig {
  const totalWeight = ACTIVITY_CONFIG.reduce(
    (sum, activity) => sum + activity.weight,
    0,
  );

  let remaining = random() * totalWeight;

  for (const activity of ACTIVITY_CONFIG) {
    remaining -= activity.weight;

    if (remaining < 0) {
      return activity;
    }
  }

  throw new Error("Invalid activity weights");
}

function localWallTimeMs(
  instant: number,
  formatter: Intl.DateTimeFormat,
): number {
  const parts = formatter.formatToParts(instant);

  function read(
    type: Intl.DateTimeFormatPartTypes,
  ): number {
    const part = parts.find(
      (part) => part.type === type,
    );

    if (!part) {
      throw new Error(`Missing date part: ${type}`);
    }

    return Number(part.value);
  }

  return Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
  );
}

function toZonedInstant(
  wallTime: number,
  formatter: Intl.DateTimeFormat,
): number {
  let candidate = wallTime;

  for (let i = 0; i < 4; i++) {
    const difference =
      wallTime - localWallTimeMs(candidate, formatter);

    if (difference === 0) {
      return candidate;
    }

    candidate += difference;
  }

  throw new Error(
    "Cannot resolve local working time in configured timezone",
  );
}

export function generateDemoData(
  config: GeneratorConfig,
): DemoDataset {
  const { seed, now, timeZone, days } = config;

  if (
    !Number.isInteger(days) ||
    days < 1 ||
    !Number.isFinite(now.getTime())
  ) {
    throw new Error(
      "Expected a positive day count and a valid reference date",
    );
  }

  const random = createRandom(seed);

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const today =
    Math.floor(
      localWallTimeMs(now.getTime(), formatter) / DAY_MS,
    ) * DAY_MS;

  const latestEnd = now.getTime() - 60 * MINUTE_MS;

  const timeBlocks: GeneratedTimeBlock[] = [];

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const day = today - daysAgo * DAY_MS;

    const weekday = new Date(day).getUTCDay();

    const weekend = weekday === 0 || weekday === 6;

    // Historical rest days.
    // Always attempt to generate today's sessions.
    if (
      daysAgo !== 0 &&
      random() >= (weekend ? 0.4 : 0.9)
    ) {
      continue;
    }

    const sessionCount = weekend
      ? randomInt(random, 1, 3)
      : daysAgo >= 30
        ? randomInt(random, 2, 4)
        : randomInt(random, 3, 5);

    const startMinute = weekend
      ? randomInt(random, 600, 660)
      : randomInt(random, 510, 600);

    let cursor = toZonedInstant(
      day + startMinute * MINUTE_MS,
      formatter,
    );

    const cutoff = Math.min(
      toZonedInstant(
        day + 18 * 60 * MINUTE_MS,
        formatter,
      ),
      latestEnd,
    );

    for (let i = 0; i < sessionCount; i++) {
      const activity = pickActivity(random);

      const activeMinutes = randomInt(
        random,
        activity.minMinutes,
        activity.maxMinutes,
      );

      const pausedMinutes =
        random() < 0.15
          ? randomInt(random, 5, 15)
          : 0;

      const end =
        cursor +
        (activeMinutes + pausedMinutes) * MINUTE_MS;

      if (end > cutoff) {
        break;
      }

      timeBlocks.push({
        activityKey: activity.key,
        startedAt: new Date(cursor).toISOString(),
        endedAt: new Date(end).toISOString(),
        durationSeconds: activeMinutes * 60,
      });

      cursor =
        end + randomInt(random, 10, 45) * MINUTE_MS;
    }
  }

  // Archive the oldest sessions to exercise history
  // preservation without cluttering recent activity.
  for (const block of timeBlocks.slice(0, 2)) {
    block.activityKey = ARCHIVED_ACTIVITY.key;
  }

  return {
    activities: [
      ...ACTIVITY_CONFIG.map(({ key, name }) => ({
        key,
        name,
      })),
      { ...ARCHIVED_ACTIVITY },
    ],
    timeBlocks,
  };
}
