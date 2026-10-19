import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/access";
import { SettingsNav } from "@/components/settings-nav";

export const metadata: Metadata = { title: "Site Settings", robots: { index: false, follow: false } };

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!await isAdminUser(userId)) redirect("/access-denied");
  return <div className="min-w-0 space-y-5">
    <section className="panel p-4 sm:p-5" aria-labelledby="site-settings-title">
      <h2 id="site-settings-title" className="font-serif text-2xl text-oxford-700 dark:text-slate-100">Site Settings</h2>
      <SettingsNav />
    </section>
    {children}
  </div>;
}
