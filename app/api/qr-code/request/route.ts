import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureQrSchema } from "@/lib/qr-schema";
import { ensureLinkSchema } from "@/lib/link-schema";

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

  if (!hasDatabaseUrl()) {
    return Response.json({
      status: "none",
      directAccess: false,
      canDownload: false,
      adminReason: null,
      canAppeal: false,
      qrCodeAccessEnabled: false,
      isAuthenticated: Boolean(userId),
    });
  }

  await ensureLinkSchema();
  const sql = getSql();

  // Check if link has QR code downloads enabled globally for signed-in users
  let qrCodeAccessEnabled = false;
  try {
    const linkRows = (await sql`
      SELECT qr_code_access_enabled
      FROM redirects
      WHERE slug = ${slug}
      LIMIT 1;
    `) as Array<{ qr_code_access_enabled: boolean | null }>;
    if (linkRows.length > 0) {
      qrCodeAccessEnabled = Boolean(linkRows[0].qr_code_access_enabled);
    }
  } catch {
  }

  if (!userId) {
    return Response.json({
      status: "unauthenticated",
      directAccess: false,
      canDownload: false,
      adminReason: null,
      canAppeal: false,
      qrCodeAccessEnabled,
      isAuthenticated: false,
    });
  }

  const profile = await getAccessProfile(userId);
  const isDirectStaff =
    profile.admin || profile.reportStaff || profile.canManageLinks || profile.canManageReports;

  // Staff and admins always have immediate access
  if (isDirectStaff) {
    return Response.json({
      status: "accepted",
      directAccess: true,
      canDownload: true,
      adminReason: null,
      canAppeal: false,
      qrCodeAccessEnabled,
      isAuthenticated: true,
    });
  }

  // If QR code downloads are enabled for this link, any signed-in user gets immediate download access
  if (qrCodeAccessEnabled) {
    return Response.json({
      status: "accepted",
      directAccess: true,
      canDownload: true,
      adminReason: null,
      canAppeal: false,
      qrCodeAccessEnabled: true,
      isAuthenticated: true,
    });
  }

  // Otherwise, check for user's individual permission request status in the database
  await ensureQrSchema();
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
      qrCodeAccessEnabled: false,
      isAuthenticated: true,
    });
  }

  return Response.json({
    status: latest.status,
    directAccess: false,
    canDownload: latest.status === "accepted",
    adminReason: latest.admin_reason ?? null,
    canAppeal: latest.can_appeal ?? true,
    qrCodeAccessEnabled: false,
    isAuthenticated: true,
  });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized. Please sign in to request QR code download access.", { status: 401 });
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
