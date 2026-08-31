import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityList } from "@/components/activities/activity-list";
import { CreateActivityForm } from "@/components/activities/create-activity-form";
import { ManualTimeBlockForm } from "@/components/time-blocks/manual-time-block-form";
import { RecentTimeBlockList } from "@/components/time-blocks/recent-time-block-list";
import { ActivityTimer } from "@/components/timer/activity-timer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/time/format-duration";
import { getUserTimezone } from "@/lib/time/get-user-timezone";
import { TimezoneInitializer } from "@/components/timezone-initializer";
import { SignOutForm } from "@/components/auth/sign-out-form";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const timezone = await getUserTimezone(user.id);
  
  const [
    { data: activities, error: activitiesError },
    { data: timeBlocks, error: timeBlocksError },
    {
      data: todayTimeBlocks,
      error: todayTimeBlocksError,
    },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),

    supabase
      .from("time_blocks")
      .select(`
        id,
        started_at,
        ended_at,
        duration_seconds,
        activity:activities (
          id,
          name
        )
      `)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20),

    supabase.rpc("time_blocks_for_today", {
      p_tz: timezone,
    }),
  ]);

  const activityList = activities ?? [];
  const timeBlockList = timeBlocks ?? [];

  const todayTotalSeconds =
    todayTimeBlocks?.reduce(
      (total, timeBlock) =>
        total + timeBlock.duration_seconds,
      0,
    ) ?? 0;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {timezone === "UTC" && <TimezoneInitializer />}
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
                TimeMetrics
              </p>

              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Track your time
              </h1>

              <p className="text-muted-foreground mt-2">
                Track focused sessions and review your recent work.
              </p>
            </div>

            {todayTimeBlocksError !== null ? (
              <p
                role="alert"
                className="text-destructive text-sm"
              >
                We couldn&apos;t load today&apos;s total.
              </p>
            ) : (
              <p className="text-sm">
                <span className="text-muted-foreground">
                  Today&apos;s total:
                </span>{" "}
                <span className="font-mono font-medium tabular-nums">
                  {formatDuration(todayTotalSeconds)}
                </span>
              </p>
            )}

            <p className="text-muted-foreground text-sm">
              Signed in as {user.email}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/history"
              className="text-muted-foreground text-sm font-medium transition-colors hover:text-foreground"
            >
              View history
            </Link>

            <Link
              href="/analytics"
              className="text-muted-foreground text-sm font-medium transition-colors hover:text-foreground"
            >
              View analytics
            </Link>

            <SignOutForm />
          </div>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Focus timer
              </CardTitle>

              <CardDescription>
                Track a focused work session.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ActivityTimer activities={activityList} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Manual entry
              </CardTitle>

              <CardDescription>
                Log time you tracked outside the timer.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ManualTimeBlockForm
                activities={activityList}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Activities
              </CardTitle>

              <CardDescription>
                Create and manage what you track.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <CreateActivityForm />

              <div className="border-t pt-4">
                <ActivityList
                  activities={activityList}
                  hasError={activitiesError !== null}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Recent sessions
              </CardTitle>

              <CardDescription>
                Your latest tracked time.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <RecentTimeBlockList
                timeBlocks={timeBlockList}
                activities={activityList}
                hasError={timeBlocksError !== null}
                timezone={timezone}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}