"use client";

import { useEffect, useState } from "react";

export function CommandPaletteTrigger() {
  const [shortcutKey, setShortcutKey] = useState("⌘K");

  useEffect(() => {
    if (typeof window !== "undefined" && !navigator.platform.toUpperCase().includes("MAC")) {
      setShortcutKey("Ctrl+K");
    }
  }, []);

  function handleOpen() {
    window.dispatchEvent(new CustomEvent("cvsdgo:open-command-palette"));
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group relative flex h-11 w-full max-w-md items-center justify-between rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 text-sm text-slate-500 shadow-inner transition hover:border-oxford-300 hover:bg-white hover:text-oxford-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-oxford-400 dark:hover:bg-slate-900 dark:hover:text-slate-200"
      aria-label="Open search command palette"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-oxford-600 dark:group-hover:text-oxford-300"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className="truncate text-xs font-medium sm:text-sm">Search links, pages, or tools...</span>
      </div>
      <kbd className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {shortcutKey}
      </kbd>
    </button>
  );
}
