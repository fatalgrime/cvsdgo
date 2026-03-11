import { revalidateTag } from "next/cache";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { requireAllowedUser } from "@/lib/access";
import { ensureLinkSchema } from "@/lib/link-schema";
import type { LinkFolderRow } from "@/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  await ensureLinkSchema();
  const { id } = await params;
  const body = await request.json();

  const name = body.name === undefined ? undefined : String(body.name ?? "").trim();
  const isPublic = body.isPublic === undefined ? undefined : Boolean(body.isPublic);

  if (name !== undefined && !name) {
    return new Response("Folder name is required", { status: 400 });
  }

  if (name === undefined && isPublic === undefined) {
    return new Response("Nothing to update", { status: 400 });
  }

  const sql = getSql();
  try {
    const rows = (await sql`
      UPDATE link_folders
      SET
        name = COALESCE(${name ?? null}, name),
        is_public = COALESCE(${isPublic ?? null}, is_public),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, is_public, created_at, updated_at;
    `) as LinkFolderRow[];

    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    revalidateTag("redirects");
    return Response.json({ folder: rows[0] });
  } catch (error) {
    const message = (error as { message?: string }).message ?? "";
    if (message.toLowerCase().includes("unique")) {
      return new Response("Folder already exists", { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  await ensureLinkSchema();
  const { id } = await params;
  const sql = getSql();

  const inUse = (await sql`
    SELECT id
    FROM redirects
    WHERE folder_id = ${id}
    LIMIT 1;
  `) as { id: number }[];

  if (inUse.length > 0) {
    return new Response("Folder has links assigned. Move links first.", { status: 409 });
  }

  const rows = (await sql`
    DELETE FROM link_folders
    WHERE id = ${id}
    RETURNING id;
  `) as { id: number }[];

  if (rows.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  revalidateTag("redirects");
  return Response.json({ ok: true });
}
