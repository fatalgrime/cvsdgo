import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="panel-strong overflow-hidden p-6 md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-deepforest-700 dark:text-deepforest-400">{eyebrow}</p>
      <h1 className="mt-2 font-serif text-3xl leading-tight text-oxford-700 dark:text-slate-100 md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
