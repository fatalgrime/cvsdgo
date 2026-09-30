"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { useAccessProfile } from "@/components/access-provider";

export function SidebarAuth() {
  const { user, isLoaded } = useUser();
  const { authenticated } = useAccessProfile();
  const username = user?.username || user?.firstName || user?.emailAddresses[0]?.emailAddress;

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
      {!authenticated && (
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-lg border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-oxford-600"
        >
          Login
        </Link>
      )}

      {authenticated && (
        <div className="flex items-center gap-3">
          {isLoaded ? <UserButton afterSignOutUrl="/" /> : <span className="h-7 w-7 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" aria-label="Loading account" />}
          {isLoaded ? (
            <div className="max-w-[130px] truncate text-xs font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-400">
              {username}
            </div>
          ) : (
            <span className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          )}
        </div>
      )}
    </div>
  );
}
