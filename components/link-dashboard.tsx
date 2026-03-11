"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { RedirectRow } from "@/lib/types";

type LinkDashboardProps = {
  links: RedirectRow[];
};

export function LinkDashboard({ links }: LinkDashboardProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);

  const filteredLinks = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    if (!normalizedQuery) return links;

    return links.filter((link) => {
      const slug = `go/${link.slug}`.toLowerCase();
      const description = (link.description ?? "").toLowerCase();
      const url = link.url.toLowerCase();

      return (
        slug.includes(normalizedQuery) ||
        description.includes(normalizedQuery) ||
        url.includes(normalizedQuery)
      );
    });
  }, [links, deferredQuery]);

  const groupedLinks = useMemo(() => {
    const groups = new Map<string, { title: string; links: RedirectRow[] }>();
    for (const link of filteredLinks) {
      const key = link.folder_id ? `folder:${link.folder_id}` : "folder:none";
      if (!groups.has(key)) {
        groups.set(key, {
          title: link.folder_name?.trim() ? link.folder_name : "General",
          links: [],
        });
      }
      groups.get(key)?.links.push(link);
    }
    return Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredLinks]);

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
      <div className="panel mb-5 p-3 md:p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search shortcut, destination, or keyword..."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-oxford-700 outline-none transition placeholder:text-slate-500 focus:border-oxford-700 focus:ring-2 focus:ring-[var(--ring-soft)]"
          aria-label="Search CVSD Go links"
        />
      </div>

      <div className="space-y-7">
        {groupedLinks.map((group) => (
          <section key={group.title}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-deepforest-700">
                {group.title}
              </h2>
              <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                {group.links.length}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:auto-rows-fr md:grid-cols-2 xl:auto-rows-fr xl:grid-cols-3">
              {group.links.map((link) => {
                const shortName = `go.cvsd.live/${link.slug}`;
                return (
                  <article
                    key={link.id}
                    className="panel group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-oxford-300 hover:shadow-md"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-deepforest-700">
                      {shortName}
                    </p>
                    <h3 className="mt-2 min-h-[3.5rem] line-clamp-2 text-lg font-semibold text-oxford-700">
                      {link.description || link.url}
                    </h3>
                    <p className="mt-2 min-h-[1.25rem] overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                      {link.is_locked ? "Locked" : link.url}
                    </p>

                    <div className="mt-6 flex items-center gap-2">
                      <Link
                        href={`/${link.slug}`}
                        className="rounded-lg border border-oxford-700 bg-oxford-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
                      >
                        Open
                      </Link>
                      <button
                        onClick={() => handleCopy(link.slug)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-oxford-700 transition hover:border-oxford-400 hover:text-oxford-700"
                        type="button"
                        aria-label={copiedSlug === link.slug ? "Copied" : "Copy link"}
                        title={copiedSlug === link.slug ? "Copied" : "Copy link"}
                      >
                        {copiedSlug === link.slug ? (
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M10 13a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-3 3" />
                            <path d="M14 11a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l3-3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {filteredLinks.length === 0 && (
        <div className="panel mt-8 p-8 text-center">
          <p className="text-lg font-semibold text-oxford-700">No links matched your search.</p>
          <p className="mt-2 text-sm text-slate-600">Try a different keyword.</p>
        </div>
      )}
    </section>
  );
}
