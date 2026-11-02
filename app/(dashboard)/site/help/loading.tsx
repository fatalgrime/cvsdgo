export default function HelpLoading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading help and usage guidance…</p>
      <div className="panel-strong p-6 md:p-8" aria-hidden="true">
        <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-9 w-64 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
      <div className="panel h-56 animate-pulse p-6" aria-hidden="true">
        <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    </section>
  );
}
