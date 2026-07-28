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

export type CreateTimeBlockResult =
  | {
      status: "success";
      message: string;
    }
  | {
      status: "error";
      message: string;
    };