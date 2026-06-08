import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAccessProfileForUser, getCVSDGoRoleMetadata, isAllowedUser } from "@/lib/access";
import { getSql, hasDatabaseUrl } from "@/lib/db";
import { ensureReportSchema } from "@/lib/report-schema";

type AdminUserView = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  imageUrl: string;
  banned: boolean;
  locked: boolean;
  createdAt: number;
  lastSignInAt: number | null;
  allowlisted: boolean;
  admin: boolean;
  reportStaff: boolean;
  metadataAdmin: boolean;
  metadataReportStaff: boolean;
  reportBanType: string;
  reportBannedUntil: string | null;
  reportLimitHourly: number;
  reportLimitDaily: number;
  reportStrikes: number;
  reportLastStrikeAt: string | null;
};

function getDisplayName(firstName: string | null, lastName: string | null, username: string | null): string {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (username) return username;
  return "Unnamed user";
}

export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allowed = await isAllowedUser(userId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const client = await clerkClient();
  const users: AdminUserView[] = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const result = await client.users.getUserList({ limit, offset });
    const batch = result.data ?? [];

    for (const user of batch) {
      const primaryEmail =
        user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;
      const roles = getCVSDGoRoleMetadata(user);
      const access = getAccessProfileForUser(user);
      users.push({
        id: user.id,
        name: getDisplayName(user.firstName, user.lastName, user.username),
        username: user.username,
        email: primaryEmail,
        imageUrl: user.imageUrl,
        banned: user.banned,
        locked: user.locked,
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
        allowlisted: access.allowlisted,
        admin: access.admin,
        reportStaff: access.canManageReports,
        metadataAdmin: roles.admin,
        metadataReportStaff: roles.reportStaff,
        reportBanType: "none",
        reportBannedUntil: null,
        reportLimitHourly: 0,
        reportLimitDaily: 0,
        reportStrikes: 0,
        reportLastStrikeAt: null,
      });
    }

    offset += batch.length;
    if (batch.length < limit || offset >= result.totalCount) {
      break;
    }
  }

  if (hasDatabaseUrl()) {
    await ensureReportSchema();
    const userIds = users.map((user) => user.id);
    if (userIds.length > 0) {
      const sql = getSql();
      const profileRows = (await sql`
        SELECT user_id, report_ban_type, banned_until, limit_hourly, limit_daily, strikes, last_strike_at
        FROM reporting_profiles
        WHERE user_id = ANY(${userIds}::text[])
      `) as {
        user_id: string;
        report_ban_type: string;
        banned_until: string | null;
        limit_hourly: number;
        limit_daily: number;
        strikes: number;
        last_strike_at: string | null;
      }[];

      const profileMap = new Map(profileRows.map((profile) => [profile.user_id, profile]));
      for (const user of users) {
        const profile = profileMap.get(user.id);
        if (profile) {
          user.reportBanType = profile.report_ban_type;
          user.reportBannedUntil = profile.banned_until;
          user.reportLimitHourly = profile.limit_hourly;
          user.reportLimitDaily = profile.limit_daily;
          user.reportStrikes = profile.strikes;
          user.reportLastStrikeAt = profile.last_strike_at;
        }
      }
    }
  }

  users.sort((a, b) => {
    const aName = (a.name || a.email || a.id).toLowerCase();
    const bName = (b.name || b.email || b.id).toLowerCase();
    return aName.localeCompare(bName);
  });

  return Response.json({ users });
}
