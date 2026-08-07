"use client";

import { DeleteTimeBlockButton } from "@/components/time-blocks/delete-time-block-button";
import { formatDuration } from "@/lib/time/format-duration";
import type { TimeBlockListItem } from "@/lib/time/time-block-types";

type TimeBlockHistoryProps = {
  timeBlocks: TimeBlockListItem[];
  hasError: boolean;
};

type TimeBlockGroup = {
  dateKey: string;
  dateLabel: string;
  totalSeconds: number;
  timeBlocks: TimeBlockListItem[];
};

function getLocalDateKey(dateString: string): string {
  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0",
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function groupTimeBlocksByDate(
  timeBlocks: TimeBlockListItem[],
): TimeBlockGroup[] {
  const groups = new Map<string, TimeBlockGroup>();

  // The database query returns sessions newest-first.
  // Map insertion order therefore keeps date groups newest-first.
  for (const timeBlock of timeBlocks) {
    const date = new Date(timeBlock.started_at);
    const dateKey = getLocalDateKey(
      timeBlock.started_at,
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
      dateLabel: date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      totalSeconds: timeBlock.duration_seconds,
      timeBlocks: [timeBlock],
    });
  }

  return Array.from(groups.values());
}

export function TimeBlockHistory({
  timeBlocks,
  hasError,
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

  const groups = groupTimeBlocksByDate(timeBlocks);

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
              <li
                key={timeBlock.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {timeBlock.activity?.name ??
                      "No activity"}
                  </p>

                  <time
                    dateTime={timeBlock.started_at}
                    className="text-muted-foreground text-sm"
                  >
                    {new Date(
                      timeBlock.started_at,
                    ).toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <p className="font-mono font-medium tabular-nums">
                    {formatDuration(
                      timeBlock.duration_seconds,
                    )}
                  </p>

                  <DeleteTimeBlockButton
                    timeBlockId={timeBlock.id}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}