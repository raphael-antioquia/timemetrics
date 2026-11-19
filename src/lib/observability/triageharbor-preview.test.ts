import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TOKEN = "th_" + "A".repeat(43);
const RENDER_CONTEXT = {
  routeType: "render",
  routePath: "/triageharbor-preview/render",
};
const HANDLER_CONTEXT = {
  routeType: "route",
  routePath: "/triageharbor-preview/handler",
};

function fakeResponse(status: number, cancel = vi.fn().mockResolvedValue(undefined)) {
  return { status, body: { cancel } } as unknown as Response;
}

async function setup(token: string | null = TOKEN) {
  vi.stubEnv("TRIAGEHARBOR_INGEST_TOKEN", token === null ? undefined : token);
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(fakeResponse(202));
  vi.stubGlobal("fetch", fetchMock);
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const reporter = await import("./triageharbor-preview");
  return { reporter, fetchMock, info, warn };
}

describe("reportSyntheticError", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("silently disables when the token is absent", async () => {
    const { reporter, fetchMock, info, warn } = await setup(null);
    expect(
      reporter.reportSyntheticError(
        new Error(reporter.RENDER_SENTINEL),
        RENDER_CONTEXT,
      ),
    ).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects malformed tokens with a fixed warning once per module initialization", async () => {
    const { reporter, fetchMock, warn } = await setup("th_bad");
    await import("./triageharbor-preview");
    expect(warn).toHaveBeenCalledExactlyOnceWith("triageharbor:disabled:config");
    expect(
      reporter.reportSyntheticError(
        new Error(reporter.RENDER_SENTINEL),
        RENDER_CONTEXT,
      ),
    ).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only sends an exact sentinel, route type, and file route path match", async () => {
    const { reporter, fetchMock, info } = await setup();
    const error = new Error(reporter.RENDER_SENTINEL);

    expect(reporter.reportSyntheticError(error, { ...RENDER_CONTEXT, routeType: "route" })).toBeUndefined();
    expect(reporter.reportSyntheticError(error, { ...RENDER_CONTEXT, routePath: "/app/other/page" })).toBeUndefined();
    expect(reporter.reportSyntheticError(new Error("real customer error"), RENDER_CONTEXT)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledTimes(3);
    for (const [line] of info.mock.calls) {
      expect(line).toContain("triageharbor:skipped:not-allowlisted");
      expect(line).not.toContain("real customer error");
      expect(line).not.toContain(reporter.RENDER_SENTINEL);
    }

    await reporter.reportSyntheticError(error, RENDER_CONTEXT);
    await reporter.reportSyntheticError(new Error(reporter.ROUTE_SENTINEL), HANDLER_CONTEXT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends precisely the fixed JSON fields and canonical fetch options", async () => {
    const { reporter, fetchMock, warn } = await setup();
    const error = new Error(reporter.RENDER_SENTINEL);
    error.stack = "SECRET_STACK_TRACE";
    (error as Error & { userId: string }).userId = "SECRET_USER";

    await reporter.reportSyntheticError(error, RENDER_CONTEXT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://triageharbor.com/events");
    expect(options).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TriageHarbor-Ingest-Key": TOKEN,
      },
      redirect: "error",
      cache: "no-store",
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const body = String(options?.body);
    const payload = JSON.parse(body) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["exceptionType", "message", "occurredAt"]);
    expect(payload).toMatchObject({
      exceptionType: "TimeMetricsPreviewRenderError",
      message: reporter.RENDER_SENTINEL,
    });
    expect(typeof payload.occurredAt).toBe("string");
    expect(new Date(String(payload.occurredAt)).toISOString()).toBe(payload.occurredAt);
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(256 * 1024);
    for (const forbidden of ["SECRET_STACK_TRACE", "SECRET_USER", "stackTrace", "headers", "cookies", "userId", "requestUrl"]) {
      expect(body).not.toContain(forbidden);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([202, 401, 429, 500])("records a single HTTP %i outcome without retrying", async (status) => {
    const { reporter, fetchMock, info } = await setup();
    const cancel = vi.fn().mockResolvedValue(undefined);
    fetchMock.mockResolvedValue(fakeResponse(status, cancel));
    await reporter.reportSyntheticError(new Error(reporter.ROUTE_SENTINEL), HANDLER_CONTEXT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledExactlyOnceWith(
      status === 202 ? "triageharbor:sent:202" : `triageharbor:status:${status}`,
    );
  });

  it("does not record a second outcome if response-body cancellation fails", async () => {
    const { reporter, fetchMock, info, warn } = await setup();
    const cancel = vi.fn().mockRejectedValue(new Error("SECRET_CANCEL_ERROR"));
    fetchMock.mockResolvedValue(fakeResponse(202, cancel));
    await reporter.reportSyntheticError(new Error(reporter.RENDER_SENTINEL), RENDER_CONTEXT);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledExactlyOnceWith("triageharbor:sent:202");
    expect(warn).not.toHaveBeenCalled();
  });

  it("contains network failure without leaking the raw error or retrying", async () => {
    const { reporter, fetchMock, info, warn } = await setup();
    fetchMock.mockRejectedValue(new Error("SECRET_NETWORK_FAILURE"));
    await expect(
      reporter.reportSyntheticError(new Error(reporter.RENDER_SENTINEL), RENDER_CONTEXT),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledExactlyOnceWith("triageharbor:network");
    expect(warn).not.toHaveBeenCalled();
  });

  it("classifies a signal-aborted fetch as timeout with no retry", async () => {
    const { reporter, fetchMock, info } = await setup();
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    fetchMock.mockImplementation((_url, options) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = options?.signal;
        expect(signal).toBe(controller.signal);
        signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    );

    const pending = reporter.reportSyntheticError(new Error(reporter.RENDER_SENTINEL), RENDER_CONTEXT);
    controller.abort(new DOMException("synthetic timeout", "TimeoutError"));
    await pending;

    expect(timeout).toHaveBeenCalledExactlyOnceWith(2_500);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledExactlyOnceWith("triageharbor:timeout");
  });

  it("fails closed when reading the error message throws", async () => {
    const { reporter, fetchMock, info } = await setup();
    const error = Object.defineProperty({}, "message", {
      get() {
        throw new Error("SECRET_GETTER_FAILURE");
      },
    });
    expect(reporter.reportSyntheticError(error, RENDER_CONTEXT)).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledExactlyOnceWith(
      `triageharbor:skipped:not-allowlisted routeType=${RENDER_CONTEXT.routeType} routePath=${RENDER_CONTEXT.routePath}`,
    );
  });
});
