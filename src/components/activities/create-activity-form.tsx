"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { createActivity } from "@/app/actions/activities";
import { initialCreateActivityState } from "@/app/actions/activity-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateActivityForm() {
  const [state, formAction, isPending] = useActionState(
    createActivity,
    initialCreateActivityState,
  );

  const [name, setName] = useState("");
  const wasPendingRef = useRef(false);
  const feedbackId = useId();

  useEffect(() => {
    const submissionFinished = wasPendingRef.current && !isPending;

    if (submissionFinished && state.status === "success") {
      setName("");
    }

    wasPendingRef.current = isPending;
  }, [isPending, state.status]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="activity-name">Activity name</Label>

        <Input
          id="activity-name"
          name="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          required
          disabled={isPending}
          placeholder="e.g. TimeMetrics development"
          aria-invalid={state.status === "error"}
          aria-describedby={
            state.status !== "idle" ? feedbackId : undefined
          }
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create activity"}
      </Button>

      {state.status !== "idle" && (
        <p
          id={feedbackId}
          role={state.status === "error" ? "alert" : "status"}
          className={
            state.status === "error"
              ? "text-destructive text-sm"
              : "text-sm text-emerald-600"
          }
        >
          {state.message}
        </p>
      )}
    </form>
  );
}