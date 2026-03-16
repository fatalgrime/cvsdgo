import Image from "next/image";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { isAllowedUser } from "@/lib/access";
import { SidebarAuth } from "@/components/sidebar-auth";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const isStaff = await isAllowedUser(userId);
  const sidebarItems = [
    { href: "/", label: "Link Directory" },
    { href: "/site/help", label: "Support" },
    { href: "/site/support", label: "Submissions" },
  ];
  if (isStaff) {
    sidebarItems.push({ href: "/site/link-manager", label: "Link Manager" });
    sidebarItems.push({ href: "/site/users", label: "Users" });
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="logo-shell inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 shadow-sm">
            <Image
              src="/cvsd-logo.png"
              alt="Cedar Valley School District"
              width={220}
              height={52}
              className="h-11 w-auto"
              priority
            />
            <span className="ml-4 border-l border-slate-300 pl-4 text-base font-semibold uppercase tracking-[0.16em] text-oxford-700">
              Go
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[250px_1fr] lg:px-8">
        <aside className="panel border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/80 lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)] lg:overflow-auto">
          <div className="flex h-full flex-col px-4 py-5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:text-slate-400">Navigation</p>
            <SidebarNav items={sidebarItems} />
            <SidebarAuth />
          </div>
        </aside>

        <section className="pb-10">{children}</section>
      </div>
    </main>
  );
}
