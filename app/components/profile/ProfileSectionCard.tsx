"use client";

import type { ReactNode } from "react";

export default function ProfileSectionCard({
  icon,
  title,
  description,
  children,
  aside,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/50 backdrop-blur sm:p-6 lg:p-7">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
            {icon}
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">{title}</h2>
            {description ? <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
          </div>
        </div>
        {aside ? <div className="sm:max-w-sm">{aside}</div> : null}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}
