import { auth } from "@clerk/nextjs/server";
import { isAllowedUser } from "@/lib/access";
import Link from "next/link";

export default async function HelpPage() {
  const { userId } = await auth();
  const hasLinkManagerAccess = await isAllowedUser(userId);

  return (
    <section>
      <div className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#10203a]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Help</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">CVSD Go Help</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
          Find guidance for creating, sharing, and managing district short links.
        </p>
      </div>

      <div className="mt-6 rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#10203a]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Public support</p>
        <h2 className="mt-3 text-lg font-semibold text-oxford-700">For all visitors</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Use CVSD Go to find official links, verify destinations, and share short URLs.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#13233f]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-slate-200">Getting started</p>
            <p className="mt-2 text-sm text-slate-600">
              Search the Link Directory to find the official destination for common district services.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#13233f]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-slate-200">Share links</p>
            <p className="mt-2 text-sm text-slate-600">
              Copy the short link from any card to send a shortened URL to people.
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#13233f]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-slate-200">Report issues</p>
            <p className="mt-2 text-sm text-slate-600">
              Sign in below to submit a report and track updates from CVSD.
            </p>
            <Link
              href="/site/support"
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
            >
              Go to Support
            </Link>
          </div>
        </div>
      </div>

      {hasLinkManagerAccess && (
        <div className="mt-6 rounded-md border border-oxford-200 bg-white p-6 dark:border-slate-800 dark:bg-[#10203a]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">
            Link Manager support
          </p>
          <h2 className="mt-3 text-lg font-semibold text-oxford-700">For authorized staff</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            You have access to create, update, and schedule links. Use the guidance below for
            link management.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-oxford-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#13233f]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-oxford-700 dark:text-slate-200">Create & update</p>
              <p className="mt-2 text-sm text-slate-600">
                Confirm the destination URL, add a descriptive title, and save changes to publish updates.
              </p>
            </div>
            <div className="rounded-md border border-oxford-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#13233f]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-oxford-700 dark:text-slate-200">Scheduling</p>
              <p className="mt-2 text-sm text-slate-600">
                Use release and expiration times to align links with events or anything.
              </p>
            </div>
            <div className="rounded-md border border-oxford-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#13233f]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-oxford-700 dark:text-slate-200">Passwords</p>
              <p className="mt-2 text-sm text-slate-600">
                Protect URL links by enabling and setting a password in the Dashboard.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
