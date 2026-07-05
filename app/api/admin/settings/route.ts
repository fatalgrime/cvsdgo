import { auth } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureAuditSchema, getRequestContext, logAuditEvent } from "@/lib/audit";
import { canEditDiscordWebhook, isAllowedUser } from "@/lib/access";

type SettingsRequestBody = {
  settingKey?: unknown;
  settingValue?: unknown;
  action?: unknown;
};

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
  const canEdit = canEditDiscordWebhook(userId);
  if (!canEdit && typeof settings.discord_webhook_url === "string") {
    settings.discord_webhook_url = settings.discord_webhook_url.replace(/.(?=.{4,}$)/g, "•");
  }
  const logs = (await sql`
    SELECT id, action, details, actor_user_id, actor_username, actor_has_discord_account, actor_has_login_account, actor_ip_address, actor_user_agent, metadata, severity, category, source, created_at
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
    actor_ip_address: string | null;
    actor_user_agent: string | null;
    metadata: Record<string, unknown> | null;
    severity: string | null;
    category: string | null;
    source: string | null;
    created_at: string;
  }>;
  const health = {
    databaseConfigured: hasDatabaseUrl(),
    webhookConfigured: Boolean(settings.discord_webhook_url),
    auditLogEntries: logs.length,
    latestActivityAt: logs[0]?.created_at ?? null,
  };

  return Response.json({ settings, auditLogs: logs, canEditWebhook: canEdit, health });
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
  const body = (await request.json().catch(() => null)) as SettingsRequestBody | null;
  const action = String(body?.action ?? "").trim();
  const settingKey = String(body?.settingKey ?? "").trim();
  const settingValue = String(body?.settingValue ?? "").trim();
  const context = getRequestContext(request);

  if (!settingKey && action !== "revert") return new Response("Invalid setting", { status: 400 });

  if (settingKey === "discord_webhook_url" && !canEditDiscordWebhook(userId)) {
    return new Response("Only drevmourn can edit the Discord webhook URL.", { status: 403 });
  }

  const sql = getSql();
  let nextValue = settingValue;

  if (action === "revert") {
    const previous = (await sql`
      SELECT setting_value
      FROM site_settings
      WHERE setting_key = ${settingKey || "discord_webhook_url"}
      ORDER BY updated_at DESC
      LIMIT 1;
    `) as { setting_value: string }[];

    if (previous.length === 0) {
      return new Response("No previous value found", { status: 404 });
    }

    nextValue = previous[0].setting_value;
  }

  const current = (await sql`
    SELECT setting_value
    FROM site_settings
    WHERE setting_key = ${settingKey || "discord_webhook_url"}
    LIMIT 1;
  `) as { setting_value: string }[];
  const previousValue = current[0]?.setting_value ?? null;

  await sql`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES (${settingKey || "discord_webhook_url"}, ${nextValue}, NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW();
  `;

  await logAuditEvent({
    action: action === "revert" ? "Settings reverted" : "Settings updated",
    details: `${settingKey || "discord_webhook_url"} ${action === "revert" ? "reverted" : "updated"}`,
    actorUserId: userId,
    metadata: {
      settingKey: settingKey || "discord_webhook_url",
      previousValue,
      newValue: nextValue,
      reverted: action === "revert",
    },
    severity: action === "revert" ? "warning" : "info",
    category: "settings",
    source: "admin-settings",
    actorIpAddress: context.actorIpAddress,
    actorUserAgent: context.actorUserAgent,
  });

  return Response.json({ ok: true });
}
