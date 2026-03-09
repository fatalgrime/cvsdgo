"use client";

import { SignOutButton } from "@clerk/nextjs";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <SignOutButton>
      <button
        type="button"
        className={
          className ??
          "rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400"
        }
      >
        Logout
      </button>
    </SignOutButton>
  );
}
