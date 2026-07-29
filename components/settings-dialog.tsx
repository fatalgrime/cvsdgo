"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/toast-provider";
import { PolicyEditor } from "@/components/policy-editor";

type AuditLogEntry = {
  id: number;
  action: string;
  details: string | null;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_has_discord_account: boolean;
  actor_has_login_account: boolean;
  created_at: string;
};

type SettingsResponse = {
  settings: Record<string, string>;
  auditLogs: AuditLogEntry[];
  canEditWebhook: boolean;
  canEditPolicies: boolean;
  health: {
    databaseConfigured: boolean;
    webhookConfigured: boolean;
    auditLogEntries: number;
    latestActivityAt: string | null;
  };
};

export function SettingsDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [canEditWebhook, setCanEditWebhook] = useState(false);
  const [canEditPolicies, setCanEditPolicies] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [health, setHealth] = useState<SettingsResponse["health"] | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isActive = true;

    async function loadSettings() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/settings");
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = (await response.json()) as SettingsResponse;
        if (!isActive) return;
        setWebhookUrl(data.settings.discord_webhook_url ?? "");
        setAuditLogs(data.auditLogs ?? []);
        setCanEditWebhook(Boolean(data.canEditWebhook));
        setCanEditPolicies(Boolean(data.canEditPolicies));
        setHealth(data.health ?? null);
      } catch (error) {
        const message = (error as Error).message || "Unable to load settings.";
        if (!isActive) return;
        toast({ title: "Unable to load settings", description: message, variant: "error" });
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      isActive = false;
    };
  }, [isOpen, toast]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return auditLogs;

    return auditLogs.filter((entry) => {
      const haystack = [entry.action, entry.details, entry.actor_username, entry.actor_user_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [auditLogs, search]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settingKey: "discord_webhook_url", settingValue: webhookUrl.trim() }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({ title: "Settings updated", description: "Discord logging webhook saved.", variant: "success" });
      setIsOpen(false);
    } catch (error) {
      const message = (error as Error).message || "Unable to save settings.";
      toast({ title: "Unable to save settings", description: message, variant: "error" });
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

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({ title: "Webhook reverted", description: "The previous webhook value has been restored.", variant: "success" });
      setWebhookUrl("");
      void loadSettings();
    } catch (error) {
      const message = (error as Error).message || "Unable to revert settings.";
      toast({ title: "Unable to revert settings", description: message, variant: "error" });
    } finally {
      setIsReverting(false);
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch("/api/admin/settings");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as SettingsResponse;
      setWebhookUrl(data.settings.discord_webhook_url ?? "");
      setAuditLogs(data.auditLogs ?? []);
      setCanEditWebhook(Boolean(data.canEditWebhook));
      setCanEditPolicies(Boolean(data.canEditPolicies));
      setHealth(data.health ?? null);
    } catch (error) {
      const message = (error as Error).message || "Unable to load settings.";
      toast({ title: "Unable to load settings", description: message, variant: "error" });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-oxford-700 shadow-sm transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300"
        aria-label="Open site settings"
        title="Site settings"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z" />
        </svg>
      </button>

      {portalReady &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
              >
                <motion.div
                  className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">Settings</p>
                      <h2 className="mt-2 font-serif text-2xl text-oxford-700 dark:text-slate-100">Site configuration</h2>
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                        Configure Discord webhooks and review recent audit activity.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      aria-label="Close settings"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <PolicyEditor enabled={canEditPolicies} />
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {canEditPolicies ? "Edit the Terms of Service or Privacy Policy with the markdown editor." : "Policy editing is available to administrators only."}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Discord webhook logging</h3>
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                        Add a webhook URL to send embedded audit messages for important actions.
                      </p>
                      <form className="mt-4 space-y-3" onSubmit={handleSave}>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="discord-webhook">
                            Webhook URL
                          </label>
                          <input
                            id="discord-webhook"
                            type="url"
                            value={webhookUrl}
                            onChange={(event) => setWebhookUrl(event.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                            readOnly={!canEditWebhook}
                            disabled={!canEditWebhook}
                            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {canEditWebhook ? (
                            <button
                              type="submit"
                              disabled={isSaving}
                              className="inline-flex items-center gap-2 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                            >
                              {isSaving && <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3.3-6.9" /></svg>}
                              Save webhook
                            </button>
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Only drevmourn can update this webhook URL.</p>
                          )}
                          {canEditWebhook && (
                            <button
                              type="button"
                              onClick={handleRevert}
                              disabled={isReverting}
                              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              {isReverting ? "Reverting…" : "Revert"}
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Action history</h3>
                          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Recent admin and staff activity.</p>
                        </div>
                        {health && (
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${health.databaseConfigured ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"}`}>
                            {health.databaseConfigured ? "Healthy" : "Setup needed"}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {[
                          { label: "Entries", value: health?.auditLogEntries ?? 0 },
                          { label: "Webhook", value: health?.webhookConfigured ? "Live" : "Offline" },
                          { label: "Latest", value: health?.latestActivityAt ? new Date(health.latestActivityAt).toLocaleDateString() : "None" },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
                            <p className="mt-1.5 text-sm font-semibold text-oxford-700 dark:text-slate-100">{String(value)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="relative mt-3">
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          placeholder="Search log entries"
                        />
                      </div>
                      <div className="mt-3 max-h-[380px] space-y-2 overflow-auto pr-0.5">
                        {isLoading && (
                          <div className="space-y-2">
                            {[0,1,2].map((i) => (
                              <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                                <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                                <div className="mt-2 h-2.5 w-48 rounded bg-slate-100 dark:bg-slate-800" />
                              </div>
                            ))}
                          </div>
                        )}
                        {!isLoading && filteredLogs.length === 0 && (
                          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-400 dark:border-slate-700">
                            No matching log entries found.
                          </p>
                        )}
                        {filteredLogs.map((entry) => (
                          <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/70">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-oxford-700 dark:text-slate-100">{entry.action}</p>
                              <p className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}</p>
                            </div>
                            {entry.details && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{entry.details}</p>}
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                              <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                                {entry.actor_username || entry.actor_user_id || "Unknown"}
                              </span>
                              <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                                Discord: {entry.actor_has_discord_account ? "Yes" : "No"}
                              </span>
                              <span className="rounded-full border border-slate-200 px-2 py-0.5 dark:border-slate-700">
                                Login: {entry.actor_has_login_account ? "Yes" : "No"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
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
