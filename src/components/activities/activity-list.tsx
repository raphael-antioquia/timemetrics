import { EditActivityDialog } from "./edit-activity-dialog";

type ActivityListItem = {
  id: string;
  name: string;
};

type ActivityListProps = {
  activities: ActivityListItem[];
  hasError: boolean;
};

export function ActivityList({
  activities,
  hasError,
}: ActivityListProps) {
  if (hasError) {
    return (
      <p
        role="alert"
        className="text-destructive text-sm"
      >
        We couldn&apos;t load your activities.
      </p>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        You haven&apos;t created any activities yet.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {activities.map((activity) => (
        <li
          key={activity.id}
          className="flex items-center gap-3 px-4 py-3"
        >
          <p className="min-w-0 flex-1 truncate font-medium">
            {activity.name}
          </p>

          <div className="ml-auto shrink-0">
            <EditActivityDialog
              activityId={activity.id}
              activityName={activity.name}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}