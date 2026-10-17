import { getSql } from "@/lib/db";
import { ensureAbuseSchema } from "@/lib/abuse-schema";

// Shared per-link budget across all instances and clients; no spoofable IP key.
const MAX_ATTEMPTS = 10;

export async function consumeUnlockAttempt(rawSlug: string): Promise<boolean> {
  await ensureAbuseSchema();
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO link_unlock_attempts (slug, window_start, attempts)
    VALUES (${rawSlug.trim().toLowerCase()}, NOW(), 1)
    ON CONFLICT (slug) DO UPDATE SET
      window_start = CASE WHEN link_unlock_attempts.window_start <= NOW() - INTERVAL '1 minute'
        THEN NOW() ELSE link_unlock_attempts.window_start END,
      attempts = CASE WHEN link_unlock_attempts.window_start <= NOW() - INTERVAL '1 minute'
        THEN 1 ELSE link_unlock_attempts.attempts + 1 END
    WHERE link_unlock_attempts.window_start <= NOW() - INTERVAL '1 minute'
      OR link_unlock_attempts.attempts < ${MAX_ATTEMPTS}
    RETURNING slug;
  `) as { slug: string }[];
  return rows.length > 0;
}
