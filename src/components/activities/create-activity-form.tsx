"use client";

import { useActionState } from "react";
import { createActivity } from "@/app/actions/activities";
import { initialCreateActivityState } from "@/app/actions/activity-state";

export function CreateActivityForm() {
  const [state, formAction, isPending] = useActionState(
    createActivity,
    initialCreateActivityState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="activity-name" className="block text-sm font-medium">
          Activity name
        </label>

        <input
          key={state.status === "success" ? "reset" : "active"}
          id="activity-name"
          name="name"
          type="text"
          defaultValue=""
          maxLength={100}
          required
          disabled={isPending}
          placeholder="e.g. TimeMetrics development"
          className="w-full rounded-md border px-3 py-2 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create activity"}
      </button>

      {state.status !== "idle" && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error" ? "text-sm text-red-600" : "text-sm text-green-600"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}