"use client";

import { useState, type FormEvent } from "react";
import { createManualTimeBlock } from "@/app/actions/time-blocks";
import type { CreateTimeBlockResult } from "@/app/actions/time-block-state";

type Activity = {
  id: string;
  name: string;
};

type ManualTimeBlockFormProps = {
  activities: Activity[];
};

export function ManualTimeBlockForm({
  activities,
}: ManualTimeBlockFormProps) {
  const [activityId, setActivityId] = useState("");
  const [startedAtLocal, setStartedAtLocal] = useState("");
  const [endedAtLocal, setEndedAtLocal] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [result, setResult] =
    useState<CreateTimeBlockResult | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setResult(null);

    const startedAt = new Date(startedAtLocal);
    const endedAt = new Date(endedAtLocal);

    if (
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(endedAt.getTime())
    ) {
      setResult({
        status: "error",
        message: "Please enter valid start and end times.",
      });

      return;
    }

    setIsSaving(true);

    try {
      const actionResult = await createManualTimeBlock({
        activityId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      });

      setResult(actionResult);

      if (actionResult.status === "success") {
        setStartedAtLocal("");
        setEndedAtLocal("");
      }
    } catch {
      setResult({
        status: "error",
        message:
          "We couldn't save this time session. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  const hasActivities = activities.length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div>
        <label
          htmlFor="manual-activity"
          className="mb-1 block text-sm font-medium"
        >
          Activity
        </label>

        <select
          id="manual-activity"
          value={activityId}
          onChange={(event) =>
            setActivityId(event.target.value)
          }
          required
          disabled={!hasActivities || isSaving}
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
      </div>

      <div>
        <label
          htmlFor="manual-started-at"
          className="mb-1 block text-sm font-medium"
        >
          Started at
        </label>

        <div className="flex w-full min-w-0 rounded-md border px-3 py-2">
          <input
            id="manual-started-at"
            type="datetime-local"
            value={startedAtLocal}
            onChange={(event) =>
              setStartedAtLocal(event.target.value)
            }
            required
            disabled={isSaving}
            className="block w-full min-w-0 border-0 bg-transparent p-0"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="manual-ended-at"
          className="mb-1 block text-sm font-medium"
        >
          Ended at
        </label>

        <div className="flex w-full min-w-0 rounded-md border px-3 py-2">
          <input
            id="manual-ended-at"
            type="datetime-local"
            value={endedAtLocal}
            onChange={(event) =>
              setEndedAtLocal(event.target.value)
            }
            required
            disabled={isSaving}
            className="block w-full min-w-0 border-0 bg-transparent p-0"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={
          !hasActivities ||
          !activityId ||
          !startedAtLocal ||
          !endedAtLocal ||
          isSaving
        }
        className="rounded-md bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save time entry"}
      </button>

      {!hasActivities && (
        <p className="text-sm text-gray-600">
          Create an activity before logging time.
        </p>
      )}

      {result && (
        <p
          role={
            result.status === "error"
              ? "alert"
              : "status"
          }
          className={
            result.status === "error"
              ? "text-sm text-red-600"
              : "text-sm text-green-600"
          }
        >
          {result.message}
        </p>
      )}
    </form>
  );
}