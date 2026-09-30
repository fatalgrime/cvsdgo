"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";
import { PageHeader } from "@/components/page-header";

type Severity = "info" | "warning" | "critical";

type AuditLogEntry = {
  id: number;
  action: string;
  details: string | null;
  actor_user_id: string | null;
  actor_username: string | null;
  actor_email: string | null;
  actor_discord_username: string | null;
  actor_discord_user_id: string | null;
  actor_has_discord_account: boolean;
  actor_has_login_account: boolean;
  actor_ip_address: string | null;
  actor_user_agent: string | null;
  metadata: Record<string, unknown> | null;
  severity: Severity | null;
  category: string | null;
  source: string | null;
  created_at: string;
};

type SettingsResponse = {
  auditLogs: AuditLogEntry[];
  health: {
    databaseConfigured: boolean;
    webhookConfigured: boolean;
    auditLogEntries: number;
    latestActivityAt: string | null;
  };
};

const severityStyles: Record<Severity, { label: string; dot: string; badge: string; icon: string }> = {
  info: { label: "Info", dot: "bg-blue-500", badge: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300", icon: "text-blue-600 dark:text-blue-300" },
  warning: { label: "Warning", dot: "bg-amber-500", badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300", icon: "text-amber-600 dark:text-amber-300" },
  critical: { label: "Critical", dot: "bg-rose-500", badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300", icon: "text-rose-600 dark:text-rose-300" },
};

function getActorLabel(entry: AuditLogEntry): string {
  return entry.actor_username || entry.actor_discord_username || entry.actor_email || "Unknown account";
}

function formatCategory(value: string | null): string {
  if (!value) return "General";
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export default function StatusPage() {
  const { toast } = useToast();
  const [health, setHealth] = useState<SettingsResponse["health"] | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const loadStatus = useCallback(async (quiet = false) => {
    if (quiet) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const response = await fetch("/api/admin/settings", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const data = (await response.json()) as SettingsResponse;
      setHealth(data.health ?? null);
      setAuditLogs(data.auditLogs ?? []);
      setLastUpdated(new Date());
    } catch (error) {
      if (!quiet) toast({ title: "Unable to load status", description: (error as Error).message, variant: "error" });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(true), 30_000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  const categories = useMemo(() => [...new Set(auditLogs.map((entry) => entry.category).filter((value): value is string => Boolean(value)))].sort(), [auditLogs]);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      const severity = entry.severity || "info";
      if (severityFilter !== "all" && severity !== severityFilter) return false;
      if (categoryFilter !== "all" && entry.category !== categoryFilter) return false;
      if (!normalizedQuery) return true;
      return [entry.action, entry.details, entry.actor_username, entry.actor_email, entry.actor_discord_username, entry.category, entry.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [auditLogs, categoryFilter, query, severityFilter]);

  const severityCounts = useMemo(() => auditLogs.reduce<Record<Severity, number>>((counts, entry) => {
    counts[entry.severity || "info"] += 1;
    return counts;
  }, { info: 0, warning: 0, critical: 0 }), [auditLogs]);

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of auditLogs) counts.set(entry.source || "CVSD Go", (counts.get(entry.source || "CVSD Go") || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [auditLogs]);

  const statCards = [
    { label: "Database", value: health?.databaseConfigured ? "Connected" : "Unavailable", description: "Audit and application storage", healthy: Boolean(health?.databaseConfigured) },
    { label: "Discord delivery", value: health?.webhookConfigured ? "Configured" : "Not configured", description: "Administrative event notifications", healthy: Boolean(health?.webhookConfigured) },
    { label: "Recorded events", value: String(health?.auditLogEntries ?? auditLogs.length), description: "Most recent activity window", healthy: true },
    { label: "Critical events", value: String(severityCounts.critical), description: "Events requiring review", healthy: severityCounts.critical === 0 },
  ];

  return (
    <section className="space-y-5">
      <PageHeader eyebrow="Administration" title="System Activity" description="Monitor application health and review administrative events with account-level context." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="panel p-5">
            <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{card.label}</p><span className={`h-2.5 w-2.5 rounded-full ${card.healthy ? "bg-emerald-500" : "bg-amber-500"}`}/></div>
            {isLoading ? <div className="mt-3 h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700"/> : <p className="mt-3 text-xl font-semibold text-oxford-700 dark:text-slate-100">{card.value}</p>}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold text-oxford-700 dark:text-slate-100">Activity log</h2><p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Auto-refreshes every 30 seconds.</p></div>
              <div className="flex items-center gap-3">
                <span className="hidden text-xs text-slate-500 sm:block">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : `${filteredLogs.length} of ${auditLogs.length} events`}</span>
                <button type="button" onClick={() => void loadStatus(true)} disabled={isRefreshing} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-oxford-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>
                  Refresh
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_11rem]">
              <label className="relative"><span className="sr-only">Search activity</span><svg aria-hidden="true" viewBox="0 0 24 24" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions, people, or details" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-oxford-600 focus:ring-2 focus:ring-oxford-600/15 dark:border-slate-700 dark:bg-slate-900"/></label>
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as "all" | Severity)} aria-label="Filter by severity" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-oxford-600 dark:border-slate-700 dark:bg-slate-900"><option value="all">All statuses</option><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by category" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-oxford-600 dark:border-slate-700 dark:bg-slate-900"><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}</select>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {isLoading ? [0,1,2,3].map((item) => <div key={item} className="animate-pulse p-5"><div className="h-4 w-52 rounded bg-slate-200 dark:bg-slate-700"/><div className="mt-3 h-3 w-3/4 rounded bg-slate-100 dark:bg-slate-800"/></div>) : filteredLogs.length === 0 ? (
              <div className="px-5 py-12 text-center"><p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No matching activity</p><p className="mt-1 text-sm text-slate-400">Try changing the search or filters.</p></div>
            ) : filteredLogs.map((entry) => {
              const severity = entry.severity || "info";
              const styles = severityStyles[severity];
              return (
                <article key={entry.id} className="p-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-900/50 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 ${styles.icon} dark:bg-slate-900`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><h3 className="text-sm font-semibold text-oxford-700 dark:text-slate-100">{entry.action}</h3><p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">{entry.details || "No additional details."}</p></div>
                        <time className="shrink-0 text-xs text-slate-400" dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${styles.badge}`}><span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}/>{styles.label}</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{getActorLabel(entry)}</span>
                        {entry.actor_email && entry.actor_email !== getActorLabel(entry) ? <span className="text-slate-500">{entry.actor_email}</span> : null}
                        {entry.actor_discord_username ? <span className="text-indigo-600 dark:text-indigo-300">Discord @{entry.actor_discord_username}</span> : null}
                        <span className="text-slate-500">{formatCategory(entry.category)}</span>
                      </div>
                      {(entry.actor_user_id || entry.actor_ip_address || entry.metadata) && (
                        <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer select-none font-semibold hover:text-oxford-700 dark:hover:text-slate-200">Technical details</summary><div className="mt-2 grid gap-1 rounded-xl bg-slate-50 p-3 font-mono dark:bg-slate-900"><span>Source: {entry.source || "CVSD Go"}</span>{entry.actor_user_id ? <span>Clerk ID: {entry.actor_user_id}</span> : null}{entry.actor_discord_user_id ? <span>Discord ID: {entry.actor_discord_user_id}</span> : null}{entry.actor_ip_address ? <span>IP: {entry.actor_ip_address}</span> : null}{entry.metadata ? <span className="break-all">Metadata: {JSON.stringify(entry.metadata)}</span> : null}</div></details>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="panel p-5"><h2 className="text-sm font-semibold text-oxford-700 dark:text-slate-100">Event status</h2><div className="mt-4 space-y-2">{(["critical","warning","info"] as Severity[]).map((severity) => <button key={severity} type="button" onClick={() => setSeverityFilter(severityFilter === severity ? "all" : severity)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"><span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"><span className={`h-2.5 w-2.5 rounded-full ${severityStyles[severity].dot}`}/>{severityStyles[severity].label}</span><span className="text-sm font-semibold text-oxford-700 dark:text-slate-100">{severityCounts[severity]}</span></button>)}</div></div>
          <div className="panel p-5"><h2 className="text-sm font-semibold text-oxford-700 dark:text-slate-100">Active sources</h2><p className="mt-1 text-xs text-slate-500">Where recent events originated.</p><div className="mt-4 space-y-3">{sourceCounts.length ? sourceCounts.map(([source, count]) => <div key={source} className="flex items-center justify-between gap-3"><span className="truncate text-sm text-slate-600 dark:text-slate-300">{formatCategory(source)}</span><span className="text-xs font-semibold text-slate-500">{count}</span></div>) : <p className="text-sm text-slate-400">No sources recorded.</p>}</div></div>
        </aside>
      </div>
    </section>
  );
}
