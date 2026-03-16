import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-50 px-4 py-12">
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <SignIn />
      </div>
    </main>
  );
}
