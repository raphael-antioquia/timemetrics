import * as Sentry from "@sentry/nextjs";
import { waitUntil } from "@vercel/functions";
import type { Instrumentation } from "next";

import { reportSyntheticError } from "@/lib/observability/triageharbor-preview";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  // Keep both reporters independent without awaiting network delivery.
  try {
    const captured = Sentry.captureRequestError(error, request, context);
    void Promise.resolve(captured).catch(() => {
      console.warn("sentry:request-capture-failed");
    });
  } catch {
    console.warn("sentry:request-capture-failed");
  }

  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const delivery = reportSyntheticError(error, context);
    if (delivery) waitUntil(delivery);
  } catch {
    console.warn("triageharbor:registration-failed");
  }
};
