"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";

type RedirectResponse = {
  destinationUrl: string | null;
  locked?: boolean;
  inactive?: boolean;
  reason?: "scheduled" | "expired";
  canOverride?: boolean;
};

function isValidRedirectUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function RedirectShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-16 text-oxford-700 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-oxford-200/50 blur-3xl dark:bg-oxford-800/25" />
        <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-deepforest-100/60 blur-3xl dark:bg-deepforest-800/20" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      </div>
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6"><ThemeToggle /></div>
      <motion.section initial={{ opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className={`relative w-full ${compact ? "max-w-md" : "max-w-lg"}`}>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-xl shadow-oxford-900/10 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-black/30">
          <div className="h-1 bg-gradient-to-r from-oxford-500 via-deepforest-500 to-oxford-500" />
          <div className="p-6 sm:p-8">{children}</div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">Secure redirection provided by Cedar Valley School District</p>
      </motion.section>
    </main>
  );
}

function Brand() {
  return (
    <div className="logo-shell inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 shadow-sm">
      <Image src="/cvsd-logo.png" alt="Cedar Valley School District" width={180} height={40} className="h-8 w-auto" priority />
      <span className="ml-3 border-l border-slate-300 pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-oxford-700">Go</span>
    </div>
  );
}

export function RedirectLanding() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = useMemo(() => params?.slug ?? "", [params]);
  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [canOverride, setCanOverride] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inactiveReason, setInactiveReason] = useState<RedirectResponse["reason"] | null>(null);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    async function loadDestination() {
      try {
        setIsLoading(true);
        setIsLocked(false);
        setCanOverride(false);
        setInactiveReason(null);
        const response = await fetch(`/api/redirect/${slug}`, { signal: controller.signal });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as RedirectResponse | null;
          if (data?.inactive) setInactiveReason(data.reason ?? "scheduled");
          setDestinationUrl(null);
          return;
        }
        const data = (await response.json()) as RedirectResponse;
        if (data.locked) {
          setIsLocked(true);
          setCanOverride(Boolean(data.canOverride));
          setDestinationUrl(null);
        } else if (isValidRedirectUrl(data.destinationUrl)) {
          setDestinationUrl(data.destinationUrl);
          window.location.replace(data.destinationUrl!);
        } else {
          setDestinationUrl(null);
        }
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setDestinationUrl(null);
        }
      } finally {
        setIsLoading(false);
      }
    }
    void loadDestination();
    return () => controller.abort();
  }, [slug]);

  async function readError(response: Response): Promise<RedirectResponse | string | null> {
    return (response.headers.get("content-type") ?? "").includes("application/json")
      ? ((await response.json().catch(() => null)) as RedirectResponse | null)
      : response.text().catch(() => "");
  }

  async function finishRedirect(response: Response, fallbackMessage: string) {
    if (!response.ok) {
      const payload = await readError(response);
      if (typeof payload === "object" && payload?.inactive) {
        setInactiveReason(payload.reason ?? "scheduled");
        setIsLocked(false);
        setDestinationUrl(null);
        return;
      }
      throw new Error((typeof payload === "string" && payload) || fallbackMessage);
    }
    const data = (await response.json()) as RedirectResponse;
    if (!isValidRedirectUrl(data.destinationUrl)) throw new Error("This link has an invalid destination.");
    setIsLocked(false);
    setDestinationUrl(data.destinationUrl);
    window.location.replace(data.destinationUrl!);
  }

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      setPasswordError("Enter the password to continue.");
      return;
    }
    setIsUnlocking(true);
    setPasswordError(null);
    try {
      const response = await fetch(`/api/redirect/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      await finishRedirect(response, "That password is not correct. Try again.");
    } catch (error) {
      setPasswordError((error as Error).message || "That password is not correct. Try again.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleOverride() {
    setIsUnlocking(true);
    setPasswordError(null);
    try {
      const response = await fetch(`/api/redirect/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ override: true }) });
      await finishRedirect(response, "Unable to override this link right now.");
      setCanOverride(false);
    } catch (error) {
      setPasswordError((error as Error).message || "Unable to override this link right now.");
    } finally {
      setIsUnlocking(false);
    }
  }

  if (isLoading || destinationUrl) {
    return (
      <RedirectShell compact>
        <div className="flex flex-col items-center text-center">
          <Brand />
          <div className="relative mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-oxford-50 text-oxford-700 dark:bg-oxford-800 dark:text-slate-100">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>
            <span className="absolute inset-0 animate-ping rounded-2xl border border-oxford-300 opacity-40 dark:border-oxford-500" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-deepforest-700 dark:text-deepforest-400">CVSD Go</p>
          <h1 className="mt-2 font-serif text-2xl font-semibold text-oxford-700 dark:text-slate-100">Taking you there</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Checking the link and preparing your destination.</p>
          <div className="mt-7 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><motion.div className="h-full w-2/5 rounded-full bg-gradient-to-r from-oxford-500 to-deepforest-500" animate={{ x: ["-100%", "250%"] }} transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }} /></div>
          <p className="mt-3 font-mono text-xs text-slate-500">go.cvsd.live/{slug}</p>
        </div>
      </RedirectShell>
    );
  }

  if (isLocked) {
    return (
      <RedirectShell>
        <Brand />
        <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Locked link</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-oxford-700 dark:text-slate-100">Enter the password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Access to <span className="font-mono font-medium text-oxford-700 dark:text-slate-200">go.cvsd.live/{slug}</span> is restricted.</p>
        <form onSubmit={handleUnlock} className="mt-6">
          <label htmlFor="link-password" className="text-sm font-semibold text-oxford-700 dark:text-slate-200">Password</label>
          <div className={`mt-2 flex h-12 items-center rounded-xl border bg-white shadow-sm transition focus-within:ring-2 dark:bg-slate-950 ${passwordError ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-rose-500/15" : "border-slate-300 focus-within:border-oxford-500 focus-within:ring-oxford-500/15 dark:border-slate-700"}`}>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-3 h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            <input id="link-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); if (passwordError) setPasswordError(null); }} autoComplete="current-password" autoFocus aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? "password-error" : "password-help"} placeholder="Enter link password" className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-oxford-700 outline-none dark:text-slate-100" />
            <button type="button" onClick={() => setShowPassword((shown) => !shown)} className="mr-1 rounded-lg px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-oxford-700 dark:hover:bg-slate-800 dark:hover:text-slate-100" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
          </div>
          <p id="password-help" className="mt-2 text-xs text-slate-500">Passwords are case-sensitive.</p>
          {passwordError && <div id="password-error" role="alert" aria-live="polite" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"><svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></svg>{passwordError}</div>}
          <button type="submit" disabled={isUnlocking} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-oxford-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-oxford-600 focus:outline-none focus:ring-2 focus:ring-oxford-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-65 dark:focus:ring-offset-slate-900">
            {isUnlocking ? <><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3.3-6.9"/></svg>Checking password…</> : <>Continue<svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></>}
          </button>
          {canOverride && <button type="button" onClick={() => void handleOverride()} disabled={isUnlocking} className="mt-3 h-11 w-full rounded-xl border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/60">Continue with administrator access</button>}
        </form>
      </RedirectShell>
    );
  }

  const state = inactiveReason === "scheduled"
    ? { label: "Scheduled", title: "This link is not available yet", body: "The destination has a scheduled release time. Please check back later.", tone: "amber" }
    : inactiveReason === "expired"
      ? { label: "Expired", title: "This link has expired", body: "The destination is no longer active. Contact the district if you still need access.", tone: "rose" }
      : { label: "Not found", title: "We could not find this link", body: `There is no active destination for go.cvsd.live/${slug}.`, tone: "slate" };

  return (
    <RedirectShell>
      <Brand />
      <div className={`mt-7 flex h-12 w-12 items-center justify-center rounded-2xl ${state.tone === "amber" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : state.tone === "rose" ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></svg></div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{state.label}</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-oxford-700 dark:text-slate-100">{state.title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{state.body}</p>
      <button type="button" onClick={() => router.push("/")} className="mt-7 inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-oxford-700 shadow-sm transition hover:border-oxford-400 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800">Return to link directory</button>
    </RedirectShell>
  );
}
