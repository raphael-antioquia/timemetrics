import * as Sentry from "@sentry/nextjs";

import { createClient } from "@/lib/supabase/server";

export async function getUserTimezone(
  userId: string,
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .single();

  if (error) {
    Sentry.captureException(error, {
      tags: {
        operation: "getUserTimezone",
      },
    });

    throw error;
  }

  return data.timezone;
}