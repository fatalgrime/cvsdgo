import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureQrSchema } from "@/lib/qr-schema";
import { logAuditEvent } from "@/lib/audit";

type QrRequestRowAdmin = {
  id: number;
  link_slug: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  status: "pending" | "accepted" | "declined";
  admin_reason: string | null;
  can_appeal: boolean;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  const profile = await getAccessProfile(userId);

  if (!profile.admin && !profile.reportStaff && !profile.canManageLinks) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!hasDatabaseUrl()) {
    return Response.json({ requests: [] });
  }

  await ensureQrSchema();
  const sql = getSql();
  const requests = (await sql`
    SELECT id, link_slug, user_id, user_email, user_name, status, admin_reason, can_appeal, reviewed_by_user_id, reviewed_by_name, created_at, updated_at
    FROM qr_code_requests
    ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, id DESC
    LIMIT 100;
  `) as QrRequestRowAdmin[];

  return Response.json({ requests });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await getAccessProfile(userId);

  if (!profile.admin && !profile.reportStaff && !profile.canManageLinks) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!hasDatabaseUrl()) {
    return new Response("Database unavailable", { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    requestId?: number;
    status?: "accepted" | "declined";
    adminReason?: string;
    canAppeal?: boolean;
  } | null;

  if (!body?.requestId || !body?.status) {
    return new Response("Invalid request payload", { status: 400 });
  }

  let reviewerName = "";
  try {
    const client = await clerkClient();
    const reviewer = await client.users.getUser(userId);
    reviewerName = [reviewer.firstName, reviewer.lastName].filter(Boolean).join(" ").trim() || reviewer.username || "";
  } catch {
  }

  await ensureQrSchema();
  const sql = getSql();

  const adminReason = body.adminReason?.trim() ?? null;
  const canAppeal = body.canAppeal !== false;

  await sql`
    UPDATE qr_code_requests
    SET status = ${body.status},
        admin_reason = ${adminReason},
        can_appeal = ${canAppeal},
        reviewed_by_user_id = ${userId},
        reviewed_by_name = ${reviewerName},
        updated_at = NOW()
    WHERE id = ${body.requestId};
  `;

  await logAuditEvent({
    action: `QR Download Access ${body.status === "accepted" ? "Accepted" : "Declined"}`,
    details: `Admin ${body.status} request #${body.requestId} ${adminReason ? `(Reason: ${adminReason})` : ""}`,
    actorUserId: userId,
    severity: body.status === "declined" ? "warning" : "info",
    category: "qr-requests",
  });

  return Response.json({ success: true, status: body.status });
}
