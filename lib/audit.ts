import { clerkClient } from "@clerk/nextjs/server";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { getCachedUserInfo } from "@/lib/access";

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
  metadata?: Record<string, unknown> | null;
  severity?: "info" | "warning" | "critical";
  category?: string | null;
  source?: string | null;
  actorIpAddress?: string | null;
  actorUserAgent?: string | null;
};

const suspiciousActivityBuckets = new Map<string, number[]>();

const BUCKET_PRUNE_INTERVAL_MS = 5 * 60_000;
const BUCKET_WINDOW_MS = 60_000;

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - BUCKET_WINDOW_MS;
    for (const [key, timestamps] of suspiciousActivityBuckets) {
      const still_recent = timestamps.filter((t) => t > cutoff);
      if (still_recent.length === 0) {
        suspiciousActivityBuckets.delete(key);
      } else {
        suspiciousActivityBuckets.set(key, still_recent);
      }
    }
  }, BUCKET_PRUNE_INTERVAL_MS);
}

let ensureAuditSchemaPromise: Promise<void> | null = null;

async function getActorInfo(userId?: string | null): Promise<ActorInfo> {
  if (!userId) {
    return { username: null, hasDiscordAccount: false, hasLoginAccount: false };
  }

  const cached = getCachedUserInfo(userId);
  if (cached) {
    return {
      username: cached.username,
      hasDiscordAccount: cached.hasDiscordAccount,
      hasLoginAccount: cached.hasLoginAccount,
    };
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    const username = user.username || fullName || user.emailAddresses[0]?.emailAddress || null;
    const hasDiscordAccount = user.externalAccounts.some((account) =>
      account.provider.toLowerCase().includes("discord")
    );
    const hasLoginAccount =
      Boolean((user as { passwordEnabled?: boolean }).passwordEnabled) ||
      user.emailAddresses.length > 0 ||
      user.externalAccounts.length > 0;
    return { username, hasDiscordAccount, hasLoginAccount };
  } catch {
    return { username: null, hasDiscordAccount: false, hasLoginAccount: false };
  }
}

function normalizeSeverity(severity?: AuditEventInput["severity"]): "info" | "warning" | "critical" {
  return severity === "critical" ? "critical" : severity === "warning" ? "warning" : "info";
}

function shouldNotifyDiscord(input: AuditEventInput, details: string): boolean {
  const normalizedAction = input.action.toLowerCase();
  const normalizedDetails = details.toLowerCase();
  return (
    normalizeSeverity(input.severity) === "critical" ||
    normalizedAction.includes("delete") ||
    normalizedAction.includes("lock") ||
    normalizedAction.includes("ban") ||
    normalizedAction.includes("revoke") ||
    normalizedAction.includes("suspicious") ||
    normalizedDetails.includes("mass") ||
    normalizedDetails.includes("bulk") ||
    normalizedDetails.includes("multiple")
  );
}

function detectSuspiciousActivity(input: AuditEventInput): "info" | "warning" | "critical" {
  if (input.severity === "critical") {
    return "critical";
  }

  const bucketKey = `${input.actorUserId ?? "anonymous"}:${input.action.toLowerCase()}`;
  const now = Date.now();
  const timestamps = suspiciousActivityBuckets.get(bucketKey) ?? [];
  const recent = timestamps.filter((stamp) => now - stamp < BUCKET_WINDOW_MS);
  recent.push(now);
  suspiciousActivityBuckets.set(bucketKey, recent);

  if (recent.length >= 3) {
    return "critical";
  }

  return normalizeSeverity(input.severity);
}

export function getRequestContext(request?: Request | null): { actorIpAddress: string | null; actorUserAgent: string | null } {
  if (!request) {
    return { actorIpAddress: null, actorUserAgent: null };
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const realIp = request.headers.get("x-real-ip")?.trim() ?? null;
  const userAgent = request.headers.get("user-agent")?.trim() ?? null;

  return {
    actorIpAddress: forwarded ?? realIp,
    actorUserAgent: userAgent,
  };
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

async function runEnsureAuditSchema(): Promise<void> {
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
      actor_ip_address TEXT,
      actor_user_agent TEXT,
      metadata JSONB,
      severity TEXT NOT NULL DEFAULT 'info',
      category TEXT,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS actor_ip_address TEXT,
    ADD COLUMN IF NOT EXISTS actor_user_agent TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB,
    ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT;
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS audit_logs_severity_idx ON audit_logs(severity);
  `;
}

export async function ensureAuditSchema(): Promise<void> {
  if (!ensureAuditSchemaPromise) {
    ensureAuditSchemaPromise = runEnsureAuditSchema().catch((error) => {
      ensureAuditSchemaPromise = null;
      throw error;
    });
  }
  await ensureAuditSchemaPromise;
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  if (!hasDatabaseUrl()) return;

  try {
    await ensureAuditSchema();

    const actor = await getActorInfo(input.actorUserId);
    const username = input.actorUsername ?? actor.username;
    const webhookUrl = await getDiscordWebhookUrl();
    const severity = detectSuspiciousActivity(input);
    const details = input.details ?? "No additional details were provided.";
    const metadataJson = input.metadata ? JSON.stringify(input.metadata) : null;
    const sql = getSql();

    await sql`
      INSERT INTO audit_logs (
        action,
        details,
        actor_user_id,
        actor_username,
        actor_has_discord_account,
        actor_has_login_account,
        actor_ip_address,
        actor_user_agent,
        metadata,
        severity,
        category,
        source
      )
      VALUES (
        ${input.action},
        ${details},
        ${input.actorUserId ?? null},
        ${username ?? null},
        ${input.actorHasDiscordAccount ?? actor.hasDiscordAccount},
        ${input.actorHasLoginAccount ?? actor.hasLoginAccount},
        ${input.actorIpAddress ?? null},
        ${input.actorUserAgent ?? null},
        ${metadataJson}::jsonb,
        ${severity},
        ${input.category ?? null},
        ${input.source ?? null}
      );
    `;

    if (!webhookUrl) return;

    const notifyDiscord = shouldNotifyDiscord(input, details);

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(notifyDiscord ? { content: "@everyone" } : {}),
          embeds: [
            {
              title: `Audit: ${input.action}`,
              color: notifyDiscord ? 0xef4444 : 0x1d4ed8,
              description: details,
              fields: [
                { name: "User", value: username || "Unknown user", inline: true },
                { name: "Linked to Discord", value: input.actorHasDiscordAccount ?? actor.hasDiscordAccount ? "Yes" : "No", inline: true },
                { name: "Has login account", value: input.actorHasLoginAccount ?? actor.hasLoginAccount ? "Yes" : "No", inline: true },
                { name: "Severity", value: severity, inline: true },
                { name: "Action", value: input.action, inline: false },
                { name: "Details", value: details, inline: false },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
    } catch {
    }
  } catch {
  }
}
