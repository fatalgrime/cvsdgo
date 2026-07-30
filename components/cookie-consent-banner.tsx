"use client";

import { useEffect, useMemo, useState } from "react";

type ConsentChoice = "accepted" | "declined";

type ConsentCategory = {
  id: "necessary" | "analytics" | "preferences";
  label: string;
  required: boolean;
  description: string;
};

type ConsentPreference = {
  version: number;
  choice: ConsentChoice;
  categories: Record<ConsentCategory["id"], boolean>;
  updatedAt: string;
};

const CONSENT_STORAGE_KEY = "cvsdgo-cookie-consent";
const CONSENT_COOKIE_NAME = "cvsdgo_cookie_consent";
const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

const CONSENT_CATEGORIES: ConsentCategory[] = [
  {
    id: "necessary",
    label: "Necessary",
    required: true,
    description: "Required for sign-in, security, and core site functions.",
  },
  {
    id: "analytics",
    label: "Analytics",
    required: false,
    description: "Reserved for optional usage measurement if added later.",
  },
  {
    id: "preferences",
    label: "Preferences",
    required: false,
    description: "Reserved for optional personalization beyond essential settings.",
  },
];

function buildPreference(choice: ConsentChoice): ConsentPreference {
  const accepted = choice === "accepted";
  return {
    version: CONSENT_VERSION,
    choice,
    categories: CONSENT_CATEGORIES.reduce(
      (categories, category) => ({
        ...categories,
        [category.id]: category.required || accepted,
      }),
      {} as ConsentPreference["categories"]
    ),
    updatedAt: new Date().toISOString(),
  };
}

function isStoredPreference(value: unknown): value is ConsentPreference {
  if (!value || typeof value !== "object") return false;
  const preference = value as Partial<ConsentPreference>;
  return (
    preference.version === CONSENT_VERSION &&
    (preference.choice === "accepted" || preference.choice === "declined") &&
    typeof preference.categories === "object" &&
    preference.categories !== null &&
    typeof preference.updatedAt === "string"
  );
}

function readStoredPreference(): ConsentPreference | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isStoredPreference(parsed)) {
        return parsed;
      }
    }
  } catch {
  }

  const storedCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (storedCookie === "accepted" || storedCookie === "declined") {
    return buildPreference(storedCookie);
  }

  return null;
}

function persistPreference(preference: ConsentPreference) {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(preference));
  } catch {
  }

  document.cookie = [
    `${CONSENT_COOKIE_NAME}=${preference.choice}`,
    `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    window.location.protocol === "https:" ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function CookieConsentBanner() {
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const stored = readStoredPreference();
    setIsVisible(!stored);
    setIsReady(true);
  }, []);

  const categorySummary = useMemo(
    () => CONSENT_CATEGORIES.map((category) => category.label).join(", "),
    []
  );

  function saveChoice(choice: ConsentChoice) {
    persistPreference(buildPreference(choice));
    setIsVisible(false);
  }

  if (!isReady || !isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[160] px-4 pb-4 sm:px-6 sm:pb-6" role="region" aria-label="Cookie consent">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-black/40">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-deepforest-700 dark:text-deepforest-400">Privacy Preferences</p>
                <h2 className="mt-1 font-serif text-xl leading-tight text-oxford-700 dark:text-slate-100">Cookie consent</h2>
              </div>
              <button
                type="button"
                onClick={() => saveChoice("declined")}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                aria-label="Dismiss cookie consent banner"
                title="Dismiss"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              We use necessary cookies to keep CVSD Go secure and working. You can accept optional categories or decline them; your choice is saved for future visits.
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              Categories: {categorySummary}. Declining keeps only necessary cookies enabled.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => saveChoice("accepted")}
              className="inline-flex justify-center rounded-xl border border-oxford-700 bg-oxford-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-oxford-600 focus:outline-none focus:ring-2 focus:ring-oxford-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => saveChoice("declined")}
              className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-oxford-500 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
