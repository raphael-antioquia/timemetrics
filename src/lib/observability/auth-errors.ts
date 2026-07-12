import * as Sentry from "@sentry/nextjs";
import type { AuthError } from "@supabase/supabase-js";

type AuthOperation = "sign_up" | "sign_in" | "confirm_email";

export function reportUnexpectedAuthError(
  error: AuthError,
  operation: AuthOperation,
): void {
  const isServerError = error.status !== undefined && error.status >= 500;
  const hasNoStatus = error.status === undefined;

  // Normal 4xx authentication errors are user-flow errors.
  // Errors with no status may represent client/network failures.
  if (!isServerError && !hasNoStatus) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setTag("feature", "authentication");
    scope.setTag("operation", operation);

    if (error.code) {
      scope.setTag("auth_error_code", error.code);
    }

    scope.setContext("supabase_auth_error", {
      code: error.code ?? "unknown",
      status: error.status ?? "unknown",
      name: error.name,
    });

    Sentry.captureException(error);
  });
}