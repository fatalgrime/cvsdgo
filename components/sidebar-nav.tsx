"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

type SidebarItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

type SidebarNavProps = {
  items: SidebarItem[];
};

export function SidebarNav({ items }: SidebarNavProps) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const [badgeCount, setBadgeCount] = useState<number>(0);

  const fetchBadgeCount = useCallback(async () => {
    if (!isSignedIn) {
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
  }, [isSignedIn]);

  useEffect(() => {
    fetchBadgeCount();
    const interval = setInterval(fetchBadgeCount, 30_000);

    const handleRefreshBadge = () => {
      fetchBadgeCount();
    };

    window.addEventListener("cvsdgo:refresh-submissions-badge", handleRefreshBadge);

    return () => {
      clearInterval(interval);
      window.removeEventListener("cvsdgo:refresh-submissions-badge", handleRefreshBadge);
    };
  }, [fetchBadgeCount]);

  const visibleItems = items.filter((item) => !item.requiresAuth || isSignedIn);

  return (
    <ul className="mt-5 flex-1 space-y-2 text-sm text-oxford-700 dark:text-slate-100">
      {visibleItems.map((item) => {
        const isSubmissions = item.href === "/site/support";
        const isActive = pathname === item.href;

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
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
