"use client";

import { SignOutButton } from "@clerk/nextjs";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <SignOutButton>
      <button
        type="button"
        className={
          className ??
          "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300"
        }
      >
        Logout
      </button>
    </SignOutButton>
  );
}
