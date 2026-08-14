import type { ActionResult } from "@/app/actions/action-result";

export type CreateTimeBlockInput = {
  activityId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type CreateManualTimeBlockInput = {
  activityId: string;
  startedAt: string;
  endedAt: string;
};


export type UpdateTimeBlockInput = {
  timeBlockId: string;
  activityId: string;
  startedAt: string;
  endedAt: string;
};

export type CreateTimeBlockResult = ActionResult;