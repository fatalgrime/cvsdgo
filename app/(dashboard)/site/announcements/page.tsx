import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/access";
import { AnnouncementManager } from "@/components/announcement-manager";

export const metadata: Metadata = { title: "Announcements", robots: { index: false, follow: false } };
export default async function AnnouncementsPage() {
  const { userId } = await auth();
  if (!await isAdminUser(userId)) redirect("/access-denied");
  return <AnnouncementManager />;
}
