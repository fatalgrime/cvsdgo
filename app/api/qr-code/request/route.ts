import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureQrSchema } from "@/lib/qr-schema";

type QrRequestRow = {
  id: number;
  link_slug: string;
  user_id: string;
  status: "pending" | "accepted" | "declined";
  admin_reason: string | null;
  can_appeal: boolean;
  created_at: string;
};

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase() ?? "";

  if (!slug) {
    return Response.json({ error: "Missing slug" }, { status: 400 });
  }

  const { userId } = await auth();
  const profile = await getAccessProfile(userId);

  const isDirectStaff =
    profile.admin || profile.reportStaff || profile.canManageLinks || profile.canManageReports;

  if (isDirectStaff) {
    return Response.json({
      status: "accepted",
      directAccess: true,
      canDownload: true,
      adminReason: null,
      canAppeal: false,
    });
  }

  if (!userId || !hasDatabaseUrl()) {
    return Response.json({
      status: "none",
      directAccess: false,
      canDownload: false,
      adminReason: null,
      canAppeal: false,
    });
  }

  await ensureQrSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, link_slug, user_id, status, admin_reason, can_appeal, created_at
    FROM qr_code_requests
    WHERE link_slug = ${slug} AND user_id = ${userId}
    ORDER BY id DESC
    LIMIT 1;
  `) as QrRequestRow[];

  const latest = rows[0] ?? null;

  if (!latest) {
    return Response.json({
      status: "none",
      directAccess: false,
      canDownload: false,
      adminReason: null,
      canAppeal: false,
    });
  }

  return Response.json({
    status: latest.status,
    directAccess: false,
    canDownload: latest.status === "accepted",
    adminReason: latest.admin_reason ?? null,
    canAppeal: latest.can_appeal ?? true,
  });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return new Response("Database unavailable", { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { slug?: string } | null;
  const slug = body?.slug?.trim().toLowerCase();
  if (!slug) {
    return new Response("Missing slug parameter", { status: 400 });
  }

  await ensureQrSchema();
  const sql = getSql();

  let userEmail = "";
  let userName = "";
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    userEmail = user.emailAddresses[0]?.emailAddress ?? "";
    userName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || userEmail;
  } catch {
  }

  const existing = (await sql`
    SELECT id, status
    FROM qr_code_requests
    WHERE link_slug = ${slug} AND user_id = ${userId}
    ORDER BY id DESC
    LIMIT 1;
  `) as QrRequestRow[];

  if (existing[0]?.status === "pending") {
    return Response.json({ status: "pending", message: "Request already pending" });
  }
  if (existing[0]?.status === "accepted") {
    return Response.json({ status: "accepted", message: "Access already granted" });
  }

  await sql`
    INSERT INTO qr_code_requests (link_slug, user_id, user_email, user_name, status, can_appeal)
    VALUES (${slug}, ${userId}, ${userEmail}, ${userName}, 'pending', true);
  `;

  return Response.json({ status: "pending", message: "Request submitted for admin review" });
}
