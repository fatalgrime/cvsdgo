"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Image from "next/image";
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

type UsersResponse = { users: ManagedUser[] };
type UserReportResponse = {
  profile: ReportingProfile;
  reports: ReportRow[];
  comments: ReportCommentRow[];
};
type ToastInput = {
  title: string;
  description?: string;
  variant?: "success" | "error" | "info" | "warning";
  action?: { label: string; onClick: () => void };
  avatarUrl?: string;
  avatarAlt?: string;
};
type SortField = "name" | "lastSignIn" | "status" | "role";
type SortDir = "asc" | "desc";
type FilterRole = "all" | "admin" | "reportStaff" | "allowlisted";
type FilterStatus = "all" | "active" | "locked" | "reportBanned";
type ConfirmAction =
  | { type: "lock"; user: ManagedUser }
  | { type: "unlock"; user: ManagedUser }
  | { type: "pwreset"; user: ManagedUser }
  | { type: "bulkLock"; ids: string[] }
  | { type: "bulkUnlock"; ids: string[] }
  | { type: "bulkPwreset"; ids: string[] };

const initialReportingProfile: ReportingProfile = {
  reportBanType: "none",
  reportBannedUntil: null,
  reportLimitHourly: 0,
  reportLimitDaily: 0,
  reportStrikes: 0,
  reportLastStrikeAt: null,
};

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
  label,
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id: string;
  label: string;
  title?: string;
}) {
  return (
    <label
      htmlFor={id}
      title={title}
      className={`inline-flex cursor-pointer items-center gap-2 select-none ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className="relative">
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={`block h-5 w-9 rounded-full transition-colors duration-200 ${
            checked ? "bg-oxford-700" : "bg-slate-300 dark:bg-slate-600"
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  );
}

function StatusBadge({ status }: { status: "active" | "locked" | "pwreset" | "reportBanned" | "permanentBan" }) {
  const cfg = {
    active:      { dot: "bg-emerald-500",  text: "text-emerald-700 dark:text-emerald-300",  label: "Active" },
    locked:      { dot: "bg-rose-500",     text: "text-rose-700 dark:text-rose-300",        label: "Locked" },
    pwreset:     { dot: "bg-amber-400",    text: "text-amber-700 dark:text-amber-300",      label: "Pw Reset" },
    reportBanned:{ dot: "bg-orange-400",   text: "text-orange-700 dark:text-orange-300",    label: "Rpt Banned" },
    permanentBan:{ dot: "bg-red-600",      text: "text-red-700 dark:text-red-300",          label: "Perm Ban" },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cfg.text}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/** Role pill chip. */
function RolePill({ label, color }: { label: string; color: "oxford" | "deepforest" | "amber" }) {
  const cls = {
    oxford:     "border-oxford-200 bg-oxford-50 text-oxford-700 dark:border-oxford-700 dark:bg-oxford-900/60 dark:text-slate-200",
    deepforest: "border-deepforest-200 bg-deepforest-50 text-deepforest-700 dark:border-deepforest-700 dark:bg-deepforest-900/60 dark:text-slate-200",
    amber:      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  }[color];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${cls}`}>
      {label}
    </span>
  );
}

function UserAvatar({ user }: { user: ManagedUser }) {
  const [imgError, setImgError] = useState(false);
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  if (user.imageUrl && !imgError) {
    return (
      <Image
        src={user.imageUrl}
        alt={user.name}
        width={36}
        height={36}
        unoptimized
        onError={() => setImgError(true)}
        className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
      />
    );
  }
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oxford-100 text-xs font-bold text-oxford-700 dark:bg-oxford-800 dark:text-slate-200">
      {initials || "?"}
    </span>
  );
}

function ConfirmDialog({
  action,
  onConfirm,
  onCancel,
}: {
  action: ConfirmAction;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cfg: Record<ConfirmAction["type"], { title: string; body: string; cta: string; danger: boolean }> = {
    lock:        { title: "Lock account?",                body: "The user will be unable to sign in until unlocked.", cta: "Lock account",        danger: true  },
    unlock:      { title: "Unlock account?",              body: "The user will regain access immediately.",           cta: "Unlock account",      danger: false },
    pwreset:     { title: "Require password reset?",      body: "The user will be forced to set a new password at next sign-in.", cta: "Require reset", danger: false },
    bulkLock:    { title: "Lock selected accounts?",      body: `${(action as { ids: string[] }).ids.length} account(s) will be locked.`, cta: "Lock all", danger: true  },
    bulkUnlock:  { title: "Unlock selected accounts?",    body: `${(action as { ids: string[] }).ids.length} account(s) will be unlocked.`, cta: "Unlock all", danger: false },
    bulkPwreset: { title: "Require password resets?",     body: `${(action as { ids: string[] }).ids.length} account(s) will require a new password.`, cta: "Require all", danger: false },
  };
  const { title, body, cta, danger } = cfg[action.type];

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700">Confirm action</p>
        <h3 className="mt-2 font-serif text-xl text-oxford-700 dark:text-slate-100">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{body}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
              danger
                ? "bg-rose-600 hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
                : "border border-oxford-700 bg-oxford-700 hover:bg-oxford-600 focus:ring-2 focus:ring-oxford-500 focus:ring-offset-1"
            }`}
          >
            {cta}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ActionsMenu({
  user,
  isBusy,
  onLock,
  onPwReset,
  onViewReports,
}: {
  user: ManagedUser;
  isBusy: boolean;
  onLock: () => void;
  onPwReset: () => void;
  onViewReports: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        menuRef.current && !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function handleOpen() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setCoords({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    });
    setOpen((v) => !v);
  }

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="User actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={isBusy}
        onClick={handleOpen}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {isBusy ? (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3.3-6.9" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
          </svg>
        )}
      </button>

      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              style={{ position: "absolute", top: coords.top, right: coords.right }}
              className="z-[300] min-w-[192px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              <button role="menuitem" type="button" className={item} onClick={() => { onViewReports(); setOpen(false); }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                View Report History
              </button>
              <button role="menuitem" type="button" className={item} onClick={() => { onPwReset(); setOpen(false); }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Require Password Reset
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                role="menuitem"
                type="button"
                className={`${item} ${user.locked ? "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40" : "text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"}`}
                onClick={() => { onLock(); setOpen(false); }}
              >
                {user.locked ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                )}
                {user.locked ? "Unlock Account" : "Lock Account"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

function ReportModal({
  user,
  profile,
  reportHistory,
  reportComments,
  reportLoading,
  reportError,
  reportBanType,
  setReportBanType,
  reportBannedUntil,
  setReportBannedUntil,
  reportLimitHourly,
  setReportLimitHourly,
  reportLimitDaily,
  setReportLimitDaily,
  resetStrikes,
  setResetStrikes,
  saving,
  onSave,
  onClose,
}: {
  user: ManagedUser;
  profile: ReportingProfile;
  reportHistory: ReportRow[];
  reportComments: ReportCommentRow[];
  reportLoading: boolean;
  reportError: string | null;
  reportBanType: string;
  setReportBanType: (v: string) => void;
  reportBannedUntil: string;
  setReportBannedUntil: (v: string) => void;
  reportLimitHourly: string;
  setReportLimitHourly: (v: string) => void;
  reportLimitDaily: string;
  setReportLimitDaily: (v: string) => void;
  resetStrikes: boolean;
  setResetStrikes: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const currentStatus =
    profile.reportBanType === "permanent" ? "Permanently banned"
    : profile.reportBanType === "temporary" ? "Temporary restriction"
    : "Normal access";
  const currentCaption =
    profile.reportBanType === "permanent" ? "Reporting is disabled for this account."
    : profile.reportBanType === "temporary" && profile.reportBannedUntil
    ? `Active until ${new Date(profile.reportBannedUntil).toLocaleString()}`
    : "This user can submit reports normally.";

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center">
        <motion.div
          className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          {/* Modal header */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <UserAvatar user={user} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">Report & moderation</p>
                <h2 className="mt-0.5 font-serif text-xl leading-tight text-oxford-700 dark:text-slate-100">{user.name}</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>

          <div className="max-h-[calc(100vh-9rem)] space-y-4 overflow-y-auto p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              {/* Moderation settings panel */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Moderation controls</p>

                <div>
                  <label htmlFor="modal-ban-type" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-400">
                    Reporting access
                  </label>
                  <select
                    id="modal-ban-type"
                    value={reportBanType}
                    onChange={(e) => setReportBanType(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="none">No restriction</option>
                    <option value="temporary">Temporary restriction</option>
                    <option value="permanent">Permanent ban</option>
                  </select>
                </div>

                {reportBanType === "temporary" && (
                  <div>
                    <label htmlFor="modal-ban-until" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-400">
                      Restriction ends
                    </label>
                    <input
                      id="modal-ban-until"
                      type="datetime-local"
                      value={reportBannedUntil}
                      onChange={(e) => setReportBannedUntil(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>
                )}

                {reportBanType !== "none" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="modal-hourly" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-400">Hourly limit</label>
                      <input id="modal-hourly" type="number" min="0" value={reportLimitHourly} onChange={(e) => setReportLimitHourly(e.target.value)} placeholder="0"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                    </div>
                    <div>
                      <label htmlFor="modal-daily" className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-400">Daily limit</label>
                      <input id="modal-daily" type="number" min="0" value={reportLimitDaily} onChange={(e) => setReportLimitDaily(e.target.value)} placeholder="0"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                    </div>
                  </div>
                )}

                {reportBanType !== "none" && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <input type="checkbox" checked={resetStrikes} onChange={(e) => setResetStrikes(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700" />
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Reset strike count</p>
                      <p className="mt-0.5 text-xs text-slate-500">Clear existing strikes before applying this action.</p>
                    </div>
                  </label>
                )}

                <button
                  type="button"
                  disabled={saving}
                  onClick={onSave}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-oxford-700 bg-oxford-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                >
                  {saving && <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3.3-6.9" /></svg>}
                  Save moderation settings
                </button>
              </div>

              {/* Profile summary panel */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Profile summary</p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {profile.reportStrikes} strike{profile.reportStrikes === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "Status",      value: currentStatus, sub: currentCaption },
                    { label: "Hourly limit", value: profile.reportLimitHourly || "None" },
                    { label: "Daily limit",  value: profile.reportLimitDaily  || "None" },
                    { label: "Last strike",  value: profile.reportLastStrikeAt ? new Date(profile.reportLastStrikeAt).toLocaleString() : "None" },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                      <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{String(value)}</p>
                      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent reports */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recent reports</p>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {reportHistory.length} item{reportHistory.length === 1 ? "" : "s"}
                </span>
              </div>
              {reportLoading ? (
                <p className="mt-3 text-sm text-slate-500">Loading…</p>
              ) : reportError ? (
                <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{reportError}</p>
              ) : reportHistory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No reports submitted by this user.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {reportHistory.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.title}</p>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600 dark:border-slate-700 dark:bg-slate-900">{r.status}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{r.description}</p>
                      {r.handled_by_name && <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-slate-400">Handled by {r.handled_by_name}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            {reportComments.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Comments</p>
                <div className="mt-3 space-y-2">
                  {reportComments.map((c) => (
                    <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Comment on report #{c.report_id}</p>
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{c.body}</p>
                      <p className="mt-1.5 text-[10px] text-slate-400">By {c.author_name ?? c.author_user_id} · {new Date(c.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function UsersPage() {
  const { toast } = useToast();

  // --- data state ---
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // --- toolbar state ---
  const [query, setQuery] = useState("");
  const [filterRole, setFilterRole] = useState<FilterRole>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // --- bulk selection ---
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- confirm dialog ---
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // --- report modal ---
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<ReportingProfile>(initialReportingProfile);
  const [reportHistory, setReportHistory] = useState<ReportRow[]>([]);
  const [reportComments, setReportComments] = useState<ReportCommentRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [savingReport, setSavingReport] = useState(false);
  const [reportBanType, setReportBanType] = useState("none");
  const [reportBannedUntil, setReportBannedUntil] = useState("");
  const [reportLimitHourly, setReportLimitHourly] = useState("");
  const [reportLimitDaily, setReportLimitDaily] = useState("");
  const [resetStrikes, setResetStrikes] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as UsersResponse;
      setUsers(data.users ?? []);
      setSelected(new Set());
    } catch (err) {
      const msg = (err as Error).message || "Unable to load users.";
      setLoadError(msg);
      toast({ title: "Unable to load users", description: msg, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const processedUsers = useMemo(() => {
    let list = [...users];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((u) => `${u.name} ${u.email ?? ""} ${u.username ?? ""}`.toLowerCase().includes(q));
    }
    if (filterRole !== "all") {
      list = list.filter((u) =>
        filterRole === "admin" ? u.admin
        : filterRole === "reportStaff" ? u.reportStaff
        : u.allowlisted
      );
    }
    if (filterStatus !== "all") {
      list = list.filter((u) =>
        filterStatus === "active" ? !u.locked && u.reportBanType === "none"
        : filterStatus === "locked" ? u.locked
        : u.reportBanType !== "none"
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name")      cmp = a.name.localeCompare(b.name);
      else if (sortField === "lastSignIn") cmp = (b.lastSignInAt ?? 0) - (a.lastSignInAt ?? 0);
      else if (sortField === "status")    cmp = Number(a.locked) - Number(b.locked);
      else if (sortField === "role")      cmp = Number(b.admin) - Number(a.admin);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [users, query, filterRole, filterStatus, sortField, sortDir]);

  const allVisibleIds = useMemo(() => processedUsers.map((u) => u.id), [processedUsers]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allVisibleIds));
    }
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function cycleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  function toastFor(user: ManagedUser, input: ToastInput) {
    toast({ ...input, avatarUrl: user.imageUrl || undefined, avatarAlt: user.name });
  }
  function toastWithUndo(user: ManagedUser, input: ToastInput, undoLabel: string, onUndo: () => void | Promise<void>) {
    toastFor(user, { ...input, action: { label: undoLabel, onClick: () => void onUndo() } });
  }

  function setBusy(id: string, val: boolean) {
    setPending((p) => ({ ...p, [id]: val }));
  }

  async function updateRoles(user: ManagedUser, patch: { admin?: boolean; reportStaff?: boolean }) {
    setBusy(user.id, true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadUsers();
      const key = "admin" in patch ? "admin" : "reportStaff";
      const enabled = patch[key as keyof typeof patch] as boolean;
      const undoPatch = { [key]: !enabled };
      toastWithUndo(user,
        { title: "Permissions updated", description: `${key === "admin" ? "Admin" : "Report staff"} access ${enabled ? "granted" : "removed"}.`, variant: "success" },
        "Undo", () => updateRoles(user, undoPatch as typeof patch)
      );
    } catch (err) {
      toastFor(user, { title: "Failed to update permissions", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(user.id, false);
    }
  }

  async function performAction(user: ManagedUser, action: "lock" | "unlock" | "force_password_reset") {
    setBusy(user.id, true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadUsers();
      const title = action === "force_password_reset" ? "Password reset required" : action === "lock" ? "Account locked" : "Account unlocked";
      const description = action === "force_password_reset" ? "User must set a new password at next sign-in." : action === "lock" ? "The account has been locked." : "The account is now active.";
      if (action === "lock" || action === "unlock") {
        const undoAction = action === "lock" ? "unlock" : "lock";
        toastWithUndo(user, { title, description, variant: "warning" }, "Undo", () => performAction(user, undoAction));
      } else {
        toastFor(user, { title, description, variant: "warning" });
      }
    } catch (err) {
      toastFor(user, { title: "Action failed", description: (err as Error).message, variant: "error" });
    } finally {
      setBusy(user.id, false);
    }
  }

  async function executeBulk(action: "lock" | "unlock" | "force_password_reset", ids: string[]) {
    await Promise.all(ids.map((id) => {
      const user = users.find((u) => u.id === id);
      return user ? performAction(user, action) : Promise.resolve();
    }));
    setSelected(new Set());
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
      const res = await fetch(`/api/admin/users/${user.id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as UserReportResponse;
      setReportHistory(data.reports ?? []);
      setReportComments(data.comments ?? []);
      setSelectedProfile(data.profile ?? initialReportingProfile);
      setReportBanType(data.profile.reportBanType);
      setReportBannedUntil(data.profile.reportBannedUntil ?? "");
      setReportLimitHourly(data.profile.reportLimitHourly > 0 ? String(data.profile.reportLimitHourly) : "");
      setReportLimitDaily(data.profile.reportLimitDaily > 0 ? String(data.profile.reportLimitDaily) : "");
    } catch (err) {
      const msg = (err as Error).message || "Unable to load report history.";
      setReportError(msg);
      toastFor(user, { title: "Unable to load report history", description: msg, variant: "error" });
    } finally {
      setReportLoading(false);
    }
  }

  async function saveReportingSettings() {
    if (!selectedUser) return;
    setSavingReport(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportBanType: reportBanType || "none",
          bannedUntil: reportBanType === "temporary" ? reportBannedUntil || null : null,
          limitHourly: reportLimitHourly ? Number(reportLimitHourly) : 0,
          limitDaily: reportLimitDaily ? Number(reportLimitDaily) : 0,
          resetStrikes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadUsers();
      await loadReportHistory(selectedUser);
      toastFor(selectedUser, { title: "Moderation settings saved", variant: "success" });
    } catch (err) {
      toastFor(selectedUser!, { title: "Failed to save settings", description: (err as Error).message, variant: "error" });
    } finally {
      setSavingReport(false);
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

  async function executeConfirmed() {
    if (!confirmAction) return;
    const a = confirmAction;
    setConfirmAction(null);
    if (a.type === "lock")        await performAction(a.user, "lock");
    else if (a.type === "unlock")      await performAction(a.user, "unlock");
    else if (a.type === "pwreset")     await performAction(a.user, "force_password_reset");
    else if (a.type === "bulkLock")    await executeBulk("lock", a.ids);
    else if (a.type === "bulkUnlock")  await executeBulk("unlock", a.ids);
    else if (a.type === "bulkPwreset") await executeBulk("force_password_reset", a.ids);
  }

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field;
    return (
      <button
        type="button"
        onClick={() => cycleSort(field)}
        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
          active ? "text-oxford-700 dark:text-slate-200" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        }`}
      >
        {label}
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-3 w-3 transition-transform ${active && sortDir === "desc" ? "rotate-180" : ""}`} fill="currentColor">
          <path d="M8 4l4 6H4z"/>
        </svg>
      </button>
    );
  }

  function userStatus(u: ManagedUser): "active" | "locked" | "reportBanned" | "permanentBan" {
    if (u.locked) return "locked";
    if (u.reportBanType === "permanent") return "permanentBan";
    if (u.reportBanType === "temporary") return "reportBanned";
    return "active";
  }

  return (
    <section className="space-y-5">
      {/* Page header */}
      <div className="panel-strong overflow-hidden p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-deepforest-400">Administration</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-oxford-700 dark:text-slate-100 md:text-4xl">User Management</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Manage accounts, permissions, and report moderation settings.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Sign in required</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">You need to sign in to manage users.</p>
          <SignInButton>
            <button className="mt-3 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-600" type="button">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Toolbar */}
        <div className="panel p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, username, or email…"
                aria-label="Search users"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-oxford-700 outline-none transition placeholder:text-slate-400 focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Filters */}
            <div className="flex shrink-0 flex-wrap gap-2">
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as FilterRole)}
                aria-label="Filter by role"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="reportStaff">Report staff</option>
                <option value="allowlisted">Allowlisted</option>
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                aria-label="Filter by status"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="locked">Locked</option>
                <option value="reportBanned">Report banned</option>
              </select>

              <button
                type="button"
                onClick={() => void loadUsers()}
                aria-label="Refresh user list"
                title="Refresh"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/></svg>
              </button>
            </div>
          </div>

          {/* Result count + bulk actions */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isLoading ? "Loading…" : `${processedUsers.length} user${processedUsers.length === 1 ? "" : "s"}`}
              {someSelected && <span className="ml-2 font-semibold text-oxford-700 dark:text-slate-200">· {selected.size} selected</span>}
            </p>
            {someSelected && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setConfirmAction({ type: "bulkLock",    ids: Array.from(selected) })} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">Lock selected</button>
                <button type="button" onClick={() => setConfirmAction({ type: "bulkUnlock",  ids: Array.from(selected) })} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">Unlock selected</button>
                <button type="button" onClick={() => setConfirmAction({ type: "bulkPwreset", ids: Array.from(selected) })} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">Require reset</button>
                <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Clear</button>
              </div>
            )}
          </div>
        </div>

        {/* Error banner */}
        {loadError && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">{loadError}</p>
        )}

        {/* Table */}
        <div className="panel overflow-hidden">
          {/* Column headers */}
          <div className="hidden items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/60 sm:grid"
               style={{ gridTemplateColumns: "2rem 2.5rem 1fr 10rem 9rem 7rem 7rem 2.5rem" }}>
            <input
              type="checkbox"
              aria-label="Select all visible users"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
            />
            <span />
            <SortBtn field="name" label="User" />
            <SortBtn field="role" label="Roles" />
            <SortBtn field="status" label="Status" />
            <SortBtn field="lastSignIn" label="Last sign-in" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Permissions</span>
            <span />
          </div>

          {isLoading ? (
            <div className="space-y-px">
              {[0,1,2,3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                  <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-800" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-48 rounded bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : processedUsers.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No users matched your filters.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
              <AnimatePresence initial={false}>
                {processedUsers.map((user) => {
                  const isBusy = pending[user.id] === true;
                  const status = userStatus(user);
                  const isSelected = selected.has(user.id);

                  return (
                    <motion.li
                      key={user.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`transition-colors ${isSelected ? "bg-oxford-50/60 dark:bg-oxford-900/20" : "hover:bg-slate-50/60 dark:hover:bg-slate-900/40"}`}
                    >
                      {/* Desktop row */}
                      <div className="hidden items-center gap-3 px-4 py-3 sm:grid"
                           style={{ gridTemplateColumns: "2rem 2.5rem 1fr 10rem 9rem 7rem 7rem 2.5rem" }}>

                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.name}`}
                          checked={isSelected}
                          onChange={() => toggleSelect(user.id)}
                          className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                        />

                        {/* Avatar */}
                        <UserAvatar user={user} />

                        {/* Name + email */}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-oxford-700 dark:text-slate-100">{user.name}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{user.email ?? (user.username ? `@${user.username}` : "—")}</p>
                          {user.lastSignInAt === null && (
                            <p className="mt-0.5 text-[10px] text-slate-400">Never signed in</p>
                          )}
                        </div>

                        {/* Role pills */}
                        <div className="flex flex-wrap gap-1">
                          {user.allowlisted && <RolePill label="Allowlisted" color="deepforest" />}
                          {user.admin        && <RolePill label="Admin"       color="oxford" />}
                          {user.reportStaff  && <RolePill label="Reports"     color="deepforest" />}
                          {!user.admin && !user.reportStaff && !user.allowlisted && (
                            <span className="text-xs text-slate-400">Member</span>
                          )}
                        </div>

                        {/* Status */}
                        <StatusBadge status={status} />

                        {/* Last sign-in */}
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : "—"}
                        </p>

                        {/* Permission toggles */}
                        <div className="flex flex-col gap-1.5">
                          <ToggleSwitch
                            id={`admin-${user.id}`}
                            label="Admin"
                            checked={user.metadataAdmin}
                            disabled={isBusy || user.allowlisted}
                            title={user.allowlisted ? "Granted automatically via allowlist" : "Toggle admin access"}
                            onChange={(next) => void updateRoles(user, { admin: next })}
                          />
                          <ToggleSwitch
                            id={`reports-${user.id}`}
                            label="Reports"
                            checked={user.metadataReportStaff}
                            disabled={isBusy}
                            title="Toggle report staff access"
                            onChange={(next) => void updateRoles(user, { reportStaff: next })}
                          />
                        </div>

                        {/* Actions menu */}
                        <ActionsMenu
                          user={user}
                          isBusy={isBusy}
                          onLock={() => setConfirmAction({ type: user.locked ? "unlock" : "lock", user })}
                          onPwReset={() => setConfirmAction({ type: "pwreset", user })}
                          onViewReports={() => void loadReportHistory(user)}
                        />
                      </div>

                      {/* Mobile card (< sm) */}
                      <div className="flex items-start gap-3 p-4 sm:hidden">
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.name}`}
                          checked={isSelected}
                          onChange={() => toggleSelect(user.id)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                        />
                        <UserAvatar user={user} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-oxford-700 dark:text-slate-100">{user.name}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">{user.email ?? "—"}</p>
                            </div>
                            <ActionsMenu
                              user={user}
                              isBusy={isBusy}
                              onLock={() => setConfirmAction({ type: user.locked ? "unlock" : "lock", user })}
                              onPwReset={() => setConfirmAction({ type: "pwreset", user })}
                              onViewReports={() => void loadReportHistory(user)}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={status} />
                            {user.allowlisted && <RolePill label="Allowlisted" color="deepforest" />}
                            {user.admin       && <RolePill label="Admin"       color="oxford" />}
                            {user.reportStaff && <RolePill label="Reports"     color="deepforest" />}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                            <ToggleSwitch
                              id={`mobile-admin-${user.id}`}
                              label="Admin access"
                              checked={user.metadataAdmin}
                              disabled={isBusy || user.allowlisted}
                              onChange={(next) => void updateRoles(user, { admin: next })}
                            />
                            <ToggleSwitch
                              id={`mobile-reports-${user.id}`}
                              label="Report staff"
                              checked={user.metadataReportStaff}
                              disabled={isBusy}
                              onChange={(next) => void updateRoles(user, { reportStaff: next })}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </SignedIn>

      {/* Report / moderation modal */}
      <AnimatePresence>
        {selectedUser && (
          <ReportModal
            user={selectedUser}
            profile={selectedProfile}
            reportHistory={reportHistory}
            reportComments={reportComments}
            reportLoading={reportLoading}
            reportError={reportError}
            reportBanType={reportBanType}
            setReportBanType={setReportBanType}
            reportBannedUntil={reportBannedUntil}
            setReportBannedUntil={setReportBannedUntil}
            reportLimitHourly={reportLimitHourly}
            setReportLimitHourly={setReportLimitHourly}
            reportLimitDaily={reportLimitDaily}
            setReportLimitDaily={setReportLimitDaily}
            resetStrikes={resetStrikes}
            setResetStrikes={setResetStrikes}
            saving={savingReport}
            onSave={() => void saveReportingSettings()}
            onClose={closeReportModal}
          />
        )}
      </AnimatePresence>

      {/* Confirm dialog */}
      <AnimatePresence>
        {confirmAction && (
          <ConfirmDialog
            action={confirmAction}
            onConfirm={() => void executeConfirmed()}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
