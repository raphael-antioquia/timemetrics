import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

import type {
  Database,
  TablesInsert,
} from "../src/lib/supabase/database.types.ts";

import {
  ARCHIVED_ACTIVITY,
  generateDemoData,
  type DemoDataset,
  type GeneratorConfig,
} from "./generate-demo-data.ts";

// Disposable local credentials.
// Never reuse these for a hosted account.
const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "TimeMetrics-Local-Demo-2026!";

const SEED = 42;
const DAYS = 60;
const TIME_ZONE = "America/Toronto";
const PREVIEW_ONLY = false;

const LOCAL_ORIGINS = new Set([
  "http://127.0.0.1:54321",
  "http://localhost:54321",
]);

const DAY_MS = 86_400_000;

function validateLocalUrl(value: string): string {
  const url = new URL(value);

  if (
    !LOCAL_ORIGINS.has(url.origin) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Demo seeding is restricted to local Supabase",
    );
  }

  return url.origin;
}

function checkError(
  operation: string,
  error: {
    code?: string;
    message: string;
  } | null,
): void {
  if (error) {
    throw new Error(
      `${operation} failed: ${error.code ?? "unknown"} — ${error.message}`,
    );
  }
}

export async function seedDemo(
  supabaseUrl: string,
  publishableKey: string,
  dataset: DemoDataset,
  timeZone: string,
): Promise<void> {
  const localUrl = validateLocalUrl(supabaseUrl);

  if (!publishableKey.trim()) {
    throw new Error("Missing Supabase publishable key");
  }

  if (dataset.timeBlocks.length === 0) {
    throw new Error("Cannot seed an empty dataset");
  }

  const supabase = createClient<Database>(
    localUrl,
    publishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );

  const credentials = {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  };

  // Authenticate or provision the demo account.
  const signIn =
    await supabase.auth.signInWithPassword(credentials);

  let session = signIn.data.session;

  if (signIn.error) {
    if (signIn.error.code !== "invalid_credentials") {
      checkError("Demo sign-in", signIn.error);
    }

    const signUp =
      await supabase.auth.signUp(credentials);

    if (signUp.error?.code === "user_already_exists") {
      throw new Error(
        "Demo account exists but credentials do not match",
      );
    }

    checkError("Demo signup", signUp.error);

    session = signUp.data.session;
  }

  if (!session) {
    throw new Error(
      "Demo authentication returned no session. Check local Auth configuration.",
    );
  }

  const userId = session.user.id;

  // Refuse to modify an already populated account.
  const existingActivities = await supabase
    .from("activities")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  checkError(
    "Activity existence check",
    existingActivities.error,
  );

  const existingBlocks = await supabase
    .from("time_blocks")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  checkError(
    "Time block existence check",
    existingBlocks.error,
  );

  if (!existingActivities.data || !existingBlocks.data) {
    throw new Error(
      "Could not verify that the demo account is empty",
    );
  }

  if (
    existingActivities.data.length > 0 ||
    existingBlocks.data.length > 0
  ) {
    throw new Error(
      "Demo account already contains data. Refusing to seed.",
    );
  }

  // Align the profile timezone with the dataset.
  const profile = await supabase
    .from("profiles")
    .update({ timezone: timeZone })
    .eq("id", userId)
    .select("id")
    .single();

  checkError("Profile timezone update", profile.error);

  // Insert activities in one request.
  const activityRows: TablesInsert<"activities">[] =
    dataset.activities.map((activity) => ({
      user_id: userId,
      name: activity.name,
    }));

  const insertedActivities = await supabase
    .from("activities")
    .insert(activityRows)
    .select("id, name");

  checkError(
    "Activity insertion",
    insertedActivities.error,
  );

  if (
    !insertedActivities.data ||
    insertedActivities.data.length !== activityRows.length
  ) {
    throw new Error(
      "Activity insertion returned an unexpected number of rows",
    );
  }

  // Map logical activity keys to database-generated UUIDs.
  const idsByName = new Map(
    insertedActivities.data.map((activity) => [
      activity.name,
      activity.id,
    ]),
  );

  const activityIds = new Map<string, string>();

  for (const activity of dataset.activities) {
    const id = idsByName.get(activity.name);

    if (!id) {
      throw new Error(
        `Missing inserted activity: ${activity.name}`,
      );
    }

    activityIds.set(activity.key, id);
  }

  const archivedId = activityIds.get(
    ARCHIVED_ACTIVITY.key,
  );

  if (!archivedId) {
    throw new Error("Missing archived activity");
  }

  // Insert all sessions in one request.
  const blockRows: TablesInsert<"time_blocks">[] =
    dataset.timeBlocks.map((block) => {
      const activityId = activityIds.get(
        block.activityKey,
      );

      if (!activityId) {
        throw new Error(
          `Unknown activity key: ${block.activityKey}`,
        );
      }

      return {
        user_id: userId,
        activity_id: activityId,
        started_at: block.startedAt,
        ended_at: block.endedAt,
        duration_seconds: block.durationSeconds,
      };
    });

  const insertedBlocks = await supabase
    .from("time_blocks")
    .insert(blockRows);

  checkError(
    "Time block insertion",
    insertedBlocks.error,
  );

  // Exercise real ON DELETE SET NULL behavior.
  const deletedActivity = await supabase
    .from("activities")
    .delete()
    .eq("id", archivedId)
    .eq("user_id", userId)
    .select("id")
    .single();

  checkError(
    "Archived activity deletion",
    deletedActivity.error,
  );
}

