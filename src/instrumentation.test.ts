import * as Sentry from "@sentry/nextjs";
import { waitUntil } from "@vercel/functions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportSyntheticError } from "@/lib/observability/triageharbor-preview";

import { onRequestError } from "./instrumentation";

vi.mock("server-only", () => ({}));
vi.mock("@sentry/nextjs", () => ({ captureRequestError: vi.fn() }));
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
vi.mock("@/lib/observability/triageharbor-preview", () => ({
  reportSyntheticError: vi.fn(),
}));

type HookArguments = Parameters<typeof onRequestError>;
const error = new Error("synthetic test error") as HookArguments[0];
const request = {
  path: "/triageharbor-preview/render",
  method: "GET",
  headers: {},
} as HookArguments[1];
const context = {
  routerKind: "App Router",
  routeType: "render",
  routePath: "/triageharbor-preview/render",
  revalidateReason: undefined,
} as HookArguments[2];

function invoke() {
  return onRequestError(error, request, context);
}

describe("instrumentation onRequestError composition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("preserves Sentry and skips lifecycle registration when synthetic reporting is disabled", () => {
    vi.mocked(reportSyntheticError).mockReturnValue(undefined);
    invoke();
    expect(Sentry.captureRequestError).toHaveBeenCalledExactlyOnceWith(error, request, context);
    expect(reportSyntheticError).toHaveBeenCalledExactlyOnceWith(error, context);
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("registers the reporter promise with waitUntil without awaiting it", async () => {
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    vi.mocked(reportSyntheticError).mockReturnValue(pending);

    expect(invoke()).toBeUndefined();
    expect(Sentry.captureRequestError).toHaveBeenCalledExactlyOnceWith(error, request, context);
    expect(waitUntil).toHaveBeenCalledExactlyOnceWith(pending);
    complete();
    await pending;
  });

  it("contains synchronous waitUntil failure while preserving Sentry", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(reportSyntheticError).mockReturnValue(Promise.resolve());
    vi.mocked(waitUntil).mockImplementation(() => {
      throw new Error("local lifecycle unavailable");
    });
    expect(invoke).not.toThrow();
    expect(Sentry.captureRequestError).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledExactlyOnceWith("triageharbor:registration-failed");
  });

  it("does not let synchronous Sentry failure suppress reporter registration", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Sentry.captureRequestError).mockImplementation(() => {
      throw new Error("sentry failed");
    });
    const pending = Promise.resolve();
    vi.mocked(reportSyntheticError).mockReturnValue(pending);

    expect(invoke).not.toThrow();
    expect(waitUntil).toHaveBeenCalledExactlyOnceWith(pending);
    expect(warn).toHaveBeenCalledExactlyOnceWith("sentry:request-capture-failed");
  });

  it("contains asynchronous Sentry rejection and still attempts reporter registration", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Sentry.captureRequestError).mockImplementation(() =>
      Promise.reject(new Error("sentry failed asynchronously")),
    );
    const pending = Promise.resolve();
    vi.mocked(reportSyntheticError).mockReturnValue(pending);

    expect(invoke()).toBeUndefined();
    expect(waitUntil).toHaveBeenCalledExactlyOnceWith(pending);
    await Promise.resolve();
    expect(warn).toHaveBeenCalledExactlyOnceWith("sentry:request-capture-failed");
  });

  it("does not invoke the TriageHarbor reporter for Edge errors", () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    invoke();
    expect(Sentry.captureRequestError).toHaveBeenCalledOnce();
    expect(reportSyntheticError).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("contains reporter registration exceptions without disrupting Sentry", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(reportSyntheticError).mockImplementation(() => {
      throw new Error("unexpected reporter exception");
    });

    expect(invoke).not.toThrow();
    expect(Sentry.captureRequestError).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledExactlyOnceWith("triageharbor:registration-failed");
  });
});
