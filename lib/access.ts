import { auth, clerkClient } from "@clerk/nextjs/server";
import type { User } from "@clerk/backend";

const ALLOWED_DISCORD_ID = "1012507248305647718";
const ALLOWED_USERNAMES = ["admin"];
export const WEBHOOK_EDIT_USER_ID = "user_3AhQ5Y8oIecKRmPgo7mEtNduoaW";

const ACCESS_CACHE_TTL_MS = 30_000;

export type CachedUserInfo = {
  profile: AccessProfile;
  username: string | null;
  hasDiscordAccount: boolean;
  hasLoginAccount: boolean;
};

type CacheEntry = CachedUserInfo & { expiresAt: number };
const accessProfileCache = new Map<string, CacheEntry>();

function getCachedEntry(userId: string): CachedUserInfo | null {
  const entry = accessProfileCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    accessProfileCache.delete(userId);
    return null;
  }
  const { expiresAt: _exp, ...info } = entry;
  void _exp;
  return info;
}

function setCachedEntry(userId: string, info: CachedUserInfo): void {
  accessProfileCache.set(userId, { ...info, expiresAt: Date.now() + ACCESS_CACHE_TTL_MS });
}

function getCachedProfile(userId: string): AccessProfile | null {
  return getCachedEntry(userId)?.profile ?? null;
}

export function invalidateAccessProfileCache(userId: string): void {
  accessProfileCache.delete(userId);
}

export function getCachedUserInfo(userId: string): CachedUserInfo | null {
  return getCachedEntry(userId);
}

type CVSDGoMetadata = {
  admin?: boolean;
  reportStaff?: boolean;
};

type AccessProfile = {
  allowlisted: boolean;
  admin: boolean;
  reportStaff: boolean;
  canManageLinks: boolean;
  canManageReports: boolean;
};

function getPrivateMetadataObject(user: User): Record<string, unknown> {
  const metadata = user.privateMetadata;
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function getCVSDGoMetadata(user: User): CVSDGoMetadata {
  const privateMetadata = getPrivateMetadataObject(user);
  const cvsdGo = privateMetadata.cvsdGo;
  if (!cvsdGo || typeof cvsdGo !== "object") {
    return {};
  }
  const value = cvsdGo as Record<string, unknown>;
  return {
    admin: value.admin === true,
    reportStaff: value.reportStaff === true,
  };
}

function buildAccessProfile(user: User): AccessProfile {
  const metadata = getCVSDGoMetadata(user);
  const allowedByDiscord = user.externalAccounts.some(
    (account) =>
      account.providerUserId === ALLOWED_DISCORD_ID &&
      account.provider.toLowerCase().includes("discord")
  );
  const allowedByUsername =
    typeof user.username === "string" &&
    ALLOWED_USERNAMES.includes(user.username.toLowerCase());
  const allowlisted = allowedByDiscord || allowedByUsername;
  const admin = allowlisted || metadata.admin === true;
  const reportStaff = admin || metadata.reportStaff === true;

  return {
    allowlisted,
    admin,
    reportStaff,
    canManageLinks: admin,
    canManageReports: reportStaff,
  };
}

export function getCVSDGoRoleMetadata(user: User): { admin: boolean; reportStaff: boolean } {
  const metadata = getCVSDGoMetadata(user);
  return {
    admin: metadata.admin === true,
    reportStaff: metadata.reportStaff === true,
  };
}

export function getAccessProfileForUser(user: User): AccessProfile {
  return buildAccessProfile(user);
}

export async function getAccessProfile(userId: string | null): Promise<AccessProfile> {
  if (!userId) {
    return {
      allowlisted: false,
      admin: false,
      reportStaff: false,
      canManageLinks: false,
      canManageReports: false,
    };
  }

  const cached = getCachedProfile(userId);
  if (cached) return cached;

  const user = await (await clerkClient()).users.getUser(userId);
  const profile = buildAccessProfile(user);

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const username = user.username || fullName || user.emailAddresses[0]?.emailAddress || null;
  const hasDiscordAccount = user.externalAccounts.some((account) =>
    account.provider.toLowerCase().includes("discord")
  );
  const hasLoginAccount =
    Boolean((user as { passwordEnabled?: boolean }).passwordEnabled) ||
    user.emailAddresses.length > 0 ||
    user.externalAccounts.length > 0;

  setCachedEntry(userId, { profile, username, hasDiscordAccount, hasLoginAccount });
  return profile;
}

export async function isAllowedUser(userId: string | null): Promise<boolean> {
  const profile = await getAccessProfile(userId);
  return profile.canManageLinks;
}

export async function isAdminUser(userId: string | null): Promise<boolean> {
  const profile = await getAccessProfile(userId);
  return profile.admin;
}

export function canEditDiscordWebhook(userId: string | null): boolean {
  return userId === WEBHOOK_EDIT_USER_ID;
}

export async function isReportStaffUser(userId: string | null): Promise<boolean> {
  const profile = await getAccessProfile(userId);
  return profile.canManageReports;
}

export async function requireAllowedUser(): Promise<Response | null> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allowed = await isAllowedUser(userId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}

export async function requireAdminUser(): Promise<Response | null> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allowed = await isAdminUser(userId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}

export async function requireReportStaffUser(): Promise<Response | null> {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const allowed = await isReportStaffUser(userId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}
