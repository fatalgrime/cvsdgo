"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { readEditorDraft, writeEditorDraft } from "@/lib/editor-drafts";

export function useEditorDraft<T>({ name, value, dirty, active = true, validate }: { name: string; value: T; dirty: boolean; active?: boolean; validate: (value: unknown) => value is T }) {
  const { userId } = useAuth();
  const key = active && userId ? "cvsdgo:draft:" + userId + ":" + name : null;
  const [recovery, setRecovery] = useState<{ key: string; value: T } | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const serialized = JSON.stringify(value);
  useEffect(() => {
    setLoadedKey(key);
    setRecovery(null);
    setStorageFailed(false);
    if (!key) return;
    try {
      const saved = readEditorDraft(sessionStorage, key, validateRef.current);
      if (saved) setRecovery({ key, value: saved });
    } catch { setStorageFailed(true); }
  }, [key]);
  useEffect(() => {
    if (!key || loadedKey !== key || recovery?.key === key) return;
    try {
      if (!dirty) { sessionStorage.removeItem(key); return; }
      setStorageFailed(!writeEditorDraft(sessionStorage, key, JSON.parse(serialized)));
    }
    catch { setStorageFailed(true); }
  }, [key, loadedKey, serialized, dirty, recovery]);
  const clear = useCallback(() => {
    if (key) { try { sessionStorage.removeItem(key); } catch { /* Editing works without storage. */ } }
    setRecovery(null);
  }, [key]);
  return { recovered: recovery?.key === key ? recovery.value : null, clear, storageFailed };
}

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.hasAttribute("data-announcement-preview") || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self") || !/^https?:$/.test(anchor.protocol)) return;
      const destination = new URL(anchor.href);
      if (destination.origin === location.origin && destination.pathname === location.pathname && destination.search === location.search) return;
      if (!window.confirm("You have unsaved changes. Leave this page without saving?")) {
        event.preventDefault(); event.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); };
  }, [dirty]);
}
