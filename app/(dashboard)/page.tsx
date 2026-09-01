import { LinkDashboard } from "@/components/link-dashboard";
import { getAllRedirects } from "@/lib/redirects";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const links = await getAllRedirects();
  const total = links.length;
  const locked = links.filter((link) => link.is_locked).length;

  return (
    <section className="space-y-6">
      <div className="panel-strong overflow-hidden p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-slate-200">Cedar Valley School District</p>
        <h1 className="mt-3 max-w-4xl font-serif text-3xl leading-tight text-oxford-700 md:text-5xl">
          CVSD Go Public Link Directory
        </h1>
        <p className="mt-4 max-w-3xl text-sm text-slate-600 md:text-base">
          Search through our links and share shortened links to others you know!
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:max-w-md">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Active links</p>
            <p className="mt-1 text-2xl font-semibold text-oxford-700 dark:text-slate-100">{total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Locked links</p>
            <p className="mt-1 text-2xl font-semibold text-oxford-700 dark:text-slate-100">{locked}</p>
          </div>
        </div>
      </div>

      <LinkDashboard links={links} />
    </section>
  );
}
