import { auth } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { hasDatabaseUrl } from "@/lib/db";
import { normalizeSlug } from "@/lib/normalize";
import { verifyPassword } from "@/lib/password";
import { getRedirectBySlug, recordClick } from "@/lib/redirects";

function parseStoredDate(value: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function getCanOverrideForUser(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) {
    return false;
  }

  const profile = await getAccessProfile(userId);
  return profile.admin;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  if (!hasDatabaseUrl()) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const { slug: rawSlug } = await params;
  const destination = await getRedirectBySlug(rawSlug);

  if (!destination) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const now = new Date();
  const releaseAt = parseStoredDate(destination.release_at);
  const expiresAt = parseStoredDate(destination.expires_at);

  if (releaseAt && now < releaseAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "scheduled" }, { status: 404 });
  }
  if (expiresAt && now > expiresAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "expired" }, { status: 404 });
  }

  if (destination.is_locked) {
    const canOverride = await getCanOverrideForUser();
    return Response.json({ destinationUrl: null, locked: true, canOverride });
  }

  recordClick(rawSlug);

  return Response.json({ destinationUrl: destination.url, locked: false });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  if (!hasDatabaseUrl()) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const { slug: rawSlug } = await params;
  const destination = await getRedirectBySlug(rawSlug);

  if (!destination || !destination.is_locked) {
    return Response.json({ destinationUrl: null }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown; override?: unknown } | null;
  if (!body) {
    return new Response("Invalid request", { status: 400 });
  }

  const password = String(body.password ?? "");
  const requestedOverride = body.override === true || body.override === "true";

  const now = new Date();
  const releaseAt = parseStoredDate(destination.release_at);
  const expiresAt = parseStoredDate(destination.expires_at);
  if (releaseAt && now < releaseAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "scheduled" }, { status: 404 });
  }
  if (expiresAt && now > expiresAt) {
    return Response.json({ destinationUrl: null, inactive: true, reason: "expired" }, { status: 404 });
  }

  if (requestedOverride) {
    const canOverride = await getCanOverrideForUser();
    if (!canOverride) {
      return new Response("Forbidden", { status: 403 });
    }
  } else {
    const isValid = verifyPassword(password, destination.password_hash);
    if (!isValid) {
      return new Response("Invalid password", { status: 401 });
    }
  }

  recordClick(rawSlug);

  return Response.json({ destinationUrl: destination.url, locked: false });
}

