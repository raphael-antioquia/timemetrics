import { redirect } from "next/navigation";
import { ActivityList } from "@/components/activities/activity-list";
import { CreateActivityForm } from "@/components/activities/create-activity-form";
import { TimeBlockList } from "@/components/time-blocks/time-block-list";
import { ActivityTimer } from "@/components/timer/activity-timer";
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
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            TimeMetrics
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight">
            Track your time
          </h1>

          <p className="mt-3 text-muted-foreground">
            Track focused sessions and review your recent work.
          </p>

          <p className="mt-4 text-sm text-gray-600">
            Signed in as {user.email}
          </p>
        </header>

        <section className="mt-8 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            Track time
          </h2>

          <ActivityTimer activities={activityList} />
        </section>

        <section className="mt-8 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            Create an activity
          </h2>

          <CreateActivityForm />
        </section>

        <section className="mt-6 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            Your activities
          </h2>

          <ActivityList
            activities={activityList}
            hasError={activitiesError !== null}
          />
        </section>

        <section className="mt-6 rounded-lg border p-4">
          <h2 className="text-lg font-medium">
            Today&apos;s total
          </h2>

          {todayTimeBlocksError !== null ? (
            <p
              role="alert"
              className="mt-3 text-sm text-red-600"
            >
              We couldn&apos;t load today&apos;s total.
            </p>
          ) : (
            <p className="mt-3 font-mono text-3xl font-semibold tabular-nums">
              {formatDuration(todayTotalSeconds)}
            </p>
          )}
        </section>

        <section className="mt-6 rounded-lg border p-4">
          <h2 className="mb-4 text-lg font-medium">
            Recent sessions
          </h2>

          <TimeBlockList
            timeBlocks={timeBlockList}
            hasError={timeBlocksError !== null}
          />
        </section>
      </div>
    </main>
  );
}