import { beforeEach, describe, expect, it, vi } from "vitest";

import * as Sentry from "@sentry/nextjs";

import { createClient } from "@/lib/supabase/server";

import { getUserTimezone } from "./get-user-timezone";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

type MockedSupabase = Awaited<ReturnType<typeof createClient>>;

function mockClient(from: unknown): MockedSupabase {
  return { from } as unknown as MockedSupabase;
}

describe("getUserTimezone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user's profile timezone", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        timezone: "America/Toronto",
      },
      error: null,
    });

    const eq = vi.fn().mockReturnValue({
      single,
    });

    const select = vi.fn().mockReturnValue({
      eq,
    });

    const from = vi.fn().mockReturnValue({
      select,
    });

    vi.mocked(createClient).mockResolvedValue(
      mockClient(from),
    );

    await expect(
      getUserTimezone("user-123"),
    ).resolves.toBe("America/Toronto");

    expect(eq).toHaveBeenCalledWith(
      "id",
      "user-123",
    );

    expect(
      Sentry.captureException,
    ).not.toHaveBeenCalled();
  });

  it("captures and rethrows a Supabase error", async () => {
    const error = new Error(
      "Failed to load profile",
    );

    const single = vi.fn().mockResolvedValue({
      data: null,
      error,
    });

    const eq = vi.fn().mockReturnValue({
      single,
    });

    const select = vi.fn().mockReturnValue({
      eq,
    });

    const from = vi.fn().mockReturnValue({
      select,
    });

    vi.mocked(createClient).mockResolvedValue(
      mockClient(from),
    );

    await expect(
      getUserTimezone("user-123"),
    ).rejects.toBe(error);

    expect(
      Sentry.captureException,
    ).toHaveBeenCalledWith(error, {
      tags: {
        operation: "getUserTimezone",
      },
    });
  });
});