import { getSql, hasDatabaseUrl } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { RedirectRow } from "@/lib/types";
import { ensureLinkSchema } from "@/lib/link-schema";

const getAllRedirectsCached = unstable_cache(
  async (): Promise<RedirectRow[]> => {
    if (!hasDatabaseUrl()) {
      return [];
    }

    try {
      await ensureLinkSchema();
      const sql = getSql();
      const rows = (await sql`
        SELECT
          r.id,
          r.slug,
          r.url,
          r.description,
          r.click_count,
          r.is_locked,
          r.release_at,
          r.expires_at,
          r.folder_id,
          f.name AS folder_name,
          f.is_public AS folder_is_public,
          f.sort_order AS folder_sort_order
        FROM redirects r
        LEFT JOIN link_folders f ON f.id = r.folder_id
        WHERE r.folder_id IS NULL OR f.is_public IS DISTINCT FROM false
        ORDER BY COALESCE(f.sort_order, 0), COALESCE(f.name, ''), r.slug ASC;
      `) as RedirectRow[];

      return rows;
    } catch (error) {
      console.error("Error loading redirects:", error);
      return [];
    }
  },
  ["redirects:all"],
  { revalidate: 120, tags: ["redirects"] }
);

export async function getAllRedirects(): Promise<RedirectRow[]> {
  if (!hasDatabaseUrl()) {
    return [];
  }
  return getAllRedirectsCached();
}

export type RedirectDestinationInfo = {
  url: string;
  is_locked: boolean;
  password_hash: string | null;
  release_at: string | Date | null;
  expires_at: string | Date | null;
};

export async function getRedirectBySlug(rawSlug: string): Promise<RedirectDestinationInfo | null> {
  if (!hasDatabaseUrl()) return null;
  const slug = rawSlug.trim().toLowerCase();
  if (!slug) return null;
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT url, is_locked, password_hash, release_at, expires_at
      FROM redirects
      WHERE slug = ${slug}
      LIMIT 1;
    `) as RedirectDestinationInfo[];
    return rows[0] ?? null;
  } catch (error) {
    console.error("Error fetching redirect by slug:", error);
    return null;
  }
}

export function recordClick(rawSlug: string): void {
  if (!hasDatabaseUrl()) return;
  const slug = rawSlug.trim().toLowerCase();
  if (!slug) return;
  const sql = getSql();
  sql`
    UPDATE redirects
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE slug = ${slug};
  `.catch((err) => {
    console.error("Failed to record click for slug:", slug, err);
  });
}

