"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CreateActivityState } from "@/app/actions/activity-state";
import type { ActionResult } from "@/app/actions/action-result";
import { UUID_PATTERN } from "@/lib/validation/uuid";

export async function createActivity(
  _previousState: CreateActivityState,
  formData: FormData,
): Promise<CreateActivityState> {
  const nameValue = formData.get("name");

  if (typeof nameValue !== "string") {
    return {
      status: "error",
      message: "Activity name is required.",
    };
  }

  const name = nameValue.trim();

  if (name.length === 0) {
    return {
      status: "error",
      message: "Activity name is required.",
    };
  }

  if (name.length > 100) {
    return {
      status: "error",
      message: "Activity name must be 100 characters or fewer.",
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
      message: "Your session could not be verified. Please sign in again.",
    };
  }

  const { error } = await supabase.from("activities").insert({
    user_id: user.id,
    name,
  });

  if (error?.code === "23505") {
    return {
      status: "error",
      message: "You already have an activity with this name.",
    };
  }

  if (error) {
    Sentry.captureException(error, {
      tags: {
        operation: "create_activity",
      },
    });

    return {
      status: "error",
      message: "We couldn't create the activity. Please try again.",
    };
  }

  revalidatePath("/");

  return {
    status: "success",
    message: "Activity created.",
  };
}

type UpdateActivityInput = {
  activityId: string;
  name: string;
};

export async function updateActivity(
  input: UpdateActivityInput,
): Promise<ActionResult> {
  const { activityId, name: nameValue } = input;

  if (!UUID_PATTERN.test(activityId)) {
    return {
      status: "error",
      message: "The selected activity is invalid.",
    };
  }

  const name = nameValue.trim();

  if (name.length === 0) {
    return {
      status: "error",
      message: "Activity name is required.",
    };
  }

  if (name.length > 100) {
    return {
      status: "error",
      message: "Activity name must be 100 characters or fewer.",
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
      message: "Your session could not be verified. Please sign in again.",
    };
  }

  const {
    data: updatedActivity,
    error: updateError,
  } = await supabase
    .from("activities")
    .update({
      name,
    })
    .eq("id", activityId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (updateError?.code === "23505") {
    return {
      status: "error",
      message: "You already have an activity with this name.",
    };
  }

  if (updateError) {
    Sentry.captureException(updateError, {
      tags: {
        operation: "update_activity",
      },
    });

    return {
      status: "error",
      message: "We couldn't update the activity. Please try again.",
    };
  }

  if (!updatedActivity) {
    return {
      status: "error",
      message: "This activity could not be found.",
    };
  }

  revalidatePath("/");
  revalidatePath("/history");

  return {
    status: "success",
    message: "Activity updated.",
  };
}

export async function deleteActivity(
  activityId: string,
): Promise<ActionResult> {
  if (!UUID_PATTERN.test(activityId)) {
    return {
      status: "error",
      message: "The selected activity is invalid.",
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
    data: deletedActivity,
    error: deleteError,
  } = await supabase
    .from("activities")
    .delete()
    .eq("id", activityId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
    Sentry.captureException(deleteError, {
      tags: {
        operation: "delete_activity",
      },
    });

    return {
      status: "error",
      message:
        "We couldn't delete the activity. Please try again.",
    };
  }

  if (!deletedActivity) {
    return {
      status: "error",
      message: "This activity could not be found.",
    };
  }

  revalidatePath("/");
  revalidatePath("/history");

  return {
    status: "success",
    message: "Activity deleted.",
  };
}