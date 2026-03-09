import { getSql, hasDatabaseUrl } from "@/lib/db";
import { normalizeSlug } from "@/lib/normalize";
import { hashPassword } from "@/lib/password";
import { requireAllowedUser } from "@/lib/access";

type RedirectRow = {
  id: number;
  slug: string;
  url: string;
  description: string | null;
  click_count: number;
  is_locked: boolean;
  release_at: string | null;
  expires_at: string | null;
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

export async function GET(): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return Response.json({ links: [] }, { status: 200 });
  }

  const sql = getSql();
  const rows = (await sql`
    SELECT id, slug, url, description, click_count, is_locked, release_at, expires_at
    FROM redirects
    ORDER BY slug ASC;
  `) as RedirectRow[];

  return Response.json({ links: rows });
}

export async function POST(request: Request): Promise<Response> {
  const authError = await requireAllowedUser();
  if (authError) return authError;

  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  const body = await request.json();
  const slug = normalizeSlug(String(body.slug ?? ""));
  const description = String(body.description ?? "").trim() || null;
  const isLocked = Boolean(body.isLocked);
  const password = String(body.password ?? "").trim();
  const url = parseUrl(String(body.url ?? ""));
  const releaseAt = parseDate(body.releaseAt);
  const expiresAt = parseDate(body.expiresAt);

  if (!slug || !url) {
    return new Response("Invalid input", { status: 400 });
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
  try {
    const passwordHash = isLocked ? hashPassword(password) : null;
    const rows = (await sql`
      INSERT INTO redirects (slug, url, description, is_locked, password_hash, release_at, expires_at)
      VALUES (${slug}, ${url}, ${description}, ${isLocked}, ${passwordHash}, ${releaseAt}, ${expiresAt})
      RETURNING id, slug, url, description, click_count, is_locked, release_at, expires_at;
    `) as RedirectRow[];
    return Response.json({ link: rows[0] }, { status: 201 });
  } catch (error) {
    const message = (error as { message?: string }).message ?? "";
    if (message.toLowerCase().includes("unique")) {
      return new Response("Slug already exists", { status: 409 });
    }
    throw error;
  }
}
