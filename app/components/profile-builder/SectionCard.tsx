"use client";

import type { ReactNode } from "react";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import type { ProfileSectionType } from "@/lib/profile/marketplace";

export default function SectionCard({
  title,
  sectionType,
  visible,
  dragHandleProps,
  onToggleVisible,
  children,
}: {
  title: string;
  sectionType: ProfileSectionType;
  visible: boolean;
  dragHandleProps?: ReactNode;
  onToggleVisible: () => void;
  children?: ReactNode;
}) {
  return (
    <article className={`rounded-[24px] border p-4 shadow-sm transition ${visible ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-80"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={`Drag ${title}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm"
            {...(dragHandleProps ? { children: dragHandleProps } : {})}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div>
            <p className="text-base font-semibold text-slate-950">{title}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{sectionType}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleVisible}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {visible ? "Visible" : "Hidden"}
        </button>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
