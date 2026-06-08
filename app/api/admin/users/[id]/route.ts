import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCVSDGoRoleMetadata, isAllowedUser } from "@/lib/access";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureReportSchema } from "@/lib/report-schema";

type RoleUpdateBody = {
  admin?: unknown;
  reportStaff?: unknown;
};

type ReportingSettingsBody = {
  reportBanType?: unknown;
  bannedUntil?: unknown;
  limitHourly?: unknown;
  limitDaily?: unknown;
  resetStrikes?: unknown;
};

type UserUpdateBody = RoleUpdateBody & ReportingSettingsBody;

type UserActionBody = {
  action?: unknown;
};

type ReportingProfileRow = {
  user_id: string;
  report_ban_type: string;
  banned_until: string | null;
  limit_hourly: number;
  limit_daily: number;
  strikes: number;
  last_strike_at: string | null;
};

type ReportingProfileData = {
  reportBanType: string;
  reportBannedUntil: string | null;
  reportLimitHourly: number;
  reportLimitDaily: number;
  reportStrikes: number;
  reportLastStrikeAt: string | null;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPrivateMetadataObject(user: { privateMetadata: unknown }) {
  if (!isObject(user.privateMetadata)) return {};
  return user.privateMetadata as Record<string, unknown>;
}

function parseReportingBoolean(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === "true";
}

function parseReportBanType(value: unknown): string {
  const normalized = String(value ?? "none").toLowerCase();
  if (["none", "temporary", "permanent"].includes(normalized)) {
    return normalized;
  }
  return "none";
}

function parseLimitValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function defaultReportingProfile(): ReportingProfileData {
  return {
    reportBanType: "none",
    reportBannedUntil: null,
    reportLimitHourly: 0,
    reportLimitDaily: 0,
    reportStrikes: 0,
    reportLastStrikeAt: null,
  };
}

function profileFromRow(row: ReportingProfileRow | null): ReportingProfileData {
  if (!row) {
    return defaultReportingProfile();
  }
  return {
    reportBanType: row.report_ban_type,
    reportBannedUntil: row.banned_until,
    reportLimitHourly: row.limit_hourly,
    reportLimitDaily: row.limit_daily,
    reportStrikes: row.strikes,
    reportLastStrikeAt: row.last_strike_at,
  };
}

export async function GET(
  _request: Request,
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

  if (!hasDatabaseUrl()) {
    return Response.json({ profile: defaultReportingProfile(), reports: [], comments: [] });
  }

  const { id } = await params;
  await ensureReportSchema();
  const sql = getSql();

  const profileRows = (await sql`
    SELECT user_id, report_ban_type, banned_until, limit_hourly, limit_daily, strikes, last_strike_at
    FROM reporting_profiles
    WHERE user_id = ${id}
  `) as ReportingProfileRow[];

  const profile = profileFromRow(profileRows[0] ?? null);
  const reports = (await sql`
    SELECT
      id,
      user_id,
      user_email,
      title,
      description,
      link_slug,
      priority,
      status,
      metadata,
      handled_by_user_id,
      handled_by_name,
      created_at,
      updated_at
    FROM reports
    WHERE user_id = ${id}
    ORDER BY created_at DESC
  `) as {
    id: number;
    user_id: string;
    user_email: string | null;
    title: string;
    description: string;
    link_slug: string | null;
    priority: string;
    status: string;
    metadata: Record<string, unknown> | null;
    handled_by_user_id: string | null;
    handled_by_name: string | null;
    created_at: string;
    updated_at: string;
  }[];

  const reportIds = reports.map((report) => report.id);
  const comments = reportIds.length
    ? ((await sql`
        SELECT id, report_id, author_user_id, author_name, body, created_at
        FROM report_comments
        WHERE report_id = ANY(${reportIds}::bigint[])
        ORDER BY created_at ASC
      `) as {
        id: number;
        report_id: number;
        author_user_id: string;
        author_name: string | null;
        body: string;
        created_at: string;
      }[])
    : [];

  return Response.json({ profile, reports, comments });
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

  const body = (await request.json().catch(() => null)) as UserUpdateBody | null;
  if (!body) {
    return new Response("No updates provided", { status: 400 });
  }

  const { id } = await params;
  const client = await clerkClient();
  const target = await client.users.getUser(id);

  let updated = target;
  const roleUpdate = {} as { admin?: boolean; reportStaff?: boolean };
  if ("admin" in body) {
    if (typeof body.admin !== "boolean") {
      return new Response("Invalid admin value", { status: 400 });
    }
    roleUpdate.admin = body.admin;
  }
  if ("reportStaff" in body) {
    if (typeof body.reportStaff !== "boolean") {
      return new Response("Invalid reportStaff value", { status: 400 });
    }
    roleUpdate.reportStaff = body.reportStaff;
  }

  if (Object.keys(roleUpdate).length > 0) {
    const privateMetadata = getPrivateMetadataObject(target);
    const cvsdGo = isObject(privateMetadata.cvsdGo) ? (privateMetadata.cvsdGo as Record<string, unknown>) : {};
    const nextCVSDGo = {
      ...cvsdGo,
      ...(typeof roleUpdate.admin === "boolean" ? { admin: roleUpdate.admin } : {}),
      ...(typeof roleUpdate.reportStaff === "boolean" ? { reportStaff: roleUpdate.reportStaff } : {}),
    };

    updated = await client.users.updateUserMetadata(id, {
      privateMetadata: {
        ...privateMetadata,
        cvsdGo: nextCVSDGo,
      },
    });
  }

  let profile = defaultReportingProfile();
  const hasReportingSettings =
    "reportBanType" in body ||
    "bannedUntil" in body ||
    "limitHourly" in body ||
    "limitDaily" in body ||
    "resetStrikes" in body;

  if (hasReportingSettings) {
    if (!hasDatabaseUrl()) {
      return new Response("Database not configured", { status: 500 });
    }

    await ensureReportSchema();
    const sql = getSql();
    const profileRows = (await sql`
      SELECT user_id, report_ban_type, banned_until, limit_hourly, limit_daily, strikes, last_strike_at
      FROM reporting_profiles
      WHERE user_id = ${id}
    `) as ReportingProfileRow[];

    const currentProfile = profileRows[0] ?? {
      user_id: id,
      report_ban_type: "none",
      banned_until: null,
      limit_hourly: 0,
      limit_daily: 0,
      strikes: 0,
      last_strike_at: null,
    };

    const nextBanType = parseReportBanType(body.reportBanType ?? currentProfile.report_ban_type);
    const nextBannedUntil =
      nextBanType === "none"
        ? null
        : nextBanType === "temporary"
        ? typeof body.bannedUntil === "string"
          ? new Date(body.bannedUntil).toISOString()
          : currentProfile.banned_until
        : null;
    const nextLimitHourly = parseLimitValue(body.limitHourly, currentProfile.limit_hourly);
    const nextLimitDaily = parseLimitValue(body.limitDaily, currentProfile.limit_daily);
    const nextStrikes = parseReportingBoolean(body.resetStrikes) ? 0 : currentProfile.strikes;
    const nextLastStrikeAt = parseReportingBoolean(body.resetStrikes) ? null : currentProfile.last_strike_at;

    if (profileRows.length > 0) {
      await sql`
        UPDATE reporting_profiles
        SET
          report_ban_type = ${nextBanType},
          banned_until = ${nextBannedUntil},
          limit_hourly = ${nextLimitHourly},
          limit_daily = ${nextLimitDaily},
          strikes = ${nextStrikes},
          last_strike_at = ${nextLastStrikeAt},
          updated_at = NOW()
        WHERE user_id = ${id};
      `;
    } else {
      await sql`
        INSERT INTO reporting_profiles (
          user_id,
          report_ban_type,
          banned_until,
          limit_hourly,
          limit_daily,
          strikes,
          last_strike_at
        ) VALUES (
          ${id},
          ${nextBanType},
          ${nextBannedUntil},
          ${nextLimitHourly},
          ${nextLimitDaily},
          ${nextStrikes},
          ${nextLastStrikeAt}
        );
      `;
    }

    profile = {
      reportBanType: nextBanType,
      reportBannedUntil: nextBannedUntil,
      reportLimitHourly: nextLimitHourly,
      reportLimitDaily: nextLimitDaily,
      reportStrikes: nextStrikes,
      reportLastStrikeAt: nextLastStrikeAt,
    };
  }

  const roles = getCVSDGoRoleMetadata(updated);
  return Response.json({ ok: true, roles, profile });
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
