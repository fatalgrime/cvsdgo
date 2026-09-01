"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RedirectRow } from "@/lib/types";
import { QrCodeDialog } from "@/components/qr-code-dialog";

type LinkDashboardProps = {
  links: RedirectRow[];
};

export function LinkDashboard({ links }: LinkDashboardProps) {
  const router = useRouter();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isDirectoryUpdated, setIsDirectoryUpdated] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 60_000);

    const handleRefreshEvent = () => {
      router.refresh();
      setIsDirectoryUpdated(true);
      window.setTimeout(() => setIsDirectoryUpdated(false), 1800);
    };

    window.addEventListener("cvsdgo:refresh-directory", handleRefreshEvent);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("cvsdgo");
      channel.addEventListener("message", (event) => {
        if (event.data === "refresh-directory") {
          handleRefreshEvent();
        }
      });
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener("cvsdgo:refresh-directory", handleRefreshEvent);
      if (channel) {
        channel.close();
      }
    };
  }, [router]);

  const groupedLinks = useMemo(() => {
    const groups = new Map<string, { title: string; links: RedirectRow[]; folderSortOrder?: number | null }>();
    for (const link of links) {
      const key = link.folder_id ? `folder:${link.folder_id}` : "folder:none";
      if (!groups.has(key)) {
        groups.set(key, {
          title: link.folder_name?.trim() ? link.folder_name : "General",
          links: [],
          folderSortOrder: link.folder_sort_order ?? null,
        });
      }
      groups.get(key)?.links.push(link);
    }
    const hasPolicyText = (link: RedirectRow) => {
      const text = `${link.slug} ${link.description ?? ""} ${link.url}`.toLowerCase();
      return text.includes("policy") || text.includes("policies");
    };

    return Array.from(groups.values())
      .map((group) => {
        const sorted = [...group.links].sort((a, b) => a.slug.localeCompare(b.slug));
        if (group.title.toLowerCase() === "general") {
          sorted.sort((a, b) => {
            const aIsPolicy = hasPolicyText(a) ? 0 : 1;
            const bIsPolicy = hasPolicyText(b) ? 0 : 1;
            if (aIsPolicy !== bIsPolicy) return aIsPolicy - bIsPolicy;
            return a.slug.localeCompare(b.slug);
          });
        }
        return { ...group, links: sorted };
      })
      .sort((a, b) => {
        const aSort = a.folderSortOrder ?? -1;
        const bSort = b.folderSortOrder ?? -1;
        if (aSort !== bSort) return aSort - bSort;
        if (a.title.toLowerCase() === "general") return -1;
        if (b.title.toLowerCase() === "general") return 1;
        return a.title.localeCompare(b.title);
      });
  }, [links]);

  async function handleCopy(slug: string) {
    const shortLink = `https://go.cvsd.live/${slug}`;
    await navigator.clipboard.writeText(shortLink);
    setCopiedSlug(slug);

    setTimeout(() => {
      setCopiedSlug((current) => (current === slug ? null : current));
    }, 1400);
  }

  return (
    <section className="w-full pb-6">
      <div className="space-y-10">
        {groupedLinks.map((group) => (
          <section key={group.title} className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200/80 pb-2.5 dark:border-slate-800/80">
              <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-deepforest-700 dark:text-deepforest-400">
                {group.title}
              </h2>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                {group.links.length}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {group.links.map((link) => {
                const shortName = `go.cvsd.live/${link.slug}`;
                return (
                  <article
                    key={link.id}
                    className="group relative flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-oxford-300 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/80 dark:hover:border-slate-700"
                  >
                    <div>
                      {/* Top Bar: Short URL slug pill + LOCKED status indicator */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100/90 px-2.5 py-1 font-mono text-[11px] font-bold text-oxford-700 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200">
                          {shortName}
                        </span>

                        {link.is_locked && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0110 0v4" />
                            </svg>
                            LOCKED
                          </span>
                        )}
                      </div>

                      {/* Main Link Title */}
                      <h3 className="mt-3.5 line-clamp-2 text-base font-bold text-oxford-700 dark:text-slate-100 leading-snug">
                        {link.description || link.url}
                      </h3>
                    </div>

                    {/* Uniform Action Bar (Open, Copy, QR Code) */}
                    <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800/80">
                      <Link
                        href={`/${link.slug}`}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-oxford-700 px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-oxford-600 focus:outline-none focus:ring-2 focus:ring-oxford-700 focus:ring-offset-2 dark:bg-oxford-600 dark:hover:bg-oxford-500"
                      >
                        <span>Open</span>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>

                      <button
                        onClick={() => handleCopy(link.slug)}
                        type="button"
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-oxford-700 shadow-sm transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300"
                        title={copiedSlug === link.slug ? "Copied to clipboard" : "Copy short link"}
                      >
                        {copiedSlug === link.slug ? (
                          <>
                            <svg className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <QrCodeDialog slug={link.slug} description={link.description ?? undefined} url={link.url} />
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {links.length === 0 && (
        <div className="panel mt-8 p-8 text-center">
          <p className="text-lg font-semibold text-oxford-700 dark:text-slate-100">No public links are available.</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Check that links are assigned to public folders or have no folder selected.</p>
        </div>
      )}

      {isDirectoryUpdated && (
        <div className="fixed bottom-6 right-6 z-50 rounded-full border border-oxford-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 shadow-lg shadow-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          Directory updated
        </div>
      )}
    </section>
  );
}
