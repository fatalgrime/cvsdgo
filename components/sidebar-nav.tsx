"use client";

import Link from "next/link";
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
  const visibleItems = items.filter((item) => !item.requiresAuth || isSignedIn);

  return (
    <ul className="mt-5 space-y-2 text-sm text-oxford-700 flex-1">
      {visibleItems.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={`block rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              pathname === item.href
                ? "bg-oxford-700 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-oxford-700"
            }`}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
