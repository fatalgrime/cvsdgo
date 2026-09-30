"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const QrCodeDialog = dynamic(
  () => import("@/components/qr-code-dialog").then((module) => module.QrCodeDialog),
  { ssr: false }
);

type LazyQrCodeDialogProps = {
  slug: string;
  url?: string;
  description?: string;
};

export function LazyQrCodeDialog(props: LazyQrCodeDialogProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (isLoaded) return <QrCodeDialog {...props} initiallyOpen />;

  return (
    <button
      type="button"
      onClick={() => setIsLoaded(true)}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-oxford-700 shadow-sm transition hover:border-oxford-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxford-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300"
      aria-label={`Generate a QR code for go.cvsd.live/${props.slug}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
      </svg>
      <span>QR code</span>
    </button>
  );
}

