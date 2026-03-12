import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white/90">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-slate-600 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <p>© {year} Cedar Valley School District.</p>
        <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.08em]">
          <Link className="text-oxford-700 hover:underline" href="/terms-of-service">
            Terms of Service
          </Link>
          <Link className="text-oxford-700 hover:underline" href="/privacy-policy">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
