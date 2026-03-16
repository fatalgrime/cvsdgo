"use client";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-xl panel-strong p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-deepforest-700">Service Alert</p>
        <h1 className="mt-3 font-serif text-3xl text-oxford-700 md:text-4xl">CVSD Go is currently unavailable</h1>
        <p className="mt-3 text-sm text-slate-600">
          We are working to restore service. You can check current status updates below.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://status.cvsd.live"
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
          >
            Check Status Updates
          </a>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300"
          >
            Try Again
          </button>
        </div>
      </div>
    </main>
  );
}
