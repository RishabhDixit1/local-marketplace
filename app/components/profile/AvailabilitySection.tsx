"use client";

import { CalendarDays, Clock3 } from "lucide-react";
import type { MarketplaceAvailabilityRecord } from "@/lib/profile/marketplace";

export default function AvailabilitySection({ availability }: { availability: MarketplaceAvailabilityRecord[] }) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Schedule</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Availability</h2>
      </div>

      {availability.length > 0 ? (
        <div className="space-y-4">
          {availability.map((item) => (
            <article key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-1 text-sm text-slate-600 capitalize">{item.availability}</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  <Clock3 className="h-3.5 w-3.5" />
                  {item.start_time && item.end_time ? `${item.start_time} - ${item.end_time}` : "Flexible"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                {item.days_of_week.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                    <CalendarDays className="h-3 w-3" />
                    {item.days_of_week.join(", ")}
                  </span>
                ) : null}
                {item.timezone ? (
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm">{item.timezone}</span>
                ) : null}
              </div>
              {item.notes ? <p className="mt-3 text-sm leading-6 text-slate-600">{item.notes}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          No availability windows set yet.
        </div>
      )}
    </section>
  );
}
