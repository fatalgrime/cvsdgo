"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/toast-provider";
import type { ReportCommentRow, ReportRow } from "@/lib/types";
import { validateContentWithAutoModSync } from "@/lib/automod";

type ReportResponse = {
  reports: ReportRow[];
  comments: ReportCommentRow[];
  isStaff: boolean;
};

type QrRequestItem = {
  id: number;
  link_slug: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  status: "pending" | "accepted" | "declined";
  admin_reason: string | null;
  can_appeal: boolean;
  reviewed_by_user_id?: string | null;
  reviewed_by_name?: string | null;
  created_at: string;
  updated_at?: string;
};

const EMPTY_REPORT = {
  title: "",
  description: "",
  linkSlug: "",
  priority: "normal",
};

export default function SupportPage() {
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"reports" | "qr-requests">("reports");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [comments, setComments] = useState<ReportCommentRow[]>([]);
  const [qrRequests, setQrRequests] = useState<QrRequestItem[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [staffStatusUpdates, setStaffStatusUpdates] = useState<Record<number, string>>({});
  const [staffComments, setStaffComments] = useState<Record<number, string>>({});
  const [pendingDelete, setPendingDelete] = useState<ReportRow | null>(null);
  const [declineReasonMap, setDeclineReasonMap] = useState<Record<number, string>>({});
  const [declineAppealMap, setDeclineAppealMap] = useState<Record<number, boolean>>({});

  function refreshSidebarBadge() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("cvsdgo:refresh-submissions-badge"));
    }
  }

  const commentMap = useMemo(() => {
    const map = new Map<number, ReportCommentRow[]>();
    for (const comment of comments) {
      const list = map.get(comment.report_id) ?? [];
      list.push(comment);
      map.set(comment.report_id, list);
    }
    return map;
  }, [comments]);

  const visibleReports = useMemo(() => {
    return isStaff ? reports.filter((report) => report.status !== "deleted") : reports;
  }, [isStaff, reports]);

  const pendingQrCount = useMemo(() => {
    return qrRequests.filter((r) => r.status === "pending").length;
  }, [qrRequests]);

  const openReportsCount = useMemo(() => {
    return visibleReports.filter((r) => r.status === "open" || r.status === "investigating").length;
  }, [visibleReports]);

  const loadReports = useCallback(async () => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const response = await fetch("/api/reports");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = (await response.json()) as ReportResponse;
      setReports(data.reports ?? []);
      setComments(data.comments ?? []);
      setIsStaff(Boolean(data.isStaff));
    } catch (error) {
      const message = (error as Error).message || "Unable to load reports.";
      setStatusMessage(message);
      toast({ title: "Unable to load reports", description: message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, toast]);

  const loadQrRequests = useCallback(async () => {
    if (!isSignedIn) return;
    setIsQrLoading(true);
    try {
      const res = await fetch("/api/admin/qr-requests");
      if (res.ok) {
        const data = await res.json();
        setQrRequests(data.requests ?? []);
      }
    } catch (err) {
      console.error("Failed to load QR requests:", err);
    } finally {
      setIsQrLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    loadReports();
    loadQrRequests();
  }, [loadReports, loadQrRequests]);

  function updateField<K extends keyof typeof EMPTY_REPORT>(key: K, value: (typeof EMPTY_REPORT)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatusMessage(null);

    // AutoMod client check
    const autoModCheck = validateContentWithAutoModSync(`${form.title} ${form.description} ${form.linkSlug}`);
    if (!autoModCheck.isClean) {
      toast({
        title: "AutoMod Content Warning",
        description: autoModCheck.reason || "Please use school-appropriate language.",
        variant: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          linkSlug: form.linkSlug.trim(),
          priority: form.priority,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to submit report.");
      }
      setForm(EMPTY_REPORT);
      await loadReports();
      refreshSidebarBadge();
      toast({ title: "Report submitted", variant: "success" });
    } catch (error) {
      const message = (error as Error).message || "Unable to submit report.";
      setStatusMessage(message);
      toast({ title: "Unable to submit report", description: message, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusUpdate(reportId: number) {
    const status = staffStatusUpdates[reportId];
    if (!status) return;
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      await loadReports();
      refreshSidebarBadge();
      toast({ title: "Status updated", variant: "success" });
    } catch (error) {
      toast({ title: "Unable to update status", description: (error as Error).message, variant: "error" });
    }
  }

  async function handleComment(reportId: number) {
    const comment = staffComments[reportId]?.trim();
    if (!comment) return;

    // AutoMod client check on comment
    const autoModCheck = validateContentWithAutoModSync(comment);
    if (!autoModCheck.isClean) {
      toast({
        title: "AutoMod Content Warning",
        description: autoModCheck.reason || "Please use school-appropriate language.",
        variant: "error",
      });
      return;
    }

    try {
      const response = await fetch(`/api/reports/${reportId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setStaffComments((current) => ({ ...current, [reportId]: "" }));
      await loadReports();
      toast({ title: "Comment added", variant: "success" });
    } catch (error) {
      toast({ title: "Unable to add comment", description: (error as Error).message, variant: "error" });
    }
  }

  async function handleDelete(reportId: number) {
    try {
      const response = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setPendingDelete(null);
      await loadReports();
      refreshSidebarBadge();
      toast({ title: "Report deleted", variant: "warning" });
    } catch (error) {
      toast({ title: "Unable to delete report", description: (error as Error).message, variant: "error" });
    }
  }

  async function handleReviewQrRequest(requestId: number, status: "accepted" | "declined") {
    const adminReason = declineReasonMap[requestId] || "";
    const canAppeal = declineAppealMap[requestId] !== false;

    try {
      const response = await fetch("/api/admin/qr-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status, adminReason, canAppeal }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      toast({
        title: `Permission ${status === "accepted" ? "Approved" : "Denied"}`,
        description: `QR Code download request #${requestId} has been updated.`,
        variant: "success",
      });
      setQrRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status, admin_reason: adminReason || null, can_appeal: canAppeal }
            : r
        )
      );
      refreshSidebarBadge();
    } catch (error) {
      toast({
        title: "Review error",
        description: (error as Error).message || "Failed to update request status.",
        variant: "error",
      });
    }
  }

  return (
    <section className="space-y-5">
      <div className="panel-strong overflow-hidden p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-deepforest-400">Support & Administration</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-oxford-700 dark:text-slate-100 md:text-4xl">Submissions & Requests</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Manage problem reports, user feedback, and QR code access permission requests across CVSD Go.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Sign in required</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Create an account or sign in to submit and manage your reports and permission requests.</p>
          <SignInButton>
            <button className="mt-3 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-600" type="button">
              Sign In / Sign Up
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("reports")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] transition ${
              activeTab === "reports"
                ? "border-oxford-700 text-oxford-700 dark:border-oxford-400 dark:text-oxford-300"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Problem Reports
            {openReportsCount > 0 && (
              <span className="rounded-full bg-oxford-100 px-2 py-0.5 text-[10px] font-extrabold text-oxford-800 dark:bg-oxford-900/60 dark:text-oxford-200">
                {openReportsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("qr-requests")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] transition ${
              activeTab === "qr-requests"
                ? "border-oxford-700 text-oxford-700 dark:border-oxford-400 dark:text-oxford-300"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            QR Code Permission Requests
            {pendingQrCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                {pendingQrCount} Pending
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Problem Reports & Submissions Form */}
        {activeTab === "reports" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-oxford-700 dark:text-slate-100">
                  {isStaff ? "All Problem Reports" : "Your Submitted Reports"}
                </h2>
                <button
                  type="button"
                  onClick={loadReports}
                  aria-label="Refresh reports"
                  title="Refresh reports"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:text-slate-300"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 11a8 8 0 1 0-2.34 5.66" /><path d="M20 4v7h-7" />
                  </svg>
                </button>
              </div>

              {statusMessage && (
                <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                  {statusMessage}
                </p>
              )}

              {isLoading ? (
                <div className="mt-4 space-y-2">
                  {[0,1,2].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                      <div className="h-2.5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-2 h-3.5 w-48 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-2 h-2.5 w-64 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : visibleReports.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-400 dark:border-slate-700">
                  No problem reports submitted yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleReports.map((report) => {
                    const reportComments = commentMap.get(report.id) ?? [];
                    const priorityColor =
                      report.priority === "urgent" ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300" :
                      report.priority === "high"   ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300" :
                      "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
                    const statusColor =
                      report.status === "resolved" ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" :
                      report.status === "investigating" ? "border-oxford-200 bg-oxford-50 text-oxford-700 dark:border-oxford-700 dark:bg-oxford-900/40 dark:text-slate-200" :
                      report.status === "closed" ? "border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" :
                      "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
                    return (
                      <div key={report.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${priorityColor}`}>
                                {report.priority}
                              </span>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusColor}`}>
                                {report.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-oxford-700 dark:text-slate-100">{report.title}</p>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{report.description}</p>
                            {report.link_slug && (
                              <p className="mt-1.5 text-xs text-slate-400">Link: go.cvsd.live/{report.link_slug}</p>
                            )}
                            <p className="mt-1.5 text-xs text-slate-400">
                              Submitted: {new Date(report.created_at).toLocaleString()}
                            </p>
                          </div>
                          {isStaff && (
                            <div className="shrink-0 space-y-2 min-w-[160px]">
                              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Status</label>
                              <select
                                value={staffStatusUpdates[report.id] ?? report.status}
                                onChange={(event) => setStaffStatusUpdates((current) => ({ ...current, [report.id]: event.target.value }))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-oxford-700 outline-none focus:border-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              >
                                <option value="open">Open</option>
                                <option value="investigating">Investigating</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => handleStatusUpdate(report.id)}
                                className="w-full rounded-lg border border-oxford-700 bg-oxford-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-oxford-600"
                              >
                                Update Status
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDelete(report)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        {reportComments.length > 0 && (
                          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Comments</p>
                            {reportComments.map((comment) => (
                              <div key={comment.id} className="text-sm">
                                <p className="font-semibold text-oxford-700 dark:text-slate-200">{comment.author_name ?? "Staff"}</p>
                                <p className="mt-0.5 text-slate-600 dark:text-slate-400">{comment.body}</p>
                                <p className="mt-1 text-xs text-slate-400">{new Date(comment.created_at).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {isStaff && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Add comment</p>
                            <textarea
                              value={staffComments[report.id] ?? ""}
                              onChange={(event) => setStaffComments((current) => ({ ...current, [report.id]: event.target.value }))}
                              rows={3}
                              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              placeholder="Add an internal update or response..."
                            />
                            <button
                              type="button"
                              onClick={() => handleComment(report.id)}
                              className="mt-2 rounded-lg border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-oxford-600"
                            >
                              Post Comment
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel p-5">
              <h2 className="text-base font-semibold text-oxford-700 dark:text-slate-100">Submit a Report</h2>
              <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="title">Title</label>
                  <input id="title" value={form.title} onChange={(event) => updateField("title", event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="Short summary" required />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="description">Description</label>
                  <textarea id="description" value={form.description} onChange={(event) => updateField("description", event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    rows={5} placeholder="Describe the issue you found." required />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="linkSlug">Link slug (optional)</label>
                  <input id="linkSlug" value={form.linkSlug} onChange={(event) => updateField("linkSlug", event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    placeholder="example: enroll" />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="priority">Priority</label>
                  <select id="priority" value={form.priority} onChange={(event) => updateField("priority", event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <button type="submit" disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300">
                  {isSubmitting && <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3.3-6.9" /></svg>}
                  {isSubmitting ? "Submitting…" : "Submit Report"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: QR Code Permission Requests Section */}
        {activeTab === "qr-requests" && (
          <div className="panel p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-oxford-700 dark:text-slate-100">
                  QR Code Access Permission Requests
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Review and manage user permissions to download high-resolution QR codes for district links.
                </p>
              </div>
              <button
                type="button"
                onClick={loadQrRequests}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:text-slate-300"
                title="Refresh Requests"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>

            {isQrLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                    <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-2 h-3 w-64 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : qrRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No QR code access permission requests found.
              </div>
            ) : (
              <div className="space-y-4">
                {qrRequests.map((req) => (
                  <div
                    key={req.id}
                    className={`rounded-2xl border p-5 transition ${
                      req.status === "pending"
                        ? "border-amber-300/80 bg-amber-50/40 dark:border-amber-800/80 dark:bg-amber-950/20"
                        : req.status === "accepted"
                        ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-base font-bold text-oxford-700 dark:text-slate-100">
                            go.cvsd.live/{req.link_slug}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              req.status === "accepted"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : req.status === "declined"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-200 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                            }`}
                          >
                            {req.status === "accepted" ? "Approved" : req.status === "declined" ? "Denied" : "Pending Review"}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <p>
                            <strong className="font-semibold text-slate-700 dark:text-slate-300">Requested by:</strong>{" "}
                            {req.user_name || req.user_email || req.user_id}{" "}
                            {req.user_email && <span className="text-slate-400">({req.user_email})</span>}
                          </p>
                          <p>
                            <strong className="font-semibold text-slate-700 dark:text-slate-300">Request Date:</strong>{" "}
                            {new Date(req.created_at).toLocaleString()}
                          </p>
                          {req.reviewed_by_name && (
                            <p className="text-slate-500">
                              Reviewed by {req.reviewed_by_name}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Admin actions if staff/admin */}
                      {isStaff && (
                        <div className="flex flex-wrap items-center gap-2">
                          {req.status !== "accepted" && (
                            <button
                              type="button"
                              onClick={() => handleReviewQrRequest(req.id, "accepted")}
                              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
                            >
                              Approve Permission
                            </button>
                          )}
                          {req.status !== "declined" && (
                            <button
                              type="button"
                              onClick={() => handleReviewQrRequest(req.id, "declined")}
                              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500"
                            >
                              Deny Request
                            </button>
                          )}
                          {req.status === "accepted" && (
                            <button
                              type="button"
                              onClick={() => handleReviewQrRequest(req.id, "declined")}
                              className="rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300"
                            >
                              Revoke Access
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Decline Reason / Appeal controls */}
                    {isStaff && req.status === "pending" && (
                      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                        <input
                          type="text"
                          placeholder="Optional decision notes / reason (e.g. Verified district staff member)"
                          value={declineReasonMap[req.id] || ""}
                          onChange={(e) =>
                            setDeclineReasonMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        />
                        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <input
                            type="checkbox"
                            checked={declineAppealMap[req.id] !== false}
                            onChange={(e) =>
                              setDeclineAppealMap((prev) => ({ ...prev, [req.id]: e.target.checked }))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-oxford-700"
                          />
                          Allow Trust & Safety appeal if denied
                        </label>
                      </div>
                    )}

                    {req.admin_reason && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                        <strong className="font-semibold">Note from Admin:</strong> {req.admin_reason}{" "}
                        {req.can_appeal ? "(Eligible for appeal)" : "(Ineligible for appeal)"}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SignedIn>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            className="modal-backdrop z-[200] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => { if (event.target === event.currentTarget) setPendingDelete(null); }}
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700">Confirm delete</p>
              <h2 className="mt-2 font-serif text-xl text-oxford-700 dark:text-slate-100">Delete this report?</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                This will permanently remove{" "}
                <span className="font-semibold text-oxford-700 dark:text-slate-200">{pendingDelete.title}</span>.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(pendingDelete.id)}
                  className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
