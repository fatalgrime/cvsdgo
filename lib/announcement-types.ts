export type AnnouncementButton = { label: string; url: string };
export const MAX_ANNOUNCEMENT_BUTTONS = 3;

export function parseAnnouncementButtons(value: unknown): AnnouncementButton[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ANNOUNCEMENT_BUTTONS) return null;
  const buttons: AnnouncementButton[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.label !== "string" || typeof item.url !== "string") return null;
    const label = item.label.trim();
    const url = item.url.trim();
    if (!label || label.length > 40 || !url || url.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(url)) return null;
    try {
      const parsed = new URL(url, "https://go.cvsd.live");
      const local = url.startsWith("/") && !url.startsWith("//");
      if (!local && !/^https?:\/\//i.test(url)) return null;
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
      buttons.push({ label, url: local ? url : parsed.toString() });
    } catch { return null; }
  }
  return buttons;
}

export type AnnouncementInput = {
  audience: "everyone" | "staff";
  title: string;
  message: string;
  tone: "info" | "success" | "warning";
  dismissible: boolean;
  published: boolean;
  buttons?: AnnouncementButton[];
};
export type Announcement = AnnouncementInput & { id: string; revision: number };

export function parseAnnouncement(value: unknown): AnnouncementInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.title !== "string" || typeof body.message !== "string" ||
      typeof body.dismissible !== "boolean" || typeof body.published !== "boolean" ||
      (typeof body.tone !== "string" || !["info", "success", "warning"].includes(body.tone))) return null;
  if (body.audience !== "everyone" && body.audience !== "staff") return null;
  const title = body.title.trim();
  const message = body.message.trim();
  if (!title || title.length > 100 || !message || message.length > 1000) return null;
  const buttons = parseAnnouncementButtons(body.buttons);
  if (!buttons) return null;
  return { audience: body.audience, title, message, tone: body.tone as AnnouncementInput["tone"], dismissible: body.dismissible, published: body.published, ...(body.buttons !== undefined ? { buttons } : {}) };
}

export function announcementKey(item: Announcement): string {
  return `${item.id}:${item.revision}`;
}

export function isAnnouncementVisible(item: Announcement, dismissed: string[]): boolean {
  return item.published && (!item.dismissible || !dismissed.includes(announcementKey(item)));
}
