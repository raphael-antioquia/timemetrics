import type { Database } from "@/lib/supabase/database.types";

type GeneratedDailyActivityTotalRow =
  Database["public"]["Functions"]["get_daily_activity_totals"]["Returns"][number];

// PostgreSQL RETURNS TABLE metadata does not preserve the nullability
// of these output columns for generated TypeScript types.
// activity_id can be null after an activity is deleted.
// activity_name can be null because the RPC uses a LEFT JOIN.
export type DailyActivityTotalRow = Omit<
  GeneratedDailyActivityTotalRow,
  "activity_id" | "activity_name"
> & {
  activity_id: string | null;
  activity_name: string | null;
};

export type AnalyticsSummary = {
  totalSeconds: number;
  sessionCount: number;
  activeDays: number;
};

export type DailyBreakdown = {
  date: string;
  totalSeconds: number;
  sessionCount: number;
};

export type ActivityBreakdown = {
  activityId: string | null;
  activityName: string;
  totalSeconds: number;
  sessionCount: number;
};

export type RangeAnalytics = {
  startDate: string;
  endDate: string;
  summary: AnalyticsSummary;
  days: DailyBreakdown[];
  activities: ActivityBreakdown[];
};