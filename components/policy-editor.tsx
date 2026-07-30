"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/toast-provider";
import { PolicyMarkdown } from "@/components/policy-markdown";
import {
  hasMeaningfulPolicyContent,
  POLICY_DOCUMENTS,
  type PolicyDocumentKey,
  type StoredPolicyDocument,
} from "@/lib/policy-definitions";

type PolicyDocumentsResponse = {
  canEditPolicies: boolean;
  storageAvailable: boolean;
  documents: Record<PolicyDocumentKey, StoredPolicyDocument>;
};

type PolicyEditorProps = {
  enabled: boolean;
};

type ActiveStage = "selection" | "loading" | "editor";

type SelectionState = {
  stage: ActiveStage;
  documentKey: PolicyDocumentKey | null;
};

type ConfirmState = {
  open: boolean;
  reason: "discard";
};

const MARKDOWN_SNIPPETS = {
  heading1: { label: "H1", snippet: "# Heading 1\n" },
  heading2: { label: "H2", snippet: "## Heading 2\n" },
  heading3: { label: "H3", snippet: "### Heading 3\n" },
  bold: { label: "Bold", snippet: "**bold text**" },
  italic: { label: "Italic", snippet: "*italic text*" },
  bullet: { label: "List", snippet: "- First item\n- Second item\n" },
  ordered: { label: "Numbered", snippet: "1. First item\n2. Second item\n" },
  link: { label: "Link", snippet: "[Link text](https://example.com)" },
  quote: { label: "Quote", snippet: "> A quote or citation\n" },
  code: { label: "Code", snippet: "```\nconst example = true;\n```" },
  table: {
    label: "Table",
    snippet: "| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n",
  },
  callout: {
    label: "Callout",
    snippet: "> [!NOTE]\n> Callout title or summary.\n> Additional detail goes here.\n",
  },
} as const;

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n").trim();
}

function getMeaningfulMarkdown(markdown: string): boolean {
  return hasMeaningfulPolicyContent(normalizeMarkdown(markdown));
}

function buildInsertResult(current: string, start: number, end: number, insert: string, selectionOffset?: [number, number]) {
  const nextValue = `${current.slice(0, start)}${insert}${current.slice(end)}`;
  const cursorStart = start + (selectionOffset?.[0] ?? insert.length);
  const cursorEnd = start + (selectionOffset?.[1] ?? insert.length);
  return { nextValue, cursorStart, cursorEnd };
}

