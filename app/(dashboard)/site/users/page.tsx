"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { useToast } from "@/components/toast-provider";
import type { ReportCommentRow, ReportRow } from "@/lib/types";

type ReportingProfile = {
  reportBanType: string;
  reportBannedUntil: string | null;
  reportLimitHourly: number;
  reportLimitDaily: number;
  reportStrikes: number;
  reportLastStrikeAt: string | null;
};

type ManagedUser = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  imageUrl: string;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  lastSignInAt: number | null;
  allowlisted: boolean;
  admin: boolean;
  reportStaff: boolean;
  metadataAdmin: boolean;
  metadataReportStaff: boolean;
  reportBanType: string;
  reportBannedUntil: string | null;
  reportLimitHourly: number;
  reportLimitDaily: number;
  reportStrikes: number;
  reportLastStrikeAt: string | null;
};

type UsersResponse = {
  users: ManagedUser[];
};

type UserReportResponse = {
  profile: ReportingProfile;
  reports: ReportRow[];
  comments: ReportCommentRow[];
};

const initialReportingProfile: ReportingProfile = {
  reportBanType: "none",
  reportBannedUntil: null,
  reportLimitHourly: 0,
  reportLimitDaily: 0,
  reportStrikes: 0,
  reportLastStrikeAt: null,
};

