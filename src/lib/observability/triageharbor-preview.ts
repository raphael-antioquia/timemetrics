import "server-only";

const ENDPOINT = "https://triageharbor.com/events";
const TIMEOUT_MS = 2_500;
const MAX_BODY_BYTES = 256 * 1024;
const TOKEN_PATTERN = /^th_[A-Za-z0-9_-]{43}$/;

// Fixed synthetic messages. Change the run suffix for a fresh acceptance run.
export const RENDER_SENTINEL = "TH_PREVIEW_RENDER_RUN_A";
export const ROUTE_SENTINEL = "TH_PREVIEW_ROUTE_RUN_A";

type ErrorContext = {
  routeType: string;
  routePath: string;
};

const configuredToken = process.env.TRIAGEHARBOR_INGEST_TOKEN;
const token =
  configuredToken !== undefined && TOKEN_PATTERN.test(configuredToken)
    ? configuredToken
    : undefined;

// Once per module initialization; potentially once per serverless instance.
if (configuredToken !== undefined && !token) {
  console.warn("triageharbor:disabled:config");
}

const cases = [
  {
    routeType: "render",
    // Observed under local Next.js 16.3.3 next start; confirm on Vercel.
    routePath: "/triageharbor-preview/render",
    sentinel: RENDER_SENTINEL,
    exceptionType: "TimeMetricsPreviewRenderError",
  },
  {
    routeType: "route",
    routePath: "/triageharbor-preview/handler",
    sentinel: ROUTE_SENTINEL,
    exceptionType: "TimeMetricsPreviewRouteError",
  },
] as const;

function outcome(result: string): void {
  console.info(`triageharbor:${result}`);
}

export function reportSyntheticError(
  error: unknown,
  context: ErrorContext,
): Promise<void> | undefined {
  // Absent variable intentionally disables reporting (e.g., Production).
  if (!token) return undefined;

  let message: unknown;
  try {
    if (error !== null && typeof error === "object") {
      message = Reflect.get(error, "message");
    }
  } catch {
    message = undefined;
  }

  const matched = cases.find(
    (entry) =>
      entry.routeType === context.routeType &&
      entry.routePath === context.routePath &&
      entry.sentinel === message,
  );

  if (!matched) {
    // Context fields are framework route templates, NOT request URLs.
    outcome(
      `skipped:not-allowlisted routeType=${context.routeType} routePath=${context.routePath}`,
    );
    return undefined;
  }

  // Never serialize the original error, stack, request, or session.
  const body = JSON.stringify({
    occurredAt: new Date().toISOString(),
    exceptionType: matched.exceptionType,
    message: matched.sentinel,
  });

  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    outcome("skipped:oversize");
    return undefined;
  }

  return deliver(body, token);
}

async function deliver(body: string, ingestToken: string): Promise<void> {
  let signal: AbortSignal | undefined;

  try {
    signal = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TriageHarbor-Ingest-Key": ingestToken,
      },
      body,
      signal,
      redirect: "error",
      cache: "no-store",
    });

    outcome(response.status === 202 ? "sent:202" : `status:${response.status}`);

    // Resource cleanup is not another transport outcome. Never read the body.
    try {
      await response.body?.cancel();
    } catch {
      // No second outcome or raw cancellation-error log.
    }
  } catch {
    outcome(signal?.aborted ? "timeout" : "network");
  }
}
