import { describe, expect, it } from "vitest";

import { parseAnalyticsRangePreset } from "./analytics-range-preset";

describe("parseAnalyticsRangePreset", () => {
  it("defaults to 7 when missing", () => {
    expect(parseAnalyticsRangePreset(undefined)).toBe(7);
  });

  it("parses a supported preset", () => {
    expect(parseAnalyticsRangePreset("30")).toBe(30);
  });

  it("falls back for unsupported input", () => {
    expect(parseAnalyticsRangePreset("banana")).toBe(7);
  });

  it("uses the first repeated query value", () => {
    expect(
      parseAnalyticsRangePreset(["30", "7"]),
    ).toBe(30);
  });
});