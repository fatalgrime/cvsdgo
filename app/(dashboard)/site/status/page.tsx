"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

type AuditLogEntry = {
  id: number;
  action: string;
  details: string | null;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_has_discord_account: boolean;
  actor_has_login_account: boolean;
  severity: string | null;
  category: string | null;
  source: string | null;
  created_at: string;
};

type SettingsResponse = {
  settings: Record<string, string>;
  auditLogs: AuditLogEntry[];
  canEditWebhook: boolean;
  health: {
    databaseConfigured: boolean;
    webhookConfigured: boolean;
    auditLogEntries: number;
    latestActivityAt: string | null;
  };
};

export default function StatusPage() {
  const { toast } = useToast();
  const [health, setHealth] = useState<SettingsResponse["health"] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/settings");
        if (!response.ok) throw new Error(await response.text());
        const data = (await response.json()) as SettingsResponse;
        setHealth(data.health ?? null);
        setAuditLogs(data.auditLogs ?? []);
      } catch (error) {
        const message = (error as Error).message || "Unable to load system status.";
        toast({ title: "Unable to load status", description: message, variant: "error" });
      } finally {
        setIsLoading(false);
      }
    }
    void loadStatus();
  }, [toast]);

  const severityGroups = useMemo(() => {
    const counts = auditLogs.reduce<Record<string, number>>((acc, entry) => {
      const s = entry.severity || "info";
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    return [
      { label: "Critical", value: counts.critical ?? 0, dot: "bg-rose-500",   text: "text-rose-700 dark:text-rose-300" },
      { label: "Warning",  value: counts.warning  ?? 0, dot: "bg-amber-400",  text: "text-amber-700 dark:text-amber-300" },
      { label: "Info",     value: counts.info     ?? 0, dot: "bg-emerald-500",text: "text-emerald-700 dark:text-emerald-300" },
    ];
  }, [auditLogs]);

  const statCards = [
    {
      label: "Database",
      value: isLoading ? null : (health?.databaseConfigured ? "Connected" : "Pending"),
      sub: "Application can write admin and audit data.",
      dot: health?.databaseConfigured ? "bg-emerald-500" : "bg-amber-400",
    },
    {
      label: "Webhook",
      value: isLoading ? null : (health?.webhookConfigured ? "Active" : "Offline"),
      sub: "Discord alerts for important actions.",
      dot: health?.webhookConfigured ? "bg-emerald-500" : "bg-slate-400",
    },
    {
      label: "Latest activity",
      value: isLoading ? null : (health?.latestActivityAt ? new Date(health.latestActivityAt).toLocaleString() : "No activity yet"),
      sub: "Most recent recorded audit event.",
      dot: health?.latestActivityAt ? "bg-oxford-500" : "bg-slate-400",
    },
  ];

  return (
    <section className="space-y-5">
      <div className="panel-strong overflow-hidden p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-deepforest-400">Administration</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-oxford-700 dark:text-slate-100 md:text-4xl">Health &amp; Monitoring</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Review system health, recent admin activity, and the current webhook state.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.label} className="panel p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
            {isLoading ? (
              <div className="mt-3 h-7 w-28 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${card.dot}`} />
                <p className="text-xl font-semibold text-oxford-700 dark:text-slate-100">{card.value}</p>
              </div>
            )}
            <p className="mt-1.5 text-xs text-slate-500">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recent activity</p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Latest audit events and their severity.</p>
            </div>
            {!isLoading && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {health?.auditLogEntries ?? 0} entries
              </span>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {isLoading ? (
              [0,1,2,3].map((i) => (
                <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                  <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="mt-2 h-2.5 w-64 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              ))
            ) : auditLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-400 dark:border-slate-700">
                No audit events recorded yet.
              </p>
            ) : (
              auditLogs.slice(0, 8).map((entry) => {
                const severityDot =
                  entry.severity === "critical" ? "bg-rose-500" :
                  entry.severity === "warning"  ? "bg-amber-400" : "bg-emerald-500";
                return (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${severityDot}`} />
                        <p className="text-sm font-semibold text-oxford-700 dark:text-slate-100">{entry.action}</p>
                      </div>
                      <p className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}</p>
                    </div>
                    {entry.details && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{entry.details}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Severity overview</p>
          <div className="mt-4 space-y-2">
            {severityGroups.map((group) => (
              <div key={group.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${group.dot}`} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{group.label}</span>
                </div>
                <span className={`text-sm font-semibold ${group.text}`}>{group.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
