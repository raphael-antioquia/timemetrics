import { describe, expect, it } from "vitest";

import {
  getLastSevenDayRange,
  getLastThirtyDayRange,
  getPreviousDateRange,
} from "@/lib/time/ranges";

const MS_PER_DAY = 86_400_000;

function addDaysInTest(
  date: string,
  days: number,
): string {
  return new Date(
    Date.parse(date) + days * MS_PER_DAY,
  )
    .toISOString()
    .slice(0, 10);
}

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

describe("getLastThirtyDayRange", () => {
  it("returns the last 30 calendar days including today", () => {
    const range = getLastThirtyDayRange(
      "America/Toronto",
      new Date("2026-08-25T16:00:00Z"),
    );

    expect(range).toEqual({
      startDate: "2026-07-27",
      endDate: "2026-08-25",
    });
  });
});

describe("getPreviousDateRange", () => {
  it("returns the previous equivalent 7-day range", () => {
    expect(
      getPreviousDateRange({
        startDate: "2026-08-19",
        endDate: "2026-08-25",
      }),
    ).toEqual({
      startDate: "2026-08-12",
      endDate: "2026-08-18",
    });
  });

  it("handles month boundaries", () => {
    expect(
      getPreviousDateRange({
        startDate: "2026-08-01",
        endDate: "2026-08-07",
      }),
    ).toEqual({
      startDate: "2026-07-25",
      endDate: "2026-07-31",
    });
  });

  it("handles year boundaries", () => {
    expect(
      getPreviousDateRange({
        startDate: "2026-01-01",
        endDate: "2026-01-07",
      }),
    ).toEqual({
      startDate: "2025-12-25",
      endDate: "2025-12-31",
    });
  });

  it("works for 30-day ranges", () => {
    expect(
      getPreviousDateRange({
        startDate: "2026-07-27",
        endDate: "2026-08-25",
      }),
    ).toEqual({
      startDate: "2026-06-27",
      endDate: "2026-07-26",
    });
  });

  it("handles a one-day range", () => {
    expect(
      getPreviousDateRange({
        startDate: "2026-08-25",
        endDate: "2026-08-25",
      }),
    ).toEqual({
      startDate: "2026-08-24",
      endDate: "2026-08-24",
    });
  });

  it("handles a leap day in the previous range", () => {
    expect(
      getPreviousDateRange({
        startDate: "2028-03-01",
        endDate: "2028-03-07",
      }),
    ).toEqual({
      startDate: "2028-02-23",
      endDate: "2028-02-29",
    });
  });

  it("rejects an inverted range", () => {
    expect(() =>
      getPreviousDateRange({
        startDate: "2026-08-25",
        endDate: "2026-08-19",
      }),
    ).toThrow(
      "Date range end must be on or after start",
    );
  });

  it.each([1, 2, 7, 14, 30, 31, 60, 365])(
    "produces an adjacent equal-length previous range for %i days",
    (length) => {
      const currentStart = "2026-03-01";

      const current = {
        startDate: currentStart,
        endDate: addDaysInTest(
          currentStart,
          length - 1,
        ),
      };

      const previous = getPreviousDateRange(current);

      // No gap or overlap between previous and current.
      expect(
        addDaysInTest(previous.endDate, 1),
      ).toBe(current.startDate);

      // Previous starts exactly one full range-length
      // before the current range starts.
      expect(
        Date.parse(current.startDate) -
          Date.parse(previous.startDate),
      ).toBe(length * MS_PER_DAY);
    },
  );
});