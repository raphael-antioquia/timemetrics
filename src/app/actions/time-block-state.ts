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

export type ActionResult =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };

export type CreateTimeBlockResult = ActionResult;