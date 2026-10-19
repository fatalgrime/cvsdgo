"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";
type SettingsResponse = { settings: Record<string, string>; canEditWebhook: boolean };
export function DiscordSettings() {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [canEditWebhook, setCanEditWebhook] = useState(false);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as SettingsResponse;
      setWebhookUrl(data.settings.discord_webhook_url ?? "");
      setCanEditWebhook(Boolean(data.canEditWebhook));
    } catch (error) {
      toast({ title: "Unable to load settings", description: (error as Error).message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

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

  return <div className="space-y-4">
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

<Link href="/site/settings/activity" className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-oxford-700 underline focus-visible:ring-2 focus-visible:ring-oxford-500 dark:text-slate-100">View audit logs and Discord delivery status</Link>
</div>;
}
