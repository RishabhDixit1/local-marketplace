"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, MapPin, Search, ShoppingBag, Store, TreePine } from "lucide-react";

type Locality = {
  id: string;
  name: string;
  slug: string;
  zone_type: string;
  phase: number;
  provider_count?: number;
};

const zoneTabs = [
  { key: "society", label: "Societies", icon: Building2 },
  { key: "market", label: "Markets", icon: Store },
  { key: "supply_area", label: "Supply Areas", icon: TreePine },
  { key: "expansion", label: "Upcoming", icon: ShoppingBag },
] as const;

const zoneColors: Record<string, { bg: string; badge: string; text: string }> = {
  society: { bg: "bg-blue-50", badge: "bg-blue-100 text-blue-700", text: "text-blue-600" },
  market: { bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700", text: "text-emerald-600" },
  supply_area: { bg: "bg-amber-50", badge: "bg-amber-100 text-amber-700", text: "text-amber-600" },
  expansion: { bg: "bg-purple-50", badge: "bg-purple-100 text-purple-700", text: "text-purple-600" },
};

export default function ZoneBrowser({
  initialLocalities,
}: {
  initialLocalities: Locality[];
}) {
  const [activeTab, setActiveTab] = useState<string>("society");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return initialLocalities.filter((l) => {
      if (l.zone_type !== activeTab) return false;
      if (!q) return true;
      return l.name.toLowerCase().includes(q);
    });
  }, [initialLocalities, activeTab, search]);

  const TabIcon = zoneTabs.find((t) => t.key === activeTab)?.icon || Building2;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
        {zoneTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? "bg-[var(--brand-900)] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${activeTab === "society" ? "societies" : activeTab === "market" ? "markets" : "areas"}...`}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <TabIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">
            No {activeTab === "society" ? "societies" : activeTab === "market" ? "markets" : "areas"} found
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {search ? "Try a different search term." : `No ${activeTab} zones loaded yet.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((locality) => {
            const colors = zoneColors[locality.zone_type] || zoneColors.society;
            return (
              <Link
                key={locality.id}
                href={`/explore?locality_id=${locality.id}`}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--brand-300)] hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <h3 className="truncate text-sm font-bold text-slate-900 group-hover:text-[var(--brand-700)]">
                        {locality.name}
                      </h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                        {locality.zone_type === "society" ? "Society" : locality.zone_type === "market" ? "Market" : locality.zone_type === "supply_area" ? "Supply Area" : "Upcoming"}
                      </span>
                      {locality.provider_count != null && locality.provider_count > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                          {locality.provider_count} provider{locality.provider_count === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs font-semibold text-[var(--brand-700)] opacity-0 transition group-hover:opacity-100">
                  View providers →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
