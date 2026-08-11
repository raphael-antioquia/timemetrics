import { DeleteTimeBlockButton } from "@/components/time-blocks/delete-time-block-button";
import { formatDuration } from "@/lib/time/format-duration";
import type { TimeBlockListItem } from "@/lib/time/time-block-types";
import { EditTimeBlockDialog } from "@/components/time-blocks/edit-time-block-dialog";

type Activity = {
  id: string;
  name: string;
};

type TimeBlockRowProps = {
  timeBlock: TimeBlockListItem;
  activities: Activity[];
  timeRangeFormatter: Intl.DateTimeFormat;
};

export function TimeBlockRow({
  timeBlock,
  activities,
  timeRangeFormatter,
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
          {timeRangeFormatter.formatRange(
            new Date(timeBlock.started_at),
            new Date(timeBlock.ended_at),
          )}
        </time>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        <p className="font-mono font-medium tabular-nums">
          {formatDuration(timeBlock.duration_seconds)}
        </p>
        <EditTimeBlockDialog
          timeBlock={timeBlock}
          activities={activities}
        />

        <DeleteTimeBlockButton
          timeBlockId={timeBlock.id}
        />
      </div>
    </li>
  );
}