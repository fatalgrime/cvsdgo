import { revalidateTag } from "next/cache";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { normalizeSlug } from "@/lib/normalize";
import { hashPassword } from "@/lib/password";
import { requireAllowedUser } from "@/lib/access";
import { ensureLinkSchema } from "@/lib/link-schema";

type RedirectRow = {
  id: number;
  slug: string;
  url: string;
  description: string | null;
  click_count: number;
  is_locked: boolean;
  release_at: string | null;
  expires_at: string | null;
  folder_id: number | null;
};

function parseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return null;
  }
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function parseFolderId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  if (!Number.isInteger(next) || next <= 0) {
    return null;
  }
  return next;
}

async function validateFolder(sql: ReturnType<typeof getSql>, folderId: number | null): Promise<boolean> {
  if (folderId === null) return true;
  const rows = (await sql`
    SELECT id
    FROM link_folders
    WHERE id = ${folderId}
    LIMIT 1;
  `) as { id: number }[];
  return rows.length > 0;
}

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
  const slug = normalizeSlug(String(body.slug ?? ""));
  const description = String(body.description ?? "").trim() || null;
  const isLocked = Boolean(body.isLocked);
  const password = String(body.password ?? "").trim();
  const url = parseUrl(String(body.url ?? ""));
  const releaseAt = parseDate(body.releaseAt);
  const expiresAt = parseDate(body.expiresAt);
  const folderId = parseFolderId(body.folderId);

  if (!slug || !url) {
    return new Response("Invalid input", { status: 400 });
  }
  if (body.folderId !== null && body.folderId !== undefined && folderId === null) {
    return new Response("Folder is invalid", { status: 400 });
  }
  if (isLocked && password && password.length < 4) {
    return new Response("Password must be at least 4 characters", { status: 400 });
  }
  if (body.releaseAt && !releaseAt) {
    return new Response("Release time is invalid", { status: 400 });
  }
  if (body.expiresAt && !expiresAt) {
    return new Response("Expiration time is invalid", { status: 400 });
  }
  if (releaseAt && expiresAt && releaseAt >= expiresAt) {
    return new Response("Release time must be before expiration time", { status: 400 });
  }

  const sql = getSql();
  const folderExists = await validateFolder(sql, folderId);
  if (!folderExists) {
    return new Response("Folder not found", { status: 404 });
  }

  try {
    if (!isLocked) {
      const rows = (await sql`
        UPDATE redirects
        SET slug = ${slug}, url = ${url}, description = ${description}, folder_id = ${folderId}, is_locked = false, password_hash = NULL, release_at = ${releaseAt}, expires_at = ${expiresAt}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at, folder_id;
      `) as RedirectRow[];

      if (rows.length === 0) {
        return new Response("Not found", { status: 404 });
      }

      revalidateTag("redirects");
      return Response.json({ link: rows[0] });
    }

    if (password) {
      const passwordHash = hashPassword(password);
      const rows = (await sql`
        UPDATE redirects
        SET slug = ${slug}, url = ${url}, description = ${description}, folder_id = ${folderId}, is_locked = true, password_hash = ${passwordHash}, release_at = ${releaseAt}, expires_at = ${expiresAt}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at, folder_id;
      `) as RedirectRow[];

      if (rows.length === 0) {
        return new Response("Not found", { status: 404 });
      }

      revalidateTag("redirects");
      return Response.json({ link: rows[0] });
    }

    const existing = (await sql`
      SELECT password_hash
      FROM redirects
      WHERE id = ${id};
    `) as { password_hash: string | null }[];

    if (existing.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    if (!existing[0].password_hash) {
      return new Response("Password required to lock this link", { status: 400 });
    }

    const rows = (await sql`
      UPDATE redirects
      SET slug = ${slug}, url = ${url}, description = ${description}, folder_id = ${folderId}, is_locked = true, release_at = ${releaseAt}, expires_at = ${expiresAt}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at, folder_id;
    `) as RedirectRow[];

    if (rows.length === 0) {
      return new Response("Not found", { status: 404 });
    }

    revalidateTag("redirects");
    return Response.json({ link: rows[0] });
  } catch (error) {
    const message = (error as { message?: string }).message ?? "";
    if (message.toLowerCase().includes("unique")) {
      return new Response("Slug already exists", { status: 409 });
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
  const rows = (await sql`
    DELETE FROM redirects
    WHERE id = ${id}
    RETURNING id;
  `) as { id: number }[];

  if (rows.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  revalidateTag("redirects");
  return Response.json({ ok: true });
}
