"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AccessibleDialog } from "@/components/accessible-dialog";
import { PolicyEditor } from "@/components/policy-editor";
import { useAccessProfile } from "@/components/access-provider";
import { useToast } from "@/components/toast-provider";

type SettingsResponse = {
  settings: Record<string, string>;
  canEditWebhook: boolean;
  canEditPolicies: boolean;
};

function SettingsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function SettingsDialog() {
  const access = useAccessProfile();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [canEditWebhook, setCanEditWebhook] = useState(false);
  const [canEditPolicies, setCanEditPolicies] = useState(access.admin);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as SettingsResponse;
      setWebhookUrl(data.settings.discord_webhook_url ?? "");
      setCanEditWebhook(Boolean(data.canEditWebhook));
      setCanEditPolicies(Boolean(data.canEditPolicies));
    } catch (error) {
      toast({ title: "Unable to load settings", description: (error as Error).message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) void loadSettings();
  }, [isOpen, loadSettings]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settingKey: "discord_webhook_url", settingValue: webhookUrl.trim() }),
      });
      if (!response.ok) throw new Error(await response.text());
      toast({ title: "Settings updated", description: "Discord logging webhook saved.", variant: "success" });
      setIsOpen(false);
    } catch (error) {
      toast({ title: "Unable to save settings", description: (error as Error).message, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRevert() {
    setIsReverting(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert", settingKey: "discord_webhook_url" }),
      });
      if (!response.ok) throw new Error(await response.text());
      toast({ title: "Webhook reverted", description: "The previous webhook value has been restored.", variant: "success" });
      await loadSettings();
    } catch (error) {
      toast({ title: "Unable to revert settings", description: (error as Error).message, variant: "error" });
    } finally {
      setIsReverting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-oxford-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-oxford-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300" aria-label="Open site settings" title="Site settings">
        <SettingsIcon />
      </button>

      <AccessibleDialog open={isOpen} onClose={() => setIsOpen(false)} ariaLabel="Site settings" zIndexClassName="z-[100]" panelClassName="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/20 bg-slate-50 shadow-2xl dark:border-slate-700/80 dark:bg-slate-950">
        <header className="relative overflow-hidden rounded-t-[1.4rem] bg-oxford-700 px-6 py-6 text-white sm:px-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full border-[28px] border-white/5" />
          <div className="relative flex items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-inner"><SettingsIcon /></span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Administration</p>
                <h2 className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">Site settings</h2>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-300">Manage integrations and published policy content for CVSD Go.</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-slate-200 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70" aria-label="Close settings">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </header>

        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,.65fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70" aria-labelledby="integration-heading">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12h8M12 8v8"/><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"/></svg>
              </span>
              <div>
                <h3 id="integration-heading" className="text-base font-semibold text-oxford-700 dark:text-slate-100">Discord audit logging</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">Send important administrative events to a protected Discord webhook.</p>
              </div>
            </div>

            {isLoading ? (
              <div className="mt-5 space-y-3" role="status" aria-label="Loading settings"><div className="h-11 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"/><div className="h-9 w-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"/></div>
            ) : (
              <form className="mt-5" onSubmit={handleSave}>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="discord-webhook">Webhook URL</label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Kept private and only editable by the designated integration owner.</p>
                <input id="discord-webhook" type={canEditWebhook ? "url" : "text"} value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://discord.com/api/webhooks/..." readOnly={!canEditWebhook} disabled={!canEditWebhook} className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-oxford-700 shadow-sm outline-none transition focus:border-oxford-700 focus:ring-2 focus:ring-oxford-700/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-800" />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {canEditWebhook ? (
                    <><button type="submit" disabled={isSaving} className="inline-flex items-center rounded-xl bg-oxford-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving…" : "Save integration"}</button><button type="button" onClick={handleRevert} disabled={isReverting} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{isReverting ? "Reverting…" : "Revert"}</button></>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Restricted setting</span>
                  )}
                </div>
              </form>
            )}
          </section>

          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70" aria-labelledby="policies-heading">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg></span>
              <h3 id="policies-heading" className="mt-4 text-base font-semibold text-oxford-700 dark:text-slate-100">Published policies</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">Edit the Terms of Service and Privacy Policy in the guided policy editor.</p>
              <div className="mt-4"><PolicyEditor enabled={canEditPolicies}/></div>
            </section>

            <Link href="/site/status" onClick={() => setIsOpen(false)} className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-oxford-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700">
              <span><span className="block text-sm font-semibold text-oxford-700 dark:text-slate-100">System status</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Health and activity are available on the dedicated Status page.</span></span>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </Link>
          </div>
        </div>
      </AccessibleDialog>
    </>
  );
}
