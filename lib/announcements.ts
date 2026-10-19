import { getSql, hasDatabaseUrl } from "@/lib/db";
import type { Announcement } from "@/lib/announcement-types";
let schemaPromise: Promise<void> | null = null;
export async function ensureAnnouncementSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS announcements (
          id BIGSERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          tone TEXT NOT NULL DEFAULT 'info' CHECK (tone IN ('info', 'success', 'warning')),
          dismissible BOOLEAN NOT NULL DEFAULT TRUE,
          published BOOLEAN NOT NULL DEFAULT FALSE,
          revision INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
    })().catch((error) => { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}
export async function getAnnouncements(includeDrafts = false): Promise<Announcement[]> {
  if (!hasDatabaseUrl()) return [];
  await ensureAnnouncementSchema();
  const sql = getSql();
  return await sql`
    SELECT id::text, title, message, tone, dismissible, published, revision
    FROM announcements WHERE published = TRUE OR ${includeDrafts}
    ORDER BY created_at DESC, id DESC;
  ` as Announcement[];
}
