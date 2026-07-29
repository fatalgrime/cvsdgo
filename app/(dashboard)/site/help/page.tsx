import { auth } from "@clerk/nextjs/server";
import { isAllowedUser } from "@/lib/access";
import Link from "next/link";

export default async function HelpPage() {
  const { userId } = await auth();
  const hasLinkManagerAccess = await isAllowedUser(userId);

  return (
    <section className="space-y-5">
      <div className="panel-strong overflow-hidden p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-deepforest-400">Help</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-oxford-700 dark:text-slate-100 md:text-4xl">CVSD Go Help</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Find guidance for creating, sharing, and managing district short links.
        </p>
      </div>

      <div className="panel p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">Public support</p>
        <h2 className="mt-2 text-base font-semibold text-oxford-700 dark:text-slate-100">For all visitors</h2>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Use CVSD Go to find official links, verify destinations, and share short URLs.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">Getting started</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Search the Link Directory to find the official destination for common district services.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">Share links</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Copy the short link from any card to send a shortened URL to others.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">Report issues</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Sign in to submit a report and track updates from CVSD.
            </p>
            <Link
              href="/site/support"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-oxford-600"
            >
              Go to Support
            </Link>
          </div>
        </div>
      </div>

      {hasLinkManagerAccess && (
        <div className="panel p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">
            Link Manager support
          </p>
          <h2 className="mt-2 text-base font-semibold text-oxford-700 dark:text-slate-100">For authorized staff</h2>
          <p className="mt-1.5 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            You have access to create, update, and schedule links. Use the guidance below for link management.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-oxford-200 bg-oxford-50/40 p-4 dark:border-oxford-700/50 dark:bg-oxford-900/20">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oxford-700 dark:text-slate-200">Create &amp; update</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Confirm the destination URL, add a descriptive title, and save changes to publish updates.
              </p>
            </div>
            <div className="rounded-xl border border-oxford-200 bg-oxford-50/40 p-4 dark:border-oxford-700/50 dark:bg-oxford-900/20">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oxford-700 dark:text-slate-200">Scheduling</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Use release and expiration times to align links with events or announcements.
              </p>
            </div>
            <div className="rounded-xl border border-oxford-200 bg-oxford-50/40 p-4 dark:border-oxford-700/50 dark:bg-oxford-900/20">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-oxford-700 dark:text-slate-200">Passwords</p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Protect links by enabling and setting a password in the Link Manager.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
