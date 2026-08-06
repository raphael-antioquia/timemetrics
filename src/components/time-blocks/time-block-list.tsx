import { DeleteTimeBlockButton } from "@/components/time-blocks/delete-time-block-button";
import { formatDuration } from "@/lib/time/format-duration";
import type { TimeBlockListItem } from "@/lib/time/time-block-types";

type TimeBlockListProps = {
  timeBlocks: TimeBlockListItem[];
  hasError: boolean;
};

export function TimeBlockList({
  timeBlocks,
  hasError,
}: TimeBlockListProps) {
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

            {/* TODO(#42): Format timestamps using the user's local timezone. */}
            <time
              dateTime={timeBlock.started_at}
              className="text-muted-foreground text-sm"
            >
              {new Date(
                timeBlock.started_at,
              ).toLocaleString()}
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