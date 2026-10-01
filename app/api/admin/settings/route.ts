import { auth } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureAuditSchema, getRequestContext, logAuditEvent, resolveAuditActorInfo } from "@/lib/audit";
import { canEditDiscordWebhook, getAccessProfile, isAllowedUser } from "@/lib/access";

type SettingsRequestBody = {
  settingKey?: unknown;
  settingValue?: unknown;
  action?: unknown;
};

function sanitizeAuditMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata || metadata.settingKey !== "discord_webhook_url") return metadata;
  const { previousValue: _previousValue, newValue: _newValue, ...safeMetadata } = metadata;
  void _previousValue;
  void _newValue;
  return safeMetadata;
}

function redactIpAddress(value: string | null): string | null {
  if (!value) return null;
  const ipAddress = value.trim();
  const ipv4Match = ipAddress.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    return `${ipv4Match[1]}.${ipv4Match[2]}.x.x`;
  }

  const mappedIpv4Match = ipAddress.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
  if (mappedIpv4Match) {
    return `::ffff:${mappedIpv4Match[1]}.${mappedIpv4Match[2]}.x.x`;
  }

  if (ipAddress.includes(":")) {
    const visibleGroups = ipAddress.split(":").filter(Boolean).slice(0, 2);
    return visibleGroups.length ? `${visibleGroups.join(":")}:…:redacted` : "IPv6 redacted";
  }

  return "Redacted";
}

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const allowed = await isAllowedUser(userId);
  if (!allowed) return new Response("Forbidden", { status: 403 });

  if (!hasDatabaseUrl()) {
    return Response.json({ settings: {}, auditLogs: [] });
  }

  await ensureAuditSchema();
  const accessProfile = await getAccessProfile(userId);
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
    SELECT id, action, details, actor_user_id, actor_username, actor_email, actor_discord_username, actor_discord_user_id, actor_has_discord_account, actor_has_login_account, actor_ip_address, actor_user_agent, metadata, severity, category, source, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 100;
  `) as Array<{
    id: number;
    action: string;
    details: string | null;
    actor_user_id: string | null;
    actor_username: string | null;
    actor_email: string | null;
    actor_discord_username: string | null;
    actor_discord_user_id: string | null;
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
  const missingActorIds = [...new Set(logs.filter((log) => {
    if (!log.actor_user_id) return false;
    const usernameIsEmail = Boolean(log.actor_username && log.actor_email && log.actor_username.toLowerCase() === log.actor_email.toLowerCase());
    return !log.actor_username || usernameIsEmail || (log.actor_has_discord_account && !log.actor_discord_username);
  }).map((log) => log.actor_user_id as string))];
  const actorEntries = await Promise.all(missingActorIds.slice(0, 25).map(async (id) => [id, await resolveAuditActorInfo(id)] as const));
  const actorMap = new Map(actorEntries);
  const enrichedLogs = logs.map((log) => {
    const actor = log.actor_user_id ? actorMap.get(log.actor_user_id) : null;
    const enriched = actor ? {
      ...log,
      actor_username: actor.username,
      actor_email: actor.email,
      actor_discord_username: actor.discordUsername,
      actor_discord_user_id: actor.discordUserId,
      actor_has_discord_account: actor.hasDiscordAccount,
      actor_has_login_account: actor.hasLoginAccount,
    } : log;
    const username = enriched.actor_username?.trim() || null;
    const email = enriched.actor_email?.trim() || null;
    const safeUsername = username && (!email || username.toLowerCase() !== email.toLowerCase()) && !username.includes("@")
      ? username
      : null;
    return {
      ...enriched,
      actor_username: safeUsername,
      actor_email: null,
      actor_ip_address: redactIpAddress(enriched.actor_ip_address),
      metadata: sanitizeAuditMetadata(enriched.metadata),
    };
  });
  const webhookDeliveryValue = settings.discord_webhook_last_delivery_ok;
  const health = {
    databaseConfigured: hasDatabaseUrl(),
    webhookConfigured: Boolean(settings.discord_webhook_url),
    webhookOperational: webhookDeliveryValue === "true" ? true : webhookDeliveryValue === "false" ? false : null,
    webhookLastDeliveryAt: settings.discord_webhook_last_delivery_at ?? null,
    auditLogEntries: logs.length,
    latestActivityAt: logs[0]?.created_at ?? null,
  };

  return Response.json({ settings, auditLogs: enrichedLogs, canEditWebhook: canEdit, canEditPolicies: accessProfile.admin, health });
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
  const resolvedSettingKey = settingKey || (action === "revert" ? "discord_webhook_url" : "");

  if (resolvedSettingKey !== "discord_webhook_url") return new Response("Invalid setting", { status: 400 });

  if (!canEditDiscordWebhook(userId)) {
    return new Response("Only drevmourn can edit the Discord webhook URL.", { status: 403 });
  }

  const sql = getSql();
  const current = (await sql`
    SELECT setting_value
    FROM site_settings
    WHERE setting_key = ${resolvedSettingKey}
    LIMIT 1;
  `) as { setting_value: string }[];
  const previousValue = current[0]?.setting_value ?? null;
  let nextValue = settingValue;
  let historyId: number | null = null;

  if (action === "revert") {
    const previous = (await sql`
      SELECT id, setting_value
      FROM site_settings_history
      WHERE setting_key = ${resolvedSettingKey}
      ORDER BY created_at DESC, id DESC
      LIMIT 1;
    `) as { id: number; setting_value: string }[];

    if (previous.length === 0) {
      return new Response("No previous value found", { status: 404 });
    }

    nextValue = previous[0].setting_value;
    historyId = previous[0].id;
  } else if (previousValue !== null && previousValue !== nextValue) {
    await sql`
      INSERT INTO site_settings_history (setting_key, setting_value)
      VALUES (${resolvedSettingKey}, ${previousValue});
    `;
  }

  await sql`
    INSERT INTO site_settings (setting_key, setting_value, updated_at)
    VALUES (${resolvedSettingKey}, ${nextValue}, NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW();
  `;

  if (historyId !== null) {
    await sql`DELETE FROM site_settings_history WHERE id = ${historyId};`;
  }

  await logAuditEvent({
    action: action === "revert" ? "Settings reverted" : "Settings updated",
    details: `${resolvedSettingKey} ${action === "revert" ? "reverted" : "updated"}`,
    actorUserId: userId,
    metadata: {
      settingKey: resolvedSettingKey,
      valueChanged: previousValue !== nextValue,
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
