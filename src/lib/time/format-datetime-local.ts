export function formatDateTimeLocal(
  dateString: string,
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(
    new Date(dateString),
  );

  const getPart = (
    type: Intl.DateTimeFormatPartTypes,
  ) =>
    parts.find((part) => part.type === type)?.value;

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const second = getPart("second");

  if (
    !year ||
    !month ||
    !day ||
    !hour ||
    !minute ||
    !second
  ) {
    throw new Error(
      "Failed to format datetime-local value.",
    );
  }

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

export function parseDateTimeLocal(
  value: string,
): Date | null {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}