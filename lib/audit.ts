import { clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";

type ActorInfo = {
  username: string | null;
  hasDiscordAccount: boolean;
  hasLoginAccount: boolean;
};

type AuditEventInput = {
  action: string;
  details?: string | null;
  actorUserId?: string | null;
  actorUsername?: string | null;
  actorHasDiscordAccount?: boolean;
  actorHasLoginAccount?: boolean;
};

async function getActorInfo(userId?: string | null): Promise<ActorInfo> {
  if (!userId) {
    return {
      username: null,
      hasDiscordAccount: false,
      hasLoginAccount: false,
    };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const username = user.username || fullName || user.emailAddresses[0]?.emailAddress || null;
    const hasDiscordAccount = user.externalAccounts.some((account) => account.provider.toLowerCase().includes("discord"));
    const hasLoginAccount = Boolean((user as { passwordEnabled?: boolean }).passwordEnabled) || user.emailAddresses.length > 0 || user.externalAccounts.length > 0;

    return {
      username,
      hasDiscordAccount,
      hasLoginAccount,
    };
  } catch {
    return {
      username: null,
      hasDiscordAccount: false,
      hasLoginAccount: false,
    };
  }
}

async function getDiscordWebhookUrl(): Promise<string | null> {
  if (!hasDatabaseUrl()) return null;

  const sql = getSql();
  const rows = (await sql`
    SELECT setting_value
    FROM site_settings
    WHERE setting_key = 'discord_webhook_url';
  `) as { setting_value: string }[];

  return rows[0]?.setting_value ?? null;
}

export async function ensureAuditSchema(): Promise<void> {
  if (!hasDatabaseUrl()) return;

  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGSERIAL PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT,
      actor_user_id TEXT,
      actor_username TEXT,
      actor_has_discord_account BOOLEAN NOT NULL DEFAULT FALSE,
      actor_has_login_account BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
  `;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  if (!hasDatabaseUrl()) return;

  await ensureAuditSchema();

  const actor = await getActorInfo(input.actorUserId);
  const username = input.actorUsername ?? actor.username;
  const webhookUrl = await getDiscordWebhookUrl();
  const sql = getSql();

  await sql`
    INSERT INTO audit_logs (
      action,
      details,
      actor_user_id,
      actor_username,
      actor_has_discord_account,
      actor_has_login_account
    )
    VALUES (
      ${input.action},
      ${input.details ?? null},
      ${input.actorUserId ?? null},
      ${username ?? null},
      ${input.actorHasDiscordAccount ?? actor.hasDiscordAccount},
      ${input.actorHasLoginAccount ?? actor.hasLoginAccount}
    );
  `;

  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: `Audit: ${input.action}`,
            color: 0x1d4ed8,
            description: input.details || "No additional details were provided.",
            fields: [
              { name: "User", value: username || "Unknown user", inline: true },
              { name: "Linked to Discord", value: input.actorHasDiscordAccount ?? actor.hasDiscordAccount ? "Yes" : "No", inline: true },
              { name: "Has login account", value: input.actorHasLoginAccount ?? actor.hasLoginAccount ? "Yes" : "No", inline: true },
              { name: "Action", value: input.action, inline: false },
              { name: "Details", value: input.details || "No additional details were provided.", inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch {
    // Swallow webhook failures to avoid breaking user flows.
  }
}
