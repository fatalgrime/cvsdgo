"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

type Position = {
  x: number;
  y: number;
};

export function ContextMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [portalReady, setPortalReady] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      // Allow default context menu on text inputs and textareas so editing is not disrupted
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();

      const menuWidth = 220;
      const menuHeight = 160;
      const padding = 12;

      let x = e.clientX;
      let y = e.clientY;

      if (x + menuWidth > window.innerWidth - padding) {
        x = window.innerWidth - menuWidth - padding;
      }
      if (y + menuHeight > window.innerHeight - padding) {
        y = window.innerHeight - menuHeight - padding;
      }

      x = Math.max(padding, x);
      y = Math.max(padding, y);

      setPosition({ x, y });
      setIsOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      } else {
        closeMenu();
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        closeMenu();
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, isOpen]);

  const handleBack = () => {
    closeMenu();
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      router.back();
    }
  };

  const handleForward = () => {
    closeMenu();
    if (typeof window !== "undefined") {
      window.history.forward();
    } else {
      router.forward();
    }
  };

  const handleReload = () => {
    closeMenu();
    router.refresh();
  };

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.12 }}
          style={{ top: `${position.y}px`, left: `${position.x}px` }}
          className="fixed z-[9999] min-w-[200px] overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/95"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Navigation</p>
          </div>

          <div className="mt-1 space-y-0.5">
            <button
              type="button"
              onClick={handleBack}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-oxford-700 transition hover:bg-oxford-50 hover:text-oxford-800 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
            >
              <svg className="h-4 w-4 shrink-0 text-oxford-600 dark:text-oxford-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={handleForward}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-oxford-700 transition hover:bg-oxford-50 hover:text-oxford-800 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
            >
              <svg className="h-4 w-4 shrink-0 text-oxford-600 dark:text-oxford-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
              <span>Forward</span>
            </button>

            <button
              type="button"
              onClick={handleReload}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-oxford-700 transition hover:bg-oxford-50 hover:text-oxford-800 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-slate-100"
            >
              <svg className="h-4 w-4 shrink-0 text-oxford-600 dark:text-oxford-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reload Content</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
