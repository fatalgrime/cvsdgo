import { AnnouncementBanner } from "@/components/announcement-banner";
import { getAnnouncements } from "@/lib/announcements";
import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { SidebarAuth } from "@/components/sidebar-auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPaletteShell } from "@/components/command-palette-shell";
import { MobileNav } from "@/components/mobile-nav";
import { AccessProvider } from "@/components/access-provider";


export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const access = await getAccessProfile(userId);
  const announcements = await getAnnouncements().catch((error) => {
    console.error("Unable to load announcement banner", error);
    return [];
  });
  const isStaff = access.canManageLinks || access.canManageReports;
  const sidebarItems = [
    { href: "/", label: "Link Directory" },
    { href: "/site/help", label: "Help" },
    { href: "/site/support", label: isStaff ? "Submissions" : "Report an Issue" },
  ];
  if (access.admin) {
    sidebarItems.splice(2, 1);
    sidebarItems.push({ href: "/site/settings", label: "Settings" });
  }

  return (
    <AccessProvider profile={{ authenticated: Boolean(userId), ...access }}>
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex min-h-20 flex-wrap w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex shrink-0 items-center">
            <Link href="/" className="logo-shell inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 sm:px-4 sm:py-2 shadow-sm">
              <Image
                src="/cvsd-logo.png"
                alt="Cedar Valley School District"
                width={220}
                height={52}
                className="h-8 sm:h-11 w-auto"
                priority
              />
              <span className="ml-2 sm:ml-4 border-l border-slate-300 pl-2 sm:pl-4 text-xs sm:text-base font-semibold uppercase tracking-[0.16em] text-oxford-700">
                Go
              </span>
            </Link>
          </div>

          <div className="order-3 flex w-full items-center justify-center sm:order-none sm:mx-4 sm:w-auto sm:min-w-0 sm:max-w-md sm:flex-1">
            <CommandPaletteShell />
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile Header Nav Drawer Bar */}
      <MobileNav items={sidebarItems} />
      <AnnouncementBanner initial={announcements} />

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[250px_1fr] lg:px-8">
        <aside className="hidden panel border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/80 lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)] lg:overflow-auto">
          <div className="flex h-full flex-col px-4 py-5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:text-slate-400">Navigation</p>
            <nav aria-label="Main navigation"><SidebarNav items={sidebarItems} /></nav>
            <SidebarAuth />
          </div>
        </aside>

        <section className="pb-10 min-w-0">{children}</section>
      </div>
    </main>
    </AccessProvider>
  );
}
