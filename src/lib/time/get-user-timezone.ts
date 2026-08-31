import * as Sentry from "@sentry/nextjs";

import { createClient } from "@/lib/supabase/server";
import { isAllowedProfileTimezone } from "@/lib/time/is-allowed-profile-timezone";

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

  // PostgreSQL and Intl.DateTimeFormat do not recognize
  // exactly the same timezone identifiers. Keep this
  // defensive check to detect and safely handle drift
  // between the database and application validators.
  if (!isAllowedProfileTimezone(data.timezone)) {
    Sentry.captureMessage(
      "Invalid stored profile timezone",
      {
        level: "warning",
        tags: {
          operation: "getUserTimezone",
        },
      },
    );

    return "UTC";
  }

  return data.timezone;
}
