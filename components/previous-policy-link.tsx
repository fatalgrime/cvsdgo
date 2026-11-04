import Link from "next/link";
import { PolicyArchiveWindow } from "@/components/policy-archive-window";
import { isPolicyArchivePublic } from "@/lib/policy-archive-access";
import { POLICY_DOCUMENTS, type PolicyDocumentKey } from "@/lib/policy-definitions";
export function PreviousPolicyLink({ documentKey }: { documentKey: PolicyDocumentKey }) {
  if (!isPolicyArchivePublic()) return null;
  return (
    <PolicyArchiveWindow>
      <footer className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-700">
        <Link href={"/site/policies/" + documentKey + "/previous"} prefetch={false} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-oxford-700 transition hover:border-oxford-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" aria-label={"View old version of " + POLICY_DOCUMENTS[documentKey].title}>
          View old version
        </Link>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Available until November 9, 2026 at 12:00 a.m. Mountain Time.</p>
      </footer>
    </PolicyArchiveWindow>
  );
}
