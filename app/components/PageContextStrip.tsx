"use client";

import Link from "next/link";

type PageContextStripProps = {
  label: string;
  description: string;
  action: { label: string; href: string };
  switchAction?: { label: string; href: string };
};

export default function PageContextStrip({ label, description, action, switchAction }: PageContextStripProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/92 px-4 py-3 shadow-sm backdrop-blur-sm sm:flex-nowrap sm:px-5">
      <div className="min-w-0 flex-1">
        <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-700)]">
          {label}
        </span>
        <span className="text-xs text-slate-500 sm:text-sm">{description}</span>
      </div>

      <div className="flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-between">
        {switchAction && (
          <Link
            href={switchAction.href}
            className="shrink-0 text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-slate-700 hover:underline"
          >
            {switchAction.label}
          </Link>
        )}
        <Link
          href={action.href}
          className="inline-flex min-h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[var(--brand-900)] bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-700)] hover:border-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-1"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}
