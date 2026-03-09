"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

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
                  className="rounded-md border border-slate-200 bg-white p-4 shadow-lg"
                >
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
                        <p className="mt-1 text-sm text-slate-600">{toastItem.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(toastItem.id)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
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
