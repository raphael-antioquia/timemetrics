"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionResult,
  CreateManualTimeBlockInput,
  CreateTimeBlockInput,
  CreateTimeBlockResult,
  UpdateTimeBlockInput,
} from "./time-block-state";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_FUTURE_CLOCK_SKEW_MILLISECONDS =
  5 * 60 * 1000;

type ValidatedTimeBlockInput = {
  activityId: string;
  startedAtMilliseconds: number;
  endedAtMilliseconds: number;
  durationSeconds: number;
};

type TimeRangeValidationResult =
  | {
      status: "success";
      startedAtMilliseconds: number;
      endedAtMilliseconds: number;
    }
  | {
      status: "error";
      message: string;
    };

function validateTimeRange(
  startedAt: string,
  endedAt: string,
  label: "timer" | "session",
): TimeRangeValidationResult {
  const startedAtMilliseconds = Date.parse(startedAt);
  const endedAtMilliseconds = Date.parse(endedAt);

  if (
    !Number.isFinite(startedAtMilliseconds) ||
    !Number.isFinite(endedAtMilliseconds)
  ) {
    return {
      status: "error",
      message: `The ${label} dates are invalid.`,
    };
  }

  if (endedAtMilliseconds <= startedAtMilliseconds) {
    return {
      status: "error",
      message: `The ${label} end must be after its start.`,
    };
  }

  if (
    endedAtMilliseconds >
    Date.now() + MAX_FUTURE_CLOCK_SKEW_MILLISECONDS
  ) {
    return {
      status: "error",
      message: `The ${label} end time cannot be in the future.`,
    };
  }

  return {
    status: "success",
    startedAtMilliseconds,
    endedAtMilliseconds,
  };
}

async function persistTimeBlock(
  input: ValidatedTimeBlockInput,
): Promise<CreateTimeBlockResult> {
  const {
    activityId,
    startedAtMilliseconds,
    endedAtMilliseconds,
    durationSeconds,
  } = input;

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message:
        "Your session could not be verified. Please sign in again.",
    };
  }

  const {
    data: activity,
    error: activityError,
  } = await supabase
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (activityError) {
    Sentry.captureException(activityError, {
      tags: {
        operation: "verify_time_block_activity",
      },
    });
    return {
      status: "error",
      message:
        "We couldn't verify the selected activity. Please try again.",
    };
  }

  if (!activity) {
    return {
      status: "error",
      message:
        "The selected activity could not be found.",
    };
  }

  const { error: insertError } = await supabase
    .from("time_blocks")
    .insert({
      user_id: user.id,
      activity_id: activity.id,
      started_at: new Date(
        startedAtMilliseconds,
      ).toISOString(),
      ended_at: new Date(
        endedAtMilliseconds,
      ).toISOString(),
      duration_seconds: durationSeconds,
    });

  if (insertError) {
    // 23P01 is the exclusion violation raised by
    // time_blocks_no_overlap. This is the database
    // enforcing a known domain rule, not a fault.
    if (insertError.code === "23P01") {
      return {
        status: "error",
        message:
          "This time range overlaps an existing session.",
      };
    }

    Sentry.captureException(insertError, {
      tags: {
        operation: "create_time_block",
      },
    });
    return {
      status: "error",
      message:
        "We couldn't save this time session. Please try again.",
    };
  }

  revalidatePath("/");

  return {
    status: "success",
    message: "Time session saved.",
  };
}

