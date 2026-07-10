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
        className="mb-4 inline-flex rounded-md border border-oxford-700 bg-oxford-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-oxford-600"
      >
        Go Home
      </Link>
      <article className="panel p-6 md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Policy</p>
        <h1 className="mt-3 font-serif text-3xl text-oxford-700 md:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-600">
          Last updated: {document.updatedAt ? new Date(document.updatedAt).toLocaleDateString() : "Default copy"}
        </p>

        <section className="mt-6 space-y-5">
          <PolicyMarkdown markdown={document.markdown} className="space-y-5 text-sm" />
        </section>
      </article>
    </main>
  );
}
