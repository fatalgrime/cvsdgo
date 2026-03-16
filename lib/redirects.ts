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
          f.is_public AS folder_is_public
        FROM redirects r
        LEFT JOIN link_folders f ON f.id = r.folder_id
        WHERE r.folder_id IS NULL OR f.is_public = true
        ORDER BY COALESCE(f.name, ''), r.slug ASC;
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

export async function incrementAndResolveUrl(slug: string): Promise<string | null> {
  if (!hasDatabaseUrl()) {
    return null;
  }

  const sql = getSql();
  const rows = (await sql`
    UPDATE redirects
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE slug = ${slug}
    RETURNING url;
  `) as { url: string }[];

  return rows[0]?.url ?? null;
}
