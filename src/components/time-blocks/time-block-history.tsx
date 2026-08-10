import { formatDuration } from "@/lib/time/format-duration";
import type { TimeBlockListItem } from "@/lib/time/time-block-types";
import { TimeBlockRow } from "@/components/time-blocks/time-block-row";

type TimeBlockHistoryProps = {
  timeBlocks: TimeBlockListItem[];
  hasError: boolean;
  timezone: string;
};

type TimeBlockGroup = {
  dateKey: string;
  dateLabel: string;
  totalSeconds: number;
  timeBlocks: TimeBlockListItem[];
};

function getDateKey(
  dateString: string,
  formatter: Intl.DateTimeFormat,
): string {
  const parts = formatter.formatToParts(
    new Date(dateString),
  );

  const year = parts.find(
    (part) => part.type === "year",
  )?.value;
  const month = parts.find(
    (part) => part.type === "month",
  )?.value;
  const day = parts.find(
    (part) => part.type === "day",
  )?.value;

  if (!year || !month || !day) {
    throw new Error(
      "Failed to format history date key.",
    );
  }

  return `${year}-${month}-${day}`;
}

function groupTimeBlocksByDate(
  timeBlocks: TimeBlockListItem[],
  timezone: string,
): TimeBlockGroup[] {
  const groups = new Map<string, TimeBlockGroup>();

  const dateKeyFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  );

  const dateLabelFormatter =
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  // The database query returns sessions newest-first.
  // Map insertion order therefore keeps date groups newest-first.
  for (const timeBlock of timeBlocks) {
    const date = new Date(timeBlock.started_at);
    const dateKey = getDateKey(
      timeBlock.started_at,
      dateKeyFormatter,
    );

    const existingGroup = groups.get(dateKey);

    if (existingGroup) {
      existingGroup.timeBlocks.push(timeBlock);
      existingGroup.totalSeconds +=
        timeBlock.duration_seconds;

      continue;
    }

    groups.set(dateKey, {
      dateKey,
      dateLabel: dateLabelFormatter.format(date),
      totalSeconds: timeBlock.duration_seconds,
      timeBlocks: [timeBlock],
    });
  }

  return Array.from(groups.values());
}

export function TimeBlockHistory({
  timeBlocks,
  hasError,
  timezone,
}: TimeBlockHistoryProps) {
  if (hasError) {
    return (
      <p
        role="alert"
        className="text-destructive text-sm"
      >
        We couldn&apos;t load your time history.
      </p>
    );
  }

  if (timeBlocks.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You haven&apos;t tracked any sessions yet.
      </p>
    );
  }

  const timeFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    },
  );

  const groups = groupTimeBlocksByDate(
    timeBlocks,
    timezone,
  );

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section
          key={group.dateKey}
          aria-labelledby={`history-date-${group.dateKey}`}
        >
          <div className="flex flex-col gap-1 border-b pb-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <h2
              id={`history-date-${group.dateKey}`}
              className="text-lg font-semibold"
            >
              {group.dateLabel}
            </h2>

            <p className="text-muted-foreground shrink-0 font-mono text-sm tabular-nums">
              Total: {formatDuration(group.totalSeconds)}
            </p>
          </div>

          <ul className="mt-3 divide-y rounded-lg border">
            {group.timeBlocks.map((timeBlock) => (
              <TimeBlockRow
                key={timeBlock.id}
                timeBlock={timeBlock}
                startedAtFormatter={timeFormatter}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}