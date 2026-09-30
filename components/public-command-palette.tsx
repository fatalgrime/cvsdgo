"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccessibleDialog } from "@/components/accessible-dialog";
import type { SearchResultsPayload } from "@/app/api/search/route";
import type { AdminActionType } from "@/lib/ai-admin-actions";
import dynamic from "next/dynamic";

type PublicCommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  staffMode?: boolean;
};

const AdminCommandWorkflow = dynamic(
  () => import("@/components/command-palette").then((module) => module.CommandPalette),
  { ssr: false }
);

const EMPTY_RESULTS: SearchResultsPayload = {
  query: "",
  pages: [],
  links: [],
  actions: [],
  aiAdminActions: [],
  canManageLinks: false,
  isAdmin: false,
};

export function PublicCommandPalette({ open, onClose, staffMode = false }: PublicCommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultsPayload>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [adminAction, setAdminAction] = useState<AdminActionType | null>(null);
  const [adminWorkflowKey, setAdminWorkflowKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY_RESULTS);
    setIsLoading(true);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (response.ok) setResults((await response.json()) as SearchResultsPayload);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") console.error("Search failed", error);
      } finally {
        setIsLoading(false);
      }
    }, 120);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const items = useMemo(
    () => [
      ...results.links.map((item) => ({ ...item, group: "Links" } as const)),
      ...results.pages.map((item) => ({ ...item, group: "Pages" } as const)),
    ],
    [results]
  );

  function openItem(href: string) {
    onClose();
    router.push(href);
  }

  function runAction(actionId: "toggle-theme" | "open-settings") {
    if (actionId === "toggle-theme") {
      const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
      document.documentElement.style.colorScheme = nextTheme;
      window.localStorage.setItem("cvsd-theme", nextTheme);
    } else {
      document.querySelector<HTMLButtonElement>("button[aria-label='Open site settings']")?.click();
    }
    onClose();
  }

  return (
    <>
    <AccessibleDialog
      open={open}
      onClose={onClose}
      ariaLabel="Search CVSD Go"
      zIndexClassName="z-[100]"
      align="top"
      backdropClassName="bg-slate-950/55 backdrop-blur-md"
      panelClassName="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:border-slate-700/80 dark:bg-slate-950"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/70 sm:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-oxford-700 text-white shadow-sm">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={staffMode ? "Search links, pages, or run an AI Action" : "Search links and pages"}
          aria-label="Search links and pages"
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-oxford-700 outline-none placeholder:font-normal placeholder:text-slate-400 dark:text-slate-100"
        />
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          ESC
        </button>
      </div>

      <div className="max-h-[min(65vh,34rem)] overflow-y-auto p-2.5 sm:p-3">
        {isLoading && <p className="px-3 py-4 text-sm text-slate-500" role="status">Searching…</p>}
        {!isLoading && results.blockedByAutoMod && (
          <p className="px-3 py-4 text-sm text-rose-700 dark:text-rose-300">This search could not be completed.</p>
        )}
        {!isLoading && !results.blockedByAutoMod && items.length === 0 && results.aiAdminActions.length === 0 && results.actions.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-slate-500">No matching links or pages.</p>
        )}
        {!isLoading && items.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            onClick={() => openItem(item.href)}
            className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 dark:hover:bg-slate-900"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-oxford-700 dark:text-slate-100">
                {item.type === "link" ? `go.cvsd.live/${item.slug}` : item.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {item.type === "link" ? item.title : item.description}
              </span>
            </span>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">{item.group}</span>
          </button>
        ))}
        {!isLoading && staffMode && results.aiAdminActions.length > 0 && (
          <div className="mt-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-300">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 10.2 8.2 5 10l5.2 1.8L12 17l1.8-5.2L19 10l-5.2-1.8z"/><path d="m5 16-.7 2.3L2 19l2.3.7L5 22l.7-2.3L8 19l-2.3-.7z"/></svg>
                AI Actions
              </p>
              <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">No API key required</span>
            </div>
            {results.aiAdminActions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { setAdminAction(item.actionType); setAdminWorkflowKey((key) => key + 1); onClose(); }}
                className="group flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition hover:border-indigo-100 hover:bg-indigo-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:border-indigo-900/60 dark:hover:bg-indigo-950/30"
              >
                <span><span className="block text-sm font-semibold text-oxford-700 dark:text-slate-100">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span></span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-indigo-400 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        )}
        {!isLoading && results.actions.length > 0 && (
          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            {results.actions.map((item) => (
              <button key={item.id} type="button" onClick={() => runAction(item.actionId)} className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-oxford-700 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-900">{item.title}</button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        <span>Start typing to filter results</span>
        <span className="hidden sm:inline">CVSD Go unified search</span>
      </div>
    </AccessibleDialog>
    {adminAction && <AdminCommandWorkflow key={adminWorkflowKey} initialActionType={adminAction} />}
    </>
  );
}

