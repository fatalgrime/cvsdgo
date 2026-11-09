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
      if (!local && !/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) return null;
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
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
  starts_at?: string | null;
  expires_at?: string | null;
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
  const startsAt = parseAnnouncementDate(body.starts_at);
  const expiresAt = parseAnnouncementDate(body.expires_at);
  if (startsAt === undefined || expiresAt === undefined || (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt))) return null;
  const buttons = parseAnnouncementButtons(body.buttons);
  if (!buttons) return null;
  return { audience: body.audience, title, message, tone: body.tone as AnnouncementInput["tone"], dismissible: body.dismissible, published: body.published, ...(body.buttons !== undefined ? { buttons } : {}), ...(body.starts_at !== undefined ? { starts_at: startsAt } : {}), ...(body.expires_at !== undefined ? { expires_at: expiresAt } : {}) };
}

export function announcementKey(item: Announcement): string {
  return `${item.id}:${item.revision}`;
}

export function isAnnouncementVisible(item: Announcement, dismissed: string[], now = Date.now()): boolean {
  return item.published && isAnnouncementInWindow(item, now) && (!item.dismissible || !dismissed.includes(announcementKey(item)));
}

// Require a time zone so server and browser never interpret a schedule differently.
function parseAnnouncementDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return undefined;
  const time = Date.parse(value);
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!Number.isFinite(time) || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return undefined;
  return new Date(time).toISOString();
}
export function isAnnouncementInWindow(item: Pick<AnnouncementInput, "starts_at" | "expires_at">, now = Date.now()): boolean {
  return (!item.starts_at || Date.parse(item.starts_at) <= now) && (!item.expires_at || Date.parse(item.expires_at) > now);
}
export function announcementStatus(item: AnnouncementInput, now = Date.now()): string {
  if (!item.published) return "Draft";
  if (item.expires_at && Date.parse(item.expires_at) <= now) return "Expired";
  if (item.starts_at && Date.parse(item.starts_at) > now) return "Scheduled";
  return "Published";
}
export function announcementDateInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
