import { auth } from "@clerk/nextjs/server";
import { getRequestContext, logAuditEvent } from "@/lib/audit";
import { requireAdminUser } from "@/lib/access";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureAnnouncementSchema, getAnnouncements } from "@/lib/announcements";
import { parseAnnouncement, type Announcement } from "@/lib/announcement-types";

export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  const denied = await requireAdminUser();
  if (denied) return denied;
  return Response.json({ announcements: await getAnnouncements(true, true), storageAvailable: hasDatabaseUrl() }, { headers: { "Cache-Control": "no-store" } });
}
async function mutate(request: Request, action: "create" | "update" | "delete"): Promise<Response> {
  const denied = await requireAdminUser();
  if (denied) return denied;
  if (!hasDatabaseUrl()) return new Response("Database unavailable", { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return new Response("Invalid request", { status: 400 });
  const id = body.id;
  if (action !== "create" && (typeof id !== "string" || !/^[1-9]\d{0,18}$/.test(id) || BigInt(id) > BigInt("9223372036854775807"))) {
    return new Response("Invalid announcement ID", { status: 400 });
  }
  const input = action === "delete" ? null : parseAnnouncement(body);
  if (action !== "delete" && !input) return new Response("Provide a title (1–100 characters), message (1–1000 characters), and valid settings.", { status: 400 });
  await ensureAnnouncementSchema();
  const sql = getSql();
  const { userId } = await auth();
  let rows;
  if (action === "delete") {
    rows = await sql`DELETE FROM announcements WHERE id = ${id} RETURNING id::text, title, message, tone, audience, dismissible, published, revision;`;
  } else if (action === "update" && input) {
    rows = await sql`
      UPDATE announcements SET title = ${input.title}, message = ${input.message}, tone = ${input.tone},
        audience = ${input.audience}, dismissible = ${input.dismissible}, published = ${input.published}, revision = revision + 1, updated_at = NOW()
      WHERE id = ${id} RETURNING id::text, title, message, tone, audience, dismissible, published, revision;
    `;
  } else if (input) {
    rows = await sql`
      INSERT INTO announcements (title, message, tone, audience, dismissible, published)
      VALUES (${input.title}, ${input.message}, ${input.tone}, ${input.audience}, ${input.dismissible}, ${input.published}) RETURNING id::text, title, message, tone, audience, dismissible, published, revision;
    `;
  }
  if (!(rows as unknown[])?.length) return new Response("Announcement not found", { status: 404 });
  const saved = (rows as Announcement[])[0];
  await logAuditEvent({
    action: action === "create" ? "Announcement created" : action === "delete" ? "Announcement deleted" : "Announcement updated",
    details: `${saved.title} (${saved.published ? "published" : "draft"}; ${saved.audience}; ${saved.dismissible ? "dismissible" : "always visible"})`,
    actorUserId: userId,
    category: "announcements",
    source: "admin-announcements",
    severity: action === "delete" ? "warning" : "info",
    metadata: { announcement: saved },
    ...getRequestContext(request),
  });
  return Response.json({ ok: true }, { status: action === "create" ? 201 : 200 });
}
export const POST = (request: Request) => mutate(request, "create");
export const PUT = (request: Request) => mutate(request, "update");
export const DELETE = (request: Request) => mutate(request, "delete");
