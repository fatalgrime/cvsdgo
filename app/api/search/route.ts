import { auth } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { getAllRedirects } from "@/lib/redirects";
import { validateContentWithAutoMod } from "@/lib/automod";

import { ADMIN_ACTION_DEFINITIONS, type AdminActionType } from "@/lib/ai-admin-actions";

export type SearchPageItem = {
  id: string;
  type: "page";
  title: string;
  description: string;
  href: string;
  category: "Navigation" | "Staff" | "Admin";
};

export type SearchLinkItem = {
  id: string;
  type: "link";
  slug: string;
  title: string;
  url: string;
  href: string;
  isLocked: boolean;
  folderName: string;
};

export type SearchActionItem = {
  id: string;
  type: "action";
  actionId: "toggle-theme" | "open-settings" | "open-intercom";
  title: string;
  description: string;
};

export type SearchAdminActionItem = {
  id: string;
  type: "ai-admin-action";
  actionType: AdminActionType;
  title: string;
  description: string;
  isDestructive?: boolean;
};

export type SearchResultsPayload = {
  query: string;
  pages: SearchPageItem[];
  links: SearchLinkItem[];
  actions: SearchActionItem[];
  aiAdminActions: SearchAdminActionItem[];
  canManageLinks: boolean;
  isAdmin: boolean;
  blockedByAutoMod?: boolean;
  autoModReason?: string;
};

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const { userId } = await auth();
  const profile = await getAccessProfile(userId);

  if (query) {
    const autoModCheck = await validateContentWithAutoMod(query);
    if (!autoModCheck.isClean) {
      return Response.json({
        query,
        pages: [],
        links: [],
        actions: [],
        aiAdminActions: [],
        canManageLinks: profile.canManageLinks,
        isAdmin: profile.admin,
        blockedByAutoMod: true,
        autoModReason: autoModCheck.reason,
      });
    }
  }

  const availablePages: SearchPageItem[] = [
    {
      id: "page-home",
      type: "page",
      title: "Link Directory",
      description: "Browse public CVSD short links and resources",
      href: "/",
      category: "Navigation",
    },
    {
      id: "page-help",
      type: "page",
      title: "Support & Help",
      description: "Get assistance or submit a link request",
      href: "/site/help",
      category: "Navigation",
    },
    {
      id: "page-privacy",
      type: "page",
      title: "Privacy Policy",
      description: "District link shortener privacy guidelines",
      href: "/privacy-policy",
      category: "Navigation",
    },
    {
      id: "page-terms",
      type: "page",
      title: "Terms of Service",
      description: "CVSD Go acceptable use terms",
      href: "/terms-of-service",
      category: "Navigation",
    },
  ];

  if (profile.canManageReports || profile.canManageLinks || profile.admin) {
    availablePages.push(
      {
        id: "page-submissions",
        type: "page",
        title: "Submissions & Reports",
        description: "Review user submissions and support requests",
        href: "/site/support",
        category: "Staff",
      },
      {
        id: "page-link-manager",
        type: "page",
        title: "Link Manager",
        description: "Manage, create, and organize district short links",
        href: "/site/link-manager",
        category: "Staff",
      },
      {
        id: "page-status",
        type: "page",
        title: "System Status",
        description: "Monitor database, services, and system metrics",
        href: "/site/status",
        category: "Staff",
      }
    );
  }

  if (profile.admin) {
    availablePages.push({
      id: "page-users",
      type: "page",
      title: "User Management",
      description: "Manage staff roles, permissions, and bans",
      href: "/site/users",
      category: "Admin",
    });
  }

  const availableActions: SearchActionItem[] = [
    {
      id: "action-theme",
      type: "action",
      actionId: "toggle-theme",
      title: "Toggle Light / Dark Theme",
      description: "Switch color theme mode",
    },
  ];

  if (userId) {
    availableActions.unshift({
      id: "action-intercom",
      type: "action",
      actionId: "open-intercom",
      title: "Open Support Messenger",
      description: "Chat with CVSD support & help center",
    });
  }

  if (profile.admin) {
    availableActions.push({
      id: "action-settings",
      type: "action",
      actionId: "open-settings",
      title: "Open Site Settings",
      description: "Configure webhooks, audit logs, and policy content",
    });
  }

  const filteredPages = query
    ? availablePages.filter(
      (p) =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.href.toLowerCase().includes(query)
    )
    : availablePages;

  const filteredActions = query
    ? availableActions.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query)
    )
    : availableActions;

  const allRedirects = await getAllRedirects();
  const now = new Date();

  const filteredLinks: SearchLinkItem[] = [];

  for (const link of allRedirects) {
    if (link.release_at && new Date(link.release_at) > now) continue;
    if (link.expires_at && new Date(link.expires_at) < now) continue;

    const slug = link.slug.toLowerCase();
    const title = (link.description || link.slug).toLowerCase();
    const url = (link.is_locked ? "" : link.url).toLowerCase();
    const folder = (link.folder_name || "").toLowerCase();

    const matchesQuery =
      !query ||
      slug.includes(query) ||
      title.includes(query) ||
      url.includes(query) ||
      folder.includes(query);

    if (matchesQuery) {
      filteredLinks.push({
        id: `link-${link.id}`,
        type: "link",
        slug: link.slug,
        title: link.description || `go.cvsd.live/${link.slug}`,
        url: link.is_locked ? "Protected destination" : link.url,
        href: `/${link.slug}`,
        isLocked: Boolean(link.is_locked),
        folderName: link.folder_name?.trim() ? link.folder_name : "General",
      });
    }

    if (filteredLinks.length >= 25) break;
  }

  const aiAdminActions: SearchAdminActionItem[] = [];
  const canManage = Boolean(profile.canManageLinks || profile.admin);

  if (canManage) {
    for (const def of ADMIN_ACTION_DEFINITIONS) {
      const matches =
        !query ||
        def.title.toLowerCase().includes(query) ||
        def.description.toLowerCase().includes(query) ||
        def.triggers.some((tr) => tr.includes(query) || query.includes(tr));

      if (matches) {
        aiAdminActions.push({
          id: `ai-action-${def.type}`,
          type: "ai-admin-action",
          actionType: def.type,
          title: def.title,
          description: def.description,
          isDestructive: def.isDestructive,
        });
      }
    }
  }

  const payload: SearchResultsPayload = {
    query,
    pages: filteredPages.slice(0, 10),
    links: filteredLinks,
    actions: filteredActions.slice(0, 5),
    aiAdminActions,
    canManageLinks: canManage,
    isAdmin: Boolean(profile.admin),
  };

  return Response.json(payload);
}
