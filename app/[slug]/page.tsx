import { redirect } from "next/navigation";
import { RedirectLanding } from "@/components/redirect-landing";
import { getRedirectBySlug, recordClick } from "@/lib/redirects";

function parseStoredDate(value: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function SlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug) {
    const destination = await getRedirectBySlug(slug);
    if (destination) {
      const now = new Date();
      const releaseAt = parseStoredDate(destination.release_at);
      const expiresAt = parseStoredDate(destination.expires_at);
      const isScheduled = Boolean(releaseAt && now < releaseAt);
      const isExpired = Boolean(expiresAt && now > expiresAt);

      if (!destination.is_locked && !isScheduled && !isExpired && destination.url) {
        recordClick(slug);
        redirect(destination.url);
      }
    }
  }

  return <RedirectLanding />;
}

