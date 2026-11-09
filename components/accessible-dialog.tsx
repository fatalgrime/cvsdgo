"use client";

import { useEffect, useRef, useState, type KeyboardEventHandler, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { isTopDialog, registerDialog } from "@/lib/dialog-stack";

type AccessibleDialogProps = {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  panelClassName?: string;
  align?: "center" | "top";
  backdropClassName?: string;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  zIndexClassName?: string;
};

export function AccessibleDialog({
  open,
  onClose,
  ariaLabel,
  children,
  panelClassName = "w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950",
  align = "center",
  backdropClassName = "bg-slate-950/60 backdrop-blur-sm",
  onKeyDown,
  zIndexClassName = "z-[200]",
}: AccessibleDialogProps) {
  const [portalReady, setPortalReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Capture the trigger before React mounts any auto-focused modal controls.
  if (open && !wasOpenRef.current && typeof document !== "undefined") {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  wasOpenRef.current = open;
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !portalReady || !panelRef.current) return;
    return registerDialog(panelRef.current, () => onCloseRef.current(), returnFocusRef.current);
  }, [open, portalReady]);

  if (!portalReady || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="dialog-backdrop"
          data-animated-dialog="true"
          className={`modal-backdrop ${zIndexClassName} flex justify-center px-4 ${align === "top" ? "items-start pt-16 sm:pt-24" : "items-center"} ${backdropClassName}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && isTopDialog(panelRef.current)) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={event => { if (isTopDialog(panelRef.current)) onKeyDown?.(event); }}
            className={`modal-panel ${panelClassName}`}
            initial={reduceMotion ? false : { opacity: 0, y: align === "top" ? -10 : 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: align === "top" ? -6 : 8, scale: 0.99 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

