import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type PolicyMarkdownProps = {
  markdown: string;
  className?: string;
};

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }

  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children);
  }

  return "";
}

function getCalloutTone(label: string): { className: string; accent: string } {
  switch (label) {
    case "warning":
      return { className: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-50", accent: "Warning" };
    case "important":
      return { className: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-50", accent: "Important" };
    case "tip":
      return { className: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-50", accent: "Tip" };
    default:
      return { className: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-50", accent: "Note" };
  }
}

type MarkdownCodeProps = {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
};

const components: Components = {
  h1: ({ children }) => <h1 className="mt-2 scroll-m-20 font-serif text-3xl text-oxford-700 dark:text-slate-100 md:text-4xl">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-8 scroll-m-20 text-2xl font-semibold text-oxford-700 dark:text-slate-100">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 scroll-m-20 text-xl font-semibold text-oxford-700 dark:text-slate-100">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-5 scroll-m-20 text-lg font-semibold text-oxford-700 dark:text-slate-100">{children}</h4>,
  p: ({ children }) => <p className="leading-7 text-slate-700 dark:text-slate-200">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} className="font-semibold text-oxford-700 underline decoration-oxford-300 underline-offset-4 transition hover:text-oxford-900 dark:text-oxford-200 dark:decoration-oxford-500" target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noreferrer noopener" : undefined}>
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="ml-6 list-disc space-y-2 text-slate-700 dark:text-slate-200">{children}</ul>,
  ol: ({ children }) => <ol className="ml-6 list-decimal space-y-2 text-slate-700 dark:text-slate-200">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => {
    const items = React.Children.toArray(children);
    const firstChildText = extractText(items[0]).trim();
    const calloutMatch = firstChildText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING)\]\s*(.*)$/i);

    if (calloutMatch) {
      const label = calloutMatch[1].toLowerCase();
      const tone = getCalloutTone(label);
      const bodyText = calloutMatch[2]?.trim();
      const rest = items.slice(1);

      return (
        <aside className={`rounded-2xl border px-4 py-4 shadow-sm ${tone.className}`}>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.16em] opacity-80">{tone.accent}</div>
          {bodyText ? <p className="leading-7">{bodyText}</p> : null}
          {rest.length > 0 ? <div className="mt-3 space-y-3">{rest}</div> : null}
        </aside>
      );
    }

    return (
      <blockquote className="border-l-4 border-oxford-300 pl-4 text-slate-600 dark:border-oxford-500 dark:text-slate-300">
        <div className="space-y-3">{children}</div>
      </blockquote>
    );
  },
  code: (({ inline, className, children }: MarkdownCodeProps) => {
    if (inline) {
      return (
        <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-oxford-700 dark:bg-slate-800 dark:text-slate-100">
          {children}
        </code>
      );
    }

    return (
      <code className={`block font-mono text-sm leading-6 text-slate-100 ${className ?? ""}`}>
        {children}
      </code>
    );
  }) as Components["code"],
  pre: ({ children }) => <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 px-4 py-4 font-mono text-sm leading-6 text-slate-100 shadow-inner">{children}</pre>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-200 dark:divide-slate-800">{children}</tbody>,
  tr: ({ children }) => <tr className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-950 dark:even:bg-slate-900">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em]">{children}</th>,
  td: ({ children }) => <td className="px-4 py-3 align-top leading-6">{children}</td>,
  hr: () => <hr className="my-8 border-slate-200 dark:border-slate-800" />,
  strong: ({ children }) => <strong className="font-semibold text-oxford-700 dark:text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
};

export function PolicyMarkdown({ markdown, className }: PolicyMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
