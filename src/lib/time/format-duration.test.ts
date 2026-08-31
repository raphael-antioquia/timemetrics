import { describe, expect, it } from "vitest";

import {
  formatAnalyticsDuration,
  formatDuration,
} from "./format-duration";

describe("formatDuration", () => {
  it("formats zero seconds", () => {
    expect(formatDuration(0)).toBe("00:00:00");
  });

  it("formats seconds", () => {
    expect(formatDuration(45)).toBe("00:00:45");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(125)).toBe("00:02:05");
  });

  it("formats hours, minutes, and seconds", () => {
    expect(formatDuration(3661)).toBe("01:01:01");
  });

  it("supports durations longer than 24 hours", () => {
    expect(formatDuration(90061)).toBe("25:01:01");
  });
});

describe("formatAnalyticsDuration", () => {
  it("formats zero seconds as zero minutes", () => {
    expect(formatAnalyticsDuration(0)).toBe("0m");
  });

  it("rounds durations below 30 seconds down to zero minutes", () => {
    expect(formatAnalyticsDuration(29)).toBe("0m");
  });

  it("rounds 30 seconds up to one minute", () => {
    expect(formatAnalyticsDuration(30)).toBe("1m");
  });

  it("formats durations under one hour as minutes", () => {
    expect(
      formatAnalyticsDuration(30 * 60),
    ).toBe("30m");
  });

  it("formats an exact number of hours", () => {
    expect(
      formatAnalyticsDuration(2 * 3600),
    ).toBe("2h");
  });

  it("formats hours and minutes", () => {
    expect(
      formatAnalyticsDuration(
        2 * 3600 + 15 * 60,
      ),
    ).toBe("2h 15m");
  });

  it("rounds seconds to the nearest minute", () => {
    expect(formatAnalyticsDuration(89)).toBe("1m");
    expect(formatAnalyticsDuration(90)).toBe("2m");
  });

  it("rounds across the hour boundary", () => {
    expect(formatAnalyticsDuration(3599)).toBe("1h");
  });
});