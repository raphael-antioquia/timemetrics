import { DeleteTimeBlockButton } from "@/components/time-blocks/delete-time-block-button";
import { formatDuration } from "@/lib/time/format-duration";
import type { TimeBlockListItem } from "@/lib/time/time-block-types";

type TimeBlockRowProps = {
  timeBlock: TimeBlockListItem;
  startedAtFormatter: Intl.DateTimeFormat;
};

export function TimeBlockRow({
  timeBlock,
  startedAtFormatter,
}: TimeBlockRowProps) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {timeBlock.activity?.name ?? "No activity"}
        </p>

        <time
          dateTime={timeBlock.started_at}
          className="text-muted-foreground text-sm"
        >
          {startedAtFormatter.format(
            new Date(timeBlock.started_at),
          )}
        </time>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        <p className="font-mono font-medium tabular-nums">
          {formatDuration(timeBlock.duration_seconds)}
        </p>

        <DeleteTimeBlockButton
          timeBlockId={timeBlock.id}
        />
      </div>
    </li>
  );
}