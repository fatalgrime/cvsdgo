import { auth, clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureReportSchema } from "@/lib/report-schema";
import { isReportStaffUser } from "@/lib/access";

type ReportStatusRow = {
  id: number;
  status: string;
  updated_at: string;
};

type ReportingProfileRow = {
  user_id: string;
  report_ban_type: string;
  banned_until: string | null;
  limit_hourly: number;
  limit_daily: number;
  strikes: number;
  last_strike_at: string | null;
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
  if (status === "rejected") {
    await ensureReportSchema();

    const profileRows = (await sql`
      SELECT user_id, report_ban_type, banned_until, limit_hourly, limit_daily, strikes, last_strike_at
      FROM reporting_profiles
      WHERE user_id = ${updatedReport.user_id}
    `) as ReportingProfileRow[];

    const currentProfile = profileRows[0] ?? {
      user_id: updatedReport.user_id,
      report_ban_type: "none",
      banned_until: null,
      limit_hourly: 0,
      limit_daily: 0,
      strikes: 0,
      last_strike_at: null,
    };

    const nextStrikeCount = currentProfile.strikes + 1;
    const nextBanType = nextStrikeCount >= 10 ? "permanent" : nextStrikeCount >= 5 ? "temporary" : currentProfile.report_ban_type;
    const nextBannedUntil = nextBanType === "temporary" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;

    if (profileRows.length > 0) {
      await sql`
        UPDATE reporting_profiles
        SET strikes = ${nextStrikeCount}, last_strike_at = NOW(), report_ban_type = ${nextBanType}, banned_until = ${nextBannedUntil}, updated_at = NOW()
        WHERE user_id = ${updatedReport.user_id};
      `;
    } else {
      await sql`
        INSERT INTO reporting_profiles (user_id, report_ban_type, banned_until, limit_hourly, limit_daily, strikes, last_strike_at)
        VALUES (${updatedReport.user_id}, ${nextBanType}, ${nextBannedUntil}, 0, 0, ${nextStrikeCount}, NOW());
      `;
    }

    await sql`
      INSERT INTO report_strikes (user_id, report_id, reason, strike_type, points)
      VALUES (${updatedReport.user_id}, ${id}, 'Report rejected by staff', 'rejected', 1);
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
