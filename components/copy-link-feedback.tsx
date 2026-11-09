"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AccessibleDialog } from "@/components/accessible-dialog";
import { tryCopyText } from "@/lib/copy-text";

export function useCopyLink() {
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef(0);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); request.current++; }, []);
  async function copyLink(slug: string) {
    const current = ++request.current;
    if (timer.current) clearTimeout(timer.current);
    setMessage(""); setCopiedSlug(null);
    const url = "https://go.cvsd.live/" + slug;
    const copied = await tryCopyText(url);
    if (current !== request.current) return;
    if (copied) {
      setManualLink(null); setCopiedSlug(slug); setMessage("Copied " + url + " to your clipboard.");
      timer.current = setTimeout(() => { setCopiedSlug(null); setMessage(""); }, 3000);
    } else { setManualLink(url); }
  }
  return { copiedSlug, copyLink, manualLink, message, closeManual: () => setManualLink(null) };
}
export function CopyLinkFeedback({ manualLink, message, closeManual }: { manualLink: string | null; message: string; closeManual: () => void }) {
  const id = useId();
  return <>
    <p role="status" aria-live="polite" className="sr-only">{message}</p>
    <AccessibleDialog open={Boolean(manualLink)} onClose={closeManual} ariaLabel="Copy link manually" zIndexClassName="z-[250]">
      <h2 className="font-serif text-xl font-semibold">Copy this link</h2>
      <p id={id + "-help"} className="mt-2 text-sm text-slate-600 dark:text-slate-300">Your browser couldn’t copy automatically. The link below is selected. Use your device’s Copy command or press Ctrl+C (Command+C on Mac).</p>
      <label htmlFor={id} className="mt-4 block text-sm font-semibold">Short link</label>
      <input id={id} readOnly value={manualLink ?? ""} aria-describedby={id + "-help"} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
      <button type="button" onClick={closeManual} className="mt-4 min-h-11 rounded-lg bg-oxford-700 px-4 py-2 font-semibold text-white">Done</button>
    </AccessibleDialog>
  </>;
}
