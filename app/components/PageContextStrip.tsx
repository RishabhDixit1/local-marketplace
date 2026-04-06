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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 bg-white/80 px-4 py-2.5 shadow-sm backdrop-blur-sm sm:flex-nowrap sm:gap-3 sm:px-5">
      <div className="min-w-0">
        <span className="mr-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand-700)]">
          {label}
        </span>
        <span className="text-xs text-slate-500">{description}</span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {switchAction && (
          <Link
            href={switchAction.href}
            className="text-xs text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline"
          >
            {switchAction.label}
          </Link>
        )}
        <Link
          href={action.href}
          className="inline-flex h-7 items-center rounded-full bg-[var(--brand-600)] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-1"
        >
          {action.label}
        </Link>
      </div>
    </div>
  );
}
