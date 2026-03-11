import { revalidateTag } from "next/cache";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { requireAllowedUser } from "@/lib/access";
import { ensureLinkSchema } from "@/lib/link-schema";
import type { LinkFolderRow } from "@/lib/types";

export async function GET(): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return Response.json({ folders: [] }, { status: 200 });
  }

  await ensureLinkSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, name, is_public, created_at, updated_at
    FROM link_folders
    ORDER BY name ASC;
  `) as LinkFolderRow[];

  return Response.json({ folders: rows });
}

export async function POST(request: Request): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  await ensureLinkSchema();
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const isPublic = body.isPublic === undefined ? true : Boolean(body.isPublic);

  if (!name) {
    return new Response("Folder name is required", { status: 400 });
  }

  const sql = getSql();
  try {
    const rows = (await sql`
      INSERT INTO link_folders (name, is_public)
      VALUES (${name}, ${isPublic})
      RETURNING id, name, is_public, created_at, updated_at;
    `) as LinkFolderRow[];

    revalidateTag("redirects");
    return Response.json({ folder: rows[0] }, { status: 201 });
  } catch (error) {
    const message = (error as { message?: string }).message ?? "";
    if (message.toLowerCase().includes("unique")) {
      return new Response("Folder already exists", { status: 409 });
    }
    throw error;
  }
}
