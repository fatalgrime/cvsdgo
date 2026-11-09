"use client";
export function DraftRecoveryNotice({ onRestore, onDiscard }: { onRestore: () => void; onDiscard: () => void }) {
  return <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
    <p className="font-semibold">An unfinished draft is available in this tab.</p>
    <p className="mt-1">Restore it to continue editing, or discard the saved draft.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={onRestore} className="min-h-11 rounded-lg bg-amber-900 px-4 py-2 font-semibold text-white dark:bg-amber-100 dark:text-amber-950">Restore draft</button>
      <button type="button" onClick={onDiscard} className="min-h-11 rounded-lg border border-amber-600 px-4 py-2 font-semibold">Discard saved draft</button>
    </div>
  </div>;
}
