"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SignInButton, useUser } from "@clerk/nextjs";
import { useToast } from "@/components/toast-provider";
import { generateQrSvgDataUri } from "@/lib/qr-generator";

type QrCodeDialogProps = {
  slug: string;
  url?: string;
  description?: string;
  triggerButton?: React.ReactNode;
};

type RequestStatusPayload = {
  status: "accepted" | "pending" | "declined" | "none" | "unauthenticated";
  directAccess: boolean;
  canDownload: boolean;
  adminReason: string | null;
  canAppeal: boolean;
  qrCodeAccessEnabled?: boolean;
  isAuthenticated?: boolean;
};

export function QrCodeDialog({ slug, description, triggerButton }: QrCodeDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [portalReady, setPortalReady] = useState(false);
  const [reqState, setReqState] = useState<RequestStatusPayload>({
    status: "none",
    directAccess: false,
    canDownload: false,
    adminReason: null,
    canAppeal: false,
    qrCodeAccessEnabled: false,
    isAuthenticated: false,
  });
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [copiedAppealTemplate, setCopiedAppealTemplate] = useState(false);

  const { user, isLoaded } = useUser();
  const { toast } = useToast();

  const shortLinkUrl = `https://go.cvsd.live/${slug}`;

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    async function checkStatus() {
      try {
        const response = await fetch(`/api/qr-code/request?slug=${encodeURIComponent(slug)}`);
        if (response.ok) {
          const data = (await response.json()) as RequestStatusPayload;
          setReqState(data);
        }
      } catch (error) {
        console.error("Failed to check QR status:", error);
      }
    }

    void checkStatus();
  }, [isOpen, slug]);

  async function handleRequestAccess() {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "All users must be signed in to submit a permission request.",
        variant: "error",
      });
      return;
    }

    setIsSubmittingReq(true);
    try {
      const response = await fetch("/api/qr-code/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      toast({
        title: "Request submitted",
        description: "Your download access request has been sent to district admins.",
        variant: "success",
      });
      setReqState((prev) => ({ ...prev, status: "pending", canDownload: false }));
    } catch (error) {
      toast({
        title: "Unable to submit request",
        description: (error as Error).message || "Please sign in to request download access.",
        variant: "error",
      });
    } finally {
      setIsSubmittingReq(false);
    }
  }

  function handleDownloadSvg() {
    if (!user && !reqState.canDownload) {
      toast({ title: "Sign in required", description: "All users must be signed in to download a QR code.", variant: "error" });
      return;
    }
    const svgDataUri = generateQrSvgDataUri(shortLinkUrl, includeLogo);
    const link = document.createElement("a");
    link.href = svgDataUri;
    link.download = `CVSD-GO-${slug}-QR.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Downloaded SVG", description: "Vector QR Code saved to downloads.", variant: "success" });
  }

  function handleDownloadPng() {
    if (!user && !reqState.canDownload) {
      toast({ title: "Sign in required", description: "All users must be signed in to download a QR code.", variant: "error" });
      return;
    }
    const svgDataUri = generateQrSvgDataUri(shortLinkUrl, includeLogo);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 2000;
      canvas.height = 2000;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, 2000, 2000);
      ctx.drawImage(img, 0, 0, 2000, 2000);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `CVSD-GO-${slug}-QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Downloaded PNG", description: "High-resolution 2000x2000px PNG saved.", variant: "success" });
    };
    img.src = svgDataUri;
  }

  const userUsername = user?.username || user?.emailAddresses[0]?.emailAddress || "user_account";

  const appealTemplateText = `To: Vantor Department of Trust & Safety <safety@vantor.one>
Subject: Appeal a Decision for a Download Request - CVSD Go (${slug})

Username of the affected account: ${userUsername}
Platform: Cedar Valley School District Go (CVSD Go)
Reason for decision: ${reqState.adminReason || "QR Code Download Request Declined"}

Why should your QR code download request appeal be accepted?
[Provide your intended use case, school event, poster location, or promotional context]

If QR code download access is granted, will you follow all district media and branding regulations?
[Yes / No]

Regulations Agreement: You must agree to follow all district regulations for QR code display and promotional materials. If you violate our regulations after your download access is granted, your download access may be permanently revoked with no further opportunity to appeal.
Status: Agree`;

  async function handleCopyAppealTemplate() {
    await navigator.clipboard.writeText(appealTemplateText);
    setCopiedAppealTemplate(true);
    toast({ title: "Template Copied", description: "Appeal information template copied to clipboard.", variant: "success" });
    setTimeout(() => setCopiedAppealTemplate(false), 2000);
  }

  const isSignedOut = isLoaded && !user;

  return (
    <>
      {triggerButton ? (
        <div onClick={() => setIsOpen(true)}>{triggerButton}</div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-oxford-700 shadow-sm transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-oxford-300"
          title="Generate QR Code"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
          </svg>
          QR Code
        </button>
      )}

      {portalReady &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="modal-backdrop z-[100] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsOpen(false);
                }}
              >
                <motion.div
                  className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">
                        District QR Generator
                      </p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-oxford-700 dark:text-slate-100">
                        go.cvsd.live/{slug}
                      </h2>
                      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      aria-label="Close dialog"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* QR Code Visual Preview */}
                  <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
                    <img
                      src={generateQrSvgDataUri(shortLinkUrl, includeLogo)}
                      alt={`QR Code for ${shortLinkUrl}`}
                      className="h-56 w-56 rounded-lg border border-slate-300 bg-white p-3 shadow-md dark:border-slate-700"
                    />

                    <div className="mt-4 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`logo-toggle-${slug}`}
                        checked={includeLogo}
                        onChange={(e) => setIncludeLogo(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900"
                      />
                      <label htmlFor={`logo-toggle-${slug}`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Embed CVSD District Logo Overlay
                      </label>
                    </div>
                  </div>

                  {/* Authorization & Download Workflow */}
                  <div className="mt-5 space-y-3">
                    {isSignedOut ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="text-sm font-semibold">Sign In Required</p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          All users must be signed in to download a QR code image or submit an access permission request.
                        </p>
                        <SignInButton>
                          <button
                            type="button"
                            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-oxford-600"
                          >
                            Sign In / Create Account
                          </button>
                        </SignInButton>
                      </div>
                    ) : reqState.canDownload ? (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500">
                          {reqState.directAccess
                            ? "QR Code Downloads Enabled: Download vector SVG or high-res PNG for flyers and posters."
                            : "Download Request Approved: Download vector SVG or high-res PNG for promotional materials."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadPng}
                            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-oxford-600"
                          >
                            Download PNG (High-Res)
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadSvg}
                            className="flex-1 inline-flex justify-center items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          >
                            Download SVG (Vector)
                          </button>
                        </div>
                      </div>
                    ) : reqState.status === "pending" ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                        <p className="text-sm font-semibold">Download Access Request Pending</p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          Your request has been submitted to district administrators for review. Access will be granted upon approval.
                        </p>
                      </div>
                    ) : reqState.status === "declined" ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Download Access Request Declined</p>
                          <span className="rounded-full bg-rose-200/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:bg-rose-900 dark:text-rose-100">
                            Declined
                          </span>
                        </div>
                        {reqState.adminReason && (
                          <p className="mt-2 text-xs font-medium text-rose-800 dark:text-rose-300">
                            <strong className="font-semibold">Reason from Admin:</strong> {reqState.adminReason}
                          </p>
                        )}

                        {reqState.canAppeal ? (
                          <div className="mt-4 pt-3 border-t border-rose-200/80 dark:border-rose-900/60">
                            <button
                              type="button"
                              onClick={() => setShowAppealModal(true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 shadow-sm transition hover:bg-rose-100 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200"
                            >
                              View Appeal Information
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">
                            This decision is final and is not eligible for appeal.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Direct QR downloads are currently disabled for this link. To download high-res PNG or SVG files, please submit a permission request to district administrators.
                        </p>
                        <button
                          type="button"
                          onClick={handleRequestAccess}
                          disabled={isSubmittingReq}
                          className="mt-3 w-full rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:opacity-60"
                        >
                          {isSubmittingReq ? "Submitting..." : "Request QR Code Download Access"}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Vantor Trust & Safety Appeal Modal */}
      {portalReady &&
        createPortal(
          <AnimatePresence>
            {showAppealModal && (
              <motion.div
                className="modal-backdrop z-[110] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowAppealModal(false);
                }}
              >
                <motion.div
                  className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700 dark:text-rose-400">
                        Vantor Department of Trust & Safety
                      </p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-oxford-700 dark:text-slate-100">
                        Appeal a Decision for a Download Request
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAppealModal(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <p>
                      Users eligible to appeal a decision for a download request can submit their request directly to the Vantor Department of Trust & Safety by emailing{" "}
                      <a href="mailto:safety@vantor.one" className="font-semibold text-oxford-700 underline dark:text-oxford-300">
                        safety@vantor.one
                      </a>.
                    </p>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Required Information in Email:</p>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-oxford-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      <p><strong className="text-slate-500">Username of affected account:</strong> {userUsername}</p>
                      <p><strong className="text-slate-500">Platform:</strong> Cedar Valley School District Go (CVSD Go)</p>
                      <p><strong className="text-slate-500">Reason for decision:</strong> {reqState.adminReason || "Download Request Declined"}</p>
                      <p><strong className="text-slate-500">Why should your QR code download request appeal be accepted?</strong> [Provide intended use case, school event, or poster location]</p>
                      <p><strong className="text-slate-500">If QR code download access is granted, will you follow all district media and branding regulations?</strong> [Yes / No]</p>
                      <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
                        <strong className="text-slate-400">Regulations Agreement:</strong> You must agree to follow all district regulations for QR code display and promotional materials. If you violate our regulations after your download access is granted, your download access may be permanently revoked with no further opportunity to appeal. Agree / Disagree
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCopyAppealTemplate}
                      className="inline-flex items-center gap-2 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
                    >
                      {copiedAppealTemplate ? "Template Copied!" : "Copy Appeal Template"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAppealModal(false)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
