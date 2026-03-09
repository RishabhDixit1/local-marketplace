"use client";

import { CheckCircle2, Circle, ListChecks } from "lucide-react";
import type { ProfileCompletionItem } from "@/lib/profile/types";

export default function ProfileCompletionChecklist({
  items,
}: {
  items: ProfileCompletionItem[];
}) {
  return (
    <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-lg shadow-slate-200/40 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500 text-white">
          <ListChecks className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">Completion Checklist</h2>
          <p className="text-sm text-slate-600">Required items are marked so onboarding never stalls in a partial state.</p>
        </div>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-2xl border px-4 py-3 transition ${
              item.complete ? "border-emerald-200 bg-emerald-50/80" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${item.complete ? "text-emerald-600" : "text-slate-400"}`}>
                {item.complete ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  {item.requiredForOnboarding ? (
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Required
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm leading-5 text-slate-600">{item.helper}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
