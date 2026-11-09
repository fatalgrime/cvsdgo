const MAX_DRAFT_AGE = 7 * 24 * 60 * 60 * 1000;
export function readEditorDraft<T>(storage: Storage, key: string, validate: (value: unknown) => value is T): T | null {
  try {
    const draft = JSON.parse(storage.getItem(key) || "null");
    if (!draft || draft.version !== 1 || typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > MAX_DRAFT_AGE || !validate(draft.value)) return null;
    return draft.value;
  } catch { return null; }
}
export function writeEditorDraft(storage: Storage, key: string, value: unknown): boolean {
  try { storage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now(), value })); return true; }
  catch { return false; }
}
