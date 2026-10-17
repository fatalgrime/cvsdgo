import { getSql } from "@/lib/db";

let schemaPromise: Promise<void> | null = null;

async function initialize(): Promise<void> {
  const sql = getSql();
  // Deliberately no foreign key: deleting a report must not erase quota usage.
  await sql`
    CREATE TABLE IF NOT EXISTS report_submissions (
      report_id BIGINT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS report_submissions_user_time_idx ON report_submissions (user_id, created_at);`;
  await sql`
    INSERT INTO report_submissions (report_id, user_id, created_at)
    SELECT id, user_id, created_at FROM reports
    WHERE created_at >= NOW() - INTERVAL '1 day'
    ON CONFLICT (report_id) DO NOTHING;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS link_unlock_attempts (
      slug TEXT PRIMARY KEY,
      window_start TIMESTAMPTZ NOT NULL,
      attempts INTEGER NOT NULL
    );
  `;
}

export async function ensureAbuseSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = initialize().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}
