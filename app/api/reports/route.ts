import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { isReportStaffUser } from "@/lib/access";
import type { ReportCommentRow, ReportRow } from "@/lib/types";

type ReportInsertRow = ReportRow;

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
    SELECT id, user_id, user_email, title, description, link_slug, priority, status, metadata, created_at, updated_at
    FROM reports
    WHERE ${isStaff} OR user_id = ${userId}
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

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);

  const sql = getSql();
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
    RETURNING id, user_id, user_email, title, description, link_slug, priority, status, metadata, created_at, updated_at;
  `) as ReportInsertRow[];

  return Response.json({ report: rows[0] }, { status: 201 });
}
