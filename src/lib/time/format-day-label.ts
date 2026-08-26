import { parseCalendarDate } from "@/lib/time/calendar-date";

export function formatDayLabel(date: string): string {
  const { year, month, day } = parseCalendarDate(date);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  // The input represents a calendar date, not an instant in the user's
  // timezone. Keep the synthetic Date entirely in UTC so formatting
  // cannot shift it to the previous or next day.
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(parsed);

  return `${weekday} ${day}`;
}