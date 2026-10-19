"use client";
import { SidebarNav } from "@/components/sidebar-nav";

const items = [
  { href: "/site/settings/links", label: "Link Manager" },
  { href: "/site/settings/policies", label: "Published Policies & Editor" },
  { href: "/site/settings/discord", label: "Discord Audit Logging" },
  { href: "/site/settings/activity", label: "Activity Log" },
  { href: "/site/settings/users", label: "Users" },
  { href: "/site/settings/submissions", label: "Submissions" },
  { href: "/site/settings/announcements", label: "Announcements" },
];

export function SettingsNav() {
  return <nav aria-label="Site settings categories"><SidebarNav items={items} className="mt-4 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3" /></nav>;
}
