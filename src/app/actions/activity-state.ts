export type CreateActivityState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialCreateActivityState = {
  status: "idle",
  message: "",
} satisfies CreateActivityState;