"use client";

import { useEffect, useRef, useState, useDeferredValue } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { show as showIntercom } from "@intercom/messenger-js-sdk";
import type {
  SearchResultsPayload,
  SearchPageItem,
  SearchLinkItem,
  SearchActionItem,
  SearchAdminActionItem,
} from "@/app/api/search/route";
import {
  detectAdminActionIntent,
  type AdminActionType,
} from "@/lib/ai-admin-actions";

type SelectableItem =
  | SearchAdminActionItem
  | SearchPageItem
  | SearchLinkItem
  | SearchActionItem;

type ChatMessage = {
  id: string;
  sender: "ai" | "user";
  text: string;
  fieldKey?: string;
  isConfirmation?: boolean;
};

type CreateLinkData = {
  slug: string;
  url: string;
  title: string;
  folderId: number | null;
  folderName: string;
  releaseAt: string;
  expiresAt: string;
  isLocked: boolean;
  password: string;
};

type UpdateLinkData = {
  linkId: number | null;
  slug: string;
  fieldToUpdate: "url" | "title" | "folder" | "password" | null;
  newUrl: string;
  newTitle: string;
  newFolderId: number | null;
  newFolderName: string;
  newPassword: string;
};

type CreateFolderData = {
  name: string;
  isPublic: boolean;
};

type MoveLinkData = {
  linkId: number | null;
  slug: string;
  targetFolderId: number | null;
  targetFolderName: string;
};

type DeleteLinkData = {
  linkId: number | null;
  slug: string;
  title: string;
};

type FolderOption = {
  id: number;
  name: string;
};

