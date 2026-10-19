import Link from "next/link";
import { PolicyEditor } from "@/components/policy-editor";
export default function PoliciesPage() { return <div className="space-y-4">            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70" aria-labelledby="policies-heading">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg></span>
              <h3 id="policies-heading" className="mt-4 text-base font-semibold text-oxford-700 dark:text-slate-100">Published policies</h3>
              <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-400">Edit the Terms of Service and Privacy Policy in the guided policy editor.</p>
              <div className="mt-4"><PolicyEditor enabled={true}/></div>
            </section><nav aria-label="Published policies" className="flex flex-wrap gap-4"><Link className="inline-flex min-h-11 items-center underline" href="/site/terms">Terms of Service</Link><Link className="inline-flex min-h-11 items-center underline" href="/site/privacy">Privacy Policy</Link></nav></div>; }
