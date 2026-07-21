export type CreateTimeBlockInput = {
  activityId: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
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