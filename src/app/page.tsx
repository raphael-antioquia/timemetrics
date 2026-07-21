import { redirect } from "next/navigation";
import { CreateActivityForm } from "@/components/activities/create-activity-form";
import { ActivityList } from "@/components/activities/activity-list";
import { ActivityTimer } from "@/components/timer/activity-timer";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: activities, error: activitiesError } = await supabase
    .from("activities")
    .select("id, name")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  const activityList = activities ?? [];

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            TimeMetrics
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight">
            Activities
          </h1>

          <p className="mt-3 text-muted-foreground">
            Create and manage the activities you want to track.
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
      </div>
    </main>
  );
}