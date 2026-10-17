export function normalizeSlug(raw: string): string {
  return raw.replace(/^go\//i, "").trim().toLowerCase();
}

export function parseDestinationUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
