"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RedirectRow } from "@/lib/types";
import { DirectoryLinkCard } from "@/components/directory-link-card";

type LinkDashboardProps = {
  links: RedirectRow[];
};

export function LinkDashboard({ links }: LinkDashboardProps) {
  const router = useRouter();
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [isDirectoryUpdated, setIsDirectoryUpdated] = useState(false);

  useEffect(() => {
    const handleRefreshEvent = () => {
      router.refresh();
      setIsDirectoryUpdated(true);
      window.setTimeout(() => setIsDirectoryUpdated(false), 1800);
    };

    window.addEventListener("cvsdgo:refresh-directory", handleRefreshEvent);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

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
      window.removeEventListener("cvsdgo:refresh-directory", handleRefreshEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
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
              {group.links.map((link) => (
                <DirectoryLinkCard key={link.id} link={link} copied={copiedSlug === link.slug} onCopy={handleCopy} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {links.length === 0 && (
        <div className="panel mt-8 p-8 text-center" role="status">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.15" />
            </svg>
          </div>
          <p className="mt-4 text-lg font-semibold text-oxford-700 dark:text-slate-100">No public links to show</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            The directory may be temporarily empty, or its links may not be published to a public folder. Please check back later or contact district support if you need help finding a resource.
          </p>
        </div>
      )}

      {isDirectoryUpdated && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50 rounded-full border border-oxford-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 shadow-lg shadow-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          Directory updated
        </div>
      )}
    </section>
  );
}
