"use client";
import { useEffect, useState, type ReactNode } from "react";
import { isPolicyArchivePublic, POLICY_ARCHIVE_CLOSES_AT_MS } from "@/lib/policy-archive-access";

// Also expire pages left open or restored from the browser's back/forward cache.
export function PolicyArchiveWindow({ children, showClosedMessage = false }: { children: ReactNode; showClosedMessage?: boolean }) {
  const [available, setAvailable] = useState(() => isPolicyArchivePublic());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function update() {
      clearTimeout(timer);
      const open = isPolicyArchivePublic();
      setAvailable(open);
      if (open) timer = setTimeout(update, Math.min(60_000, Math.max(1, POLICY_ARCHIVE_CLOSES_AT_MS - Date.now())));
    }
    update();
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  if (!available) return showClosedMessage ? <p role="status" className="mt-6 text-sm text-slate-700 dark:text-slate-200">Public access to this old policy version ended on November 9, 2026.</p> : null;
  return children;
}
