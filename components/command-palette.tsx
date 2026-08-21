"use client";

import { useEffect, useRef, useState, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { SearchResultsPayload, SearchPageItem, SearchLinkItem, SearchActionItem } from "@/app/api/search/route";

type SelectableItem = SearchPageItem | SearchLinkItem | SearchActionItem;

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<SearchResultsPayload>({
    query: "",
    pages: [],
    links: [],
    actions: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Global keybindings (Cmd+K / Ctrl+K) & Custom Event listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    function handleOpenEvent() {
      setIsOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("cvsdgo:open-command-palette", handleOpenEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("cvsdgo:open-command-palette", handleOpenEvent);
    };
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Fetch search results from permission-enforced API
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    async function fetchResults() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(deferredQuery)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as SearchResultsPayload;
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          console.error("Search fetch error:", error);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void fetchResults();

    return () => controller.abort();
  }, [deferredQuery, isOpen]);

  // Flatten items for keyboard navigation
  const allItems: SelectableItem[] = [
    ...results.pages,
    ...results.links,
    ...results.actions,
  ];

  function handleSelect(item: SelectableItem) {
    setIsOpen(false);
    if (item.type === "page") {
      router.push(item.href);
    } else if (item.type === "link") {
      router.push(item.href);
    } else if (item.type === "action") {
      if (item.actionId === "toggle-theme") {
        const currentTheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
        document.documentElement.style.colorScheme = nextTheme;
        window.localStorage.setItem("cvsd-theme", nextTheme);
      } else if (item.actionId === "open-settings") {
        // Dispatch settings dialog click or trigger
        const settingsButton = document.querySelector<HTMLButtonElement>("button[aria-label='Open site settings']");
        settingsButton?.click();
      }
    }
  }

  async function handleCopyLink(slug: string, event: React.MouseEvent) {
    event.stopPropagation();
    const shortLink = `https://go.cvsd.live/${slug}`;
    await navigator.clipboard.writeText(shortLink);
    setCopiedSlug(slug);
    setTimeout(() => {
      setCopiedSlug((current) => (current === slug ? null : current));
    }, 1500);
  }

  function handleModalKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev + 1) % allItems.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev - 1 + allItems.length) % allItems.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const activeItem = allItems[selectedIndex];
      if (activeItem) {
        handleSelect(activeItem);
      }
    }
  }

  let currentIndexTracker = 0;

  return (
    <>
      {portalReady &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="modal-backdrop z-[100] flex items-start justify-center pt-16 px-4 bg-slate-950/60 backdrop-blur-sm sm:pt-24"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsOpen(false);
                }}
                onKeyDown={handleModalKeyDown}
              >
                <motion.div
                  className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.96, y: -12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -12 }}
                  transition={{ duration: 0.18 }}
                  role="dialog"
                  aria-label="Command Palette Search"
                >
                  {/* Search Bar Input */}
                  <div className="relative border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search links, pages, or system actions..."
                      className="w-full bg-transparent pl-8 pr-12 text-base text-oxford-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                      aria-label="Command palette input"
                    />
                    <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      ESC
                    </kbd>
                  </div>

                  {/* Results Container */}
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                    {isLoading && (
                      <div className="p-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Searching authorized content...
                      </div>
                    )}

                    {!isLoading && allItems.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-sm font-semibold text-oxford-700 dark:text-slate-200">No results found</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Try searching for a link keyword like &quot;enroll&quot;, &quot;calendar&quot;, or a site page.
                        </p>
                      </div>
                    )}

                    {/* Section 1: Navigation & Pages */}
                    {!isLoading && results.pages.length > 0 && (
                      <div className="mb-2">
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Pages & Tools
                        </p>
                        <div className="space-y-1">
                          {results.pages.map((page) => {
                            const itemIndex = currentIndexTracker++;
                            const isSelected = itemIndex === selectedIndex;
                            return (
                              <div
                                key={page.id}
                                onClick={() => handleSelect(page)}
                                onMouseEnter={() => setSelectedIndex(itemIndex)}
                                className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${
                                  isSelected
                                    ? "bg-oxford-700 text-white dark:bg-oxford-600"
                                    : "text-oxford-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold">{page.title}</p>
                                  <p
                                    className={`text-xs ${
                                      isSelected ? "text-slate-200" : "text-slate-500 dark:text-slate-400"
                                    }`}
                                  >
                                    {page.description}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    isSelected
                                      ? "border-oxford-500 bg-oxford-800 text-slate-200"
                                      : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                  }`}
                                >
                                  {page.category}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 2: District Short Links */}
                    {!isLoading && results.links.length > 0 && (
                      <div className="mb-2">
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          District Short Links ({results.links.length})
                        </p>
                        <div className="space-y-1">
                          {results.links.map((link) => {
                            const itemIndex = currentIndexTracker++;
                            const isSelected = itemIndex === selectedIndex;
                            return (
                              <div
                                key={link.id}
                                onClick={() => handleSelect(link)}
                                onMouseEnter={() => setSelectedIndex(itemIndex)}
                                className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${
                                  isSelected
                                    ? "bg-oxford-700 text-white dark:bg-oxford-600"
                                    : "text-oxford-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                }`}
                              >
                                <div className="min-w-0 pr-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`font-mono text-xs font-bold ${
                                        isSelected ? "text-deepforest-300" : "text-deepforest-700 dark:text-slate-300"
                                      }`}
                                    >
                                      go.cvsd.live/{link.slug}
                                    </span>
                                    {link.isLocked && (
                                      <span
                                        className={`rounded-full border px-1.5 py-0.2 text-[9px] font-semibold uppercase ${
                                          isSelected
                                            ? "border-amber-400/40 bg-amber-950/40 text-amber-200"
                                            : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                        }`}
                                      >
                                        Locked
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className={`truncate text-sm font-medium ${
                                      isSelected ? "text-white" : "text-slate-700 dark:text-slate-200"
                                    }`}
                                  >
                                    {link.title}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => void handleCopyLink(link.slug, e)}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                      isSelected
                                        ? "border-oxford-500 bg-oxford-800 text-white hover:bg-oxford-900"
                                        : "border-slate-200 bg-white text-oxford-700 hover:border-oxford-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    }`}
                                    title="Copy short link"
                                  >
                                    {copiedSlug === link.slug ? "Copied!" : "Copy"}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 3: Quick System Actions */}
                    {!isLoading && results.actions.length > 0 && (
                      <div>
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          System Actions
                        </p>
                        <div className="space-y-1">
                          {results.actions.map((action) => {
                            const itemIndex = currentIndexTracker++;
                            const isSelected = itemIndex === selectedIndex;
                            return (
                              <div
                                key={action.id}
                                onClick={() => handleSelect(action)}
                                onMouseEnter={() => setSelectedIndex(itemIndex)}
                                className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${
                                  isSelected
                                    ? "bg-oxford-700 text-white dark:bg-oxford-600"
                                    : "text-oxford-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                }`}
                              >
                                <div>
                                  <p className="text-sm font-semibold">{action.title}</p>
                                  <p
                                    className={`text-xs ${
                                      isSelected ? "text-slate-200" : "text-slate-500 dark:text-slate-400"
                                    }`}
                                  >
                                    {action.description}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    isSelected
                                      ? "border-oxford-500 bg-oxford-800 text-slate-200"
                                      : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                  }`}
                                >
                                  Action
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer Controls */}
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    <div className="flex items-center gap-3">
                      <span>
                        <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                          ↑
                        </kbd>{" "}
                        <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                          ↓
                        </kbd>{" "}
                        Navigate
                      </span>
                      <span>
                        <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                          ↵
                        </kbd>{" "}
                        Select
                      </span>
                    </div>
                    <span>CVSD Go Command Search</span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
