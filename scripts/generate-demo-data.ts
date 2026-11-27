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
