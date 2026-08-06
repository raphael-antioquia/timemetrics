"use client";

import { useState, useTransition } from "react";
import { deleteTimeBlock } from "@/app/actions/time-blocks";
import { Button } from "@/components/ui/button";

type DeleteTimeBlockButtonProps = {
  timeBlockId: string;
};

export function DeleteTimeBlockButton({
  timeBlockId,
}: DeleteTimeBlockButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const errorId = `delete-time-block-error-${timeBlockId}`;

  function handleDelete() {
    const confirmed = window.confirm(
      "Delete this time session? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const result = await deleteTimeBlock(timeBlockId);

        if (result.status === "error") {
          setErrorMessage(result.message);
        }
      } catch {
        setErrorMessage(
          "We couldn't reach the server. Please try again.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        aria-describedby={
          errorMessage ? errorId : undefined
        }
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {isPending ? "Deleting..." : "Delete"}
      </Button>

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