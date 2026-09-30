"use client";

import Link from "next/link";
import type { RedirectRow } from "@/lib/types";
import { LazyQrCodeDialog } from "@/components/lazy-qr-code-dialog";

type DirectoryLinkCardProps = {
  link: RedirectRow;
  copied: boolean;
  onCopy: (slug: string) => void;
};

export function DirectoryLinkCard({ link, copied, onCopy }: DirectoryLinkCardProps) {
  const shortName = `go.cvsd.live/${link.slug}`;

  return (
    <article className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-oxford-300 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/80 dark:hover:border-slate-700">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-slate-100/90 px-2 py-1 font-mono text-[11px] font-bold text-oxford-700 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200" title={shortName}>
            {shortName}
          </span>
          {link.is_locked && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Locked
            </span>
          )}
        </div>
        <h3 className="mt-3.5 line-clamp-2 text-base font-bold leading-snug text-oxford-700 dark:text-slate-100">
          {link.description || link.url}
        </h3>
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/80">
        <Link
          href={`/${link.slug}`}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-oxford-700 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-oxford-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-700 focus-visible:ring-offset-2 dark:bg-oxford-600 dark:hover:bg-oxford-500"
        >
          Open
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </Link>
        <button
          onClick={() => onCopy(link.slug)}
          type="button"
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-semibold text-oxford-700 shadow-sm transition hover:border-oxford-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          aria-label={`${copied ? "Copied" : "Copy"} ${shortName}`}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <LazyQrCodeDialog slug={link.slug} description={link.description ?? undefined} url={link.url} />
      </div>
    </article>
  );
}

