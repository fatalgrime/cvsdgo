export type AnnouncementInput = {
  title: string;
  message: string;
  tone: "info" | "success" | "warning";
  dismissible: boolean;
  published: boolean;
};
export type Announcement = AnnouncementInput & { id: string; revision: number };

export function parseAnnouncement(value: unknown): AnnouncementInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (typeof body.title !== "string" || typeof body.message !== "string" ||
      typeof body.dismissible !== "boolean" || typeof body.published !== "boolean" ||
      (typeof body.tone !== "string" || !["info", "success", "warning"].includes(body.tone))) return null;
  const title = body.title.trim();
  const message = body.message.trim();
  if (!title || title.length > 100 || !message || message.length > 1000) return null;
  return { title, message, tone: body.tone as AnnouncementInput["tone"], dismissible: body.dismissible, published: body.published };
}

export function announcementKey(item: Announcement): string {
  return `${item.id}:${item.revision}`;
}

export function isAnnouncementVisible(item: Announcement, dismissed: string[]): boolean {
  return item.published && (!item.dismissible || !dismissed.includes(announcementKey(item)));
}
