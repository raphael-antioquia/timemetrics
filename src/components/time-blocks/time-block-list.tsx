type TimeBlockListItem = {
  id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  activity: {
    name: string;
  } | null;
};

type TimeBlockListProps = {
  timeBlocks: TimeBlockListItem[];
  hasError: boolean;
};

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

export function TimeBlockList({
  timeBlocks,
  hasError,
}: TimeBlockListProps) {
  if (hasError) {
    return (
      <p role="alert" className="text-sm text-red-600">
        We couldn&apos;t load your time history.
      </p>
    );
  }

  if (timeBlocks.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        You haven&apos;t tracked any sessions yet.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {timeBlocks.map((timeBlock) => (
        <li
          key={timeBlock.id}
          className="rounded-md border px-4 py-3"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">
                {timeBlock.activity?.name ?? "No activity"}
              </p>

              <p className="text-sm text-gray-600">
                {/* TODO(#YOUR_ISSUE_NUMBER): Format in the user's local timezone. */}
                {new Date(
                  timeBlock.started_at,
                ).toLocaleString()}
              </p>
            </div>

            <p className="font-mono tabular-nums">
              {formatDuration(
                timeBlock.duration_seconds,
              )}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}