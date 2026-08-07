import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityList } from "@/components/activities/activity-list";
import { CreateActivityForm } from "@/components/activities/create-activity-form";
import { ManualTimeBlockForm } from "@/components/time-blocks/manual-time-block-form";
import { TimeBlockList } from "@/components/time-blocks/time-block-list";
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

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // TODO(#2): Calculate day boundaries using the user's timezone.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

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
          name
        )
      `)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20),

    supabase
      .from("time_blocks")
      .select("duration_seconds")
      .eq("user_id", user.id)
      .gte("started_at", startOfToday.toISOString())
      .lt("started_at", startOfTomorrow.toISOString()),
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

          <Link
            href="/history"
            className="text-muted-foreground shrink-0 text-sm font-medium transition-colors hover:text-foreground"
          >
            View history
          </Link>
        </header>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Focus timer</h2>
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
                <h2>Manual entry</h2>
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
                <h2>Activities</h2>
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
                <h2>Recent sessions</h2>
              </CardTitle>

              <CardDescription>
                Your latest tracked time.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <TimeBlockList
                timeBlocks={timeBlockList}
                hasError={timeBlocksError !== null}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}