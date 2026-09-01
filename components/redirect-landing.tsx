"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

type RedirectResponse = {
  destinationUrl: string | null;
  locked?: boolean;
  inactive?: boolean;
  reason?: "scheduled" | "expired";
  canOverride?: boolean;
};

function isValidRedirectUrl(urlStr: string | null | undefined): boolean {
  if (!urlStr) return false;
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function RedirectLanding() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = useMemo(() => params?.slug ?? "", [params]);

  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMissing, setIsMissing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [canOverride, setCanOverride] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [inactiveReason, setInactiveReason] = useState<RedirectResponse["reason"] | null>(null);

  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();

    async function loadDestination() {
      try {
        setIsLoading(true);
        setIsMissing(false);
        setIsLocked(false);
        setCanOverride(false);
        setInactiveReason(null);

        const response = await fetch(`/api/redirect/${slug}`, { signal: controller.signal });
        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as RedirectResponse | null;
          if (data?.inactive) {
            setInactiveReason(data.reason ?? "scheduled");
          } else {
            setIsMissing(true);
          }
          setDestinationUrl(null);
          return;
        }
        const data = (await response.json()) as RedirectResponse;
        if (data.locked) {
          setIsLocked(true);
          setCanOverride(Boolean(data.canOverride));
          setDestinationUrl(null);
        } else if (isValidRedirectUrl(data.destinationUrl)) {
          setCanOverride(false);
          setDestinationUrl(data.destinationUrl);
          // Immediate smooth client-side redirect for public links
          window.location.replace(data.destinationUrl!);
        } else {
          setIsMissing(true);
          setDestinationUrl(null);
        }
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setIsMissing(true);
          setDestinationUrl(null);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadDestination();

    return () => controller.abort();
  }, [slug]);

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim()) {
      setPasswordError("Enter the password to continue.");
      return;
    }
    setIsUnlocking(true);
    setPasswordError(null);
    try {
      const response = await fetch(`/api/redirect/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? ((await response.json().catch(() => null)) as RedirectResponse | null)
          : await response.text().catch(() => "");

        if (typeof payload === "object" && payload?.inactive) {
          const data = payload as RedirectResponse;
          setInactiveReason(data.reason ?? "scheduled");
          setIsLocked(false);
          setDestinationUrl(null);
          return;
        }

        const message = typeof payload === "string" ? payload : null;
        throw new Error(message || "Invalid password.");
      }
      const data = (await response.json()) as RedirectResponse;
      if (isValidRedirectUrl(data.destinationUrl)) {
        setIsLocked(false);
        setDestinationUrl(data.destinationUrl);
        window.location.replace(data.destinationUrl!);
      } else {
        throw new Error("Invalid destination URL");
      }
    } catch (error) {
      setPasswordError((error as Error).message || "Invalid password.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function handleOverride() {
    setIsUnlocking(true);
    setPasswordError(null);
    try {
      const response = await fetch(`/api/redirect/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: true }),
      });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        const payload = contentType.includes("application/json")
          ? ((await response.json().catch(() => null)) as RedirectResponse | null)
          : await response.text().catch(() => "");

        if (typeof payload === "object" && payload?.inactive) {
          const data = payload as RedirectResponse;
          setInactiveReason(data.reason ?? "scheduled");
          setIsLocked(false);
          setDestinationUrl(null);
          return;
        }

        const message = typeof payload === "string" ? payload : null;
        throw new Error(message || "Unable to override this link right now.");
      }
      const data = (await response.json()) as RedirectResponse;
      if (isValidRedirectUrl(data.destinationUrl)) {
        setIsLocked(false);
        setCanOverride(false);
        setDestinationUrl(data.destinationUrl);
        window.location.replace(data.destinationUrl!);
      } else {
        throw new Error("Invalid destination URL");
      }
    } catch (error) {
      setPasswordError((error as Error).message || "Unable to override this link right now.");
    } finally {
      setIsUnlocking(false);
    }
  }

  // Standalone dedicated "Redirecting..." loading screen
  if (isLoading || destinationUrl) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 text-white">
        <div className="flex flex-col items-center text-center space-y-5 max-w-md w-full p-8 rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-md shadow-2xl">
          <div className="logo-shell inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 shadow-sm">
            <Image
              src="/cvsd-logo.png"
              alt="Cedar Valley School District"
              width={180}
              height={40}
              className="h-8 w-auto"
              priority
            />
            <span className="ml-3 border-l border-slate-300 pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-oxford-700">
              Go
            </span>
          </div>

          <div className="relative flex h-10 w-10 items-center justify-center pt-2">
            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-oxford-400 opacity-75"></span>
            <span className="relative inline-flex h-6 w-6 rounded-full bg-oxford-600"></span>
          </div>

          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-100">Redirecting...</h1>
            <p className="mt-1.5 text-xs text-slate-400">Taking you to your destination...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 text-white">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="logo-shell inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 shadow-sm mb-4">
          <Image
            src="/cvsd-logo.png"
            alt="Cedar Valley School District"
            width={180}
            height={40}
            className="h-8 w-auto"
            priority
          />
          <span className="ml-3 border-l border-slate-300 pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-oxford-700">
            Go
          </span>
        </div>

        {inactiveReason === "scheduled" && (
          <div>
            <h1 className="font-serif text-2xl font-bold text-amber-400">Link Not Released</h1>
            <p className="mt-2 text-xs text-slate-300">
              This link has not been released yet. Please check back later or contact district administrators.
            </p>
          </div>
        )}

        {inactiveReason === "expired" && (
          <div>
            <h1 className="font-serif text-2xl font-bold text-rose-400">Link Expired</h1>
            <p className="mt-2 text-xs text-slate-300">
              This short link has expired and is no longer active.
            </p>
          </div>
        )}

        {!inactiveReason && isMissing && (
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-100">Link Not Found</h1>
            <p className="mt-2 text-xs text-slate-400">
              We couldn&apos;t find a active destination for <code className="font-mono text-amber-300">{slug}</code>.
            </p>
          </div>
        )}

        {isLocked && (
          <div>
            <h1 className="font-serif text-2xl font-bold text-slate-100">Password Required</h1>
            <p className="mt-2 text-xs text-slate-400">
              This link is password-protected. Enter the password to proceed to <span className="font-mono text-slate-200">go.cvsd.live/{slug}</span>.
            </p>
            <form onSubmit={handleUnlock} className="mt-4 space-y-3">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none focus:border-oxford-400 focus:ring-1 focus:ring-oxford-400"
              />
              {passwordError && <p className="text-xs font-semibold text-rose-400">{passwordError}</p>}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="inline-flex items-center gap-2 rounded-xl bg-oxford-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-oxford-500 disabled:opacity-60"
                >
                  {isUnlocking && (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-3.3-6.9" />
                    </svg>
                  )}
                  Unlock & Proceed
                </button>
                {canOverride && (
                  <button
                    type="button"
                    onClick={() => void handleOverride()}
                    disabled={isUnlocking}
                    className="rounded-xl border border-amber-500/60 bg-amber-950/40 px-4 py-2.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-900/60"
                  >
                    Admin Override
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        <div className="mt-6 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
          >
            Return to Home Page
          </button>
        </div>
      </div>
    </main>
  );
}
