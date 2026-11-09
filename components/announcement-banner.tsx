"use client";

import { useEffect, useState } from "react";
import { announcementKey, isAnnouncementVisible, parseAnnouncementButtons, type Announcement } from "@/lib/announcement-types";

const storageKey = "cvsdgo:announcement-dismissals";
export function AnnouncementCard({ item, onDismiss, preview = false }: { item: Announcement; onDismiss?: () => void; preview?: boolean }) {
  const buttons = (item.buttons ?? []).flatMap(button => parseAnnouncementButtons([button]) ?? []).slice(0, 3);
  return (
    <article className={`announcement-card announcement-${item.tone}`} aria-label={item.title}>
      <svg aria-hidden="true" className="announcement-icon mt-0.5 h-9 w-9 shrink-0 rounded-xl p-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m3 10 14-5v14L3 14zM7 15l1 5h3l-1-4M21 8v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{item.title}</h2>
        <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 [overflow-wrap:anywhere]">{item.message}</p>
        {buttons.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {buttons.map((button, index) => (
              <a key={index} href={button.url} data-announcement-preview={preview ? "" : undefined} onClick={preview ? event => event.preventDefault() : undefined} className={"announcement-action " + (index === 0 ? "announcement-action-primary" : "announcement-action-secondary")}>
                <span>{button.label}</span>
                <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
              </a>
            ))}
          </div>
        )}
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
  const [now, setNow] = useState(() => Date.now());
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
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const boundaries = items.flatMap(item => [item.starts_at, item.expires_at]).filter((date): date is string => Boolean(date)).map(Date.parse).filter(time => time > current);
      timer = setTimeout(tick, Math.min(60_000, ...boundaries.map(time => time - current)));
    }
    tick();
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", tick); };
  }, [items]);
  const visible = items.filter(item => isAnnouncementVisible(item, dismissed, now));
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
