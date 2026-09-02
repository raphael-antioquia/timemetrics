import type { TimeBlockListItem } from "@/lib/time/time-block-types";
import {
  ACTIVITIES_LOAD_ERROR_EDITING,
} from "@/components/time-blocks/messages";
import { TimeBlockRow } from "@/components/time-blocks/time-block-row";

type Activity = {
  id: string;
  name: string;
};

type RecentTimeBlockListProps = {
  timeBlocks: TimeBlockListItem[];
  activities: Activity[];
  hasError: boolean;
  hasActivitiesError: boolean;
  timezone: string;
};

export function RecentTimeBlockList({
  timeBlocks,
  activities,
  hasError,
  hasActivitiesError,
  timezone,
}: RecentTimeBlockListProps) {
  if (hasError) {
    return (
      <p
        role="alert"
        className="text-destructive text-sm"
      >
        We couldn&apos;t load your recent sessions.
      </p>
    );
  }

  const activitiesErrorMessage = hasActivitiesError ? (
    <p
      role="alert"
      className="text-destructive text-sm"
    >
      {ACTIVITIES_LOAD_ERROR_EDITING}
    </p>
  ) : null;

  if (timeBlocks.length === 0) {
    return (
      <div className="space-y-4">
        {activitiesErrorMessage}

        <p className="text-muted-foreground text-sm">
          You haven&apos;t tracked any sessions yet.
        </p>
      </div>
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
    <div className="space-y-4">
      {activitiesErrorMessage}

      <ul className="divide-y rounded-lg border">
        {timeBlocks.map((timeBlock) => (
          <TimeBlockRow
            key={timeBlock.id}
            timeBlock={timeBlock}
            activities={activities}
            hasActivitiesError={hasActivitiesError}
            timeRangeFormatter={dateTimeFormatter}
          />
        ))}
      </ul>
    </div>
  );
}
