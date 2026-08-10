import { DeleteTimeBlockButton } from "@/components/time-blocks/delete-time-block-button";
import { formatDuration } from "@/lib/time/format-duration";
import type { TimeBlockListItem } from "@/lib/time/time-block-types";

type RecentTimeBlockListProps = {
  timeBlocks: TimeBlockListItem[];
  hasError: boolean;
  timezone: string;
};



export function RecentTimeBlockList({
  timeBlocks,
  hasError,
  timezone,
}: RecentTimeBlockListProps) {
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

  const dateTimeFormatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );

  return (
    <ul className="divide-y rounded-lg border">
      {timeBlocks.map((timeBlock) => (
        <li
          key={timeBlock.id}
          className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {timeBlock.activity?.name ?? "No activity"}
            </p>

            <time
              dateTime={timeBlock.started_at}
              className="text-muted-foreground text-sm"
            >
              {dateTimeFormatter.format(
                new Date(timeBlock.started_at),
              )}
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
  );
}