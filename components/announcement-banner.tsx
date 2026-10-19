"use client";

import { useEffect, useState } from "react";
import { announcementKey, isAnnouncementVisible, type Announcement } from "@/lib/announcement-types";

const storageKey = "cvsdgo:announcement-dismissals";
export function AnnouncementCard({ item, onDismiss }: { item: Announcement; onDismiss?: () => void }) {
  return (
    <article className={`announcement-card announcement-${item.tone}`} aria-label={item.title}>
      <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 10 14-5v14L3 14zM7 15l1 5h3l-1-4M21 8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{item.title}</h2>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{item.message}</p>
      </div>
      {item.dismissible && onDismiss && (
        <button type="button" onClick={onDismiss} aria-label={`Dismiss announcement: ${item.title}`} className="announcement-dismiss -mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      )}
    </article>
  );
}

export function AnnouncementBanner({ initial }: { initial: Announcement[] }) {
  const [items, setItems] = useState(initial);
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    function readDismissals() {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "[]");
        if (Array.isArray(saved)) setDismissed(saved.filter((key): key is string => typeof key === "string"));
      } catch { /* Storage is optional; announcements remain usable. */ }
    }
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/announcements", { cache: "no-store", signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          if (active) setItems(data.announcements);
        }
      } catch { /* Preserve the last successful result during outages. */ }
    }
    readDismissals();
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("cvsdgo:announcements-updated", refresh);
    window.addEventListener("storage", readDismissals);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("cvsdgo:announcements-updated", refresh);
      window.removeEventListener("storage", readDismissals);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const visible = items.filter(item => isAnnouncementVisible(item, dismissed));
  if (!visible.length) return null;
  function dismiss(item: Announcement) {
    if (!item.dismissible) return;
    const next = [...dismissed.filter(key => key !== announcementKey(item)), announcementKey(item)].slice(-200);
    setDismissed(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep dismissal for this visit. */ }
  }
  return (
    <section aria-label="Site announcements" className="mx-auto w-full max-w-7xl space-y-2 px-4 pt-4 sm:px-6 lg:px-8">
      {visible.map(item => <AnnouncementCard key={item.id} item={item} onDismiss={() => dismiss(item)} />)}
    </section>
  );
}
