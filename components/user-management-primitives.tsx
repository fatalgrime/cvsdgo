"use client";

import { useState } from "react";
import Image from "next/image";

export type ManagedUser = {
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

export function ToggleSwitch({ checked, onChange, disabled, id, label, title }: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id: string;
  label: string;
  title?: string;
}) {
  return (
    <label htmlFor={id} title={title} className={`inline-flex cursor-pointer select-none items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <span className="relative">
        <input id={id} type="checkbox" role="switch" aria-checked={checked} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
        <span aria-hidden="true" className={`block h-5 w-9 rounded-full transition-colors duration-200 ${checked ? "bg-oxford-700" : "bg-slate-300 dark:bg-slate-600"}`} />
        <span aria-hidden="true" className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </span>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
    </label>
  );
}

export function StatusBadge({ status }: { status: "active" | "locked" | "pwreset" | "reportBanned" | "permanentBan" }) {
  const config = {
    active: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", label: "Active" },
    locked: { dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300", label: "Locked" },
    pwreset: { dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-300", label: "Pw Reset" },
    reportBanned: { dot: "bg-orange-400", text: "text-orange-700 dark:text-orange-300", label: "Rpt Banned" },
    permanentBan: { dot: "bg-red-600", text: "text-red-700 dark:text-red-300", label: "Perm Ban" },
  }[status];
  return <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${config.text}`}><span className={`h-2 w-2 shrink-0 rounded-full ${config.dot}`} />{config.label}</span>;
}

export function RolePill({ label, color }: { label: string; color: "oxford" | "deepforest" | "amber" }) {
  const styles = {
    oxford: "border-oxford-200 bg-oxford-50 text-oxford-700 dark:border-oxford-700 dark:bg-oxford-900/60 dark:text-slate-200",
    deepforest: "border-deepforest-200 bg-deepforest-50 text-deepforest-700 dark:border-deepforest-700 dark:bg-deepforest-900/60 dark:text-slate-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
  }[color];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${styles}`}>{label}</span>;
}

export function UserAvatar({ user }: { user: ManagedUser }) {
  const [hasImageError, setHasImageError] = useState(false);
  const initials = user.name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  if (user.imageUrl && !hasImageError) {
    return <Image src={user.imageUrl} alt={user.name} width={36} height={36} unoptimized onError={() => setHasImageError(true)} className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700" />;
  }
  return <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-oxford-100 text-xs font-bold text-oxford-700 dark:bg-oxford-800 dark:text-slate-200">{initials || "?"}</span>;
}

