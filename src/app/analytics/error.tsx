"use client";

export default function AnalyticsError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div>
      <p>Couldn&apos;t load your analytics.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}