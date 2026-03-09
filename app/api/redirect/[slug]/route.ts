import { getSql, hasDatabaseUrl } from "@/lib/db";
import { normalizeSlug } from "@/lib/normalize";
import { verifyPassword } from "@/lib/password";

type RedirectDestinationRow = {
  url: string;
  is_locked: boolean;
  password_hash: string | null;
  release_at: Date | null;
  expires_at: Date | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  if (!hasDatabaseUrl()) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const sql = getSql();
  const rows = (await sql`
    SELECT url, is_locked, release_at, expires_at
    FROM redirects
    WHERE slug = ${slug};
  `) as RedirectDestinationRow[];

  if (rows.length === 0) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const now = new Date();
  const releaseAt = rows[0].release_at as Date | null;
  const expiresAt = rows[0].expires_at as Date | null;
  if (releaseAt && now < releaseAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "scheduled" }, { status: 404 });
  }
  if (expiresAt && now > expiresAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "expired" }, { status: 404 });
  }

  if (rows[0].is_locked) {
    return Response.json({ destinationUrl: null, locked: true });
  }

  await sql`
    UPDATE redirects
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE slug = ${slug};
  `;

  return Response.json({ destinationUrl: rows[0].url, locked: false });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  if (!hasDatabaseUrl()) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const body = await request.json();
  const password = String(body.password ?? "");

  const sql = getSql();
  const rows = (await sql`
    SELECT url, password_hash, release_at, expires_at
    FROM redirects
    WHERE slug = ${slug} AND is_locked = true;
  `) as RedirectDestinationRow[];

  if (rows.length === 0) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const now = new Date();
  const releaseAt = rows[0].release_at as Date | null;
  const expiresAt = rows[0].expires_at as Date | null;
  if (releaseAt && now < releaseAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "scheduled" }, { status: 404 });
  }
  if (expiresAt && now > expiresAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "expired" }, { status: 404 });
  }

  const isValid = verifyPassword(password, rows[0].password_hash);
  if (!isValid) {
    return new Response("Invalid password", { status: 401 });
  }

  await sql`
    UPDATE redirects
    SET click_count = COALESCE(click_count, 0) + 1
    WHERE slug = ${slug};
  `;

  return Response.json({ destinationUrl: rows[0].url, locked: false });
}
