import { auth } from "@clerk/nextjs/server";
import { isAdminUser } from "@/lib/access";
import { redirect } from "next/navigation";
import SubmissionsManager from "@/components/submissions-manager";

export default async function SupportPage() {
  const { userId } = await auth();
  if (await isAdminUser(userId)) redirect("/site/settings/submissions");
  return <SubmissionsManager />;
}
