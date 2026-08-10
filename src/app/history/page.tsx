import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TimeBlockHistory } from "@/components/time-blocks/time-block-history";
import { createClient } from "@/lib/supabase/server";
import { getUserTimezone } from "@/lib/time/get-user-timezone";

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [
    { data: timeBlocks, error: timeBlocksError },
    timezone,
  ] = await Promise.all([
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
      .limit(100),

    getUserTimezone(user.id),
  ]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="space-y-4">
          <Link
            href="/"
            className="text-muted-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-foreground"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-4"
            />
            Back to dashboard
          </Link>

          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Time history
            </h1>

            <p className="text-muted-foreground mt-2">
              Review your recent focused work by day.
            </p>
          </div>
        </header>

        <section className="mt-8">
          <TimeBlockHistory
            timeBlocks={timeBlocks ?? []}
            hasError={timeBlocksError !== null}
            timezone={timezone}
          />
        </section>
      </div>
    </main>
  );
}