import { auth } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureAuditSchema } from "@/lib/audit";
import { canEditDiscordWebhook, isAllowedUser } from "@/lib/access";

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const allowed = await isAllowedUser(userId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  if (!hasDatabaseUrl()) {
    return Response.json({ settings: {}, auditLogs: [] });
  }

  await ensureAuditSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT setting_key, setting_value
    FROM site_settings
    ORDER BY setting_key ASC;
  `) as { setting_key: string; setting_value: string }[];
  const settings = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]));
  const logs = (await sql`
    SELECT id, action, details, actor_user_id, actor_username, actor_has_discord_account, actor_has_login_account, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 100;
  `) as Array<{
    id: number;
    action: string;
    details: string | null;
    actor_user_id: string | null;
    actor_username: string | null;
    actor_has_discord_account: boolean;
    actor_has_login_account: boolean;
    created_at: string;
  }>;

  return Response.json({ settings, auditLogs: logs, canEditWebhook: canEditDiscordWebhook(userId) });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const allowed = await isAllowedUser(userId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  if (!hasDatabaseUrl()) {
    return new Response("Database not configured", { status: 500 });
  }

  await ensureAuditSchema();
  const body = await request.json();
  const settingKey = String(body.settingKey ?? "").trim();
  const settingValue = String(body.settingValue ?? "").trim();

  if (!settingKey) return new Response("Invalid setting", { status: 400 });

  if (settingKey === "discord_webhook_url" && !canEditDiscordWebhook(userId)) {
    return new Response("Only drevmourn can edit the Discord webhook URL.", { status: 403 });
  }

  const sql = getSql();
  await sql`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES (${settingKey}, ${settingValue}, NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW();
  `;

  await (await import("@/lib/audit")).logAuditEvent({
    action: "Settings updated",
    details: `${settingKey} updated`,
    actorUserId: userId,
  });

  return Response.json({ ok: true });
}
