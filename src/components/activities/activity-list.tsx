// src/components/activities/activity-list.tsx

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
      <p role="alert" className="text-sm text-red-600">
        We couldn&apos;t load your activities.
      </p>
    );
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        You haven&apos;t created any activities yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {activities.map((activity) => (
        <li key={activity.id} className="rounded-md border px-3 py-2">
          {activity.name}
        </li>
      ))}
    </ul>
  );
}