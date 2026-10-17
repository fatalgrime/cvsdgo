import { submitReport } from "@/lib/report-submissions";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureReportSchema } from "@/lib/report-schema";
import { isReportStaffUser } from "@/lib/access";
import { logAuditEvent } from "@/lib/audit";
import { validateContentWithAutoMod } from "@/lib/automod";
import type { ReportCommentRow, ReportRow } from "@/lib/types";

function parsePriority(value: unknown): string {
  const normalized = String(value ?? "normal").toLowerCase();
  if (["low", "normal", "high", "urgent"].includes(normalized)) {
    return normalized;
  }
  return "normal";
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
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primaryEmail = user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId);

  const result = await submitReport({
    userId, email: primaryEmail?.emailAddress ?? null, title, description,
    linkSlug, priority, metadata: body.metadata ?? null,
  });
  if (result.reason === "banned") {
    return new Response("You are banned from submitting reports.", { status: 403 });
  }
  if (result.reason) {
    return new Response(`Report ${result.reason} limit reached. Please try again later.`, { status: 429 });
  }

  await logAuditEvent({
    action: "Report submitted",
    details: `${title}${linkSlug ? ` (${linkSlug})` : ""}`,
    actorUserId: userId,
  });

  return Response.json({ report: result.report }, { status: 201 });
}
