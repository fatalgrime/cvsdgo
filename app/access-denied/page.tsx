import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen bg-surface-50 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl rounded-md border border-slate-200 bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700">Access Declined</p>
        <h1 className="mt-3 font-serif text-3xl leading-tight text-oxford-700 md:text-4xl">
          You don&apos;t have permission
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Your account doesn&apos;t have the necessary permissions to access this site.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/"
            className="rounded-md border border-oxford-700 bg-oxford-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-oxford-600"
          >
            Go Home
          </Link>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
