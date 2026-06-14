"use client";

import Link from "next/link";
import { MapPin, Store, Users, X } from "lucide-react";

const QUICK_CATEGORIES = [
  "Electrician", "Plumber", "AC Repair", "RO Repair", "Carpenter", "Appliance Repair",
];

interface DashboardHeroProps {
  activeCategory: string | null;
  providerCount: number;
}

export default function DashboardHero({ activeCategory, providerCount }: DashboardHeroProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] to-white px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-100)]">
          <MapPin className="h-5 w-5 text-[var(--brand-700)]" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Serving Crossings Republik, Ghaziabad</h2>
          <p className="text-xs text-slate-500">Uttar Pradesh 201016 — Hyperlocal marketplace</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/dashboard?category=${encodeURIComponent(cat)}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
          >
            {cat}
          </Link>
        ))}
      </div>

      {activeCategory && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--brand-200)] bg-white/70 px-4 py-2.5">
          <p className="text-xs font-semibold text-slate-700">
            {providerCount > 0
              ? `${providerCount} ${activeCategory} provider${providerCount === 1 ? "" : "s"} near Crossings Republik`
              : `Showing results for ${activeCategory}`}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300"
          >
            <X className="h-3 w-3" />
            Clear
          </Link>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
        <MapPin className="h-3 w-3" />
        <span>Covering: Mahagun Mascot, Panchsheel Wellington, Galleria Market, Avantika Retail Street, and 12+ areas</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href="/market/crossing-republik"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--brand-800)]"
        >
          <Store className="h-3.5 w-3.5" />
          View Market
        </Link>
        <Link
          href="/dashboard/providers"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
        >
          <Users className="h-3.5 w-3.5" />
          Browse All Providers
        </Link>
      </div>
    </div>
  );
}
