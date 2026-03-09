export function normalizeSlug(raw: string): string {
  return raw.replace(/^go\//i, "").trim().toLowerCase();
}
