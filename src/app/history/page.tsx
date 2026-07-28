import Link from "next/link";
import { redirect } from "next/navigation";
import { TimeBlockHistory } from "@/components/time-blocks/time-block-history";
import { createClient } from "@/lib/supabase/server";

export default async function HistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const {
    data: timeBlocks,
    error: timeBlocksError,
  } = await supabase
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
    .limit(100);

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Back to dashboard
          </Link>

          <h1 className="mt-4 text-4xl font-bold tracking-tight">
            Time history
          </h1>

          <p className="mt-3 text-muted-foreground">
            Review your recent focused work by day.
          </p>
        </header>

        <section className="mt-8">
          <TimeBlockHistory
            timeBlocks={timeBlocks ?? []}
            hasError={timeBlocksError !== null}
          />
        </section>
      </div>
    </main>
  );
}