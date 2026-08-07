"use client";

import { useEffect, useState } from "react";
import { createTimeBlock } from "@/app/actions/time-blocks";
import type {
  CreateTimeBlockInput,
  CreateTimeBlockResult,
} from "@/app/actions/time-block-state";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

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
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );
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

  const [sessionStartedAt, setSessionStartedAt] =
    useState<number | null>(null);

  const [segmentStartedAt, setSegmentStartedAt] =
    useState<number | null>(null);

  const [
    accumulatedMilliseconds,
    setAccumulatedMilliseconds,
  ] = useState(0);

  const [now, setNow] = useState(() => Date.now());

  const [isSaving, setIsSaving] = useState(false);

  const [saveResult, setSaveResult] =
    useState<CreateTimeBlockResult | null>(null);

  // Keeps the exact Stop payload when a save fails.
  const [pendingTimeBlock, setPendingTimeBlock] =
    useState<CreateTimeBlockInput | null>(null);

  useEffect(() => {
    if (status !== "running") {
      return;
    }

    function updateNow() {
      setNow(Date.now());
    }

    updateNow();

    const intervalId = window.setInterval(
      updateNow,
      1000,
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status]);

  const currentSegmentMilliseconds =
    status === "running" &&
    segmentStartedAt !== null
      ? Math.max(0, now - segmentStartedAt)
      : 0;

  const elapsedMilliseconds =
    accumulatedMilliseconds +
    currentSegmentMilliseconds;

  const elapsedSeconds = Math.floor(
    elapsedMilliseconds / 1000,
  );

  const hasActivities = activities.length > 0;

  function resetTimer(resetAt: number) {
    setSelectedActivityId("");
    setStatus("idle");
    setSessionStartedAt(null);
    setSegmentStartedAt(null);
    setAccumulatedMilliseconds(0);
    setPendingTimeBlock(null);
    setNow(resetAt);
  }

  async function saveTimeBlock(
    input: CreateTimeBlockInput,
  ) {
    setIsSaving(true);
    setSaveResult(null);

    try {
      const result = await createTimeBlock(input);

      setSaveResult(result);

      if (result.status === "success") {
        resetTimer(Date.now());
      }
    } catch {
      setSaveResult({
        status: "error",
        message:
          "We couldn't save this time session. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleStart() {
    if (!selectedActivityId || isSaving) {
      return;
    }

    const startedAt = Date.now();

    setSaveResult(null);
    setPendingTimeBlock(null);
    setSessionStartedAt(startedAt);
    setSegmentStartedAt(startedAt);
    setAccumulatedMilliseconds(0);
    setNow(startedAt);
    setStatus("running");
  }

  function handlePause() {
    if (
      status !== "running" ||
      segmentStartedAt === null ||
      isSaving
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
    if (status !== "paused" || isSaving) {
      return;
    }

    const resumedAt = Date.now();

    // A failed Stop can be cancelled by resuming.
    setPendingTimeBlock(null);
    setSaveResult(null);
    setSegmentStartedAt(resumedAt);
    setNow(resumedAt);
    setStatus("running");
  }

  async function handleStop() {
    if (isSaving) {
      return;
    }

    // Retry the exact same stopped session after a failure.
    if (pendingTimeBlock) {
      await saveTimeBlock(pendingTimeBlock);
      return;
    }

    if (
      status === "idle" ||
      !selectedActivityId ||
      sessionStartedAt === null
    ) {
      return;
    }

    const stoppedAt = Date.now();

    const finalSegmentMilliseconds =
      status === "running" &&
      segmentStartedAt !== null
        ? stoppedAt - segmentStartedAt
        : 0;

    const finalDurationMilliseconds =
      accumulatedMilliseconds +
      finalSegmentMilliseconds;

    const durationSeconds = Math.floor(
      finalDurationMilliseconds / 1000,
    );

    if (durationSeconds < 1) {
      resetTimer(stoppedAt);
      return;
    }

    const input: CreateTimeBlockInput = {
      activityId: selectedActivityId,
      startedAt: new Date(
        sessionStartedAt,
      ).toISOString(),
      endedAt: new Date(stoppedAt).toISOString(),
      durationSeconds,
    };

    // Freeze the timer at the moment Stop was pressed.
    setAccumulatedMilliseconds(
      finalDurationMilliseconds,
    );
    setSegmentStartedAt(null);
    setNow(stoppedAt);
    setStatus("paused");
    setPendingTimeBlock(input);

    await saveTimeBlock(input);
  }

  return (
   <div
      aria-busy={isSaving}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="timer-activity">
          Activity
        </Label>

        <NativeSelect
          id="timer-activity"
          value={selectedActivityId}
          onChange={(event) =>
            setSelectedActivityId(event.target.value)
          }
          disabled={
            !hasActivities ||
            status !== "idle" ||
            isSaving
          }
          aria-describedby={
            !hasActivities
              ? "timer-activity-help"
              : undefined
          }
        >
          <option value="">
            Select an activity
          </option>

          {activities.map((activity) => (
            <option
              key={activity.id}
              value={activity.id}
            >
              {activity.name}
            </option>
          ))}
        </NativeSelect>

        {!hasActivities && (
          <p
            id="timer-activity-help"
            className="text-muted-foreground text-sm"
          >
            Create an activity before starting a timer.
          </p>
        )}
      </div>

      <div className="space-y-1 text-center">
        <p
          id="elapsed-time-label"
          className="text-muted-foreground text-sm"
        >
          Elapsed time
        </p>

        <div
          role="timer"
          aria-labelledby="elapsed-time-label"
          className="font-mono text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
        >
          {formatElapsed(elapsedSeconds)}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {status === "idle" && (
          <Button
            type="button"
            onClick={handleStart}
            disabled={
              !selectedActivityId || isSaving
            }
            className="w-full sm:w-auto"
          >
            Start
          </Button>
        )}

        {status === "running" && (
          <Button
            type="button"
            variant="outline"
            onClick={handlePause}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Pause
          </Button>
        )}

        {status === "paused" && (
          <Button
            type="button"
            variant="outline"
            onClick={handleResume}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Resume
          </Button>
        )}

        {status !== "idle" && (
          <Button
            type="button"
            variant={
              pendingTimeBlock
                ? "default"
                : "destructive"
            }
            onClick={() => void handleStop()}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            {isSaving
              ? "Saving..."
              : pendingTimeBlock
                ? "Retry save"
                : "Stop"}
          </Button>
        )}
      </div>

      {saveResult && (
        <p
          role={
            saveResult.status === "error"
              ? "alert"
              : "status"
          }
          className={
            saveResult.status === "error"
              ? "text-destructive text-center text-sm"
              : "text-center text-sm text-emerald-600 dark:text-emerald-400"
          }
        >
          {saveResult.message}
        </p>
      )}
    </div>
  );
}