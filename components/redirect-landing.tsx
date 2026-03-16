"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type RedirectResponse = {
  destinationUrl: string | null;
  locked?: boolean;
  inactive?: boolean;
  reason?: "scheduled" | "expired";
};

export function RedirectLanding() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = useMemo(() => params?.slug ?? "", [params]);

  const [destinationUrl, setDestinationUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isMissing, setIsMissing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [inactiveReason, setInactiveReason] = useState<RedirectResponse["reason"] | null>(null);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!slug) return;

    const controller = new AbortController();

    async function loadDestination() {
      try {
        setIsLoading(true);
        setIsMissing(false);
        setIsLocked(false);
        setInactiveReason(null);
        if (redirectTimerRef.current) {
          window.clearInterval(redirectTimerRef.current);
          redirectTimerRef.current = null;
        }
        setSecondsLeft(10);
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
          setDestinationUrl(null);
        } else {
          setDestinationUrl(data.destinationUrl);
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

    loadDestination();

    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (!destinationUrl) return;

    if (redirectTimerRef.current) {
      window.clearInterval(redirectTimerRef.current);
    }

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.location.assign(destinationUrl);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    redirectTimerRef.current = interval;

    return () => {
      window.clearInterval(interval);
      if (redirectTimerRef.current === interval) {
        redirectTimerRef.current = null;
      }
    };
  }, [destinationUrl]);

  function handleProceed() {
    if (destinationUrl) {
      window.location.assign(destinationUrl);
    }
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
      const response = await fetch(`/api/redirect/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as RedirectResponse | null;
        if (data?.inactive) {
          setInactiveReason(data.reason ?? "scheduled");
          setIsLocked(false);
          setDestinationUrl(null);
          return;
        }
        const message = await response.text();
        throw new Error(message || "Invalid password.");
      }
      const data = (await response.json()) as RedirectResponse;
      setIsLocked(false);
      setDestinationUrl(data.destinationUrl);
      setPassword("");
    } catch (error) {
      setPasswordError((error as Error).message || "Invalid password.");
    } finally {
      setIsUnlocking(false);
    }
  }

  function handleBack() {
    if (redirectTimerRef.current) {
      window.clearInterval(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    setDestinationUrl(null);
    setSecondsLeft(0);
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-surface-50 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">CVSD Go</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">Redirecting</h1>

        {isLoading && (
          <p className="mt-4 text-sm text-slate-600">Looking up the destination for this link...</p>
        )}

        {!isLoading && inactiveReason === "scheduled" && (
          <p className="mt-4 text-sm text-slate-600">
            This link hasn&apos;t been released yet. Please check back later or contact the district for access.
          </p>
        )}

        {!isLoading && inactiveReason === "expired" && (
          <p className="mt-4 text-sm text-slate-600">
            This link has expired. Please visit the CVSD Go homepage for active destinations.
          </p>
        )}

        {!isLoading && !inactiveReason && isMissing && (
          <p className="mt-4 text-sm text-slate-600">
            We couldn&apos;t find a destination for {slug}. You can head back to the home page.
          </p>
        )}

        {!isLoading && destinationUrl && (
          <>
            <p className="mt-4 text-sm text-slate-600">
              You are being redirected to <span className="font-semibold text-oxford-700">{destinationUrl}</span>.
            </p>
            <p className="mt-2 text-sm text-slate-600">Redirecting in {secondsLeft} seconds...</p>
          </>
        )}

        {!isLoading && isLocked && (
          <>
            <p className="mt-4 text-sm text-slate-600">
              This destination is protected. The link target is hidden until you enter the correct password.
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Requested link: <span className="font-semibold text-oxford-700">go.cvsd.live/{slug}</span>
            </p>
            <form onSubmit={handleUnlock} className="mt-4 space-y-3">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-oxford-300"
              />
              {passwordError && <p className="text-sm text-amber-700">{passwordError}</p>}
              <button
                type="submit"
                disabled={isUnlocking}
                className="inline-flex items-center gap-2 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
              >
                {isUnlocking && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 12a9 9 0 1 1-3.3-6.9" />
                  </svg>
                )}
                Unlock & Continue
              </button>
            </form>
          </>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleProceed}
            disabled={!destinationUrl}
            className="rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            Proceed
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300"
          >
            Back
          </button>
        </div>
      </div>
    </main>
  );
}