function calendarDayNumber(
  date: Date,
  formatter: Intl.DateTimeFormat,
): number {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(
      ({ type, value }) => [type, value],
    ),
  );

  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
  ) / DAY_MS;
}

export function summarizeDemoData(
  dataset: DemoDataset,
  config: GeneratorConfig,
) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const today = calendarDayNumber(
    config.now,
    formatter,
  );

  const blocks = dataset.timeBlocks.map((block) => ({
    seconds: block.durationSeconds,
    daysAgo:
      today -
      calendarDayNumber(
        new Date(block.startedAt),
        formatter,
      ),
  }));

  const periods = [7, 30].map((days) => {
    let currentSeconds = 0;
    let previousSeconds = 0;

    for (const block of blocks) {
      if (block.daysAgo >= 0 && block.daysAgo < days) {
        currentSeconds += block.seconds;
      } else if (
        block.daysAgo >= days &&
        block.daysAgo < days * 2
      ) {
        previousSeconds += block.seconds;
      }
    }

    const changePercent =
      previousSeconds === 0
        ? null
        : ((currentSeconds - previousSeconds) /
            previousSeconds) *
          100;

    return {
      days,
      currentSeconds,
      previousSeconds,
      changePercent,
    };
  });

  return {
    sessions: blocks.length,
    activeDays: new Set(
      blocks.map((block) => block.daysAgo),
    ).size,
    totalSeconds: blocks.reduce(
      (sum, block) => sum + block.seconds,
      0,
    ),
    periods,
  };
}

function printSummary(
  dataset: DemoDataset,
  config: GeneratorConfig,
): void {
  const summary = summarizeDemoData(dataset, config);

  console.log("\nGenerated demo dataset");
  console.log(`Seed: ${config.seed}`);
  console.log(`Reference time: ${config.now.toISOString()}`);
  console.log(`Timezone: ${config.timeZone}`);
  console.log(`Sessions: ${summary.sessions}`);
  console.log(
    `Active days: ${summary.activeDays}/${config.days}`,
  );
  console.log(
    `Tracked hours: ${(summary.totalSeconds / 3600).toFixed(1)}`,
  );

  console.table(
    summary.periods.map((period) => ({
      Range: `${period.days} days`,
      "Current hours": (
        period.currentSeconds / 3600
      ).toFixed(1),
      "Previous hours": (
        period.previousSeconds / 3600
      ).toFixed(1),
      Change:
        period.changePercent === null
          ? "No baseline"
          : `${period.changePercent.toFixed(1)}%`,
    })),
  );
}

async function main(): Promise<void> {
  const config: GeneratorConfig = {
    seed: SEED,
    now: new Date(),
    timeZone: TIME_ZONE,
    days: DAYS,
  };

  const dataset = generateDemoData(config);

  printSummary(dataset, config);

  if (PREVIEW_ONLY) {
    console.log("Preview only. No database writes.");
    return;
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing local Supabase environment configuration",
    );
  }

  await seedDemo(
    url,
    key,
    dataset,
    config.timeZone,
  );

  console.log("\nDemo seeding completed successfully.");
  console.log("Sign in at http://localhost:3000");
  console.log(`Email: ${DEMO_EMAIL}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
}

// Execute only when invoked directly, not when
// imported by the test suite.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : error,
    );

    console.error(
      "Seeding stopped. No automatic cleanup was performed.",
    );

    process.exitCode = 1;
  });
}
