// src/lib/time/format-day-label.ts

export function formatDayLabel(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC normalizes invalid dates, so verify that the resulting
  // calendar components still match the original input.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${date}`);
  }

  // The input represents a calendar date, not an instant in the user's
  // timezone. Keep the synthetic Date entirely in UTC so formatting
  // cannot shift it to the previous or next day.
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(parsed);

  return `${weekday} ${day}`;
}