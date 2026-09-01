"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import type { LinkFolderRow, RedirectRow } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { QrCodeDialog } from "@/components/qr-code-dialog";
import { validateContentWithAutoModSync } from "@/lib/automod";

const EMPTY_FORM = {
  id: null as number | null,
  slug: "",
  url: "",
  description: "",
  folderId: "",
  isLocked: false,
  password: "",
  releaseAt: "",
  expiresAt: "",
  qrCodeAccessEnabled: false,
};

const EMPTY_FOLDER_FORM = {
  name: "",
  isPublic: true,
};

type LinkPayload = {
  slug: string;
  url: string;
  description: string;
  folderId: number | null;
  isLocked: boolean;
  password: string;
  releaseAt: string | null;
  expiresAt: string | null;
  qrCodeAccessEnabled: boolean;
};

export default function LinkManagerPage() {
  const [links, setLinks] = useState<RedirectRow[]>([]);
  const [folders, setFolders] = useState<LinkFolderRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [folderForm, setFolderForm] = useState(EMPTY_FOLDER_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFolderSaving, setIsFolderSaving] = useState(false);
  const [isFolderReordering, setIsFolderReordering] = useState(false);
  const [movingLinkId, setMovingLinkId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RedirectRow | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [qrRequests, setQrRequests] = useState<Array<{
    id: number;
    link_slug: string;
    user_id: string;
    user_email: string | null;
    user_name: string | null;
    status: "pending" | "accepted" | "declined";
    admin_reason: string | null;
    can_appeal: boolean;
    created_at: string;
  }>>([]);
  const [declineReasonMap, setDeclineReasonMap] = useState<Record<number, string>>({});
  const [declineAppealMap, setDeclineAppealMap] = useState<Record<number, boolean>>({});

  const { isSignedIn } = useAuth();
  const { toast } = useToast();

  const isEditing = form.id !== null;

  function notifyLinkDirectoryUpdate() {
    if (typeof window === "undefined") return;

    window.dispatchEvent(new Event("cvsdgo:refresh-directory"));

    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("cvsdgo");
      channel.postMessage("refresh-directory");
      channel.close();
    }
  }

  const sortedLinks = useMemo(() => {
    return [...links].sort((a, b) => {
      const folderA = (a.folder_name ?? "").toLowerCase();
      const folderB = (b.folder_name ?? "").toLowerCase();
      const folderSort = folderA.localeCompare(folderB);
      if (folderSort !== 0) return folderSort;
      return a.slug.localeCompare(b.slug);
    });
  }, [links]);

  const sortedFolders = useMemo(() => {
    return [...folders].sort((a, b) => {
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [folders]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [linksResponse, foldersResponse, qrResponse] = await Promise.all([
        fetch("/api/links"),
        fetch("/api/link-folders"),
        fetch("/api/admin/qr-requests").catch(() => null),
      ]);

      if (!linksResponse.ok) {
        throw new Error(await linksResponse.text());
      }
      if (!foldersResponse.ok) {
        throw new Error(await foldersResponse.text());
      }

      const [linksData, foldersData] = await Promise.all([linksResponse.json(), foldersResponse.json()]);
      setLinks(linksData.links ?? []);
      setFolders(foldersData.folders ?? []);

      if (qrResponse && qrResponse.ok) {
        const qrData = await qrResponse.json();
        setQrRequests(qrData.requests ?? []);
      }
    } catch (error) {
      const message = (error as Error).message || "Unable to load link manager data.";
      toast({ title: "Unable to load data", description: message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

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
        title: `Request ${status}`,
        description: `QR Code download access request #${requestId} ${status}.`,
        variant: "success",
      });
      setQrRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? { ...r, status, admin_reason: adminReason || null, can_appeal: canAppeal }
            : r
        )
      );
    } catch (error) {
      toast({
        title: "Review error",
        description: (error as Error).message || "Failed to update request status.",
        variant: "error",
      });
    }
  }

  useEffect(() => {
    if (isSignedIn) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isSignedIn, loadData]);

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
      folderId: link.folder_id ? String(link.folder_id) : "",
      isLocked: Boolean(link.is_locked),
      password: "",
      releaseAt: formatLocalDateTime(link.release_at ?? null),
      expiresAt: formatLocalDateTime(link.expires_at ?? null),
      qrCodeAccessEnabled: Boolean(link.qr_code_access_enabled),
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // AutoMod client check
    const autoModCheck = validateContentWithAutoModSync(`${form.slug} ${form.description} ${form.url}`);
    if (!autoModCheck.isClean) {
      toast({
        title: "AutoMod Content Warning",
        description: autoModCheck.reason || "Please use school-appropriate language.",
        variant: "error",
      });
      return;
    }

    setIsSaving(true);

    const payload: LinkPayload = {
      slug: form.slug.trim(),
      url: form.url.trim(),
      description: form.description.trim(),
      folderId: form.folderId ? Number(form.folderId) : null,
      isLocked: form.isLocked,
      password: form.password,
      releaseAt: form.releaseAt ? new Date(form.releaseAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      qrCodeAccessEnabled: form.qrCodeAccessEnabled,
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

      await loadData();
      resetForm();
      notifyLinkDirectoryUpdate();
      toast({
        title: isEditing ? "Link updated" : "Link created",
        description: `go.cvsd.live/${payload.slug}`,
        variant: "success",
      });
    } catch (error) {
      const message = (error as Error).message || "Unable to save link.";
      toast({ title: "Unable to save link", description: message, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(linkId: number) {
    try {
      const response = await fetch(`/api/links/${linkId}`, { method: "DELETE" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to delete link.");
      }
      await loadData();
      if (form.id === linkId) {
        resetForm();
      }
      setPendingDelete(null);
      toast({ title: "Link deleted", variant: "warning" });
    } catch (error) {
      const message = (error as Error).message || "Unable to delete link.";
      toast({ title: "Unable to delete link", description: message, variant: "error" });
    }
  }

  async function moveLinkToFolder(link: RedirectRow, nextFolderId: string) {
    setMovingLinkId(link.id);
    try {
      const response = await fetch(`/api/links/${link.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: link.slug,
          url: link.url,
          description: link.description ?? "",
          folderId: nextFolderId ? Number(nextFolderId) : null,
          isLocked: Boolean(link.is_locked),
          password: "",
          releaseAt: link.release_at ? new Date(link.release_at).toISOString() : null,
          expiresAt: link.expires_at ? new Date(link.expires_at).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to move link.");
      }

      await loadData();
      notifyLinkDirectoryUpdate();
      toast({
        title: "Link moved",
        description: nextFolderId
          ? `Moved go.cvsd.live/${link.slug} to a folder`
          : `Removed go.cvsd.live/${link.slug} from folder`,
        variant: "success",
      });
    } catch (error) {
      const message = (error as Error).message || "Unable to move link.";
      toast({ title: "Unable to move link", description: message, variant: "error" });
    } finally {
      setMovingLinkId(null);
    }
  }

  async function createFolder(event: React.FormEvent) {
    event.preventDefault();
    setIsFolderSaving(true);

    try {
      const response = await fetch("/api/link-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderForm.name.trim(), isPublic: folderForm.isPublic }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to create folder.");
      }

      const data = await response.json();
      const folder = data.folder as LinkFolderRow | undefined;
      setFolderForm(EMPTY_FOLDER_FORM);
      await loadData();
      notifyLinkDirectoryUpdate();
      if (folder) {
        setForm((current) => ({ ...current, folderId: String(folder.id) }));
      }
      toast({ title: "Folder created", variant: "success" });
    } catch (error) {
      const message = (error as Error).message || "Unable to create folder.";
      toast({ title: "Unable to create folder", description: message, variant: "error" });
    } finally {
      setIsFolderSaving(false);
    }
  }

  async function toggleFolderVisibility(folder: LinkFolderRow) {
    try {
      const response = await fetch(`/api/link-folders/${folder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !folder.is_public }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to update folder.");
      }

      await loadData();
      notifyLinkDirectoryUpdate();
      toast({
        title: !folder.is_public ? "Folder is now public" : "Folder is now private",
        description: folder.name,
        variant: "success",
      });
    } catch (error) {
      const message = (error as Error).message || "Unable to update folder.";
      toast({ title: "Unable to update folder", description: message, variant: "error" });
    }
  }

  async function deleteFolder(folder: LinkFolderRow) {
    try {
      const response = await fetch(`/api/link-folders/${folder.id}`, { method: "DELETE" });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to delete folder.");
      }

      await loadData();
      notifyLinkDirectoryUpdate();
      setForm((current) => (current.folderId === String(folder.id) ? { ...current, folderId: "" } : current));
      toast({ title: "Folder deleted", description: folder.name, variant: "warning" });
    } catch (error) {
      const message = (error as Error).message || "Unable to delete folder.";
      toast({ title: "Unable to delete folder", description: message, variant: "error" });
    }
  }

  async function reorderFolder(folderId: number, direction: -1 | 1) {
    const currentList = sortedFolders;
    const index = currentList.findIndex((folder) => folder.id === folderId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= currentList.length) {
      return;
    }

    const nextFolders = [...currentList];
    [nextFolders[index], nextFolders[targetIndex]] = [nextFolders[targetIndex], nextFolders[index]];

    const orderedIds = nextFolders.map((folder) => folder.id);
    setIsFolderReordering(true);
    setFolders(nextFolders.map((folder, idx) => ({ ...folder, sort_order: idx })));

    try {
      const response = await fetch("/api/link-folders/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to reorder folders.");
      }

      await loadData();
      notifyLinkDirectoryUpdate();
      toast({ title: "Folder order updated", variant: "success" });
    } catch (error) {
      const message = (error as Error).message || "Unable to reorder folders.";
      toast({ title: "Unable to reorder folders", description: message, variant: "error" });
      await loadData();
    } finally {
      setIsFolderReordering(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="panel-strong overflow-hidden p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-deepforest-400">Administration</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-oxford-700 dark:text-slate-100 md:text-4xl">Manage Short Links</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Create folders, control public visibility, and assign links to groups.
        </p>
      </div>

      <SignedOut>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Sign in required</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">You need to sign in to manage links.</p>
          <SignInButton>
            <button className="mt-3 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white hover:bg-oxford-600" type="button">
              Sign In
            </button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <div className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-oxford-700 dark:text-slate-100">Existing Links</h2>
                <button
                  type="button"
                  onClick={loadData}
                  aria-label="Refresh links"
                  title="Refresh links"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:text-slate-300"
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

              {isLoading ? (
                <div className="mt-4 space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-2 h-2.5 w-56 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <motion.ul layout className="mt-4 space-y-4 text-sm text-oxford-700">
                  <AnimatePresence initial={false}>
                    {sortedLinks.map((link) => (
                      <motion.li
                        key={link.id}
                        layout
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-2xl border border-slate-200 p-5 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-deepforest-700 dark:text-deepforest-400">
                              go.cvsd.live/{link.slug}
                              {link.is_locked && (
                                <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                  Locked
                                </span>
                              )}
                              {link.folder_name && (
                                <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {link.folder_name}
                                  {link.folder_is_public === false ? " (Private)" : ""}
                                </span>
                              )}
                              {link.qr_code_access_enabled ? (
                                <span className="ml-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                                  Direct QR Allowed
                                </span>
                              ) : (
                                <span className="ml-2 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                                  QR Request Required
                                </span>
                              )}
                            </p>
                            <p className="mt-1 text-sm text-oxford-700 dark:text-slate-200">{link.description || link.url}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{link.url}</p>
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
                            <div className="mt-3 max-w-xs">
                              <label
                                className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                                htmlFor={`move-folder-${link.id}`}
                              >
                                Move To Folder
                              </label>
                              <select
                                id={`move-folder-${link.id}`}
                                value={link.folder_id ? String(link.folder_id) : ""}
                                disabled={movingLinkId === link.id}
                                onChange={(event) => moveLinkToFolder(link, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              >
                                <option value="">No folder</option>
                                {sortedFolders.map((folder) => (
                                  <option key={folder.id} value={folder.id}>
                                    {folder.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <QrCodeDialog slug={link.slug} description={link.description ?? undefined} url={link.url} />
                            <button
                              type="button"
                              onClick={() => startEdit(link)}
                              className="rounded-lg border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(link)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900"
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

            <div className="panel p-5">
              <h2 className="text-base font-semibold text-oxford-700 dark:text-slate-100">Folders</h2>

              <form className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={createFolder}>
                <input
                  value={folderForm.name}
                  onChange={(event) => setFolderForm((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="New folder name"
                  required
                />
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={folderForm.isPublic}
                    onChange={(event) => setFolderForm((current) => ({ ...current, isPublic: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                  />
                  Public
                </label>
                <button
                  type="submit"
                  disabled={isFolderSaving}
                  className="rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                >
                  Add Folder
                </button>
              </form>

              <ul className="mt-3 space-y-2">
                {sortedFolders.map((folder, index) => (
                  <li key={folder.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-800">
                    <p className="text-sm text-oxford-700 dark:text-slate-200">
                      {folder.name}
                      <span className="ml-2 text-xs text-slate-400">{folder.is_public ? "Public" : "Private"}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      {index > 0 && (
                        <button type="button" onClick={() => reorderFolder(folder.id, -1)} disabled={isFolderReordering} aria-label={`Move ${folder.name} up`}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-oxford-700 transition hover:border-oxford-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          ↑
                        </button>
                      )}
                      {index < sortedFolders.length - 1 && (
                        <button type="button" onClick={() => reorderFolder(folder.id, 1)} disabled={isFolderReordering} aria-label={`Move ${folder.name} down`}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-oxford-700 transition hover:border-oxford-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          ↓
                        </button>
                      )}
                      <button type="button" onClick={() => toggleFolderVisibility(folder)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        Set {folder.is_public ? "Private" : "Public"}
                      </button>
                      <button type="button" onClick={() => deleteFolder(folder)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900">
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
                {!isLoading && sortedFolders.length === 0 && (
                  <li className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-400 dark:border-slate-700">
                    No folders yet.
                  </li>
                )}
              </ul>
            </div>

            {/* QR Code Access Requests Management Panel */}
            <div className="panel p-5 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-oxford-700 dark:text-slate-100">QR Code Access Requests</h2>
                  <p className="text-xs text-slate-500">Review pending QR code download requests from users and visitors</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {qrRequests.filter((r) => r.status === "pending").length} Pending
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {qrRequests.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                    No download access requests submitted yet.
                  </div>
                ) : (
                  qrRequests.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-oxford-700 dark:text-slate-100">
                            go.cvsd.live/{req.link_slug}
                          </span>
                          <span className="ml-2 text-slate-500">
                            by {req.user_name || req.user_email || req.user_id}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${req.status === "accepted"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : req.status === "declined"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      {req.status === "pending" && (
                        <div className="mt-3 space-y-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                          <input
                            type="text"
                            placeholder="Optional reason for decision (e.g. Requires staff verification)"
                            value={declineReasonMap[req.id] || ""}
                            onChange={(e) =>
                              setDeclineReasonMap((prev) => ({ ...prev, [req.id]: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                              <input
                                type="checkbox"
                                checked={declineAppealMap[req.id] !== false}
                                onChange={(e) =>
                                  setDeclineAppealMap((prev) => ({ ...prev, [req.id]: e.target.checked }))
                                }
                                className="h-3.5 w-3.5 rounded border-slate-300 text-oxford-700"
                              />
                              Eligible for Vantor Trust & Safety appeal
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleReviewQrRequest(req.id, "accepted")}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReviewQrRequest(req.id, "declined")}
                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {req.status === "declined" && req.admin_reason && (
                        <p className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">
                          <strong>Reason:</strong> {req.admin_reason}{" "}
                          {req.can_appeal ? "(Eligible to appeal)" : "(Ineligible for appeal)"}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-base font-semibold text-oxford-700 dark:text-slate-100">{isEditing ? "Edit Link" : "Create New Link"}</h2>
            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="slug">Slug</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <span className="text-xs font-semibold text-slate-400">go.cvsd.live/</span>
                  <input id="slug" value={form.slug} onChange={(event) => updateField("slug", event.target.value)}
                    className="w-full border-none bg-transparent text-sm text-oxford-700 outline-none dark:text-slate-100"
                    placeholder="destination" required />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="url">Destination URL</label>
                <input id="url" type="url" value={form.url} onChange={(event) => updateField("url", event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="https://www.cvsd.live" required />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="description">Title</label>
                <input id="description" value={form.description} onChange={(event) => updateField("description", event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Enrollment Portal" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="folderId">Folder</label>
                <select id="folderId" value={form.folderId} onChange={(event) => updateField("folderId", event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <option value="">No folder</option>
                  {sortedFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>{folder.name} {folder.is_public ? "(Public)" : "(Private)"}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="releaseAt">Release Time</label>
                  <input id="releaseAt" type="datetime-local" value={form.releaseAt ?? ""} onChange={(event) => updateField("releaseAt", event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  <p className="mt-1 text-xs text-slate-400">Leave empty to make the link active immediately.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="expiresAt">Expiration Time</label>
                  <input id="expiresAt" type="datetime-local" value={form.expiresAt ?? ""} onChange={(event) => updateField("expiresAt", event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  <p className="mt-1 text-xs text-slate-400">Leave empty to keep the link active indefinitely.</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <label className="flex items-center gap-3 text-sm font-semibold text-oxford-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.qrCodeAccessEnabled}
                    onChange={(event) => updateField("qrCodeAccessEnabled", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700"
                  />
                  Allow Direct QR Code Downloads
                </label>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 pl-7">
                  When enabled, all signed-in users can download the QR code without requesting permission.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <label className="flex items-center gap-3 text-sm text-oxford-700 dark:text-slate-200">
                  <input type="checkbox" checked={form.isLocked} onChange={(event) => updateField("isLocked", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-oxford-700 focus:ring-oxford-700" />
                  Lock this link with a password
                </label>
                {form.isLocked && (
                  <div className="mt-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500" htmlFor="password">Password</label>
                    <input id="password" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      placeholder={isEditing ? "Leave blank to keep current password" : "Enter a password"} />
                    {isEditing && <p className="mt-1 text-xs text-slate-400">Leave blank to keep the current password.</p>}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300">
                  {isSaving && <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3.3-6.9" /></svg>}
                  {isEditing ? "Save Changes" : "Create Link"}
                </button>
                <button type="button" onClick={resetForm}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
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
                className="modal-backdrop z-[200] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => { if (e.target === e.currentTarget) setPendingDelete(null); }}
              >
                <motion.div
                  className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  transition={{ duration: 0.18 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700">Confirm delete</p>
                  <h2 className="mt-2 font-serif text-xl text-oxford-700 dark:text-slate-100">Delete this link?</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    This will permanently remove{" "}
                    <span className="font-semibold text-oxford-700 dark:text-slate-200">go.cvsd.live/{pendingDelete.slug}</span>.
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
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
