import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-slate-600 dark:text-slate-300 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <p>© {year} Cedar Valley School District.</p>
        <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.08em]">
          <Link className="text-oxford-700 hover:underline dark:text-slate-100" href="/site/terms">
            Terms of Service
          </Link>
          <Link className="text-oxford-700 hover:underline dark:text-slate-100" href="/site/privacy">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
