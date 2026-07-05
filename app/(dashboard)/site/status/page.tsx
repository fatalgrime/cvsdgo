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
        if (!response.ok) {
          throw new Error(await response.text());
        }
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
      const severity = entry.severity || "info";
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});

    return [
      { label: "Critical", value: counts.critical ?? 0, tone: "text-rose-700" },
      { label: "Warning", value: counts.warning ?? 0, tone: "text-amber-700" },
      { label: "Info", value: counts.info ?? 0, tone: "text-emerald-700" },
    ];
  }, [auditLogs]);

  return (
    <section className="space-y-6">
      <div className="panel-strong p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Status</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">Website health & monitoring</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Review system health, recent admin activity, and the current webhook state from one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Database</p>
          <p className="mt-3 text-2xl font-semibold text-oxford-700">{health?.databaseConfigured ? "Connected" : "Pending"}</p>
          <p className="mt-2 text-sm text-slate-600">The application can write admin and audit data.</p>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Webhook</p>
          <p className="mt-3 text-2xl font-semibold text-oxford-700">{health?.webhookConfigured ? "Active" : "Offline"}</p>
          <p className="mt-2 text-sm text-slate-600">Discord alerts are currently enabled for important actions.</p>
        </div>
        <div className="panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Latest activity</p>
          <p className="mt-3 text-lg font-semibold text-oxford-700">{health?.latestActivityAt ? new Date(health.latestActivityAt).toLocaleString() : "No activity yet"}</p>
          <p className="mt-2 text-sm text-slate-600">The most recent recorded audit event.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Recent activity</p>
              <p className="mt-1 text-sm text-slate-600">Latest audit events and their severity.</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              {health?.auditLogEntries ?? 0} entries
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-600">Loading activity…</p>
            ) : auditLogs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">No audit events recorded yet.</p>
            ) : (
              auditLogs.slice(0, 8).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-oxford-700">{entry.action}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  {entry.details && <p className="mt-2 text-sm text-slate-600">{entry.details}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">Severity overview</p>
          <div className="mt-4 space-y-3">
            {severityGroups.map((group) => (
              <div key={group.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                <span className="text-sm font-medium text-slate-700">{group.label}</span>
                <span className={`text-sm font-semibold ${group.tone}`}>{group.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
