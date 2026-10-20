"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AnnouncementCard } from "@/components/announcement-banner";
import type { Announcement, AnnouncementInput } from "@/lib/announcement-types";

const empty: AnnouncementInput = { audience: "everyone", title: "", message: "", tone: "info", dismissible: true, published: false };
const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-oxford-700 outline-none focus:border-oxford-500 focus:ring-2 focus:ring-oxford-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-oxford-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800";

export function AnnouncementManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState<AnnouncementInput>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/announcements", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load announcements. Please try again.");
    const data = await response.json();
    setItems(data.announcements);
    setStorage(data.storageAvailable);
  }, []);
  useEffect(() => {
    void load().catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [load]);

  function reset() { setForm(empty); setEditing(null); }
  async function mutate(method: string, body: object, message: string, resetEditor = false) {
    if (working.current) return;
    working.current = true;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/announcements", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(response.status >= 500 ? "Unable to save announcements. Please try again." : await response.text());
      if (resetEditor) reset();
      setPendingDelete(null);
      setNotice(message);
      window.dispatchEvent(new Event("cvsdgo:announcements-updated"));
      await load();
    } catch (err) { setError((err as Error).message); }
    finally { working.current = false; setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void mutate(editing ? "PUT" : "POST", { ...form, id: editing }, form.published ? "Announcement published." : "Draft saved.", true);
  }
  function edit(item: Announcement) {
    setEditing(item.id);
    setForm({ audience: item.audience, title: item.title, message: item.message, tone: item.tone, dismissible: item.dismissible, published: item.published });
    setNotice(""); setError("");
    editor.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    editor.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Administration" title="Announcements" description="Keep everyone informed with a banner below the navigation. Save a draft or publish an update for everyone or only staff and admins." />
      {error && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100">{error} <button type="button" onClick={() => { setError(""); void load().catch(err => setError(err.message)); }} className="ml-2 font-semibold underline">Retry loading</button></div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">{notice}</p>}
      {!loading && !storage && !error && <p role="status" className="text-sm text-slate-500">Announcement storage is unavailable. Configure the database to create announcements.</p>}
      <div ref={editor} className="panel scroll-mt-28 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold">{editing ? "Edit announcement" : "New announcement"}</h2>
          <p className="mt-1 text-sm text-slate-500">Published changes appear immediately here and within a minute for other open pages.</p>
        </div>
        <form onSubmit={save} className="p-5">
          <fieldset disabled={busy || !storage || loading} className="space-y-4 disabled:opacity-60">
            <div><label htmlFor="announcement-title" className="block text-sm font-semibold">Title</label>
              <input id="announcement-title" className={fieldClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={100} required placeholder="A quick update for our community" /></div>
            <div><label htmlFor="announcement-message" className="block text-sm font-semibold">Message</label>
              <textarea id="announcement-message" className={fieldClass} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} maxLength={1000} rows={3} required placeholder="Share the details visitors need to know." />
              <p className="mt-1 text-xs text-slate-500">{form.message.length}/1000 characters · Plain text</p></div>
            <div><label htmlFor="announcement-audience" className="block text-sm font-semibold">Audience</label>
              <select id="announcement-audience" className={fieldClass} value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value as AnnouncementInput["audience"] })}>
                <option value="everyone">Everyone</option><option value="staff">Staff and admins only</option>
              </select></div>
            <div><label htmlFor="announcement-tone" className="block text-sm font-semibold">Appearance</label>
              <select id="announcement-tone" className={fieldClass} value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value as AnnouncementInput["tone"] })}>
                <option value="info">Information · Blue</option><option value="success">Good news · Green</option><option value="warning">Important notice · Amber</option>
              </select></div>
            <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={form.dismissible} onChange={e => setForm({ ...form, dismissible: e.target.checked })} /><span><span className="block font-semibold">Allow dismissal</span><span className="mt-1 block text-slate-500">Visitors can hide this announcement on their browser. Turn off to keep it visible.</span></span></label>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} /><span><span className="block font-semibold">Publish announcement</span><span className="mt-1 block text-slate-500">Make it visible to the selected audience when saved. Otherwise, keep it as a draft.</span></span></label>
            </div>
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Live preview</p>
              <AnnouncementCard item={{ ...form, id: "preview", revision: 1, title: form.title || "Your announcement title", message: form.message || "Your announcement message will appear here." }} />
              {editing && <p className="mt-2 text-xs text-slate-500">Saving an update makes this announcement visible again to visitors who dismissed an earlier version.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded-xl bg-oxford-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-oxford-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 disabled:opacity-50">{busy ? "Saving…" : form.published ? "Save and publish" : "Save draft"}</button>
              {editing && <button type="button" className={buttonClass} onClick={reset}>Cancel editing</button>}
            </div>
          </fieldset>
        </form>
      </div>
      <section className="space-y-3" aria-label="Manage announcements">
        <h2 className="text-lg font-semibold">Your announcements</h2>
        {loading && <p role="status" className="text-sm text-slate-500">Loading announcements…</p>}
        {!loading && !error && items.length === 0 && <div className="panel p-6 text-sm text-slate-500">No announcements yet. Create your first update above.</div>}
        {items.map(item => <article key={item.id} className="panel p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={`rounded-full px-2.5 py-1 ${item.published ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"}`}>{item.published ? "Published" : "Draft"}</span>
            <span className="text-slate-500">{item.audience === "staff" ? "Staff and admins only" : "Everyone"}</span>
            <span className="text-slate-500">{item.dismissible ? "Dismissible" : "Always visible"}</span>
          </div>
          <h3 className="mt-3 break-words font-semibold">{item.title}</h3>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">{item.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => edit(item)} className={buttonClass}>Edit</button>
            <button type="button" disabled={busy} onClick={() => void mutate("PUT", { ...item, published: !item.published }, item.published ? "Announcement unpublished." : "Announcement published.", editing === item.id)} className={buttonClass}>{item.published ? "Unpublish" : "Publish"}</button>
            <button type="button" disabled={busy} onClick={() => setPendingDelete(item)} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950">Delete</button>
          </div>
        </article>)}
      </section>
      <ConfirmDialog open={Boolean(pendingDelete)} title="Delete announcement?" description={<>“{pendingDelete?.title}” will be removed from the site.</>} confirmLabel={busy ? "Deleting…" : "Delete announcement"} onClose={() => { if (!busy) setPendingDelete(null); }} onConfirm={() => { if (pendingDelete) void mutate("DELETE", { id: pendingDelete.id }, "Announcement deleted.", editing === pendingDelete.id); }} />
    </div>
  );
}