type LinkOption = {
  id: number;
  slug: string;
  description: string | null;
  url: string;
  folder_id: number | null;
  folder_name: string | null;
};

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<SearchResultsPayload>({
    query: "",
    pages: [],
    links: [],
    actions: [],
    aiAdminActions: [],
    canManageLinks: false,
    isAdmin: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // --- AI Workflow States ---
  const [aiMode, setAiMode] = useState<AdminActionType | null>(null);
  const [aiState, setAiState] = useState<
    "generating" | "conversing" | "confirming" | "executing" | "success" | "error"
  >("generating");
  const [stepIndex, setStepIndex] = useState(0);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdResultLink, setCreatedResultLink] = useState<string | null>(null);

  // Data collections for workflows
  const [createData, setCreateData] = useState<CreateLinkData>({
    slug: "",
    url: "",
    title: "",
    folderId: null,
    folderName: "General",
    releaseAt: "",
    expiresAt: "",
    isLocked: false,
    password: "",
  });

  const [updateData, setUpdateData] = useState<UpdateLinkData>({
    linkId: null,
    slug: "",
    fieldToUpdate: null,
    newUrl: "",
    newTitle: "",
    newFolderId: null,
    newFolderName: "",
    newPassword: "",
  });

  const [createFolderData, setCreateFolderData] = useState<CreateFolderData>({
    name: "",
    isPublic: true,
  });

  const [moveData, setMoveData] = useState<MoveLinkData>({
    linkId: null,
    slug: "",
    targetFolderId: null,
    targetFolderName: "",
  });

  const [deleteData, setDeleteData] = useState<DeleteLinkData>({
    linkId: null,
    slug: "",
    title: "",
  });

  // Cached dropdown options
  const [availableFolders, setAvailableFolders] = useState<FolderOption[]>([]);
  const [availableLinks, setAvailableLinks] = useState<LinkOption[]>([]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    function handleOpenEvent() {
      setIsOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("cvsdgo:open-command-palette", handleOpenEvent);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("cvsdgo:open-command-palette", handleOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setAiMode(null);
      setAiInput("");
      setChatHistory([]);
      setErrorMessage(null);
      setCreatedResultLink(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    async function fetchResults() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(deferredQuery)}`, {
          signal: controller.signal,
        });
        if (response.ok) {
          const data = (await response.json()) as SearchResultsPayload;
          setResults(data);
          setSelectedIndex(0);
        }
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          console.error("Search fetch error:", error);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void fetchResults();

    return () => controller.abort();
  }, [deferredQuery, isOpen]);

  // Auto scroll chat to bottom when chat history changes
  useEffect(() => {
    if (aiMode) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, aiMode, aiState]);

  // Fetch folders and links for helper options when entering AI Mode
  const loadAdminResources = async () => {
    try {
      const [foldersRes, linksRes] = await Promise.all([
        fetch("/api/link-folders"),
        fetch("/api/links"),
      ]);
      if (foldersRes.ok) {
        const fData = (await foldersRes.json()) as { folders: FolderOption[] };
        setAvailableFolders(fData.folders || []);
      }
      if (linksRes.ok) {
        const lData = (await linksRes.json()) as { links: LinkOption[] };
        setAvailableLinks(lData.links || []);
      }
    } catch (err) {
      console.error("Failed loading admin resources", err);
    }
  };

  const startAiWorkflow = (actionType: AdminActionType) => {
    setAiMode(actionType);
    setAiState("generating");
    setStepIndex(0);
    setAiInput("");
    setErrorMessage(null);
    setCreatedResultLink(null);
    void loadAdminResources();

    // Reset workflow data structures
    setCreateData({
      slug: "",
      url: "",
      title: "",
      folderId: null,
      folderName: "General",
      releaseAt: "",
      expiresAt: "",
      isLocked: false,
      password: "",
    });

    setUpdateData({
      linkId: null,
      slug: "",
      fieldToUpdate: null,
      newUrl: "",
      newTitle: "",
      newFolderId: null,
      newFolderName: "",
      newPassword: "",
    });

    setCreateFolderData({ name: "", isPublic: true });
    setMoveData({ linkId: null, slug: "", targetFolderId: null, targetFolderName: "" });
    setDeleteData({ linkId: null, slug: "", title: "" });

    // Transition after subtle "Generating..." state
    setTimeout(() => {
      setAiState("conversing");
      if (actionType === "create-link") {
        setChatHistory([
          {
            id: "msg-0",
            sender: "ai",
            text: "CVSD Go AI initialized for **Create a Link**.\n\nWhat would you like the slug to be? *(e.g. go.cvsd.live/example or 'company')*",
            fieldKey: "slug",
          },
        ]);
      } else if (actionType === "update-link") {
        setChatHistory([
          {
            id: "msg-0",
            sender: "ai",
            text: "CVSD Go AI initialized for **Update a Link**.\n\nWhich short link would you like to update? Enter the slug or title:",
            fieldKey: "select-link",
          },
        ]);
      } else if (actionType === "create-folder") {
        setChatHistory([
          {
            id: "msg-0",
            sender: "ai",
            text: "CVSD Go AI initialized for **Create a Folder**.\n\nWhat would you like to name the new folder?",
            fieldKey: "folder-name",
          },
        ]);
      } else if (actionType === "move-link") {
        setChatHistory([
          {
            id: "msg-0",
            sender: "ai",
            text: "CVSD Go AI initialized for **Move Link to Folder**.\n\nWhich short link would you like to move? Enter the slug:",
            fieldKey: "select-link",
          },
        ]);
      } else if (actionType === "delete-link") {
        setChatHistory([
          {
            id: "msg-0",
            sender: "ai",
            text: "CVSD Go AI initialized for **Delete a Link**.\n\nWhich short link would you like to delete? Enter the slug:",
            fieldKey: "select-link",
          },
        ]);
      }

      setTimeout(() => inputRef.current?.focus(), 50);
    }, 450);
  };

  const exitAiWorkflow = () => {
    setAiMode(null);
    setAiInput("");
    setChatHistory([]);
    setErrorMessage(null);
    setCreatedResultLink(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const allItems: SelectableItem[] = [
    ...(results.aiAdminActions || []),
    ...results.pages,
    ...results.links,
    ...results.actions,
  ];

  function handleSelect(item: SelectableItem) {
    if (item.type === "ai-admin-action") {
      startAiWorkflow(item.actionType);
      return;
    }

    setIsOpen(false);
    if (item.type === "page") {
      router.push(item.href);
    } else if (item.type === "link") {
      router.push(item.href);
    } else if (item.type === "action") {
      if (item.actionId === "open-intercom") {
        try {
          showIntercom();
        } catch {
          if (
            typeof window !== "undefined" &&
            (window as unknown as { Intercom?: (cmd: string) => void }).Intercom
          ) {
            (window as unknown as { Intercom: (cmd: string) => void }).Intercom("show");
          }
        }
      } else if (item.actionId === "toggle-theme") {
        const currentTheme = document.documentElement.classList.contains("dark")
          ? "dark"
          : "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
        document.documentElement.style.colorScheme = nextTheme;
        window.localStorage.setItem("cvsd-theme", nextTheme);
      } else if (item.actionId === "open-settings") {
        const settingsButton = document.querySelector<HTMLButtonElement>(
          "button[aria-label='Open site settings']"
        );
        settingsButton?.click();
      }
    }
  }

  async function handleCopyLink(slug: string, event: React.MouseEvent) {
    event.stopPropagation();
    const shortLink = `https://go.cvsd.live/${slug}`;
    await navigator.clipboard.writeText(shortLink);
    setCopiedSlug(slug);
    setTimeout(() => {
      setCopiedSlug((current) => (current === slug ? null : current));
    }, 1500);
  }

  // --- Step-by-Step Response Handler for Conversational Workflows ---
  const handleAiStepSubmit = (userText: string) => {
    const text = userText.trim();
    if (!text && aiState === "conversing") return;

    setErrorMessage(null);

    // Append User Message to history
    const userMsgId = `msg-user-${Date.now()}`;
    const newHistory: ChatMessage[] = [
      ...chatHistory,
      { id: userMsgId, sender: "user", text: text || "(Selected option)" },
    ];
    setChatHistory(newHistory);
    setAiInput("");

    // --- CREATE LINK WORKFLOW ---
    if (aiMode === "create-link") {
      if (stepIndex === 0) {
        // Slug
        const cleanSlug = text.replace(/^https?:\/\/[^/]+\//, "").replace(/^\//, "").trim();
        if (!cleanSlug) {
          setErrorMessage("Please enter a valid slug (e.g. 'company').");
          return;
        }
        setCreateData((prev) => ({ ...prev, slug: cleanSlug }));
        setStepIndex(1);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Got it! What destination URL should **/ ${cleanSlug}** redirect to?`,
            fieldKey: "url",
          },
        ]);
      } else if (stepIndex === 1) {
        // URL
        let formattedUrl = text;
        if (!/^https?:\/\//i.test(formattedUrl)) {
          formattedUrl = `https://${formattedUrl}`;
        }
        try {
          new URL(formattedUrl);
        } catch {
          setErrorMessage("Please enter a valid URL (e.g. 'https://cvsd.org/calendar').");
          return;
        }
        setCreateData((prev) => ({ ...prev, url: formattedUrl }));
        setStepIndex(2);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Perfect. What title or name should we assign to this link?`,
            fieldKey: "title",
          },
        ]);
      } else if (stepIndex === 2) {
        // Title
        const titleVal = text || `go.cvsd.live/${createData.slug}`;
        setCreateData((prev) => ({ ...prev, title: titleVal }));
        setStepIndex(3);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Where should this link be stored? Choose or type a folder name:`,
            fieldKey: "folder",
          },
        ]);
      } else if (stepIndex === 3) {
        // Folder
        const selectedFolder = availableFolders.find(
          (f) => f.name.toLowerCase() === text.toLowerCase()
        );
        const folderId = selectedFolder ? selectedFolder.id : null;
        setCreateData((prev) => ({ ...prev, folderId, folderName: text || "General" }));
        setStepIndex(4);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `When should this link be released? *(Optional - type a date or select 'Skip')*`,
            fieldKey: "releaseAt",
          },
        ]);
      } else if (stepIndex === 4) {
        // Release Time
        const releaseVal = text.toLowerCase() === "skip" || text.toLowerCase() === "none" ? "" : text;
        setCreateData((prev) => ({ ...prev, releaseAt: releaseVal }));
        setStepIndex(5);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `When should this link expire? *(Optional - type a date or select 'Skip')*`,
            fieldKey: "expiresAt",
          },
        ]);
      } else if (stepIndex === 5) {
        // Expiration Time
        const expireVal = text.toLowerCase() === "skip" || text.toLowerCase() === "none" ? "" : text;
        setCreateData((prev) => ({ ...prev, expiresAt: expireVal }));
        setStepIndex(6);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Should this link be password protected?`,
            fieldKey: "isLocked",
          },
        ]);
      } else if (stepIndex === 6) {
        // Password Protection (Yes/No)
        const isLocked =
          text.toLowerCase().includes("yes") ||
          text.toLowerCase().includes("protect") ||
          text.toLowerCase().includes("lock") ||
          text.toLowerCase() === "true";
        setCreateData((prev) => ({ ...prev, isLocked }));
        if (isLocked) {
          setStepIndex(7);
          setChatHistory([
            ...newHistory,
            {
              id: `msg-ai-${Date.now()}`,
              sender: "ai",
              text: `Enter the password for this link (at least 4 characters):`,
              fieldKey: "password",
            },
          ]);
        } else {
          // Skip password step -> go to confirmation
          setAiState("confirming");
          setChatHistory([
            ...newHistory,
            {
              id: `msg-ai-${Date.now()}`,
              sender: "ai",
              text: `All required information collected! Please review the summary below and confirm to create the link.`,
              isConfirmation: true,
            },
          ]);
        }
      } else if (stepIndex === 7) {
        // Password value
        if (text.length < 4) {
          setErrorMessage("Password must be at least 4 characters long.");
          return;
        }
        setCreateData((prev) => ({ ...prev, password: text }));
        setAiState("confirming");
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `All required information collected! Please review the summary below and confirm to create the link.`,
            isConfirmation: true,
          },
        ]);
      }
    }

    // --- UPDATE LINK WORKFLOW ---
    else if (aiMode === "update-link") {
      if (stepIndex === 0) {
        // Select link
        const targetLink = availableLinks.find(
          (l) =>
            l.slug.toLowerCase() === text.toLowerCase().replace(/^\//, "") ||
            (l.description && l.description.toLowerCase().includes(text.toLowerCase()))
        );
        if (!targetLink) {
          setErrorMessage("Could not find a link matching that slug or title. Please select from available links.");
          return;
        }
        setUpdateData((prev) => ({
          ...prev,
          linkId: targetLink.id,
          slug: targetLink.slug,
          newUrl: targetLink.url,
          newTitle: targetLink.description || "",
        }));
        setStepIndex(1);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Selected **/ ${targetLink.slug}**. What field would you like to update?`,
            fieldKey: "select-field",
          },
        ]);
      } else if (stepIndex === 1) {
        // Select field to update
        const val = text.toLowerCase();
        let field: "url" | "title" | "folder" | "password" = "url";
        if (val.includes("url") || val.includes("destination")) field = "url";
        else if (val.includes("title") || val.includes("name")) field = "title";
        else if (val.includes("folder") || val.includes("category")) field = "folder";
        else if (val.includes("password") || val.includes("lock")) field = "password";

        setUpdateData((prev) => ({ ...prev, fieldToUpdate: field }));
        setStepIndex(2);

        let promptText = "Enter the new destination URL:";
        if (field === "title") promptText = "Enter the new title/description:";
        if (field === "folder") promptText = "Enter or select the new folder name:";
        if (field === "password") promptText = "Enter the new password (or 'remove' to unlock):";

        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: promptText,
            fieldKey: field,
          },
        ]);
      } else if (stepIndex === 2) {
        // Input new field value
        if (updateData.fieldToUpdate === "url") {
          let formattedUrl = text;
          if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = `https://${formattedUrl}`;
          setUpdateData((prev) => ({ ...prev, newUrl: formattedUrl }));
        } else if (updateData.fieldToUpdate === "title") {
          setUpdateData((prev) => ({ ...prev, newTitle: text }));
        } else if (updateData.fieldToUpdate === "folder") {
          const selectedFolder = availableFolders.find(
            (f) => f.name.toLowerCase() === text.toLowerCase()
          );
          setUpdateData((prev) => ({
            ...prev,
            newFolderId: selectedFolder ? selectedFolder.id : null,
            newFolderName: text,
          }));
        } else if (updateData.fieldToUpdate === "password") {
          setUpdateData((prev) => ({ ...prev, newPassword: text }));
        }
        setAiState("confirming");
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Update details ready. Please review and confirm below:`,
            isConfirmation: true,
          },
        ]);
      }
    }

    // --- CREATE FOLDER WORKFLOW ---
    else if (aiMode === "create-folder") {
      if (stepIndex === 0) {
        if (!text) {
          setErrorMessage("Folder name cannot be empty.");
          return;
        }
        setCreateFolderData((prev) => ({ ...prev, name: text }));
        setStepIndex(1);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Should the folder '${text}' be publicly visible on the link directory?`,
            fieldKey: "folder-visibility",
          },
        ]);
      } else if (stepIndex === 1) {
        const isPublic = !text.toLowerCase().includes("no") && !text.toLowerCase().includes("private");
        setCreateFolderData((prev) => ({ ...prev, isPublic }));
        setAiState("confirming");
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Folder creation summary ready. Confirm below to create:`,
            isConfirmation: true,
          },
        ]);
      }
    }

    // --- MOVE LINK WORKFLOW ---
    else if (aiMode === "move-link") {
      if (stepIndex === 0) {
        const targetLink = availableLinks.find(
          (l) =>
            l.slug.toLowerCase() === text.toLowerCase().replace(/^\//, "") ||
            (l.description && l.description.toLowerCase().includes(text.toLowerCase()))
        );
        if (!targetLink) {
          setErrorMessage("Could not find a link matching that slug. Please select an available link.");
          return;
        }
        setMoveData((prev) => ({ ...prev, linkId: targetLink.id, slug: targetLink.slug }));
        setStepIndex(1);
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Which folder should **/ ${targetLink.slug}** be moved to?`,
            fieldKey: "target-folder",
          },
        ]);
      } else if (stepIndex === 1) {
        const folderMatch = availableFolders.find(
          (f) => f.name.toLowerCase() === text.toLowerCase()
        );
        setMoveData((prev) => ({
          ...prev,
          targetFolderId: folderMatch ? folderMatch.id : null,
          targetFolderName: text || "General",
        }));
        setAiState("confirming");
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `Ready to move link. Confirm below:`,
            isConfirmation: true,
          },
        ]);
      }
    }

    // --- DELETE LINK WORKFLOW (Destructive) ---
    else if (aiMode === "delete-link") {
      if (stepIndex === 0) {
        const targetLink = availableLinks.find(
          (l) =>
            l.slug.toLowerCase() === text.toLowerCase().replace(/^\//, "") ||
            (l.description && l.description.toLowerCase().includes(text.toLowerCase()))
        );
        if (!targetLink) {
          setErrorMessage("Could not find a link matching that slug. Please select an existing link.");
          return;
        }
        setDeleteData({
          linkId: targetLink.id,
          slug: targetLink.slug,
          title: targetLink.description || `go.cvsd.live/${targetLink.slug}`,
        });
        setAiState("confirming");
        setChatHistory([
          ...newHistory,
          {
            id: `msg-ai-${Date.now()}`,
            sender: "ai",
            text: `⚠️ DESTRUCTIVE ACTION: Are you sure you want to permanently delete **go.cvsd.live/${targetLink.slug}**? This action cannot be undone.`,
            isConfirmation: true,
          },
        ]);
      }
    }
  };

  // --- Confirm and Execute Action Backend Request ---
  const executeAdminAction = async () => {
    setAiState("executing");
    setErrorMessage(null);

    try {
      if (aiMode === "create-link") {
        const res = await fetch("/api/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: createData.slug,
            url: createData.url,
            description: createData.title || null,
            folderId: createData.folderId,
            releaseAt: createData.releaseAt || null,
            expiresAt: createData.expiresAt || null,
            isLocked: createData.isLocked,
            password: createData.password || null,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to create link");
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cvsdgo:refresh-directory"));
        }
        setCreatedResultLink(`https://go.cvsd.live/${createData.slug}`);
        setAiState("success");
      } else if (aiMode === "update-link") {
        if (!updateData.linkId) throw new Error("No link selected to update.");
        const res = await fetch(`/api/links/${updateData.linkId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: updateData.slug,
            url: updateData.newUrl,
            description: updateData.newTitle,
            folderId: updateData.newFolderId,
            password: updateData.newPassword || undefined,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to update link");
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cvsdgo:refresh-directory"));
        }
        setCreatedResultLink(`https://go.cvsd.live/${updateData.slug}`);
        setAiState("success");
      } else if (aiMode === "create-folder") {
        const res = await fetch("/api/link-folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: createFolderData.name,
            isPublic: createFolderData.isPublic,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to create folder");
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cvsdgo:refresh-directory"));
        }
        setCreatedResultLink(`Folder '${createFolderData.name}'`);
        setAiState("success");
      } else if (aiMode === "move-link") {
        if (!moveData.linkId) throw new Error("No link selected to move.");
        const targetLink = availableLinks.find((l) => l.id === moveData.linkId);
        if (!targetLink) throw new Error("Selected link not found.");

        const res = await fetch(`/api/links/${moveData.linkId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: targetLink.slug,
            url: targetLink.url,
            description: targetLink.description,
            folderId: moveData.targetFolderId,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to move link");
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cvsdgo:refresh-directory"));
        }
        setCreatedResultLink(`https://go.cvsd.live/${targetLink.slug}`);
        setAiState("success");
      } else if (aiMode === "delete-link") {
        if (!deleteData.linkId) throw new Error("No link selected to delete.");
        const res = await fetch(`/api/links/${deleteData.linkId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to delete link");
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cvsdgo:refresh-directory"));
        }
        setCreatedResultLink(`Deleted go.cvsd.live/${deleteData.slug}`);
        setAiState("success");
      }
    } catch (err: unknown) {
      console.error("AI action execution error:", err);
      setErrorMessage((err as { message?: string }).message || "Action failed to complete.");
      setAiState("confirming");
    }
  };

  function handleModalKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (aiMode) {
        exitAiWorkflow();
      } else {
        setIsOpen(false);
      }
    } else if (!aiMode && event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev + 1) % allItems.length : 0));
    } else if (!aiMode && event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev - 1 + allItems.length) % allItems.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (aiMode) {
        if (aiState === "confirming") {
          void executeAdminAction();
        } else if (aiState === "conversing") {
          handleAiStepSubmit(aiInput);
        }
      } else {
        // If user typed a direct admin command (e.g. "create a link")
        const detected = results.canManageLinks ? detectAdminActionIntent(query) : null;
        if (detected) {
          startAiWorkflow(detected.type);
          return;
        }

        const activeItem = allItems[selectedIndex];
        if (activeItem) {
          handleSelect(activeItem);
        }
      }
    }
  }

  let currentIndexTracker = 0;

  return (
    <>
      {portalReady &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="modal-backdrop z-[100] flex items-start justify-center pt-16 px-4 bg-slate-950/60 backdrop-blur-sm sm:pt-24"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsOpen(false);
                }}
                onKeyDown={handleModalKeyDown}
              >
                <motion.div
                  className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.96, y: -12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -12 }}
                  transition={{ duration: 0.18 }}
                  role="dialog"
                  aria-label="Command Palette Search"
                >
                  {/* --- Search Bar Input Header --- */}
                  <div className="relative border-b border-slate-200 px-4 py-3.5 dark:border-slate-800">
                    {aiMode ? (
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 via-violet-600 to-purple-600 text-white shadow-md shadow-indigo-500/30">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </span>
                        <input
                          ref={inputRef}
                          value={aiInput}
                          onChange={(e) => setAiInput(e.target.value)}
                          disabled={aiState === "generating" || aiState === "executing" || aiState === "success"}
                          placeholder={
                            aiState === "confirming"
                              ? "Press Enter to Confirm Action or ESC to Exit..."
                              : aiState === "success"
                                ? "Action Completed Successfully!"
                                : "Type your response and press Enter..."
                          }
                          className="w-full bg-transparent pr-20 text-base font-medium text-oxford-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                          aria-label="AI response input"
                        />
                        <button
                          type="button"
                          onClick={exitAiWorkflow}
                          className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                        >
                          ESC
                        </button>
                      </div>
                    ) : (
                      <>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                          ref={inputRef}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={
                            results.canManageLinks || results.isAdmin
                              ? "Search links, pages, or type an AI admin action like 'create a link'..."
                              : "Search links, pages, or system actions..."
                          }
                          className="w-full bg-transparent pl-8 pr-12 text-base text-oxford-700 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                          aria-label="Command palette input"
                        />
                        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                          ESC
                        </kbd>
                      </>
                    )}
                  </div>

                  {/* --- Modal Body Content --- */}
                  <div className="max-h-[60vh] overflow-y-auto p-3">
                    {/* Mode 1: AI Workflow Panel */}
                    {aiMode ? (
                      <div className="space-y-4 py-1">
                        {/* Generating State Banner */}
                        {aiState === "generating" && (
                          <div className="flex items-center justify-center gap-3 py-10 text-indigo-600 dark:text-indigo-400">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                            </span>
                            <span className="text-sm font-semibold tracking-wide animate-pulse">
                              Generating AI Admin Workflow...
                            </span>
                          </div>
                        )}

                        {/* Conversational Message Thread */}
                        {aiState !== "generating" && (
                          <div className="space-y-3">
                            {chatHistory.map((msg) => (
                              <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.15 }}
                                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender === "user"
                                      ? "bg-oxford-700 text-white shadow-sm dark:bg-oxford-600"
                                      : "border border-indigo-200/80 bg-indigo-50/40 text-slate-800 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-slate-100"
                                    }`}
                                >
                                  {msg.sender === "ai" && (
                                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      CVSD Go AI
                                    </div>
                                  )}
                                  <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                                </div>
                              </motion.div>
                            ))}

                            {/* --- Helper Suggestion Chips for Active Conversational Step --- */}
                            {aiState === "conversing" && (
                              <div className="pt-2 pl-2">
                                {/* Create Link Helper Chips */}
                                {aiMode === "create-link" && stepIndex === 3 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Select Folder:</span>
                                    {availableFolders.map((f) => (
                                      <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => handleAiStepSubmit(f.name)}
                                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-oxford-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                                      >
                                        {f.name}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("General")}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-oxford-700 hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      General
                                    </button>
                                  </div>
                                )}

                                {aiMode === "create-link" && (stepIndex === 4 || stepIndex === 5) && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("Skip")}
                                      className="rounded-lg border border-indigo-300/80 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                                    >
                                      Skip / None
                                    </button>
                                  </div>
                                )}

                                {aiMode === "create-link" && stepIndex === 6 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("No")}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      No Password
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("Yes")}
                                      className="rounded-lg border border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500"
                                    >
                                      Require Password Lock
                                    </button>
                                  </div>
                                )}

                                {/* Link Selection Helper Chips for Update / Move / Delete */}
                                {(aiMode === "update-link" || aiMode === "move-link" || aiMode === "delete-link") &&
                                  stepIndex === 0 && (
                                    <div className="space-y-1.5">
                                      <p className="text-[11px] font-semibold text-slate-400">Available Links:</p>
                                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                        {availableLinks.slice(0, 10).map((l) => (
                                          <button
                                            key={l.id}
                                            type="button"
                                            onClick={() => handleAiStepSubmit(l.slug)}
                                            className="w-full text-left flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                                          >
                                            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                              /{l.slug}
                                            </span>
                                            <span className="truncate text-slate-500 max-w-[200px]">
                                              {l.description || l.url}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                {/* Update Link Field Selector Chips */}
                                {aiMode === "update-link" && stepIndex === 1 && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("Destination URL")}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-oxford-700 hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      Destination URL
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("Title / Description")}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-oxford-700 hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      Title / Description
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("Folder")}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-oxford-700 hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      Folder
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAiStepSubmit("Password")}
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-oxford-700 hover:border-indigo-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      Password Lock
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Error Message Box */}
                            {errorMessage && (
                              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
                                ⚠️ {errorMessage}
                              </div>
                            )}

                            {/* --- Confirmation Summary Card State --- */}
                            {aiState === "confirming" && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={`rounded-2xl border p-4 shadow-sm ${aiMode === "delete-link"
                                    ? "border-rose-300 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/30"
                                    : "border-indigo-300/80 bg-indigo-50/50 dark:border-indigo-900/60 dark:bg-indigo-950/30"
                                  }`}
                              >
                                <div className="flex items-center justify-between border-b pb-2 dark:border-slate-800">
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    {aiMode === "delete-link" ? "⚠️ Destructive Confirmation Required" : "📋 Action Confirmation Summary"}
                                  </span>
                                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                                    {aiMode}
                                  </span>
                                </div>

                                <div className="mt-3 space-y-2 text-xs">
                                  {aiMode === "create-link" && (
                                    <>
                                      <div className="flex justify-between"><span className="text-slate-500">Short Link Slug:</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">go.cvsd.live/{createData.slug}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Destination URL:</span><span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[260px]">{createData.url}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Title:</span><span className="font-medium text-slate-700 dark:text-slate-200">{createData.title}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Folder:</span><span className="font-medium text-slate-700 dark:text-slate-200">{createData.folderName}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Release Date:</span><span className="text-slate-600 dark:text-slate-300">{createData.releaseAt || "Immediate"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Expiration Date:</span><span className="text-slate-600 dark:text-slate-300">{createData.expiresAt || "Never"}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Password Locked:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{createData.isLocked ? `Locked (${createData.password})` : "No"}</span></div>
                                    </>
                                  )}

                                  {aiMode === "update-link" && (
                                    <>
                                      <div className="flex justify-between"><span className="text-slate-500">Target Slug:</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">go.cvsd.live/{updateData.slug}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Updated Field:</span><span className="font-semibold uppercase text-slate-700 dark:text-slate-200">{updateData.fieldToUpdate}</span></div>
                                    </>
                                  )}

                                  {aiMode === "create-folder" && (
                                    <>
                                      <div className="flex justify-between"><span className="text-slate-500">New Folder Name:</span><span className="font-bold text-slate-800 dark:text-slate-100">{createFolderData.name}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Visibility:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{createFolderData.isPublic ? "Public" : "Internal"}</span></div>
                                    </>
                                  )}

                                  {aiMode === "move-link" && (
                                    <>
                                      <div className="flex justify-between"><span className="text-slate-500">Link:</span><span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">go.cvsd.live/{moveData.slug}</span></div>
                                      <div className="flex justify-between"><span className="text-slate-500">Target Folder:</span><span className="font-semibold text-slate-700 dark:text-slate-200">{moveData.targetFolderName}</span></div>
                                    </>
                                  )}

                                  {aiMode === "delete-link" && (
                                    <div className="space-y-1">
                                      <p className="font-mono font-bold text-rose-700 dark:text-rose-400 text-sm">go.cvsd.live/{deleteData.slug}</p>
                                      <p className="text-slate-600 dark:text-slate-300">{deleteData.title}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t dark:border-slate-800">
                                  <button
                                    type="button"
                                    onClick={exitAiWorkflow}
                                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void executeAdminAction()}
                                    className={`rounded-xl px-4 py-1.5 text-xs font-bold text-white shadow-md transition ${aiMode === "delete-link"
                                        ? "bg-rose-600 hover:bg-rose-700"
                                        : "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-500/20"
                                      }`}
                                  >
                                    {aiMode === "delete-link" ? "Confirm Delete" : "Confirm & Execute"}
                                  </button>
                                </div>
                              </motion.div>
                            )}

                            {/* Executing State Loading Shimmer */}
                            {aiState === "executing" && (
                              <div className="p-6 text-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Executing administrative action...
                              </div>
                            )}

                            {/* --- Success State Card --- */}
                            {aiState === "success" && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30"
                              >
                                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                                  <svg className="h-5 w-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Administrative Action Completed!
                                </div>
                                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                                  The requested operation was authorized and recorded successfully.
                                </p>
                                {createdResultLink && (
                                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-white p-2.5 dark:border-emerald-900/80 dark:bg-slate-900">
                                    <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                      {createdResultLink}
                                    </span>
                                    {createdResultLink.startsWith("http") && (
                                      <button
                                        type="button"
                                        onClick={(e) => void handleCopyLink(createData.slug || updateData.slug, e)}
                                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                      >
                                        Copy Link
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div className="mt-4 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={exitAiWorkflow}
                                    className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                  >
                                    Done
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startAiWorkflow("create-link")}
                                    className="rounded-xl bg-oxford-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-oxford-800 dark:bg-oxford-600"
                                  >
                                    Create Another Link
                                  </button>
                                </div>
                              </motion.div>
                            )}

                            <div ref={chatBottomRef} />
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Mode 2: Standard Command Palette Search Results */
                      <>
                        {isLoading && (
                          <div className="p-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Searching authorized content...
                          </div>
                        )}

                        {!isLoading && allItems.length === 0 && (
                          <div className="p-8 text-center">
                            <p className="text-sm font-semibold text-oxford-700 dark:text-slate-200">No results found</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {results.canManageLinks || results.isAdmin
                                ? 'Try searching for a link keyword like "roblox", "discord", or an AI action like "create a link".'
                                : 'Try searching for a link keyword like "roblox", "discord", or a site page.'}
                            </p>
                          </div>
                        )}

                        {/* Section 0: AI Admin Actions */}
                        {!isLoading && results.aiAdminActions && results.aiAdminActions.length > 0 && (
                          <div className="mb-2">
                            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                              </svg>
                              AI Admin Actions
                            </p>
                            <div className="space-y-1">
                              {results.aiAdminActions.map((aiAction) => {
                                const itemIndex = currentIndexTracker++;
                                const isSelected = itemIndex === selectedIndex;
                                return (
                                  <div
                                    key={aiAction.id}
                                    onClick={() => handleSelect(aiAction)}
                                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${isSelected
                                        ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white shadow-md shadow-indigo-500/25"
                                        : "bg-indigo-50/50 text-slate-900 hover:bg-indigo-100/70 dark:bg-indigo-950/20 dark:text-slate-100 dark:hover:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40"
                                      }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`p-2 rounded-lg ${isSelected
                                            ? "bg-white/20 text-white"
                                            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300"
                                          }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <p className="text-sm font-semibold flex items-center gap-2">
                                          {aiAction.title}
                                          {aiAction.isDestructive && (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase bg-rose-500/20 text-rose-600 dark:text-rose-400">
                                              Destructive
                                            </span>
                                          )}
                                        </p>
                                        <p
                                          className={`text-xs ${isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"
                                            }`}
                                        >
                                          {aiAction.description}
                                        </p>
                                      </div>
                                    </div>
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${isSelected
                                          ? "border-indigo-400/40 bg-indigo-950/40 text-indigo-100"
                                          : "border-indigo-200/80 bg-indigo-100/70 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300"
                                        }`}
                                    >
                                      AI Workflow
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Section 1: Navigation & Pages */}
                        {!isLoading && results.pages.length > 0 && (
                          <div className="mb-2">
                            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Pages & Tools
                            </p>
                            <div className="space-y-1">
                              {results.pages.map((page) => {
                                const itemIndex = currentIndexTracker++;
                                const isSelected = itemIndex === selectedIndex;
                                return (
                                  <div
                                    key={page.id}
                                    onClick={() => handleSelect(page)}
                                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${isSelected
                                        ? "bg-oxford-700 text-white dark:bg-oxford-600"
                                        : "text-oxford-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                      }`}
                                  >
                                    <div>
                                      <p className="text-sm font-semibold">{page.title}</p>
                                      <p
                                        className={`text-xs ${isSelected ? "text-slate-200" : "text-slate-500 dark:text-slate-400"
                                          }`}
                                      >
                                        {page.description}
                                      </p>
                                    </div>
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${isSelected
                                          ? "border-oxford-500 bg-oxford-800 text-slate-200"
                                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                        }`}
                                    >
                                      {page.category}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Section 2: District Short Links */}
                        {!isLoading && results.links.length > 0 && (
                          <div className="mb-2">
                            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              District Short Links ({results.links.length})
                            </p>
                            <div className="space-y-1">
                              {results.links.map((link) => {
                                const itemIndex = currentIndexTracker++;
                                const isSelected = itemIndex === selectedIndex;
                                return (
                                  <div
                                    key={link.id}
                                    onClick={() => handleSelect(link)}
                                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${isSelected
                                        ? "bg-oxford-700 text-white dark:bg-oxford-600"
                                        : "text-oxford-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                      }`}
                                  >
                                    <div className="min-w-0 pr-3">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`font-mono text-xs font-bold ${isSelected ? "text-deepforest-300" : "text-deepforest-700 dark:text-slate-300"
                                            }`}
                                        >
                                          go.cvsd.live/{link.slug}
                                        </span>
                                        {link.isLocked && (
                                          <span
                                            className={`rounded-full border px-1.5 py-0.2 text-[9px] font-semibold uppercase ${isSelected
                                                ? "border-amber-400/40 bg-amber-950/40 text-amber-200"
                                                : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                              }`}
                                          >
                                            Locked
                                          </span>
                                        )}
                                      </div>
                                      <p
                                        className={`truncate text-sm font-medium ${isSelected ? "text-white" : "text-slate-700 dark:text-slate-200"
                                          }`}
                                      >
                                        {link.title}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => void handleCopyLink(link.slug, e)}
                                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${isSelected
                                            ? "border-oxford-500 bg-oxford-800 text-white hover:bg-oxford-900"
                                            : "border-slate-200 bg-white text-oxford-700 hover:border-oxford-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                          }`}
                                        title="Copy short link"
                                      >
                                        {copiedSlug === link.slug ? "Copied!" : "Copy"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Section 3: Quick System Actions */}
                        {!isLoading && results.actions.length > 0 && (
                          <div>
                            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              System Actions
                            </p>
                            <div className="space-y-1">
                              {results.actions.map((action) => {
                                const itemIndex = currentIndexTracker++;
                                const isSelected = itemIndex === selectedIndex;
                                return (
                                  <div
                                    key={action.id}
                                    onClick={() => handleSelect(action)}
                                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                                    className={`flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition ${isSelected
                                        ? "bg-oxford-700 text-white dark:bg-oxford-600"
                                        : "text-oxford-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                      }`}
                                  >
                                    <div>
                                      <p className="text-sm font-semibold">{action.title}</p>
                                      <p
                                        className={`text-xs ${isSelected ? "text-slate-200" : "text-slate-500 dark:text-slate-400"
                                          }`}
                                      >
                                        {action.description}
                                      </p>
                                    </div>
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${isSelected
                                          ? "border-oxford-500 bg-oxford-800 text-slate-200"
                                          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                                        }`}
                                    >
                                      Action
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* --- Modal Footer Controls --- */}
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    {aiMode ? (
                      <div className="flex items-center gap-3">
                        <span>
                          <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                            ↵
                          </kbd>{" "}
                          Send Response / Confirm
                        </span>
                        <span>
                          <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                            ESC
                          </kbd>{" "}
                          Exit AI Mode
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span>
                          <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                            ↑
                          </kbd>{" "}
                          <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                            ↓
                          </kbd>{" "}
                          Navigate
                        </span>
                        <span>
                          <kbd className="rounded border bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">
                            ↵
                          </kbd>{" "}
                          Select
                        </span>
                      </div>
                    )}
                    <span>CVSD Go Search v2</span>
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
