"use client";

import { useEffect, useState } from "react";

type TimerStatus = "idle" | "running" | "paused";

type Activity = {
  id: string;
  name: string;
};

type ActivityTimerProps = {
  activities: Activity[];
};

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

export function ActivityTimer({
  activities,
}: ActivityTimerProps) {
  const [selectedActivityId, setSelectedActivityId] =
    useState("");
  const [status, setStatus] =
    useState<TimerStatus>("idle");

  // Original start time for the entire session.
  const [sessionStartedAt, setSessionStartedAt] =
    useState<number | null>(null);

  // Start time for the currently running segment.
  // This changes every time the timer resumes.
  const [segmentStartedAt, setSegmentStartedAt] =
    useState<number | null>(null);

  // Active time completed before the current segment.
  const [
    accumulatedMilliseconds,
    setAccumulatedMilliseconds,
  ] = useState(0);

  // Updated by the interval to trigger timer rendering.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "running") {
      return;
    }

    function updateNow() {
      setNow(Date.now());
    }

    updateNow();

    const intervalId = window.setInterval(updateNow, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status]);

  const currentSegmentMilliseconds =
    status === "running" && segmentStartedAt !== null
      ? Math.max(0, now - segmentStartedAt)
      : 0;

  const elapsedMilliseconds =
    accumulatedMilliseconds + currentSegmentMilliseconds;

  const elapsedSeconds = Math.floor(
    elapsedMilliseconds / 1000,
  );

  function resetTimer(resetAt: number) {
    setSelectedActivityId("");
    setStatus("idle");
    setSessionStartedAt(null);
    setSegmentStartedAt(null);
    setAccumulatedMilliseconds(0);
    setNow(resetAt);
  }

  function handleStart() {
    if (!selectedActivityId) {
      return;
    }

    const startedAt = Date.now();

    setSessionStartedAt(startedAt);
    setSegmentStartedAt(startedAt);
    setAccumulatedMilliseconds(0);
    setNow(startedAt);
    setStatus("running");
  }

  function handlePause() {
    if (
      status !== "running" ||
      segmentStartedAt === null
    ) {
      return;
    }

    const pausedAt = Date.now();
    const completedSegment =
      pausedAt - segmentStartedAt;

    setAccumulatedMilliseconds(
      (previousMilliseconds) =>
        previousMilliseconds + completedSegment,
    );

    setSegmentStartedAt(null);
    setNow(pausedAt);
    setStatus("paused");
  }

  function handleResume() {
    if (status !== "paused") {
      return;
    }

    const resumedAt = Date.now();

    setSegmentStartedAt(resumedAt);
    setNow(resumedAt);
    setStatus("running");
  }

  function handleStop() {
    if (
      status === "idle" ||
      !selectedActivityId ||
      sessionStartedAt === null
    ) {
      return;
    }

    const stoppedAt = Date.now();

    const finalSegmentMilliseconds =
      status === "running" && segmentStartedAt !== null
        ? stoppedAt - segmentStartedAt
        : 0;

    const finalDurationMilliseconds =
      accumulatedMilliseconds +
      finalSegmentMilliseconds;

    const durationSeconds = Math.floor(
      finalDurationMilliseconds / 1000,
    );

    // Ignore accidental sessions shorter than one second.
    if (durationSeconds < 1) {
      resetTimer(stoppedAt);
      return;
    }

    // Temporary verification only.
    // This becomes the Server Action payload later.
    console.log({
      selectedActivityId,
      startedAt: new Date(
        sessionStartedAt,
      ).toISOString(),
      endedAt: new Date(stoppedAt).toISOString(),
      durationSeconds,
    });

    resetTimer(stoppedAt);
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border p-6">
      <select
        value={selectedActivityId}
        onChange={(event) =>
          setSelectedActivityId(event.target.value)
        }
        disabled={status !== "idle"}
        className="w-full rounded-md border px-3 py-2 disabled:opacity-50"
      >
        <option value="">Select an activity</option>

        {activities.map((activity) => (
          <option
            key={activity.id}
            value={activity.id}
          >
            {activity.name}
          </option>
        ))}
      </select>

      <div className="font-mono text-4xl tabular-nums">
        {formatElapsed(elapsedSeconds)}
      </div>

      <div className="flex gap-2">
        {status === "idle" && (
          <button
            type="button"
            onClick={handleStart}
            disabled={!selectedActivityId}
            className="rounded-md bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start
          </button>
        )}

        {status === "running" && (
          <button
            type="button"
            onClick={handlePause}
            className="rounded-md border px-4 py-2"
          >
            Pause
          </button>
        )}

        {status === "paused" && (
          <button
            type="button"
            onClick={handleResume}
            className="rounded-md border px-4 py-2"
          >
            Resume
          </button>
        )}

        {status !== "idle" && (
          <button
            type="button"
            onClick={handleStop}
            className="rounded-md bg-red-600 px-4 py-2 text-white"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
}