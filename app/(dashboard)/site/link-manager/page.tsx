"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import type { RedirectRow } from "@/lib/types";
import { useToast } from "@/components/toast-provider";

const EMPTY_FORM = {
  id: null as number | null,
  slug: "",
  url: "",
  description: "",
  isLocked: false,
  password: "",
  releaseAt: "",
  expiresAt: "",
};

type LinkPayload = {
  slug: string;
  url: string;
  description: string;
  isLocked: boolean;
  password: string;
  releaseAt: string | null;
  expiresAt: string | null;
};

export default function LinkManagerPage() {
  const [links, setLinks] = useState<RedirectRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RedirectRow | null>(null);
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const isEditing = form.id !== null;

  const sortedLinks = useMemo(() => {
    return [...links].sort((a, b) => a.slug.localeCompare(b.slug));
  }, [links]);

  const loadLinks = useCallback(async () => {
    setIsLoading(true);
    setStatus(null);
    try {
      const response = await fetch("/api/links");
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const data = await response.json();
      setLinks(data.links ?? []);
    } catch (error) {
      const message = (error as Error).message || "Unable to load links.";
      setStatus(message);
      toast({ title: "Unable to load links", description: message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isSignedIn) {
      loadLinks();
    } else {
      setIsLoading(false);
    }
  }, [isSignedIn, loadLinks]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  function updateField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function formatLocalDateTime(value: string | Date | null | undefined): string {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function formatDisplayDate(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString();
  }

  function startEdit(link: RedirectRow) {
    setForm({
      id: link.id,
      slug: link.slug,
      url: link.url,
      description: link.description ?? "",
      isLocked: Boolean(link.is_locked),
      password: "",
      releaseAt: formatLocalDateTime(link.release_at ?? null),
      expiresAt: formatLocalDateTime(link.expires_at ?? null),
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);

    const payload: LinkPayload = {
      slug: form.slug.trim(),
      url: form.url.trim(),
      description: form.description.trim(),
      isLocked: form.isLocked,
      password: form.password,
      releaseAt: form.releaseAt ? new Date(form.releaseAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    };

    try {
      const response = await fetch(isEditing ? `/api/links/${form.id}` : "/api/links", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to save link.");
      }

      if (!isEditing) {
        const data = await response.json();
        setRecentlyAddedId(data?.link?.id ?? null);
      }
      await loadLinks();
      resetForm();
      const successMessage = isEditing ? "Link updated." : "Link created.";
      setStatus(successMessage);
      toast({
        title: successMessage,
        description: `go.cvsd.live/${payload.slug}`,
        variant: "success",
      });
    } catch (error) {
      const message = (error as Error).message || "Unable to save link.";
      setStatus(message);
      toast({ title: "Unable to save link", description: message, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(linkId: number) {
    setStatus(null);

    try {
      const response = await fetch(`/api/links/${linkId}`, { method: "DELETE" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to delete link.");
      }
      await loadLinks();
      if (form.id === linkId) {
        resetForm();
      }
      setPendingDelete(null);
      setStatus("Link deleted.");
      toast({ title: "Link deleted", variant: "warning" });
    } catch (error) {
      const message = (error as Error).message || "Unable to delete link.";
      setStatus(message);
      toast({ title: "Unable to delete link", description: message, variant: "error" });
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-md border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Link Manager</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">Manage Short Links</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Create, update, or remove CVSD Go links.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold uppercase tracking-[0.08em]">Sign in required</p>
          <p className="mt-2">You need to sign in to manage links.</p>
          <SignInButton>
            <button
              className="mt-4 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
              type="button"
            >
              Login
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-md border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-oxford-700">Existing Links</h2>
              <button
                type="button"
                onClick={loadLinks}
                aria-label="Refresh links"
                title="Refresh links"
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

            {status && (
              <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {status}
              </p>
            )}

            {isLoading ? (
              <p className="mt-4 text-sm text-slate-600">Loading links...</p>
            ) : (
              <motion.ul layout className="mt-4 space-y-3 text-sm text-oxford-700">
                <AnimatePresence initial={false}>
                  {sortedLinks.map((link) => (
                    <motion.li
                      key={link.id}
                      layout
                      initial={link.id === recentlyAddedId ? { opacity: 0, y: -12 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      onAnimationComplete={() => {
                        if (recentlyAddedId === link.id) {
                          setRecentlyAddedId(null);
                        }
                      }}
                      className="rounded-md border border-slate-200 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-deepforest-700">
                            go.cvsd.live/{link.slug}
                            {link.is_locked && (
                              <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                                Locked
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm text-oxford-700">{link.description || link.url}</p>
                          <p className="mt-1 text-xs text-slate-500">{link.url}</p>
                          {(link.release_at || link.expires_at) && (
                            <p className="mt-2 text-xs text-slate-500">
                              {formatDisplayDate(link.release_at) && (
                                <span className="mr-3">Release: {formatDisplayDate(link.release_at)}</span>
                              )}
                              {formatDisplayDate(link.expires_at) && (
                                <span>Expires: {formatDisplayDate(link.expires_at)}</span>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(link)}
                            className="rounded-md border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(link)}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-oxford-700 transition hover:border-oxford-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </motion.ul>
            )}
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-oxford-700">
              {isEditing ? "Edit Link" : "Create New Link"}
            </h2>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600" htmlFor="slug">
                  Slug
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    go.cvsd.live/
                  </span>
                  <input
                    id="slug"
                    value={form.slug}
                    onChange={(event) => updateField("slug", event.target.value)}
                    className="w-full border-none bg-transparent text-sm text-oxford-700 outline-none"
                    placeholder="destination"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600" htmlFor="url">
                  Destination URL
                </label>
                <input
                  id="url"
                  type="url"
                  value={form.url}
                  onChange={(event) => updateField("url", event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700"
                  placeholder="https://www.cvsd.org"
                  required
                />
              </div>

              <div>
                <label
                  className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                  htmlFor="description"
                >
                  Title
                </label>
                <input
                  id="description"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700"
                  placeholder="Enrollment Portal"
                />
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div>
                  <label
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                    htmlFor="releaseAt"
                  >
                    Release Time
                  </label>
                  <input
                    id="releaseAt"
                    type="datetime-local"
                    value={form.releaseAt ?? ""}
                    onChange={(event) => updateField("releaseAt", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700"
                  />
                  <p className="mt-2 text-xs text-slate-500">Leave empty to make the link active immediately.</p>
                </div>
                <div>
                  <label
                    className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                    htmlFor="expiresAt"
                  >
                    Expiration Time
                  </label>
                  <input
                    id="expiresAt"
                    type="datetime-local"
                    value={form.expiresAt ?? ""}
                    onChange={(event) => updateField("expiresAt", event.target.value)}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700"
                  />
                  <p className="mt-2 text-xs text-slate-500">Leave empty to keep the link active indefinitely.</p>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-3 text-sm text-oxford-700">
                  <input
                    type="checkbox"
                    checked={form.isLocked}
                    onChange={(event) => updateField("isLocked", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                  />
                  Lock this link with a password
                </label>

                {form.isLocked && (
                  <div className="mt-4">
                    <label
                      className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600"
                      htmlFor="password"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(event) => updateField("password", event.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700"
                      placeholder={isEditing ? "Leave blank to keep current password" : "Enter a password"}
                    />
                    {isEditing && (
                      <p className="mt-2 text-xs text-slate-500">
                        Leave blank to keep the current password.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                >
                  {isSaving && (
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
                  {isEditing ? "Save Changes" : "Create Link"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>
      </SignedIn>

      {portalReady &&
        createPortal(
          <AnimatePresence>
            {pendingDelete && (
              <motion.div
                className="fixed inset-0 z-[100] flex h-screen w-screen items-center justify-center bg-slate-900/50 px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-xl"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Confirm delete</p>
                  <h2 className="mt-3 font-serif text-2xl text-oxford-700">Delete this link?</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    This will permanently remove{" "}
                    <span className="font-semibold text-oxford-700">
                      go.cvsd.live/{pendingDelete.slug}
                    </span>
                    .
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(pendingDelete.id)}
                      className="rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
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
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
