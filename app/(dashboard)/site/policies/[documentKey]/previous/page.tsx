import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PolicyMarkdown } from "@/components/policy-markdown";
import { PolicyArchiveWindow } from "@/components/policy-archive-window";
import { isPolicyArchivePublic } from "@/lib/policy-archive-access";
import { LEGACY_POLICY_DOCUMENTS } from "@/lib/legacy-policy-documents";
import { isPolicyDocumentKey, POLICY_DOCUMENTS } from "@/lib/policy-definitions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Old policy version | CVSD Go",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PreviousPolicyPage({ params }: { params: Promise<{ documentKey: string }> }) {
  // Enforce on the server so direct links also stop working at the deadline.
  if (!isPolicyArchivePublic()) notFound();
  const { documentKey } = await params;
  if (!isPolicyDocumentKey(documentKey)) notFound();
  const document = LEGACY_POLICY_DOCUMENTS[documentKey];
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href={POLICY_DOCUMENTS[documentKey].route} className="mb-5 inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">Back to current {document.title}</Link>
      <PolicyArchiveWindow showClosedMessage>
        <article className="panel p-6 md:p-8">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Old version — for reference</p>
          <h1 className="mt-2 font-serif text-3xl text-oxford-700 dark:text-slate-100 md:text-4xl">{document.title}</h1>
          <p className="mt-2 text-sm font-bold"><strong>Effective date: {document.effectiveDate}</strong></p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">This is the original policy copy. Public access ends November 9, 2026 at 12:00 a.m. Mountain Time.</p>
          <section aria-label="Old policy content" className="mt-6">
            <PolicyMarkdown markdown={document.markdown} className="space-y-5 text-sm" />
          </section>
        </article>
      </PolicyArchiveWindow>
    </div>
  );
}
