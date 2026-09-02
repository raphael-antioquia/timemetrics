"use client";

import {
  useId,
  useState,
  type FormEvent,
} from "react";
import { Pencil } from "lucide-react";

import { updateTimeBlock } from "@/app/actions/time-blocks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  formatDateTimeLocal,
  parseDateTimeLocal,
} from "@/lib/time/format-datetime-local";
import type { TimeBlockListItem } from "@/lib/time/time-block-types";

type Activity = {
  id: string;
  name: string;
};

type EditTimeBlockDialogProps = {
  timeBlock: TimeBlockListItem;
  activities: Activity[];
  hasActivitiesError: boolean;
};

export function EditTimeBlockDialog({
  timeBlock,
  activities,
  hasActivitiesError,
}: EditTimeBlockDialogProps) {
  const fieldId = useId();

  const activityFieldId = `${fieldId}-activity`;
  const activityHelpId = `${fieldId}-activity-help`;
  const startedFieldId = `${fieldId}-started`;
  const endedFieldId = `${fieldId}-ended`;
  const errorId = `${fieldId}-error`;

  const [open, setOpen] = useState(false);

  const [activityId, setActivityId] =
    useState<string | null>(null);

  const [startedAtLocal, setStartedAtLocal] =
    useState("");

  const [endedAtLocal, setEndedAtLocal] =
    useState("");

  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const hasActivities = activities.length > 0;

  const activityOptions = activities.map((activity) => ({
    value: activity.id,
    label: activity.name,
  }));

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) {
      return;
    }

    if (nextOpen) {
      setActivityId(
        timeBlock.activity?.id ?? null,
      );

      setStartedAtLocal(
        formatDateTimeLocal(timeBlock.started_at),
      );

      setEndedAtLocal(
        formatDateTimeLocal(timeBlock.ended_at),
      );

      setErrorMessage(null);
    }

    setOpen(nextOpen);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setErrorMessage(null);

    if (!activityId) {
      setErrorMessage(
        "Please select an activity.",
      );

      return;
    }

    const originalStartedAtLocal =
      formatDateTimeLocal(timeBlock.started_at);

    const originalEndedAtLocal =
      formatDateTimeLocal(timeBlock.ended_at);

    const startedAt =
      startedAtLocal === originalStartedAtLocal
        ? new Date(timeBlock.started_at)
        : parseDateTimeLocal(startedAtLocal);

    const endedAt =
      endedAtLocal === originalEndedAtLocal
        ? new Date(timeBlock.ended_at)
        : parseDateTimeLocal(endedAtLocal);

    if (!startedAt || !endedAt) {
      setErrorMessage(
        "Please enter valid start and end times.",
      );

      return;
    }

    if (
      endedAt.getTime() <= startedAt.getTime()
    ) {
      setErrorMessage(
        "The session end must be after its start.",
      );

      return;
    }

    setIsSaving(true);

    try {
      const result = await updateTimeBlock({
        timeBlockId: timeBlock.id,
        activityId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
      });

      if (result.status === "error") {
        setErrorMessage(result.message);

        return;
      }

      setOpen(false);
    } catch {
      setErrorMessage(
        "We couldn't update this time session. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={hasActivitiesError}
          />
        }
      >
        <Pencil />
        Edit
      </DialogTrigger>

      <DialogContent
        showCloseButton={!isSaving}
      >
        <DialogHeader>
          <DialogTitle>
            Edit time session
          </DialogTitle>

          <DialogDescription>
            Update the activity or time range for
            this session.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor={activityFieldId}>
              Activity
            </Label>

            <Select
              items={activityOptions}
              value={activityId}
              onValueChange={setActivityId}
              disabled={
                !hasActivities || isSaving
              }
            >
              <SelectTrigger
                id={activityFieldId}
                className="w-full"
                aria-required="true"
                aria-describedby={
                  !hasActivities
                    ? activityHelpId
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
                id={activityHelpId}
                className="text-muted-foreground text-sm"
              >
                Create an activity before editing
                this session.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={startedFieldId}>
                Started at
              </Label>

              <Input
                id={startedFieldId}
                type="datetime-local"
                step="1"
                value={startedAtLocal}
                onChange={(event) =>
                  setStartedAtLocal(
                    event.target.value,
                  )
                }
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={endedFieldId}>
                Ended at
              </Label>

              <Input
                id={endedFieldId}
                type="datetime-local"
                step="1"
                value={endedAtLocal}
                onChange={(event) =>
                  setEndedAtLocal(
                    event.target.value,
                  )
                }
                required
                disabled={isSaving}
              />
            </div>
          </div>

          {errorMessage && (
            <p
              id={errorId}
              role="alert"
              className="text-destructive text-sm"
            >
              {errorMessage}
            </p>
          )}

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                />
              }
            >
              Cancel
            </DialogClose>

            <Button
              type="submit"
              disabled={
                !hasActivities ||
                !activityId ||
                !startedAtLocal ||
                !endedAtLocal ||
                isSaving
              }
            >
              {isSaving
                ? "Saving..."
                : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}