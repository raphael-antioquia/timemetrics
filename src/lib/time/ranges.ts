import { 
  type CalendarDate, 
  parseCalendarDate, 
} from "@/lib/time/calendar-date";

export type DateRange = {
  startDate: string;
  endDate: string;
};

export function getLastSevenDayRange(
  timeZone: string,
  now = new Date(),
): DateRange {
  return getTrailingDayRange(timeZone, 7, now);
}

export function getLastThirtyDayRange(
  timeZone: string,
  now = new Date(),
): DateRange {
  return getTrailingDayRange(timeZone, 30, now);
}

function getTrailingDayRange(
  timeZone: string,
  days: number,
  now: Date,
): DateRange {
  const endDate = getCalendarDate(now, timeZone);
  const startDate = addCalendarDays(endDate, -(days - 1));

  return {
    startDate: formatCalendarDate(startDate),
    endDate: formatCalendarDate(endDate),
  };
}

function getCalendarDate(
  date: Date,
  timeZone: string,
): CalendarDate {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);

  const year = getPart(parts, "year");
  const month = getPart(parts, "month");
  const day = getPart(parts, "day");

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  };
}

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const part = parts.find((item) => item.type === type);

  if (!part) {
    throw new Error(`Missing ${type} date part`);
  }

  return part.value;
}

function addCalendarDays(
  date: CalendarDate,
  days: number,
): CalendarDate {
  const shifted = new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day + days,
    ),
  );

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function formatCalendarDate(date: CalendarDate): string {
  const year = String(date.year);
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const MS_PER_DAY = 86_400_000;

function daysBetweenInclusive(
  startDate: string,
  endDate: string,
): number {
  const start = parseCalendarDate(startDate);
  const end = parseCalendarDate(endDate);

  const startMs = Date.UTC(
    start.year,
    start.month - 1,
    start.day,
  );

  const endMs = Date.UTC(
    end.year,
    end.month - 1,
    end.day,
  );

  return Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
}

export function getPreviousDateRange(
  current: DateRange,
): DateRange {
  const lengthInDays = daysBetweenInclusive(
    current.startDate,
    current.endDate,
  );

  if (lengthInDays <= 0) {
    throw new Error("Date range end must be on or after start");
  }

  const currentStart = parseCalendarDate(
    current.startDate,
  );

  const previousEnd = addCalendarDays(
    currentStart,
    -1,
  );

  const previousStart = addCalendarDays(
    previousEnd,
    -(lengthInDays - 1),
  );

  return {
    startDate: formatCalendarDate(previousStart),
    endDate: formatCalendarDate(previousEnd),
  };
}