import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureReportSchema } from "@/lib/report-schema";
import { isReportStaffUser } from "@/lib/access";
import { logAuditEvent } from "@/lib/audit";
import { validateContentWithAutoMod } from "@/lib/automod";
import type { ReportCommentRow, ReportRow } from "@/lib/types";

type ReportInsertRow = ReportRow;

type ReportingProfileRow = {
  user_id: string;
  report_ban_type: string;
  banned_until: string | null;
  limit_hourly: number;
  limit_daily: number;
};

function parsePriority(value: unknown): string {
  const normalized = String(value ?? "normal").toLowerCase();
  if (["low", "normal", "high", "urgent"].includes(normalized)) {
    return normalized;
  }
  return "normal";
}

function parseStatus(value: unknown): string {
  const normalized = String(value ?? "open").toLowerCase();
  if (["open", "investigating", "resolved", "closed"].includes(normalized)) {
    return normalized;
  }
  return "open";
}

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return Response.json({ reports: [], comments: [], isStaff: false });
  }

  const isStaff = await isReportStaffUser(userId);
  const sql = getSql();

  const reports = (await sql`
    SELECT id, user_id, user_email, title, description, link_slug, priority, status, metadata, handled_by_user_id, handled_by_name, created_at, updated_at
    FROM reports
    WHERE status != 'deleted' AND (${isStaff} OR user_id = ${userId})
    ORDER BY created_at DESC;
  `) as ReportRow[];

  const reportIds = reports.map((report) => report.id);
  const comments = reportIds.length
    ? ((await sql`
        SELECT id, report_id, author_user_id, author_name, body, created_at
        FROM report_comments
        WHERE report_id = ANY(${reportIds}::bigint[])
        ORDER BY created_at ASC;
      `) as ReportCommentRow[])
    : [];

  return Response.json({ reports, comments, isStaff });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const linkSlug = String(body.linkSlug ?? "").trim() || null;
  const priority = parsePriority(body.priority);

  if (!title || !description) {
    return new Response("Title and description are required", { status: 400 });
  }

  // AutoMod Validation
  const autoModResult = await validateContentWithAutoMod(`${title} ${description} ${linkSlug ?? ""}`);
  if (!autoModResult.isClean) {
    return new Response(autoModResult.reason || "Content blocked by AutoMod", { status: 400 });
  }

  await ensureReportSchema();
  const sql = getSql();
  const profileRows = (await sql`
    SELECT report_ban_type, banned_until, limit_hourly, limit_daily
    FROM reporting_profiles
    WHERE user_id = ${userId}
  `) as ReportingProfileRow[];

  const profile = profileRows[0];
  if (profile) {
    const now = new Date();
    const isPermanentlyBanned = profile.report_ban_type === "permanent";
    const isTemporarilyBanned =
      profile.report_ban_type === "temporary" &&
      profile.banned_until !== null &&
      new Date(profile.banned_until) > now;

    if (isPermanentlyBanned || isTemporarilyBanned) {
      return new Response("You are banned from submitting reports.", { status: 403 });
    }

    const counts = ((await sql`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') AS hourly_count,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') AS daily_count
      FROM reports
      WHERE user_id = ${userId}
    `) as { hourly_count: number; daily_count: number }[])[0];

    if (profile.limit_hourly > 0 && counts.hourly_count >= profile.limit_hourly) {
      return new Response(
        `Report limit reached: you may submit up to ${profile.limit_hourly} reports per hour.`,
        { status: 429 }
      );
    }
    if (profile.limit_daily > 0 && counts.daily_count >= profile.limit_daily) {
      return new Response(
        `Report limit reached: you may submit up to ${profile.limit_daily} reports per day.`,
        { status: 429 }
      );
    }
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);

  const rows = (await sql`
    INSERT INTO reports (user_id, user_email, title, description, link_slug, priority, status, metadata)
    VALUES (
      ${userId},
      ${primaryEmail?.emailAddress ?? null},
      ${title},
      ${description},
      ${linkSlug},
      ${priority},
      ${parseStatus("open")},
      ${body.metadata ?? null}
    )
    RETURNING id, user_id, user_email, title, description, link_slug, priority, status, metadata, handled_by_user_id, handled_by_name, created_at, updated_at;
  `) as ReportInsertRow[];

  await logAuditEvent({
    action: "Report submitted",
    details: `${title}${linkSlug ? ` (${linkSlug})` : ""}`,
    actorUserId: userId,
  });

  return Response.json({ report: rows[0] }, { status: 201 });
}
