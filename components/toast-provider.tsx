"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  action?: ToastAction;
  avatarUrl?: string;
  avatarAlt?: string;
};

type ToastInput = Omit<Toast, "id">;

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const timeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    setMounted(true);
    const timeoutMap = timeouts.current;
    return () => {
      timeoutMap.forEach((timeout) => clearTimeout(timeout));
      timeoutMap.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeout = timeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
    timeouts.current.forEach((timeout) => clearTimeout(timeout));
    timeouts.current.clear();
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = createId();
      const nextToast: Toast = {
        id,
        variant: "info",
        duration: 4200,
        ...input,
      };

      setToasts((current) => [nextToast, ...current].slice(0, 5));

      if (nextToast.duration && nextToast.duration > 0) {
        const timeout = setTimeout(() => dismiss(id), nextToast.duration);
        timeouts.current.set(id, timeout);
      }

      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss, clear }), [toast, dismiss, clear]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed right-4 top-4 z-[120] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3"
            role="region"
            aria-live="polite"
          >
            <AnimatePresence initial={false}>
              {toasts.map((toastItem) => (
                <motion.div
                  key={toastItem.id}
                  layout
                  initial={{ opacity: 0, y: -12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-start gap-3">
                    {toastItem.avatarUrl ? (
                      <div className="flex h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-200 dark:ring-slate-700">
                        <Image
                          src={toastItem.avatarUrl}
                          alt={toastItem.avatarAlt ?? ""}
                          className="h-full w-full object-cover"
                          width={48}
                          height={48}
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                          toastItem.variant === "success"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : toastItem.variant === "error"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200"
                            : toastItem.variant === "warning"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                            : "bg-oxford-50 text-oxford-700 dark:bg-oxford-950/40 dark:text-oxford-200"
                        }`}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                          {toastItem.variant === "success" ? (
                            <path d="m5 12 4 4L19 6" />
                          ) : toastItem.variant === "error" ? (
                            <>
                              <path d="M6 6l12 12" />
                              <path d="M18 6 6 18" />
                            </>
                          ) : toastItem.variant === "warning" ? (
                            <>
                              <path d="M12 9v4" />
                              <path d="M12 17h.01" />
                              <path d="M10.3 4.5h3.4L20 16.2A2 2 0 0 1 18.3 19H5.7a2 2 0 0 1-1.7-2.8L10.3 4.5Z" />
                            </>
                          ) : (
                            <>
                              <path d="M12 16v-4" />
                              <path d="M12 8h.01" />
                            </>
                          )}
                        </svg>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={`text-sm font-semibold ${
                              toastItem.variant === "success"
                                ? "text-emerald-700"
                                : toastItem.variant === "error"
                                ? "text-rose-700"
                                : toastItem.variant === "warning"
                                ? "text-amber-700"
                                : "text-oxford-700"
                            }`}
                          >
                            {toastItem.title}
                          </p>
                          {toastItem.description && (
                            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{toastItem.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => dismiss(toastItem.id)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:border-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
                          aria-label="Dismiss notification"
                        >
                          Close
                        </button>
                      </div>
                      {toastItem.action && (
                        <button
                          type="button"
                          onClick={() => {
                            toastItem.action?.onClick();
                            dismiss(toastItem.id);
                          }}
                          className="mt-3 inline-flex items-center gap-2 rounded-md border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
                        >
                          {toastItem.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
