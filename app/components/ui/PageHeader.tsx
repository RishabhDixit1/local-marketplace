"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  backHref,
  onBack,
  rightSlot,
}: PageHeaderProps) {
  const showBack = Boolean(backHref || onBack);

  return (
    <div className="flex flex-wrap items-start gap-3">
      {showBack && (
        <div className="flex shrink-0">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}
