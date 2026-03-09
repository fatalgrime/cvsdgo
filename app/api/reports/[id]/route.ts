import { auth } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { isReportStaffUser } from "@/lib/access";

type ReportStatusRow = {
  id: number;
  status: string;
  updated_at: string;
};

function parseStatus(value: unknown): string {
  const normalized = String(value ?? "").toLowerCase();
  if (["open", "investigating", "resolved", "closed"].includes(normalized)) {
    return normalized;
  }
  return "";
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

  const sql = getSql();
  const rows = (await sql`
    UPDATE reports
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, status, updated_at;
  `) as ReportStatusRow[];

  if (rows.length === 0) {
    return new Response("Not found", { status: 404 });
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

  const rows = isStaff
    ? ((await sql`
        DELETE FROM reports
        WHERE id = ${id}
        RETURNING id;
      `) as { id: number }[])
    : ((await sql`
        DELETE FROM reports
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id;
      `) as { id: number }[]);

  if (rows.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json({ ok: true });
}
