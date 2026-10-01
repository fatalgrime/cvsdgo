import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureReportSchema } from "@/lib/report-schema";
import { isReportStaffUser } from "@/lib/access";
import { getRequestContext, logAuditEvent } from "@/lib/audit";

type ReportStatusRow = {
  id: number;
  status: string;
  updated_at: string;
};

function parseStatus(value: unknown): string {
  const normalized = String(value ?? "").toLowerCase();
  if (["open", "investigating", "resolved", "closed", "rejected", "deleted"].includes(normalized)) {
    return normalized;
  }
  return "";
}

function getDisplayName(firstName: string | null, lastName: string | null, username: string | null): string {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (username) return username;
  return "Staff user";
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  const isStaff = await isReportStaffUser(userId);
  if (!isStaff) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const context = getRequestContext(request);
  const status = parseStatus(body.status);

  if (!status) {
    return new Response("Invalid status", { status: 400 });
  }

  const client = await clerkClient();
  const handler = await client.users.getUser(userId);
  const handlerName = getDisplayName(handler.firstName, handler.lastName, handler.username);

  const sql = getSql();
  const rows = (await sql`
    UPDATE reports
    SET status = ${status}, handled_by_user_id = ${userId}, handled_by_name = ${handlerName}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, user_id, status, updated_at;
  `) as ReportStatusRow & { user_id: string }[];

  if (rows.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const updatedReport = rows[0];
  await logAuditEvent({
    action: `Report ${status}`,
    details: `Report #${id} changed to ${status}`,
    actorUserId: userId,
    severity: status === "rejected" || status === "deleted" ? "warning" : "info",
    category: "reports",
    source: "reporting",
    actorIpAddress: context.actorIpAddress,
    actorUserAgent: context.actorUserAgent,
  });

  if (status === "rejected") {
    await ensureReportSchema();
    await sql`
      WITH inserted_strike AS (
        INSERT INTO report_strikes (user_id, report_id, reason, strike_type, points)
        VALUES (${updatedReport.user_id}, ${id}, 'Report rejected by staff', 'rejected', 1)
        ON CONFLICT (report_id, strike_type) WHERE report_id IS NOT NULL DO NOTHING
        RETURNING user_id
      )
      INSERT INTO reporting_profiles (
        user_id, report_ban_type, banned_until, limit_hourly, limit_daily, strikes, last_strike_at
      )
      SELECT user_id, 'none', NULL, 0, 0, 1, NOW()
      FROM inserted_strike
      ON CONFLICT (user_id) DO UPDATE SET
        strikes = reporting_profiles.strikes + 1,
        last_strike_at = NOW(),
        report_ban_type = CASE
          WHEN reporting_profiles.strikes + 1 >= 10 THEN 'permanent'
          WHEN reporting_profiles.strikes + 1 >= 5 THEN 'temporary'
          ELSE reporting_profiles.report_ban_type
        END,
        banned_until = CASE
          WHEN reporting_profiles.strikes + 1 >= 10 THEN NULL
          WHEN reporting_profiles.strikes + 1 >= 5 THEN NOW() + INTERVAL '24 hours'
          ELSE reporting_profiles.banned_until
        END,
        updated_at = NOW();
    `;
  }

  return Response.json({ report: rows[0] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  const isStaff = await isReportStaffUser(userId);
  const { id } = await params;
  const context = getRequestContext(_request);
  const sql = getSql();

  if (isStaff) {
    const client = await clerkClient();
    const handler = await client.users.getUser(userId);
    const handlerName = getDisplayName(handler.firstName, handler.lastName, handler.username);

    const rows = (await sql`
      UPDATE reports
      SET status = 'deleted', handled_by_user_id = ${userId}, handled_by_name = ${handlerName}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id;
    `) as { id: number }[];

    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    await logAuditEvent({
      action: "Report deleted",
      details: `Report #${id} deleted`,
      actorUserId: userId,
      severity: "warning",
      category: "reports",
      source: "reporting",
      actorIpAddress: context.actorIpAddress,
      actorUserAgent: context.actorUserAgent,
    });
    return Response.json({ ok: true });
  }

  const rows = (await sql`
    DELETE FROM reports
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id;
  `) as { id: number }[];

  if (rows.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json({ ok: true });
}