export function PolicyEditor({ enabled }: PolicyEditorProps) {
  const [portalReady, setPortalReady] = useState(false);
  const [selection, setSelection] = useState<SelectionState>({ stage: "selection", documentKey: null });
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, reason: "discard" });
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<StoredPolicyDocument | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [originalMarkdown, setOriginalMarkdown] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loadMessage, setLoadMessage] = useState("Preparing editor...");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const isDirty = useMemo(() => normalizeMarkdown(markdown) !== normalizeMarkdown(originalMarkdown), [markdown, originalMarkdown]);
  const canSave = storageAvailable && !isSaving && getMeaningfulMarkdown(markdown);

  useEffect(() => {
    if (!isSelectionOpen) {
      return;
    }

    let active = true;

    async function loadDocuments() {
      setFetchError(null);
      try {
        const response = await fetch("/api/admin/policies");
        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = (await response.json()) as PolicyDocumentsResponse;
        if (!active) {
          return;
        }

        setStorageAvailable(Boolean(data.storageAvailable));
      } catch (error) {
        if (!active) {
          return;
        }
        const message = (error as Error).message || "Unable to load policy documents.";
        setFetchError(message);
      }
    }

    void loadDocuments();

    return () => {
      active = false;
    };
  }, [isSelectionOpen]);

  async function openPolicyEditor(key: PolicyDocumentKey) {
    setSelection({ stage: "loading", documentKey: key });
    setIsSelectionOpen(false);
    setIsLoading(true);
    setLoadMessage(`Loading ${POLICY_DOCUMENTS[key].label}...`);
    setFetchError(null);

    const startedAt = Date.now();

    try {
      const response = await fetch("/api/admin/policies");
      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as PolicyDocumentsResponse;
      const document = data.documents[key];

      if (!document) {
        throw new Error("Policy document not found.");
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed < 260) {
        await new Promise((resolve) => setTimeout(resolve, 260 - elapsed));
      }

      setStorageAvailable(Boolean(data.storageAvailable));
      setSelectedDocument(document);
      setMarkdown(document.markdown);
      setOriginalMarkdown(document.markdown);
      setSelection({ stage: "editor", documentKey: key });
      setIsLoading(false);
    } catch (error) {
      const message = (error as Error).message || "Unable to load policy document.";
      setFetchError(message);
      setSelection({ stage: "selection", documentKey: null });
      setIsLoading(false);
      setIsSelectionOpen(true);
      toast({ title: "Unable to open policy editor", description: message, variant: "error" });
    }
  }

  function closeSelectionDialog() {
    setIsSelectionOpen(false);
    setFetchError(null);
  }

  function requestCloseEditor() {
    if (isDirty) {
      setConfirmState({ open: true, reason: "discard" });
      return;
    }

    resetEditorState();
  }

  function resetEditorState() {
    setSelection({ stage: "selection", documentKey: null });
    setSelectedDocument(null);
    setMarkdown("");
    setOriginalMarkdown("");
    setIsSaving(false);
    setFetchError(null);
    setLoadMessage("Preparing editor...");
    setConfirmState({ open: false, reason: "discard" });
  }

  function insertSnippet(snippet: string, selectionOffset?: [number, number]) {
    const input = textareaRef.current;
    if (!input) {
      setMarkdown((current) => `${current}${snippet}`);
      return;
    }

    const start = input.selectionStart ?? markdown.length;
    const end = input.selectionEnd ?? markdown.length;
    const { nextValue, cursorStart, cursorEnd } = buildInsertResult(markdown, start, end, snippet, selectionOffset);
    setMarkdown(nextValue);

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function wrapSelection(before: string, after = before, placeholder = "text") {
    const input = textareaRef.current;
    if (!input) {
      setMarkdown((current) => `${current}${before}${placeholder}${after}`);
      return;
    }

    const start = input.selectionStart ?? markdown.length;
    const end = input.selectionEnd ?? markdown.length;
    const selected = markdown.slice(start, end) || placeholder;
    const insert = `${before}${selected}${after}`;
    const { nextValue, cursorStart, cursorEnd } = buildInsertResult(markdown, start, end, insert, [
      before.length,
      before.length + selected.length,
    ]);
    setMarkdown(nextValue);

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  async function saveDocument() {
    if (!selectedDocument) {
      return;
    }

    if (!storageAvailable) {
      toast({
        title: "Storage unavailable",
        description: "Database storage is required before policy changes can be saved.",
        variant: "error",
      });
      return;
    }

    if (!getMeaningfulMarkdown(markdown)) {
      toast({
        title: "Policy content is empty",
        description: "Add text before saving this document.",
        variant: "error",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentKey: selectedDocument.key, markdown }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = (await response.json()) as { document?: StoredPolicyDocument };
      const savedDocument = data.document ?? selectedDocument;
      setSelectedDocument(savedDocument);
      setOriginalMarkdown(markdown);
      toast({
        title: `${savedDocument.label} saved`,
        description: "The updated policy content is now live.",
        variant: "success",
      });
      resetEditorState();
    } catch (error) {
      const message = (error as Error).message || "Unable to save policy document.";
      toast({ title: "Unable to save policy document", description: message, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDiscard() {
    resetEditorState();
  }

  if (!enabled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsSelectionOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
      >
        Policies
      </button>

      {portalReady &&
        createPortal(
          <AnimatePresence>
            {isSelectionOpen && (
              <motion.div
                className="modal-backdrop z-[120] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Policies</p>
                      <h3 className="mt-2 font-serif text-2xl text-oxford-700 dark:text-slate-100">Choose a document to edit</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        Select the policy you want to update. The editor will load the current content and open in a split markdown workspace.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeSelectionDialog}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      aria-label="Close policy selection"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {(Object.keys(POLICY_DOCUMENTS) as PolicyDocumentKey[]).map((key) => {
                      const definition = POLICY_DOCUMENTS[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void openPolicyEditor(key)}
                          className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:-translate-y-0.5 hover:border-oxford-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-oxford-500 dark:hover:bg-slate-900"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{definition.label}</p>
                            <span className="rounded-full border border-slate-300 px-2 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              Edit
                            </span>
                          </div>
                          <p className="mt-3 text-lg font-semibold text-oxford-700 dark:text-slate-100">{definition.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                            Open the markdown editor for this document, with live preview and validation before saving.
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {fetchError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
                      {fetchError}
                    </div>
                  ) : null}
                </motion.div>
              </motion.div>
            )}

            {isLoading && selection.stage === "loading" && (
              <motion.div
                className="modal-backdrop z-[130] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="flex w-full max-w-md items-center gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-oxford-200 bg-oxford-50 text-oxford-700 dark:border-oxford-900/60 dark:bg-oxford-950/40 dark:text-oxford-200">
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Loading editor</p>
                    <p className="mt-1 font-semibold text-oxford-700 dark:text-slate-100">{loadMessage}</p>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {selection.stage === "editor" && selectedDocument && (
              <motion.div
                className="modal-backdrop z-[140] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="flex h-[calc(100vh-3rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.97, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 18 }}
                  transition={{ duration: 0.24 }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Policy editor</p>
                        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          {selectedDocument.label}
                        </span>
                        {isDirty ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                            Unsaved changes
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100">
                            Synced
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 font-serif text-3xl text-oxford-700 dark:text-slate-100">{selectedDocument.title}</h3>
                      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
                        Edit Markdown on the left and review the rendered result on the right. Use the toolbar to insert common formatting patterns quickly.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={requestCloseEditor}
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveDocument()}
                        disabled={!canSave}
                        className="inline-flex items-center gap-2 rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                      >
                        {isSaving ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 1 1-3.3-6.9" />
                          </svg>
                        ) : null}
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-slate-800">
                    {Object.entries(MARKDOWN_SNIPPETS).map(([key, value]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          switch (key) {
                            case "bold":
                              wrapSelection("**");
                              break;
                            case "italic":
                              wrapSelection("*");
                              break;
                            case "link":
                              wrapSelection("[", "](https://example.com)", "Link text");
                              break;
                            case "quote":
                              insertSnippet(`${value.snippet}`);
                              break;
                            default:
                              insertSnippet(`${value.snippet}\n`);
                              break;
                          }
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:border-oxford-300 hover:text-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-oxford-500 dark:hover:text-slate-100"
                        title={value.label}
                      >
                        {value.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                    <div className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950 lg:border-b-0 lg:border-r">
                      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Markdown source</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{markdown.trim().split(/\n+/).length} lines</p>
                      </div>
                      <textarea
                        ref={textareaRef}
                        value={markdown}
                        onChange={(event) => setMarkdown(event.target.value)}
                        spellCheck
                        className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 font-mono text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                        placeholder="Write the policy in Markdown..."
                      />
                    </div>

                    <div className="flex min-h-0 flex-col">
                      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Live preview</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Rendered as Markdown</p>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5 dark:bg-slate-950">
                        <article className="mx-auto max-w-3xl space-y-5">
                          <PolicyMarkdown markdown={markdown} className="space-y-4" />
                        </article>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>{storageAvailable ? "Database storage available" : "Database storage unavailable"}</span>
                      {selectedDocument.updatedAt ? <span>Last saved: {new Date(selectedDocument.updatedAt).toLocaleString()}</span> : <span>Using default content</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span>{isDirty ? "Unsaved edits detected" : "No unsaved changes"}</span>
                      {!getMeaningfulMarkdown(markdown) ? <span className="text-rose-600 dark:text-rose-400">Document cannot be empty</span> : null}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {confirmState.open && (
              <motion.div
                className="modal-backdrop z-[150] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Discard changes?</p>
                  <h3 className="mt-2 font-serif text-2xl text-oxford-700 dark:text-slate-100">You have unsaved edits</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Closing now will discard your markdown changes for this policy document.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmState({ open: false, reason: "discard" })}
                      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      Keep editing
                    </button>
                    <button
                      type="button"
                      onClick={confirmDiscard}
                      className="rounded-md border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
                    >
                      Discard changes
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
