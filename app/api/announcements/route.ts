import { getAnnouncements } from "@/lib/announcements";
export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  try {
    return Response.json({ announcements: await getAnnouncements() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load announcements", error);
    return new Response("Announcements unavailable", { status: 503 });
  }
}
