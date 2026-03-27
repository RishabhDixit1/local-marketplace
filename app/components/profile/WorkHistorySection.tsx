"use client";

import { BriefcaseBusiness, CalendarClock, MapPin } from "lucide-react";
import type { MarketplaceWorkHistoryRecord } from "@/lib/profile/marketplace";

const formatRange = (start: string | null, end: string | null, current: boolean) => {
  const startLabel = start ? new Date(start).getFullYear() : "Started";
  if (current) return `${startLabel} - Present`;
  const endLabel = end ? new Date(end).getFullYear() : "Ended";
  return `${startLabel} - ${endLabel}`;
};

export default function WorkHistorySection({ workHistory }: { workHistory: MarketplaceWorkHistoryRecord[] }) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Experience</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Work History</h2>
      </div>

      {workHistory.length > 0 ? (
        <div className="space-y-4">
          {workHistory.map((item) => (
            <article key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">{item.role_title}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.company_name}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatRange(item.start_date, item.end_date, item.is_current)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                {item.location ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                    <MapPin className="h-3 w-3" />
                    {item.location}
                  </span>
                ) : null}
                {item.verification_status ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                    <BriefcaseBusiness className="h-3 w-3" />
                    {item.verification_status}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description || "Career and project details will show here."}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Work history will appear here once the profile has career entries.
        </div>
      )}
    </section>
  );
}
