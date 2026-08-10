import type { TimeBlockListItem } from "@/lib/time/time-block-types";
import { TimeBlockRow } from "@/components/time-blocks/time-block-row";

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
        <TimeBlockRow
          key={timeBlock.id}
          timeBlock={timeBlock}
          startedAtFormatter={dateTimeFormatter}
        />
      ))}
    </ul>
  );
}