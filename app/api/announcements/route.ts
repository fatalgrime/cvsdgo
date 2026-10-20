import { auth } from "@clerk/nextjs/server";
import { getAccessProfile } from "@/lib/access";
import { getAnnouncements } from "@/lib/announcements";
export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  try {
    const { userId } = await auth();
    const access = await getAccessProfile(userId);
    return Response.json({ announcements: await getAnnouncements(false, access.admin || access.reportStaff) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load announcements", error);
    return new Response("Announcements unavailable", { status: 503 });
  }
}
