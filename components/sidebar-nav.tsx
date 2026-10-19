"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useAccessProfile } from "@/components/access-provider";

type SidebarItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

type SidebarNavProps = {
  items: SidebarItem[];
  onNavigate?: () => void;
  className?: string;
};

export function SidebarNav({ items, onNavigate, className }: SidebarNavProps) {
  const { authenticated } = useAccessProfile();
  const pathname = usePathname();
  const [badgeCount, setBadgeCount] = useState<number>(0);

  const fetchBadgeCount = useCallback(async () => {
    if (!authenticated) {
      setBadgeCount(0);
      return;
    }
    try {
      const res = await fetch("/api/submissions/count");
      if (res.ok) {
        const data = (await res.json()) as { count?: number };
        setBadgeCount(data.count ?? 0);
      }
    } catch {
      // ignore error
    }
  }, [authenticated]);

  useEffect(() => {
    fetchBadgeCount();

    const handleRefreshBadge = () => {
      fetchBadgeCount();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchBadgeCount();
    };

    window.addEventListener("cvsdgo:refresh-submissions-badge", handleRefreshBadge);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("cvsdgo:refresh-submissions-badge", handleRefreshBadge);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchBadgeCount]);

  const visibleItems = items.filter((item) => !item.requiresAuth || authenticated);

  return (
    <ul className={className ?? "mt-5 flex-1 space-y-2 text-sm text-oxford-700 dark:text-slate-100"}>
      {visibleItems.map((item) => {
        const isSubmissions = ["/site/support", "/site/settings/submissions", "/site/settings"].includes(item.href);
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 ${
                isActive
                  ? "bg-oxford-700 text-white dark:bg-oxford-500"
                  : "text-slate-600 hover:bg-slate-100 hover:text-oxford-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              }`}
            >
              <span>{item.label}</span>
              {isSubmissions && badgeCount > 0 && (
                <span
                  className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-extrabold transition ${
                    isActive
                      ? "bg-amber-400 text-oxford-900"
                      : "bg-amber-500 text-white shadow-sm"
                  }`}
                  title={`${badgeCount} items requiring attention`}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
