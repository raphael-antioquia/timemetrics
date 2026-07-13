"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CreateActivityState } from "./activity-state";

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