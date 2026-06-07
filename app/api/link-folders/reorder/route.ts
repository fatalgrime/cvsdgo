import { revalidateTag } from "next/cache";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { requireAllowedUser } from "@/lib/access";
import { ensureLinkSchema } from "@/lib/link-schema";

export async function POST(request: Request): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  await ensureLinkSchema();
  const body = (await request.json()) as { orderedIds?: unknown };
  const orderedIds = Array.isArray(body.orderedIds)
    ? (body.orderedIds as unknown[]).map((id) => Number(id))
    : [];

  if (orderedIds.length === 0 || !orderedIds.every((id) => Number.isInteger(id) && id > 0)) {
    return new Response("Invalid folder order", { status: 400 });
  }

  const sql = getSql();

  for (const [sortOrder, folderId] of orderedIds.entries()) {
    await sql`
      UPDATE link_folders
      SET sort_order = ${sortOrder}, updated_at = NOW()
      WHERE id = ${folderId};
    `;
  }

  revalidateTag("redirects");
  return Response.json({ ok: true });
}
