import type { Metadata } from "next";
import Link from "next/link";
import { PolicyMarkdown } from "@/components/policy-markdown";
import { getPolicyDocument } from "@/lib/policies";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy | CVSD Go",
  description: "Privacy Policy for CVSD Go link directory and short-link services.",
};

export default async function PrivacyPolicyPage() {
  const document = await getPolicyDocument("privacy");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        Home
      </Link>
      <article className="panel p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-deepforest-700 dark:text-deepforest-400">Policy</p>
        <h1 className="mt-2 font-serif text-3xl text-oxford-700 dark:text-slate-100 md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Last updated: {document.updatedAt ? new Date(document.updatedAt).toLocaleDateString() : "Default copy"}
        </p>
        <section className="mt-6 space-y-5">
          <PolicyMarkdown markdown={document.markdown} className="space-y-5 text-sm" />
        </section>
      </article>
    </main>
  );
}
