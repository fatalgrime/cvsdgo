"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { DraftRecoveryNotice } from "@/components/draft-recovery-notice";
import { useEditorDraft, useUnsavedChanges } from "@/components/use-editor-draft";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AnnouncementCard } from "@/components/announcement-banner";
import { announcementDateInput, announcementStatus, MAX_ANNOUNCEMENT_BUTTONS, type Announcement, type AnnouncementInput } from "@/lib/announcement-types";

const empty: AnnouncementInput = { starts_at: null, expires_at: null, buttons: [], audience: "everyone", title: "", message: "", tone: "info", dismissible: true, published: false };
const fieldClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-oxford-700 outline-none focus:border-oxford-500 focus:ring-2 focus:ring-oxford-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-oxford-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 disabled:opacity-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800";

type AnnouncementDraft = { form: AnnouncementInput; baseline: AnnouncementInput; editing: string | null };
function isDraft(value: unknown): value is AnnouncementDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as AnnouncementDraft;
  const validForm = (form: AnnouncementInput) => Boolean(form && typeof form.title === "string" && typeof form.message === "string" && ["info", "success", "warning"].includes(form.tone) && ["everyone", "staff"].includes(form.audience) && typeof form.dismissible === "boolean" && typeof form.published === "boolean" && (form.starts_at == null || typeof form.starts_at === "string") && (form.expires_at == null || typeof form.expires_at === "string") && Array.isArray(form.buttons) && form.buttons.length <= 3 && form.buttons.every(button => button && typeof button.label === "string" && typeof button.url === "string"));
  return (draft.editing === null || typeof draft.editing === "string") && validForm(draft.form) && validForm(draft.baseline);
}
export function AnnouncementManager() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [form, setForm] = useState<AnnouncementInput>(empty);
  const [baseline, setBaseline] = useState<AnnouncementInput>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [storage, setStorage] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);
  const draft = useEditorDraft({ name: "announcement-editor", value: { form, baseline, editing }, dirty: isDirty, validate: isDraft });
  useUnsavedChanges(isDirty);
  function mayDiscard() { return !isDirty || window.confirm("Discard your unsaved announcement edits?"); }
  function reset() { draft.clear(); setForm(empty); setBaseline(empty); setEditing(null); }
  function restoreDraft() {
    if (!draft.recovered || (isDirty && !window.confirm("Replace your current edits with the recovered draft?"))) return;
    const recovered = draft.recovered;
    setForm(recovered.form); setBaseline(recovered.baseline); setEditing(recovered.editing);
    draft.clear();
  }

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
    if (form.starts_at && form.expires_at && Date.parse(form.expires_at) <= Date.parse(form.starts_at)) { setError("Expiration must be after the publish time."); return; }
    void mutate(editing ? "PUT" : "POST", { ...form, id: editing }, form.published ? (announcementStatus(form) === "Scheduled" ? "Announcement scheduled." : "Announcement saved and enabled.") : "Draft saved.", true);
  }
  function edit(item: Announcement) {
    if (!mayDiscard()) return;
    draft.clear();
    setEditing(item.id);
    const next: AnnouncementInput = { starts_at: item.starts_at ?? null, expires_at: item.expires_at ?? null, buttons: item.buttons ?? [], audience: item.audience, title: item.title, message: item.message, tone: item.tone, dismissible: item.dismissible, published: item.published };
    setForm(next); setBaseline(next);
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
      {draft.recovered && <DraftRecoveryNotice onRestore={restoreDraft} onDiscard={draft.clear} />}
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
            <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/40">
              <legend className="px-1 text-sm font-semibold">Announcement buttons <span className="font-normal text-slate-500">· Optional</span></legend>
              <p id="announcement-buttons-help" className="text-sm text-slate-600 dark:text-slate-300">Give visitors a next step. Add up to three buttons; the first is highlighted.</p>
              <div className="mt-4 space-y-3">
                {(form.buttons ?? []).map((button, index) => (
                  <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Button {index + 1}{index === 0 ? " · Primary" : ""}</p>
                      <button type="button" aria-label={"Remove announcement button " + (index + 1)} onClick={() => setForm({ ...form, buttons: form.buttons?.filter((_, position) => position !== index) })} className="rounded-lg px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <div><label htmlFor={"announcement-button-label-" + index} className="block text-sm font-semibold">Button text</label>
                        <input id={"announcement-button-label-" + index} className={fieldClass} value={button.label} maxLength={40} required placeholder="Learn more" onChange={e => setForm({ ...form, buttons: form.buttons?.map((item, position) => position === index ? { ...item, label: e.target.value } : item) })} /></div>
                      <div><label htmlFor={"announcement-button-url-" + index} className="block text-sm font-semibold">Link</label>
                        <input id={"announcement-button-url-" + index} className={fieldClass} type="text" inputMode="url" value={button.url} maxLength={2048} required aria-describedby="announcement-buttons-help announcement-button-links-help" placeholder="https://example.com, /site/help, or mailto:office@cvsd.live" onChange={e => setForm({ ...form, buttons: form.buttons?.map((item, position) => position === index ? { ...item, url: e.target.value } : item) })} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" disabled={(form.buttons?.length ?? 0) >= MAX_ANNOUNCEMENT_BUTTONS} onClick={() => setForm({ ...form, buttons: [...(form.buttons ?? []), { label: "", url: "" }] })} className={buttonClass + " mt-3 inline-flex min-h-11 items-center gap-2"}>
                <span aria-hidden="true" className="text-lg leading-none">+</span> Add button
              </button>
              <p id="announcement-button-links-help" className="mt-2 text-xs text-slate-500">Use an http:// or https:// address, a path starting with /, or a mailto: email link. Web links open in the same tab; email links open the visitor’s email app.</p>
            </fieldset>
            <div><label htmlFor="announcement-audience" className="block text-sm font-semibold">Audience</label>
              <select id="announcement-audience" className={fieldClass} value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value as AnnouncementInput["audience"] })}>
                <option value="everyone">Everyone</option><option value="staff">Staff and admins only</option>
              </select></div>
            <div><label htmlFor="announcement-tone" className="block text-sm font-semibold">Appearance</label>
              <select id="announcement-tone" className={fieldClass} value={form.tone} onChange={e => setForm({ ...form, tone: e.target.value as AnnouncementInput["tone"] })}>
                <option value="info">Information · Blue</option><option value="success">Good news · Green</option><option value="warning">Important notice · Amber</option>
              </select></div>
            <fieldset className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <legend className="px-1 text-sm font-semibold">Schedule <span className="font-normal text-slate-500">· Optional</span></legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="announcement-starts" className="block text-sm font-semibold">Publish time</label><input id="announcement-starts" type="datetime-local" className={fieldClass} value={announcementDateInput(form.starts_at)} onChange={e => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-describedby="announcement-schedule-help" /></div>
                <div><label htmlFor="announcement-expires" className="block text-sm font-semibold">Expiration time</label><input id="announcement-expires" type="datetime-local" className={fieldClass} value={announcementDateInput(form.expires_at)} min={announcementDateInput(form.starts_at) || undefined} onChange={e => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} aria-describedby="announcement-schedule-help" /></div>
              </div>
              <p id="announcement-schedule-help" className="mt-2 text-xs text-slate-500">Times use your device’s local time zone. Leave publish time blank to start immediately, or expiration blank to keep it visible. Enable publishing below to activate the schedule.</p>
            </fieldset>
            <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={form.dismissible} onChange={e => setForm({ ...form, dismissible: e.target.checked })} /><span><span className="block font-semibold">Allow dismissal</span><span className="mt-1 block text-slate-500">Visitors can hide this announcement on their browser. Turn off to keep it visible.</span></span></label>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={form.published} onChange={e => setForm({ ...form, published: e.target.checked })} /><span><span className="block font-semibold">Publish announcement</span><span className="mt-1 block text-slate-500">Make it visible to the selected audience during its scheduled window. Otherwise, keep it as a draft.</span></span></label>
            </div>
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Live preview</p>
              <AnnouncementCard preview item={{ ...form, id: "preview", revision: 1, title: form.title || "Your announcement title", message: form.message || "Your announcement message will appear here." }} />
              {editing && <p className="mt-2 text-xs text-slate-500">Saving an update makes this announcement visible again to visitors who dismissed an earlier version.</p>}
            </div>
            <p role="status" className="text-xs text-slate-500">{draft.storageFailed ? "Draft recovery is unavailable. Keep this tab open until you save." : isDirty ? "Unsaved edits · Draft kept privately in this tab" : "No unsaved changes"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="rounded-xl bg-oxford-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-oxford-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 disabled:opacity-50">{busy ? "Saving…" : form.published ? (announcementStatus(form) === "Scheduled" ? "Save and schedule" : "Save and publish") : "Save draft"}</button>
              {(editing || isDirty) && <button type="button" className={buttonClass} onClick={() => { if (mayDiscard()) reset(); }}>Cancel editing</button>}
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
            <span className={`rounded-full px-2.5 py-1 ${item.published ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"}`}>{announcementStatus(item)}</span>
            <span className="text-slate-500">{item.audience === "staff" ? "Staff and admins only" : "Everyone"}</span>
            <span className="text-slate-500">{item.dismissible ? "Dismissible" : "Always visible"}</span>
          </div>
          {(item.starts_at || item.expires_at) && <p className="mt-2 text-xs text-slate-500">{item.starts_at ? "Starts " + new Date(item.starts_at).toLocaleString() : "Starts immediately"}{item.expires_at ? " · Ends " + new Date(item.expires_at).toLocaleString() : " · No expiration"}</p>}
          <div className="mt-3"><AnnouncementCard item={item} /></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => edit(item)} className={buttonClass}>Edit</button>
            <button type="button" disabled={busy} onClick={() => { if (editing === item.id && !mayDiscard()) return; void mutate("PUT", { ...item, published: !item.published }, item.published ? "Announcement unpublished." : "Announcement published.", editing === item.id); }} className={buttonClass}>{item.published ? "Unpublish" : "Publish"}</button>
            <button type="button" disabled={busy} onClick={() => setPendingDelete(item)} className="rounded-lg px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 dark:text-rose-300 dark:hover:bg-rose-950">Delete</button>
          </div>
        </article>)}
      </section>
      <ConfirmDialog open={Boolean(pendingDelete)} title="Delete announcement?" description={<>“{pendingDelete?.title}” will be removed from the site.{pendingDelete?.id === editing && isDirty ? " Your unsaved edits to this announcement will also be discarded." : ""}</>} confirmLabel={busy ? "Deleting…" : "Delete announcement"} onClose={() => { if (!busy) setPendingDelete(null); }} onConfirm={() => { if (pendingDelete) void mutate("DELETE", { id: pendingDelete.id }, "Announcement deleted.", editing === pendingDelete.id); }} />
    </div>
  );
}
