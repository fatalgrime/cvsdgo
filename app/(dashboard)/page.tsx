import type { Metadata } from "next";
import { LinkDashboard } from "@/components/link-dashboard";
import { getAllRedirects } from "@/lib/redirects";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Official Link Directory",
  description: "Find and share official Cedar Valley School District short links.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const links = await getAllRedirects();

  return (
    <section className="space-y-5">
      <div className="panel-strong overflow-hidden p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-slate-200">Cedar Valley School District</p>
        <h1 className="mt-2 max-w-4xl font-serif text-3xl leading-tight text-oxford-700 dark:text-slate-100 md:text-4xl">
          Official Link Directory
        </h1>
        <p className="mt-2 max-w-3xl text-base text-slate-600 dark:text-slate-300">
          Find verified district resources, open their destinations, or copy a short link to share.
        </p>
      </div>

      <LinkDashboard links={links} />
    </section>
  );
}
