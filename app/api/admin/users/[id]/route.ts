import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCVSDGoRoleMetadata, isAllowedUser } from "@/lib/access";

type RoleUpdateBody = {
  admin?: unknown;
  reportStaff?: unknown;
};

type UserActionBody = {
  action?: unknown;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPrivateMetadataObject(user: { privateMetadata: unknown }) {
  if (!isObject(user.privateMetadata)) return {};
  return user.privateMetadata as Record<string, unknown>;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allowed = await isAllowedUser(userId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as RoleUpdateBody | null;
  if (!body || (!("admin" in body) && !("reportStaff" in body))) {
    return new Response("No role changes provided", { status: 400 });
  }
  if (("admin" in body && typeof body.admin !== "boolean") || ("reportStaff" in body && typeof body.reportStaff !== "boolean")) {
    return new Response("Role values must be boolean", { status: 400 });
  }

  const { id } = await params;
  const client = await clerkClient();
  const target = await client.users.getUser(id);

  const privateMetadata = getPrivateMetadataObject(target);
  const cvsdGo = isObject(privateMetadata.cvsdGo) ? (privateMetadata.cvsdGo as Record<string, unknown>) : {};
  const nextCVSDGo = {
    ...cvsdGo,
    ...(typeof body.admin === "boolean" ? { admin: body.admin } : {}),
    ...(typeof body.reportStaff === "boolean" ? { reportStaff: body.reportStaff } : {}),
  };

  const updated = await client.users.updateUserMetadata(id, {
    privateMetadata: {
      ...privateMetadata,
      cvsdGo: nextCVSDGo,
    },
  });

  const roles = getCVSDGoRoleMetadata(updated);
  return Response.json({ ok: true, roles });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allowed = await isAllowedUser(userId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as UserActionBody | null;
  const action = String(body?.action ?? "");
  if (!action) {
    return new Response("Action is required", { status: 400 });
  }

  const { id } = await params;
  const client = await clerkClient();

  if (id === userId && action === "lock") {
    return new Response("You cannot lock your own account", { status: 400 });
  }

  if (action === "lock") {
    await client.users.lockUser(id);
    return Response.json({ ok: true });
  }
  if (action === "unlock") {
    await client.users.unlockUser(id);
    return Response.json({ ok: true });
  }
  if (action === "force_password_reset") {
    await client.users.setPasswordCompromised(id, { revokeAllSessions: true });
    return Response.json({ ok: true });
  }

  return new Response("Invalid action", { status: 400 });
}
