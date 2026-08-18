import { describe, expect, it } from "vitest";
import { getLastSevenDayRange } from "@/lib/time/ranges";

describe("getLastSevenDayRange", () => {
  it("uses the user's local date when UTC has already rolled to the next day", () => {
    const range = getLastSevenDayRange(
      "America/Toronto",
      new Date("2026-08-19T02:00:00Z"),
    );

    expect(range).toEqual({
      startDate: "2026-08-12",
      endDate: "2026-08-18",
    });
  });

  it("spans a daylight saving time transition using calendar days", () => {
    const range = getLastSevenDayRange(
      "America/Toronto",
      new Date("2026-11-02T12:00:00Z"),
    );

    expect(range).toEqual({
      startDate: "2026-10-27",
      endDate: "2026-11-02",
    });
  });

  it("handles month boundaries", () => {
    const range = getLastSevenDayRange(
      "America/Toronto",
      new Date("2026-09-02T16:00:00Z"),
    );

    expect(range).toEqual({
      startDate: "2026-08-27",
      endDate: "2026-09-02",
    });
  });

  it("handles year rollover while respecting the user's local date", () => {
    const range = getLastSevenDayRange(
      "America/Toronto",
      new Date("2027-01-01T02:00:00Z"),
    );

    expect(range).toEqual({
      startDate: "2026-12-25",
      endDate: "2026-12-31",
    });
  });

  it("handles time zones ahead of UTC", () => {
    const range = getLastSevenDayRange(
      "Asia/Tokyo",
      new Date("2026-08-18T20:00:00Z"),
    );

    expect(range).toEqual({
      startDate: "2026-08-13",
      endDate: "2026-08-19",
    });
  });
});