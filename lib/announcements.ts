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
          audience TEXT NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'staff')),
          dismissible BOOLEAN NOT NULL DEFAULT TRUE,
          published BOOLEAN NOT NULL DEFAULT FALSE,
          revision INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `;
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'staff'));`;
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS buttons JSONB NOT NULL DEFAULT '[]'::jsonb;`;
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;`;
      await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;`;
    })().catch((error) => { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}
export async function getAnnouncements(includeDrafts = false, includeStaff = false): Promise<Announcement[]> {
  if (!hasDatabaseUrl()) return [];
  await ensureAnnouncementSchema();
  const sql = getSql();
  return await sql`
    SELECT id::text, title, message, tone, audience, dismissible, published, revision, buttons, starts_at, expires_at
    FROM announcements WHERE (published = TRUE OR ${includeDrafts})
      AND (audience = 'everyone' OR ${includeStaff})
      AND (${includeDrafts} OR ((starts_at IS NULL OR starts_at <= NOW()) AND (expires_at IS NULL OR expires_at > NOW())))
    ORDER BY created_at DESC, id DESC;
  ` as Announcement[];
}
