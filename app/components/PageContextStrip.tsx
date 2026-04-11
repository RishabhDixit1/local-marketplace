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
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/92 px-4 py-3 shadow-sm backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 sm:flex-1">
        <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-700)]">
          {label}
        </span>
        <span className="text-xs text-slate-500 sm:text-sm">{description}</span>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
        {switchAction && (
          <Link
            href={switchAction.href}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 sm:min-h-0 sm:border-transparent sm:p-0 sm:font-medium sm:underline-offset-2 sm:hover:underline"
          >
            {switchAction.label}
          </Link>
        )}
        <Link
          href={action.href}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[var(--brand-900)] bg-[var(--brand-900)] px-3.5 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:border-[var(--brand-700)] hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-1 sm:min-h-10 sm:w-auto sm:px-4 sm:text-xs"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}
