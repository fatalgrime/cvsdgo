import { getSql, hasDatabaseUrl } from "@/lib/db";
import { unstable_cache } from "next/cache";
import type { RedirectRow } from "@/lib/types";

const getAllRedirectsCached = unstable_cache(
  async (): Promise<RedirectRow[]> => {
    if (!hasDatabaseUrl()) {
      return [];
    }

    const sql = getSql();
    const rows = (await sql`
      SELECT id, slug, url, description, click_count, is_locked, release_at, expires_at
      FROM redirects
      ORDER BY slug ASC;
    `) as RedirectRow[];

    return rows;
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
