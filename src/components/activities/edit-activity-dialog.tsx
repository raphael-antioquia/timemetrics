"use client";

import {
  useId,
  useState,
  type FormEvent,
} from "react";
import { Pencil } from "lucide-react";

import { updateActivity } from "@/app/actions/activities";
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

type EditActivityDialogProps = {
  activityId: string;
  activityName: string;
};

export function EditActivityDialog({
  activityId,
  activityName,
}: EditActivityDialogProps) {
  const fieldId = useId();

  const nameFieldId = `${fieldId}-name`;
  const errorId = `${fieldId}-error`;

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const trimmedName = name.trim();

  const isUnchanged =
    trimmedName === activityName.trim();

  const canSave =
    trimmedName.length > 0 &&
    trimmedName.length <= 100 &&
    !isUnchanged &&
    !isSaving;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSaving) {
      return;
    }

    if (nextOpen) {
      // Reset from the latest prop each time because this
      // component stays mounted after activity revalidation.
      setName(activityName);
      setErrorMessage(null);
    }

    setOpen(nextOpen);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!canSave) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const result = await updateActivity({
        activityId,
        name: trimmedName,
      });

      if (result.status === "error") {
        setErrorMessage(result.message);

        return;
      }

      setOpen(false);
    } catch {
      setErrorMessage(
        "We couldn't update the activity. Please try again.",
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
            Edit activity
          </DialogTitle>

          <DialogDescription>
            Change the name of this activity.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor={nameFieldId}>
              Name
            </Label>

            <Input
              id={nameFieldId}
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={100}
              autoComplete="off"
              required
              disabled={isSaving}
              aria-invalid={
                errorMessage ? true : undefined
              }
              aria-describedby={
                errorMessage ? errorId : undefined
              }
            />
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
              disabled={!canSave}
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