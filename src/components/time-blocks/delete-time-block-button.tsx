"use client";

import { useState, useTransition } from "react";
import { deleteTimeBlock } from "@/app/actions/time-blocks";

type DeleteTimeBlockButtonProps = {
  timeBlockId: string;
};

export function DeleteTimeBlockButton({
  timeBlockId,
}: DeleteTimeBlockButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );

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
    <div className="text-right">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-1 max-w-48 text-xs text-red-600"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}