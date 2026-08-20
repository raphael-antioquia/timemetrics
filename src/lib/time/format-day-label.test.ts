// src/lib/time/format-day-label.test.ts

import { describe, expect, it } from "vitest";

import { formatDayLabel } from "@/lib/time/format-day-label";

describe("formatDayLabel", () => {
  it("formats a calendar date as a weekday and day", () => {
    expect(formatDayLabel("2026-08-12")).toBe("Wed 12");
  });

  it("handles Sunday", () => {
    expect(formatDayLabel("2026-08-16")).toBe("Sun 16");
  });

  it("handles month boundaries", () => {
    expect(formatDayLabel("2026-09-01")).toBe("Tue 1");
  });

  it("handles year boundaries", () => {
    expect(formatDayLabel("2027-01-01")).toBe("Fri 1");
  });

  it("rejects malformed input", () => {
    expect(() => formatDayLabel("not-a-date")).toThrow(
      "Invalid calendar date",
    );
  });

  it("rejects impossible calendar dates", () => {
    expect(() => formatDayLabel("2026-02-31")).toThrow(
      "Invalid calendar date",
    );
  });
});