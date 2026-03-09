"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/toast-provider";
import type { ReportCommentRow, ReportRow } from "@/lib/types";

type ReportResponse = {
  reports: ReportRow[];
  comments: ReportCommentRow[];
  isStaff: boolean;
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
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [comments, setComments] = useState<ReportCommentRow[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_REPORT);
  const [staffStatusUpdates, setStaffStatusUpdates] = useState<Record<number, string>>({});
  const [staffComments, setStaffComments] = useState<Record<number, string>>({});
  const [pendingDelete, setPendingDelete] = useState<ReportRow | null>(null);

  const commentMap = useMemo(() => {
    const map = new Map<number, ReportCommentRow[]>();
    for (const comment of comments) {
      const list = map.get(comment.report_id) ?? [];
      list.push(comment);
      map.set(comment.report_id, list);
    }
    return map;
  }, [comments]);

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

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  function updateField<K extends keyof typeof EMPTY_REPORT>(key: K, value: (typeof EMPTY_REPORT)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
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
      toast({ title: "Status updated", variant: "success" });
    } catch (error) {
      toast({ title: "Unable to update status", description: (error as Error).message, variant: "error" });
    }
  }

  async function handleComment(reportId: number) {
    const comment = staffComments[reportId]?.trim();
    if (!comment) return;
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
      toast({ title: "Report deleted", variant: "warning" });
    } catch (error) {
      toast({ title: "Unable to delete report", description: (error as Error).message, variant: "error" });
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Support</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">Submissions Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Sign in to submit a problem report and track updates from CVSD.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold uppercase tracking-[0.08em]">Sign in required</p>
          <p className="mt-2">Create an account or sign in to submit and manage your reports.</p>
          <SignInButton>
            <button
              className="mt-4 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
              type="button"
            >
              Sign In / Sign Up
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-md border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-oxford-700">
                {isStaff ? "All Reports" : "Your Reports"}
              </h2>
              <button
                type="button"
                onClick={loadReports}
                aria-label="Refresh reports"
                title="Refresh reports"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-oxford-700 transition hover:border-oxford-400"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 11a8 8 0 1 0-2.34 5.66" />
                  <path d="M20 4v7h-7" />
                </svg>
              </button>
            </div>

            {statusMessage && (
              <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {statusMessage}
              </p>
            )}

            {isLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading reports...</p>
            ) : reports.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">No reports yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {reports.map((report) => {
                  const reportComments = commentMap.get(report.id) ?? [];
                  return (
                    <div key={report.id} className="rounded-md border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-deepforest-700">
                            {report.priority} priority · {report.status}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-oxford-700">{report.title}</p>
                          <p className="mt-2 text-sm text-slate-600">{report.description}</p>
                          {report.link_slug && (
                            <p className="mt-2 text-xs text-slate-500">Link: go.cvsd.live/{report.link_slug}</p>
                          )}
                          <p className="mt-2 text-xs text-slate-500">
                            Submitted: {new Date(report.created_at).toLocaleString()}
                          </p>
                        </div>
                        {isStaff && (
                          <div className="min-w-[180px] space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                              Status
                            </label>
                            <select
                              value={staffStatusUpdates[report.id] ?? report.status}
                              onChange={(event) =>
                                setStaffStatusUpdates((current) => ({
                                  ...current,
                                  [report.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-oxford-700"
                            >
                              <option value="open">Open</option>
                              <option value="investigating">Investigating</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleStatusUpdate(report.id)}
                              className="w-full rounded-md border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
                            >
                              Update Status
                            </button>
                          </div>
                        )}
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(report)}
                            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 transition hover:border-rose-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      {reportComments.length > 0 && (
                        <div className="mt-4 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Comments</p>
                          {reportComments.map((comment) => (
                            <div key={comment.id} className="text-sm text-slate-600">
                              <p className="font-semibold text-oxford-700">{comment.author_name ?? "Staff"}</p>
                              <p className="mt-1">{comment.body}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {isStaff && (
                        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                            Add comment
                          </p>
                          <textarea
                            value={staffComments[report.id] ?? ""}
                            onChange={(event) =>
                              setStaffComments((current) => ({ ...current, [report.id]: event.target.value }))
                            }
                            rows={3}
                            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700"
                            placeholder="Add an internal update or response..."
                          />
                          <button
                            type="button"
                            onClick={() => handleComment(report.id)}
                            className="mt-3 rounded-md border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
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

          <div className="rounded-md border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-oxford-700">Submit a report</h2>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600" htmlFor="title">
                  Title
                </label>
                <input
                  id="title"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700"
                  placeholder="Short summary"
                  required
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                  htmlFor="description"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700"
                  rows={5}
                  placeholder="Describe the issue you found."
                  required
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                  htmlFor="linkSlug"
                >
                  Link slug (optional)
                </label>
                <input
                  id="linkSlug"
                  value={form.linkSlug}
                  onChange={(event) => updateField("linkSlug", event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700"
                  placeholder="example: enroll"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600" htmlFor="priority">
                  Priority
                </label>
                <select
                  id="priority"
                  value={form.priority}
                  onChange={(event) => updateField("priority", event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </form>
          </div>
        </div>
      </SignedIn>

      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 backdrop-blur-none px-4"
            style={{ backdropFilter: "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-xl"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Confirm delete</p>
              <h2 className="mt-3 font-serif text-2xl text-oxford-700">Delete this report?</h2>
              <p className="mt-2 text-sm text-slate-600">
                This will permanently remove{" "}
                <span className="font-semibold text-oxford-700">{pendingDelete.title}</span>.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDelete(pendingDelete.id)}
                  className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete(null)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400"
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
