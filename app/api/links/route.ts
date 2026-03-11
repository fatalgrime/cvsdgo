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
  folder_name: string | null;
  folder_is_public: boolean | null;
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

export async function GET(): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return Response.json({ links: [] }, { status: 200 });
  }

  await ensureLinkSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      r.id,
      r.slug,
      r.url,
      r.description,
      r.click_count,
      r.is_locked,
      r.release_at,
      r.expires_at,
      r.folder_id,
      f.name AS folder_name,
      f.is_public AS folder_is_public
    FROM redirects r
    LEFT JOIN link_folders f ON f.id = r.folder_id
    ORDER BY COALESCE(f.name, ''), r.slug ASC;
  `) as RedirectRow[];

  return Response.json({ links: rows });
}

export async function POST(request: Request): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  await ensureLinkSchema();
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
  if (isLocked && password.length < 4) {
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
    const passwordHash = isLocked ? hashPassword(password) : null;
    const rows = (await sql`
      INSERT INTO redirects (slug, url, description, folder_id, is_locked, password_hash, release_at, expires_at)
      VALUES (${slug}, ${url}, ${description}, ${folderId}, ${isLocked}, ${passwordHash}, ${releaseAt}, ${expiresAt})
      RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at, folder_id;
    `) as (Omit<RedirectRow, "folder_name" | "folder_is_public"> & { folder_name?: string | null; folder_is_public?: boolean | null })[];
    revalidateTag("redirects");
    return Response.json({ link: rows[0] }, { status: 201 });
  } catch (error) {
    const message = (error as { message?: string }).message ?? "";
    if (message.toLowerCase().includes("unique")) {
      return new Response("Slug already exists", { status: 409 });
    }
    throw error;
  }
}
