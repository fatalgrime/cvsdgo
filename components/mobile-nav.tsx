"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AccessibleDialog } from "@/components/accessible-dialog";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarAuth } from "@/components/sidebar-auth";
import { ContextMenu } from "@/components/context-menu";

type SidebarItem = { href: string; label: string; requiresAuth?: boolean };

export function MobileNav({ items }: { items: SidebarItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setIsOpen(false), [pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setIsOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return <>
    <ContextMenu />
    <div className="border-b border-slate-200/80 bg-white/90 px-4 py-2 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
      <button type="button" onClick={() => setIsOpen(true)} aria-haspopup="dialog" aria-expanded={isOpen}
        className="inline-flex min-h-11 w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold uppercase tracking-[0.14em] text-oxford-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        Navigation Menu
      </button>
    </div>
    <AccessibleDialog open={isOpen} onClose={() => setIsOpen(false)} ariaLabel="Navigation menu"
      panelClassName="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-oxford-700 dark:text-slate-100">Navigation</h2>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close navigation menu" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 dark:border-slate-700">
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 6 12 12M6 18 18 6" /></svg>
        </button>
      </div>
      <nav aria-label="Main navigation"><SidebarNav items={items} onNavigate={() => setIsOpen(false)} /></nav>
      <SidebarAuth />
    </AccessibleDialog>
  </>;
}
