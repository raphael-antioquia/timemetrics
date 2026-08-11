"use client";

import { useState, type FormEvent } from "react";

import { createManualTimeBlock } from "@/app/actions/time-blocks";
import type { CreateTimeBlockResult } from "@/app/actions/time-block-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  parseDateTimeLocal,
} from "@/lib/time/format-datetime-local";

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
  const [activityId, setActivityId] =
    useState<string | null>(null);

  const [startedAtLocal, setStartedAtLocal] =
    useState("");

  const [endedAtLocal, setEndedAtLocal] =
    useState("");

  const [isSaving, setIsSaving] = useState(false);

  const [result, setResult] =
    useState<CreateTimeBlockResult | null>(null);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setResult(null);

    if (!activityId) {
      setResult({
        status: "error",
        message: "Please select an activity.",
      });

      return;
    }

    const startedAt =
      parseDateTimeLocal(startedAtLocal);

    const endedAt =
      parseDateTimeLocal(endedAtLocal);

    if (!startedAt || !endedAt) {
      setResult({
        status: "error",
        message:
          "Please enter valid start and end times.",
      });

      return;
    }

    if (endedAt.getTime() <= startedAt.getTime()) {
      setResult({
        status: "error",
        message:
          "The session end must be after its start.",
      });

      return;
    }

    setIsSaving(true);

    try {
      const actionResult =
        await createManualTimeBlock({
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

  const activityOptions = activities.map((activity) => ({
    value: activity.id,
    label: activity.name,
  }));

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isSaving}
      className="space-y-5"
    >
      <div className="space-y-2">
        <Label htmlFor="manual-activity">
          Activity
        </Label>

        <Select
          items={activityOptions}
          value={activityId}
          onValueChange={setActivityId}
          disabled={!hasActivities || isSaving}
        >
          <SelectTrigger
            id="manual-activity"
            className="w-full"
            aria-required="true"
            aria-describedby={
              !hasActivities
                ? "manual-activity-help"
                : undefined
            }
          >
            <SelectValue placeholder="Select an activity" />
          </SelectTrigger>

          <SelectContent>
            {activityOptions.map((activity) => (
              <SelectItem
                key={activity.value}
                value={activity.value}
              >
                {activity.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!hasActivities && (
          <p
            id="manual-activity-help"
            className="text-muted-foreground text-sm"
          >
            Create an activity before logging time.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="manual-started-at">
            Started at
          </Label>

          <Input
            id="manual-started-at"
            type="datetime-local"
            value={startedAtLocal}
            onChange={(event) =>
              setStartedAtLocal(event.target.value)
            }
            required
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="manual-ended-at">
            Ended at
          </Label>

          <Input
            id="manual-ended-at"
            type="datetime-local"
            value={endedAtLocal}
            onChange={(event) =>
              setEndedAtLocal(event.target.value)
            }
            required
            disabled={isSaving}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={
          !hasActivities ||
          !activityId ||
          !startedAtLocal ||
          !endedAtLocal ||
          isSaving
        }
        className="w-full sm:w-auto"
      >
        {isSaving ? "Saving..." : "Save time entry"}
      </Button>

      {result && (
        <p
          role={
            result.status === "error"
              ? "alert"
              : "status"
          }
          className={
            result.status === "error"
              ? "text-destructive text-sm"
              : "text-sm text-emerald-600 dark:text-emerald-400"
          }
        >
          {result.message}
        </p>
      )}
    </form>
  );
}