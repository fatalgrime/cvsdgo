"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarAuth } from "@/components/sidebar-auth";
import { ContextMenu } from "@/components/context-menu";

type SidebarItem = {
  href: string;
  label: string;
  requiresAuth?: boolean;
};

type MobileNavProps = {
  items: SidebarItem[];
};

export function MobileNav({ items }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ContextMenu />

      {/* Mobile Toggle Bar (< lg) */}
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-oxford-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label="Toggle Navigation Menu"
          >
            {isOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-oxford-700 dark:text-slate-200">
            Navigation Menu
          </span>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 lg:hidden"
          >
            <SidebarNav items={items} />
            <SidebarAuth />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