export default function UsersPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ReportingProfile>(initialReportingProfile);
  const [reportHistory, setReportHistory] = useState<ReportRow[]>([]);
  const [reportComments, setReportComments] = useState<ReportCommentRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [savingReportSettings, setSavingReportSettings] = useState(false);
  const [reportBanType, setReportBanType] = useState("none");
  const [reportBannedUntil, setReportBannedUntil] = useState<string>("");
  const [reportLimitHourly, setReportLimitHourly] = useState<string>("");
  const [reportLimitDaily, setReportLimitDaily] = useState<string>("");
  const [resetStrikes, setResetStrikes] = useState(false);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) => {
      const haystack = `${user.name} ${user.email ?? ""} ${user.username ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [query, users]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as UsersResponse;
      setUsers(data.users ?? []);
    } catch (error) {
      const message = (error as Error).message || "Unable to load users.";
      setStatusMessage(message);
      toast({ title: "Unable to load users", description: message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  function setPendingFor(id: string, value: boolean) {
    setPending((current) => ({ ...current, [id]: value }));
  }

  async function updateRoles(user: ManagedUser, patch: { admin?: boolean; reportStaff?: boolean }) {
    setPendingFor(user.id, true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await loadUsers();
      toast({ title: "User access updated", description: user.email ?? user.name, variant: "success" });
    } catch (error) {
      toast({ title: "Unable to update access", description: (error as Error).message, variant: "error" });
    } finally {
      setPendingFor(user.id, false);
    }
  }

  async function performAction(user: ManagedUser, action: "lock" | "unlock" | "force_password_reset") {
    setPendingFor(user.id, true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await loadUsers();
      const title =
        action === "force_password_reset"
          ? "Password reset required"
          : action === "lock"
          ? "Account locked"
          : "Account unlocked";
      toast({ title, description: user.email ?? user.name, variant: "warning" });
    } catch (error) {
      toast({ title: "Unable to update account", description: (error as Error).message, variant: "error" });
    } finally {
      setPendingFor(user.id, false);
    }
  }

  async function loadReportHistory(user: ManagedUser) {
    setReportLoading(true);
    setReportError(null);
    setSelectedUser(user);
    setReportHistory([]);
    setReportComments([]);
    setSelectedProfile(initialReportingProfile);
    setResetStrikes(false);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`);
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as UserReportResponse;
      setReportHistory(data.reports ?? []);
      setReportComments(data.comments ?? []);
      setSelectedProfile(data.profile ?? initialReportingProfile);
      setReportBanType(data.profile.reportBanType);
      setReportBannedUntil(data.profile.reportBannedUntil ?? "");
      setReportLimitHourly(data.profile.reportLimitHourly > 0 ? String(data.profile.reportLimitHourly) : "");
      setReportLimitDaily(data.profile.reportLimitDaily > 0 ? String(data.profile.reportLimitDaily) : "");
    } catch (error) {
      const message = (error as Error).message || "Unable to load report history.";
      setReportError(message);
      toast({ title: "Unable to load report history", description: message, variant: "error" });
    } finally {
      setReportLoading(false);
    }
  }

  async function saveReportingSettings() {
    if (!selectedUser) return;
    setSavingReportSettings(true);
    try {
      const payload = {
        reportBanType: reportBanType || "none",
        bannedUntil: reportBanType === "temporary" ? reportBannedUntil || null : null,
        limitHourly: reportLimitHourly ? Number(reportLimitHourly) : 0,
        limitDaily: reportLimitDaily ? Number(reportLimitDaily) : 0,
        resetStrikes,
      };
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await loadUsers();
      await loadReportHistory(selectedUser);
      toast({ title: "Report profile updated", description: selectedUser.email ?? selectedUser.name, variant: "success" });
    } catch (error) {
      toast({ title: "Unable to save report settings", description: (error as Error).message, variant: "error" });
    } finally {
      setSavingReportSettings(false);
      setResetStrikes(false);
    }
  }

  function closeReportModal() {
    setSelectedUser(null);
    setSelectedProfile(initialReportingProfile);
    setReportHistory([]);
    setReportComments([]);
    setReportError(null);
    setReportBanType("none");
    setReportBannedUntil("");
    setReportLimitHourly("");
    setReportLimitDaily("");
    setResetStrikes(false);
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeReportModal();
    }
  }

  const activeReportBadge = (user: ManagedUser) => {
    if (user.reportBanType === "permanent") {
      return "Permanently banned from reporting";
    }
    if (user.reportBanType === "temporary") {
      return `Reporting suspended until ${new Date(user.reportBannedUntil ?? "").toLocaleString()}`;
    }
    return null;
  };

  const currentReportStatus =
    selectedProfile.reportBanType === "permanent"
      ? "Permanently banned"
      : selectedProfile.reportBanType === "temporary"
      ? "Temporary restriction"
      : "Normal reporting access";

  const currentReportCaption =
    selectedProfile.reportBanType === "permanent"
      ? "Reporting is disabled for this account."
      : selectedProfile.reportBanType === "temporary" && selectedProfile.reportBannedUntil
      ? `Active until ${new Date(selectedProfile.reportBannedUntil).toLocaleString()}`
      : "This user can still submit reports.";

  return (
    <section className="space-y-6">
      <div className="panel-strong p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Users</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">User Management</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Manage users, access roles, and report moderation settings from one polished workspace.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold uppercase tracking-[0.08em]">Sign in required</p>
          <p className="mt-2">You need to sign in to manage users.</p>
          <SignInButton>
            <button
              className="mt-4 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
              type="button"
            >
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="panel p-4 md:p-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 md:flex-row md:items-center md:justify-between md:p-4">
            <div>
              <p className="text-sm font-semibold text-oxford-700">Search directory</p>
              <p className="mt-1 text-sm text-slate-600">Find accounts quickly by name, username, or email.</p>
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users by name, username, or email..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-oxford-700 outline-none transition placeholder:text-slate-500 focus:border-oxford-700 focus:ring-2 focus:ring-[var(--ring-soft)] md:max-w-md"
              aria-label="Search users"
            />
          </div>
        </div>

        {statusMessage && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{statusMessage}</p>
        )}

        <div className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <div className="panel p-6">
              <p className="text-sm text-slate-600">No users matched your search.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isBusy = pending[user.id] === true;
              const accountStatus = user.locked ? "Locked" : "Active";
              const reportBadge = activeReportBadge(user);
              return (
                <motion.article
                  key={user.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="panel p-4 md:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="min-w-[220px] flex-1">
                      <p className="text-base font-semibold text-oxford-700">{user.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{user.email ?? "No email"}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {accountStatus}
                        </span>
                        {user.allowlisted && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200">
                            Allowlisted
                          </span>
                        )}
                        {user.admin && (
                          <span className="rounded-full border border-oxford-200 bg-slate-50 px-2 py-1 text-oxford-700 dark:border-oxford-700 dark:bg-oxford-900 dark:text-slate-100">
                            Admin Access
                          </span>
                        )}
                        {user.reportStaff && (
                          <span className="rounded-full border border-deepforest-200 bg-slate-50 px-2 py-1 text-deepforest-700 dark:border-deepforest-700 dark:bg-deepforest-900/80 dark:text-slate-100">
                            Report Staff
                          </span>
                        )}
                        {reportBadge && (
                          <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-100">
                            {reportBadge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid w-full gap-3 md:w-auto md:min-w-[340px]">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <span>Admin Features</span>
                          <input
                            type="checkbox"
                            checked={user.metadataAdmin}
                            disabled={isBusy || user.allowlisted}
                            onChange={(event) => updateRoles(user, { admin: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                          />
                        </label>
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <span>Reports Staff</span>
                          <input
                            type="checkbox"
                            checked={user.metadataReportStaff}
                            disabled={isBusy}
                            onChange={(event) => updateRoles(user, { reportStaff: event.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                          />
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => performAction(user, user.locked ? "unlock" : "lock")}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-oxford-700 transition hover:border-oxford-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {user.locked ? "Unlock Account" : "Lock Account"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => performAction(user, "force_password_reset")}
                          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Require Password Reset
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => loadReportHistory(user)}
                          className="rounded-xl border border-deepforest-200 bg-deepforest-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-deepforest-700 transition hover:border-deepforest-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          View Report History
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </div>

        <AnimatePresence>
          {selectedUser && (
            <motion.div
              className="fixed inset-0 z-50 flex min-h-screen items-center justify-center bg-slate-950/70 backdrop-blur-2xl p-4 overflow-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
            >
              <motion.div
                className="w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
                  <div>
                    <h2 className="text-lg font-serif font-semibold text-oxford-800">Report history for {selectedUser.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">Review user reports and adjust moderation controls without the extra visual weight.</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeReportModal}
                    className="rounded-full border border-slate-300 bg-white p-2 text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-oxford-700 active:scale-95"
                    aria-label="Close modal"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="max-h-[calc(100vh-2rem-73px)] space-y-4 overflow-y-auto p-4 sm:p-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Profile snapshot</p>
                        <p className="mt-1 text-sm text-slate-600">A compact view of the current moderation state and recent activity.</p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                        <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-600">{currentReportStatus}</span>
                        <span className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-slate-600">{selectedProfile.reportStrikes} strike{selectedProfile.reportStrikes === 1 ? "" : "s"}</span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Current status</p>
                        <p className="mt-2 text-sm font-semibold text-slate-700">{currentReportStatus}</p>
                        <p className="mt-1 text-sm text-slate-500">{currentReportCaption}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Limits</p>
                        <p className="mt-2 text-sm text-slate-700">Hourly: {selectedProfile.reportLimitHourly || "none"}</p>
                        <p className="mt-1 text-sm text-slate-700">Daily: {selectedProfile.reportLimitDaily || "none"}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Last activity</p>
                        <p className="mt-2 text-sm text-slate-700">{selectedProfile.reportLastStrikeAt ? new Date(selectedProfile.reportLastStrikeAt).toLocaleString() : "No recent strike"}</p>
                        <p className="mt-1 text-sm text-slate-500">Updated from the latest moderation action.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Moderation settings</p>
                          <p className="mt-1 text-sm text-slate-600">Adjust report access and limits in a clearer, guided flow.</p>
                        </div>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                          Guided
                        </span>
                      </div>
                      <div className="mt-4 space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="report-ban-type">
                            Reporting ban
                          </label>
                          <select
                            id="report-ban-type"
                            value={reportBanType}
                            onChange={(event) => setReportBanType(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-2 focus:ring-[var(--ring-soft)]"
                          >
                            <option value="none">No restriction</option>
                            <option value="temporary">Temporary restriction</option>
                            <option value="permanent">Permanent ban</option>
                          </select>
                          <p className="mt-2 text-sm text-slate-600">Choose whether the user can report right away, for a limited time, or never again.</p>
                        </div>
                        {reportBanType === "temporary" && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="report-ban-until">
                              Restriction expires
                            </label>
                            <input
                              id="report-ban-until"
                              type="datetime-local"
                              value={reportBannedUntil}
                              onChange={(event) => setReportBannedUntil(event.target.value)}
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-2 focus:ring-[var(--ring-soft)]"
                            />
                          </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="hourly-limit">
                              Hourly limit
                            </label>
                            <input
                              id="hourly-limit"
                              type="number"
                              min="0"
                              value={reportLimitHourly}
                              onChange={(event) => setReportLimitHourly(event.target.value)}
                              placeholder="0"
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-2 focus:ring-[var(--ring-soft)]"
                            />
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600" htmlFor="daily-limit">
                              Daily limit
                            </label>
                            <input
                              id="daily-limit"
                              type="number"
                              min="0"
                              value={reportLimitDaily}
                              onChange={(event) => setReportLimitDaily(event.target.value)}
                              placeholder="0"
                              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-2 focus:ring-[var(--ring-soft)]"
                            />
                          </div>
                        </div>
                        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={resetStrikes}
                            onChange={(event) => setResetStrikes(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                          />
                          <span>
                            <span className="font-semibold text-slate-800">Reset strike count</span>
                            <span className="mt-1 block text-xs text-slate-500">Clear prior strikes so future moderation decisions start fresh.</span>
                          </span>
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={savingReportSettings}
                            onClick={saveReportingSettings}
                            className="rounded-2xl bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Save report settings
                          </button>
                          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Changes apply immediately.</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Recent reports</p>
                          <p className="mt-1 text-sm text-slate-600">A concise history of submitted reports for this user.</p>
                        </div>
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                          {reportHistory.length} item{reportHistory.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {reportLoading ? (
                        <p className="mt-4 text-sm text-slate-600">Loading report history…</p>
                      ) : reportError ? (
                        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{reportError}</p>
                      ) : reportHistory.length === 0 ? (
                        <p className="mt-4 text-sm text-slate-600">No reports submitted by this user.</p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {reportHistory.map((report) => (
                            <div key={report.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <p className="font-semibold text-slate-800">{report.title}</p>
                                <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-600">
                                  {report.status}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">{report.description}</p>
                              {report.handled_by_name && (
                                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">Handled by {report.handled_by_name}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {reportComments.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">Comments</p>
                      <div className="mt-4 space-y-3">
                        {reportComments.map((comment) => (
                          <div key={comment.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-800">Comment on report #{comment.report_id}</p>
                            <p className="mt-2 text-sm text-slate-600">{comment.body}</p>
                            <p className="mt-2 text-xs text-slate-500">By {comment.author_name ?? comment.author_user_id} · {new Date(comment.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </SignedIn>
    </section>
  );
}
