"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, MapPin, Search, ShoppingBag, Store, TreePine } from "lucide-react";
import { Input } from "@/app/components/ui/Input";

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
  society: { bg: "bg-blue-50 dark:bg-blue-950/40", badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300", text: "text-blue-600 dark:text-blue-400" },
  market: { bg: "bg-emerald-50 dark:bg-emerald-950/40", badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300", text: "text-emerald-600 dark:text-emerald-400" },
  supply_area: { bg: "bg-amber-50 dark:bg-amber-950/40", badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300", text: "text-amber-600 dark:text-amber-400" },
  expansion: { bg: "bg-purple-50 dark:bg-purple-950/40", badge: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300", text: "text-purple-600 dark:text-purple-400" },
};

export default function ZoneBrowser({
  initialLocalities,
  loading,
  error,
  zoneSlug,
}: {
  initialLocalities: Locality[];
  loading?: boolean;
  error?: string | null;
  zoneSlug?: string;
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

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <p className="text-sm font-semibold text-rose-700">Failed to load zones</p>
        <p className="mt-1 text-xs text-rose-500">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-1">
          {zoneTabs.map((tab) => (
            <div key={tab.key} className="h-9 w-24 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-[var(--surface-soft)]" />
                <div className="h-4 flex-1 rounded bg-[var(--surface-soft)]" />
              </div>
              <div className="mt-3 flex gap-2">
                <div className="h-5 w-16 rounded-full bg-[var(--surface-soft)]" />
                <div className="h-5 w-20 rounded-full bg-[var(--surface-soft)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-1 scrollbar-hide">
        {zoneTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 min-h-9 py-2 text-xs font-semibold transition ${
              activeTab === tab.key
                ? "bg-[var(--brand-900)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      <Input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${activeTab === "society" ? "societies" : activeTab === "market" ? "markets" : "areas"}...`}
        leftIcon={<Search className="h-4 w-4" />}
      />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center">
          <TabIcon className="mx-auto mb-2 h-8 w-8 text-[var(--ink-500)]" />
          <p className="text-sm font-semibold text-[var(--ink-700)]">
            No {activeTab === "society" ? "societies" : activeTab === "market" ? "markets" : "areas"} found
          </p>
          <p className="mt-1 text-xs text-[var(--ink-500)]">
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
                href={`/market/${locality.slug}`}
                className="group rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 shadow-sm transition hover:border-[var(--brand-300)] hover:shadow-md active:scale-[0.98] active:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--ink-700)]">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <h3 className="truncate text-sm font-bold text-[var(--ink-950)] group-hover:text-[var(--brand-700)]">
                        {locality.name}
                      </h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
                        {locality.zone_type === "society" ? "Society" : locality.zone_type === "market" ? "Market" : locality.zone_type === "supply_area" ? "Supply Area" : "Upcoming"}
                      </span>
                      {locality.provider_count != null && locality.provider_count > 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] text-[var(--ink-700)]">
                          {locality.provider_count} provider{locality.provider_count === 1 ? "" : "s"}
                        </span>
                      ) : locality.zone_type !== "expansion" ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[var(--surface-border)] px-2 py-0.5 text-[10px] text-[var(--ink-500)]">
                          Browsable
                        </span>
                      ) : null}
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
