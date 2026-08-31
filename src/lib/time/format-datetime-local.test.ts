import { describe, expect, it } from "vitest";

import {
  formatDateTimeLocal,
  parseDateTimeLocal,
} from "./format-datetime-local";

describe("test timezone", () => {
  it("runs with the pinned America/Toronto timezone", () => {
    expect(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ).toBe("America/Toronto");

    expect(
      new Date("2026-08-30T12:00:00Z").getTimezoneOffset(),
    ).toBe(240);

    expect(
      new Date("2026-01-15T12:00:00Z").getTimezoneOffset(),
    ).toBe(300);
  });
});

describe("formatDateTimeLocal", () => {
  it("converts UTC to local wall-clock time during daylight saving time", () => {
    expect(
      formatDateTimeLocal("2026-08-30T12:00:00Z"),
    ).toBe("2026-08-30T08:00:00");
  });

  it("converts UTC to local wall-clock time during standard time", () => {
    expect(
      formatDateTimeLocal("2026-01-15T12:00:00Z"),
    ).toBe("2026-01-15T07:00:00");
  });

  it("moves to the previous local date when necessary", () => {
    expect(
      formatDateTimeLocal("2026-08-30T02:00:00Z"),
    ).toBe("2026-08-29T22:00:00");
  });

  it("throws a RangeError for an invalid date", () => {
    expect(() =>
      formatDateTimeLocal("not-a-date"),
    ).toThrow(RangeError);
  });

  // Characterization: datetime-local cannot preserve the UTC offset during
  // the repeated fall-back hour. Keep this behavior visible until the edit
  // flow preserves the original instant.
  it("collapses both fall-back hours to the same local string", () => {
    expect(
      formatDateTimeLocal("2026-11-01T05:00:00Z"),
    ).toBe("2026-11-01T01:00:00");

    expect(
      formatDateTimeLocal("2026-11-01T06:00:00Z"),
    ).toBe("2026-11-01T01:00:00");
  });
});

describe("parseDateTimeLocal", () => {
  it("round-trips an unambiguous formatted UTC timestamp", () => {
    const formatted = formatDateTimeLocal(
      "2026-08-30T12:00:00Z",
    );

    expect(
      parseDateTimeLocal(formatted)?.toISOString(),
    ).toBe("2026-08-30T12:00:00.000Z");
  });

  it("returns null for an invalid datetime-local value", () => {
    expect(
      parseDateTimeLocal("not-a-date"),
    ).toBeNull();
  });

  // Characterization: the ambiguous repeated hour resolves to the earlier
  // daylight-saving offset.
  it("resolves the ambiguous fall-back hour to the earlier offset", () => {
    expect(
      parseDateTimeLocal(
        "2026-11-01T01:00:00",
      )?.toISOString(),
    ).toBe("2026-11-01T05:00:00.000Z");
  });

  // Characterization: 02:30 does not exist locally during the spring-forward
  // transition, so JavaScript normalizes it into the first valid later time.
  it("normalizes a nonexistent spring-forward local time forward", () => {
    expect(
      parseDateTimeLocal(
        "2026-03-08T02:30:00",
      )?.toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");
  });
});