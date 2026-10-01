"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SignedIn, SignedOut, SignInButton, useAuth } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import type { LinkFolderRow, RedirectRow } from "@/lib/types";
import { useToast } from "@/components/toast-provider";
import { QrCodeDialog } from "@/components/qr-code-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
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

const PAGE_SIZE = 20;
type LinkStatusFilter = "all" | "active" | "locked" | "scheduled" | "expired";

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

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
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<LinkStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [foldersExpanded, setFoldersExpanded] = useState(false);

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

  const filteredLinks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const now = Date.now();
    return sortedLinks.filter((link) => {
      const matchesQuery = !normalizedQuery || [link.slug, link.description, link.url, link.folder_name]
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
      const matchesFolder = folderFilter === "all"
        || (folderFilter === "none" ? !link.folder_id : String(link.folder_id) === folderFilter);
      const releaseTime = link.release_at ? new Date(link.release_at).getTime() : null;
      const expiryTime = link.expires_at ? new Date(link.expires_at).getTime() : null;
      const isScheduled = releaseTime !== null && releaseTime > now;
      const isExpired = expiryTime !== null && expiryTime <= now;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "locked" && Boolean(link.is_locked))
        || (statusFilter === "scheduled" && isScheduled)
        || (statusFilter === "expired" && isExpired)
        || (statusFilter === "active" && !isScheduled && !isExpired);
      return matchesQuery && matchesFolder && matchesStatus;
    });
  }, [folderFilter, query, sortedLinks, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLinks.length / PAGE_SIZE));
  const paginatedLinks = filteredLinks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const lockedCount = links.filter((link) => link.is_locked).length;
  const totalClicks = links.reduce((sum, link) => sum + Number(link.click_count ?? 0), 0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [linksResponse, foldersResponse] = await Promise.all([
        fetch("/api/links"),
        fetch("/api/link-folders"),
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
    } catch (error) {
      const message = (error as Error).message || "Unable to load link manager data.";
      toast({ title: "Unable to load data", description: message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isSignedIn) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isSignedIn, loadData]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [query, folderFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  async function copyShortLink(slug: string) {
    try {
      await navigator.clipboard.writeText(`https://go.cvsd.live/${slug}`);
      toast({ title: "Link copied", description: `go.cvsd.live/${slug}`, variant: "success" });
    } catch {
      toast({ title: "Unable to copy link", description: "Copy the URL from your browser instead.", variant: "error" });
    }
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
          qrCodeAccessEnabled: Boolean(link.qr_code_access_enabled),
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
      <PageHeader eyebrow="Administration" title="Link Manager" description="Create, organize, protect, and monitor every CVSD Go short link from one workspace." />

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
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total links", value: String(links.length), fullValue: String(links.length), detail: "Managed destinations" },
            { label: "Total visits", value: formatCompactNumber(totalClicks), fullValue: totalClicks.toLocaleString(), detail: "Recorded redirects" },
            { label: "Locked", value: String(lockedCount), fullValue: String(lockedCount), detail: "Password protected" },
            { label: "Folders", value: String(folders.length), fullValue: String(folders.length), detail: `${folders.filter((folder) => folder.is_public).length} public` },
          ].map((stat) => (
            <div key={stat.label} className="panel min-w-0 overflow-hidden px-4 py-4 sm:px-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
              <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-oxford-700 dark:text-slate-100" title={stat.fullValue}>{stat.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{stat.detail}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <div className="panel overflow-hidden">
              <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-oxford-700 dark:text-slate-100">All links</h2>
                    <p className="mt-0.5 text-xs text-slate-500">{filteredLinks.length} of {links.length} links shown</p>
                  </div>
                <button
                  type="button"
                  onClick={loadData}
                  aria-label="Refresh links"
                  title="Refresh links"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-oxford-700 shadow-sm transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
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
                  Refresh
                </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="relative col-span-2 block">
                    <span className="sr-only">Search links</span>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, URL, slug, or folder…" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-oxford-500 focus:ring-2 focus:ring-oxford-500/15 dark:border-slate-700 dark:bg-slate-900" />
                  </label>
                  <select aria-label="Filter by folder" value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)} className="h-10 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-oxford-700 outline-none focus:border-oxford-500 focus:ring-2 focus:ring-oxford-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <option value="all">All folders</option>
                    <option value="none">No folder</option>
                    {sortedFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                  </select>
                  <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LinkStatusFilter)} className="h-10 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-oxford-700 outline-none focus:border-oxford-500 focus:ring-2 focus:ring-oxford-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="locked">Locked</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-2 p-4 sm:p-5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <div className="h-3 w-32 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-2 h-2.5 w-56 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : (
                <motion.ul layout className="divide-y divide-slate-200 text-sm text-oxford-700 dark:divide-slate-800">
                  <AnimatePresence initial={false}>
                    {paginatedLinks.map((link) => (
                      <motion.li
                        key={link.id}
                        layout
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.2 }}
                        className={`p-4 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50 sm:p-5 ${form.id === link.id ? "bg-oxford-50/70 ring-1 ring-inset ring-oxford-200 dark:bg-oxford-900/20 dark:ring-oxford-700" : ""}`}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button type="button" onClick={() => void copyShortLink(link.slug)} className="group inline-flex min-w-0 items-center gap-1.5 rounded-lg font-mono text-sm font-semibold text-oxford-700 outline-none hover:text-oxford-500 focus-visible:ring-2 focus-visible:ring-oxford-500 dark:text-slate-100" title="Copy short link">
                                <span className="truncate">go.cvsd.live/{link.slug}</span>
                                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:text-oxford-500" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3"/></svg>
                              </button>
                              {link.is_locked && (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                  Locked
                                </span>
                              )}
                              {link.folder_name && (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {link.folder_name}
                                  {link.folder_is_public === false ? " (Private)" : ""}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-sm font-medium text-oxford-700 dark:text-slate-200">{link.description || "Untitled link"}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{link.url}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              <span>{Number(link.click_count ?? 0).toLocaleString()} visits</span>
                              <span>{link.qr_code_access_enabled ? "Direct QR downloads" : "QR approval required"}</span>
                            {(link.release_at || link.expires_at) && (
                              <span className="contents">
                                {formatDisplayDate(link.release_at) && (
                                  <span>Releases {formatDisplayDate(link.release_at)}</span>
                                )}
                                {formatDisplayDate(link.expires_at) && (
                                  <span>Expires {formatDisplayDate(link.expires_at)}</span>
                                )}
                              </span>
                            )}
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-col gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center">
                            <div className="w-full min-w-0 sm:max-w-56 sm:flex-1">
                              <select
                                aria-label={`Move ${link.slug} to folder`}
                                id={`move-folder-${link.id}`}
                                value={link.folder_id ? String(link.folder_id) : ""}
                                disabled={movingLinkId === link.id}
                                onChange={(event) => moveLinkToFolder(link, event.target.value)}
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-oxford-700 outline-none focus:border-oxford-700 focus:ring-1 focus:ring-oxford-700 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              >
                                <option value="">No folder</option>
                                {sortedFolders.map((folder) => (
                                  <option key={folder.id} value={folder.id}>
                                    {folder.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 sm:ml-auto">
                              <QrCodeDialog slug={link.slug} description={link.description ?? undefined} url={link.url} />
                            <button
                              type="button"
                              onClick={() => startEdit(link)}
                              className="h-10 rounded-lg border border-oxford-700 bg-oxford-700 px-3 text-xs font-semibold text-white transition hover:bg-oxford-600"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDelete(link)}
                              aria-label={`Delete ${link.slug}`}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-900"
                            >
                              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>
                            </button>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}

              {!isLoading && filteredLinks.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.15-1.15"/></svg></div>
                  <p className="mt-3 text-sm font-semibold text-oxford-700 dark:text-slate-100">No links match these filters</p>
                  <button type="button" onClick={() => { setQuery(""); setFolderFilter("all"); setStatusFilter("all"); }} className="mt-2 text-xs font-semibold text-deepforest-700 hover:underline dark:text-deepforest-300">Clear filters</button>
                </div>
              )}

              {!isLoading && filteredLinks.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
                  <p className="text-xs text-slate-500">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900">Previous</button>
                    <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900">Next</button>
                  </div>
                </div>
              )}
            </div>

            <div className="panel overflow-hidden">
              <button type="button" onClick={() => setFoldersExpanded((expanded) => !expanded)} className="flex w-full items-center justify-between gap-3 p-5 text-left">
                <span>
                  <span className="block text-base font-semibold text-oxford-700 dark:text-slate-100">Folder organization</span>
                  <span className="mt-0.5 block text-xs text-slate-500">Create, reorder, and control directory visibility for {folders.length} folder{folders.length === 1 ? "" : "s"}.</span>
                </span>
                <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${foldersExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>

              <AnimatePresence initial={false}>
              {foldersExpanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-slate-200 dark:border-slate-800">
              <div className="p-5 pt-4">
              <form className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]" onSubmit={createFolder}>
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
              </motion.div>
              )}
              </AnimatePresence>
            </div>

          </div>

          <div className="panel overflow-hidden xl:sticky xl:top-24">
            <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">{isEditing ? "Editing link" : "New short link"}</p>
                  <h2 className="mt-1 text-lg font-semibold text-oxford-700 dark:text-slate-100">{isEditing ? `go.cvsd.live/${form.slug}` : "Create a link"}</h2>
                </div>
                {isEditing && <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Cancel</button>}
              </div>
            </div>
            <div className="p-5">
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
        </div>
      </SignedIn>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this link?"
        description={<>This will permanently remove <span className="font-semibold text-oxford-700 dark:text-slate-200">go.cvsd.live/{pendingDelete?.slug}</span>.</>}
        confirmLabel="Delete"
        onConfirm={() => { if (pendingDelete) void handleDelete(pendingDelete.id); }}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}
