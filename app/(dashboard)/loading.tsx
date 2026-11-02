export default function Loading() {
  return (
    <section className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="panel-strong p-5 md:p-6">
        <div className="h-3 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>

      <p className="sr-only">Loading the link directory…</p>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="panel h-36 animate-pulse p-5">
            <div className="h-4 w-36 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="mt-8 h-9 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </section>
  );
}
