import { getSql } from "@/lib/db";
import { ensureAbuseSchema } from "@/lib/abuse-schema";
import type { ReportRow } from "@/lib/types";

type Submission = {
  userId: string;
  email: string | null;
  title: string;
  description: string;
  linkSlug: string | null;
  priority: string;
  metadata: Record<string, unknown> | null;
};

type SubmissionResult = { report: ReportRow | null; reason: "banned" | "hourly" | "daily" | null };

export async function submitReport(input: Submission): Promise<SubmissionResult> {
  await ensureAbuseSchema();
  const sql = getSql();
  const results = await sql.transaction([
    // Separate statement + ReadCommitted gives the next query a fresh snapshot
    // after any concurrent submission by this user has committed.
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.userId}, 0));`,
    sql`
      WITH profile AS (
        SELECT * FROM reporting_profiles WHERE user_id = ${input.userId}
      ), counts AS (
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') AS hourly,
          COUNT(*) AS daily
        FROM report_submissions
        WHERE user_id = ${input.userId} AND created_at >= NOW() - INTERVAL '1 day'
      ), decision AS (
        SELECT CASE
          WHEN p.report_ban_type = 'permanent' OR
            (p.report_ban_type = 'temporary' AND p.banned_until > NOW()) THEN 'banned'
          WHEN p.limit_hourly > 0 AND c.hourly >= p.limit_hourly THEN 'hourly'
          WHEN p.limit_daily > 0 AND c.daily >= p.limit_daily THEN 'daily'
          ELSE NULL
        END AS reason
        FROM counts c LEFT JOIN profile p ON TRUE
      ), inserted AS (
        INSERT INTO reports (user_id, user_email, title, description, link_slug, priority, status, metadata)
        SELECT ${input.userId}, ${input.email}, ${input.title}, ${input.description},
          ${input.linkSlug}, ${input.priority}, 'open', ${input.metadata}
        FROM decision WHERE reason IS NULL
        RETURNING *
      ), recorded AS (
        INSERT INTO report_submissions (report_id, user_id, created_at)
        SELECT id, user_id, created_at FROM inserted
      )
      SELECT (SELECT row_to_json(inserted) FROM inserted) AS report, reason FROM decision;
    `,
  ], { isolationLevel: "ReadCommitted" });
  return (results[1] as SubmissionResult[])[0];
}
