"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";

export function SidebarAuth() {
  const { user } = useUser();
  const username = user?.username || user?.firstName || user?.emailAddresses[0]?.emailAddress;

  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
      <SignedOut>
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-lg border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white transition hover:bg-oxford-600"
        >
          Login
        </Link>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-3">
          <UserButton afterSignOutUrl="/" />
          <div className="max-w-[130px] truncate text-xs font-semibold uppercase tracking-[0.1em] text-slate-600 dark:text-slate-400">
            {username}
          </div>
        </div>
      </SignedIn>
    </div>
  );
}