export async function createTimeBlock(
  input: CreateTimeBlockInput,
): Promise<CreateTimeBlockResult> {
  const {
    activityId,
    startedAt,
    endedAt,
    durationSeconds,
  } = input;

  if (!UUID_PATTERN.test(activityId)) {
    return {
      status: "error",
      message: "The selected activity is invalid.",
    };
  }

  const timeRangeValidation = validateTimeRange(
    startedAt,
    endedAt,
    "timer",
  );

  if (timeRangeValidation.status === "error") {
    return timeRangeValidation;
  }

  const {
    startedAtMilliseconds,
    endedAtMilliseconds,
  } = timeRangeValidation;

  if (
    !Number.isInteger(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return {
      status: "error",
      message: "The tracked duration must be positive.",
    };
  }

  const wallClockSeconds = Math.floor(
    (endedAtMilliseconds - startedAtMilliseconds) / 1000,
  );

  if (durationSeconds > wallClockSeconds) {
    return {
      status: "error",
      message:
        "The tracked duration cannot exceed the session time range.",
    };
  }

  return persistTimeBlock({
    activityId,
    startedAtMilliseconds,
    endedAtMilliseconds,
    durationSeconds,
  });
}

export async function createManualTimeBlock(
  input: CreateManualTimeBlockInput,
): Promise<CreateTimeBlockResult> {
  const {
    activityId,
    startedAt,
    endedAt,
  } = input;

  if (!UUID_PATTERN.test(activityId)) {
    return {
      status: "error",
      message: "The selected activity is invalid.",
    };
  }

  const timeRangeValidation = validateTimeRange(
    startedAt,
    endedAt,
    "session",
  );

  if (timeRangeValidation.status === "error") {
    return timeRangeValidation;
  }

  const {
    startedAtMilliseconds,
    endedAtMilliseconds,
  } = timeRangeValidation;

  const durationSeconds = Math.floor(
    (endedAtMilliseconds - startedAtMilliseconds) /
      1000,
  );

  if (durationSeconds < 1) {
    return {
      status: "error",
      message:
        "The session must be at least one second long.",
    };
  }

  return persistTimeBlock({
    activityId,
    startedAtMilliseconds,
    endedAtMilliseconds,
    durationSeconds,
  });
}

export async function updateTimeBlock(
  input: UpdateTimeBlockInput,
): Promise<ActionResult> {
  const {
    timeBlockId,
    activityId,
    startedAt,
    endedAt,
  } = input;

  if (!UUID_PATTERN.test(timeBlockId)) {
    return {
      status: "error",
      message: "The selected time session is invalid.",
    };
  }

  if (!UUID_PATTERN.test(activityId)) {
    return {
      status: "error",
      message: "The selected activity is invalid.",
    };
  }

  const timeRangeValidation = validateTimeRange(
    startedAt,
    endedAt,
    "session",
  );

  if (timeRangeValidation.status === "error") {
    return timeRangeValidation;
  }

  const {
    startedAtMilliseconds,
    endedAtMilliseconds,
  } = timeRangeValidation;

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message:
        "Your session could not be verified. Please sign in again.",
    };
  }

  const {
    data: activity,
    error: activityError,
  } = await supabase
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (activityError) {
    Sentry.captureException(activityError, {
      tags: {
        operation:
          "verify_time_block_update_activity",
      },
    });

    return {
      status: "error",
      message:
        "We couldn't verify the selected activity. Please try again.",
    };
  }

  if (!activity) {
    return {
      status: "error",
      message:
        "The selected activity could not be found.",
    };
  }

  const wallClockSeconds = Math.floor(
    (endedAtMilliseconds -
      startedAtMilliseconds) /
      1000,
  );

  if (wallClockSeconds < 1) {
    return {
      status: "error",
      message:
        "The session must be at least one second long.",
    };
  }

  const durationSeconds = wallClockSeconds;

  const {
    data: updatedTimeBlock,
    error: updateError,
  } = await supabase
    .from("time_blocks")
    .update({
      activity_id: activity.id,
      started_at: new Date(
        startedAtMilliseconds,
      ).toISOString(),
      ended_at: new Date(
        endedAtMilliseconds,
      ).toISOString(),
      duration_seconds: durationSeconds,
    })
    .eq("id", timeBlockId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23P01") {
      return {
        status: "error",
        message:
          "This time range overlaps an existing session.",
      };
    }

    Sentry.captureException(updateError, {
      tags: {
        operation: "update_time_block",
      },
    });

    return {
      status: "error",
      message:
        "We couldn't update this time session. Please try again.",
    };
  }

  if (!updatedTimeBlock) {
    return {
      status: "error",
      message:
        "This time session could not be found.",
    };
  }

  revalidatePath("/");
  revalidatePath("/history");

  return {
    status: "success",
    message: "Time session updated.",
  };
}

export async function deleteTimeBlock(
  timeBlockId: string,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(timeBlockId)) {
    return {
      status: "error",
      message: "The selected time session is invalid.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message:
        "Your session could not be verified. Please sign in again.",
    };
  }

  const {
    data: deletedTimeBlock,
    error: deleteError,
  } = await supabase
    .from("time_blocks")
    .delete()
    .eq("id", timeBlockId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    Sentry.captureException(deleteError, {
      tags: {
        operation: "delete_time_block",
      },
    });
    return {
      status: "error",
      message:
        "We couldn't delete this time session. Please try again.",
    };
  }

  if (!deletedTimeBlock) {
    return {
      status: "error",
      message:
        "This time session could not be found.",
    };
  }

  revalidatePath("/");
  revalidatePath("/history");

  return {
    status: "success",
    message: "Time session deleted.",
  };
}

function isAllowedProfileTimezone(
  candidate: string,
): boolean {
  if (
    /^(UTC|GMT)?[+-]/.test(candidate) ||
    candidate.startsWith("Etc/")
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: candidate,
    });

    return true;
  } catch {
    return false;
  }
}

export async function initializeUserTimezone(
  timezone: string,
): Promise<void> {
  if (!isAllowedProfileTimezone(timezone)) {
    return;
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    Sentry.captureException(userError, {
      tags: {
        operation: "initialize_user_timezone",
      },
    });

    return;
  }

  if (!user) {
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", user.id)
    .eq("timezone", "UTC")
    .select("id")
    .maybeSingle();

  if (error) {
    Sentry.captureException(error, {
      tags: {
        operation: "initialize_user_timezone",
      },
    });

    return;
  }

  // Another request may already have initialized it.
  if (!data) {
    return;
  }

  revalidatePath("/");
}