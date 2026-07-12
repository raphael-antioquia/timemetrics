export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <section className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          TimeMetrics
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Track your time. Understand your patterns.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          A personal productivity app for logging focused work sessions,
          reviewing daily history, and understanding where your time actually
          goes.
        </p>

        <div className="mt-8 flex gap-4">
          <button className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
            Start tracking
          </button>

          <button className="rounded-md border px-4 py-2 text-sm font-medium">
            View demo
          </button>
        </div>
      </section>
    </main>
  );
}