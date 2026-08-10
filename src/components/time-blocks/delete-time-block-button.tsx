"use client";

import { useState, useTransition } from "react";

import { deleteTimeBlock } from "@/app/actions/time-blocks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeleteTimeBlockButtonProps = {
  timeBlockId: string;
};

export function DeleteTimeBlockButton({
  timeBlockId,
}: DeleteTimeBlockButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] =
    useTransition();
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const errorId = `delete-time-block-error-${timeBlockId}`;

  function handleConfirm() {
    setOpen(false);

    startTransition(async () => {
      try {
        const result =
          await deleteTimeBlock(timeBlockId);

        if (result.status === "error") {
          setErrorMessage(result.message);
        }
      } catch {
        setErrorMessage(
          "Couldn't delete. Try again.",
        );
      }
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setErrorMessage(null);
    }

    setOpen(nextOpen);
  }

  return (
    <div>
      <AlertDialog
        open={open}
        onOpenChange={handleOpenChange}
      >
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              aria-describedby={
                errorMessage ? errorId : undefined
              }
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            />
          }
        >
          {isPending ? "Deleting..." : "Delete"}
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this time session?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirm}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          className="text-destructive mt-1 max-w-48 text-right text-xs"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}