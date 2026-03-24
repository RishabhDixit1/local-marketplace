"use client";

import { Filter, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { SetStateAction } from "react";
import type { MarketplaceFeedFilterState } from "@/lib/marketplaceFeed";

type FeedFiltersProps = {
  filters: MarketplaceFeedFilterState;
  categoryOptions: string[];
  showAdvancedFilters: boolean;
  onToggleAdvanced: () => void;
  onReset: () => void;
  onFiltersChange: (nextValue: SetStateAction<MarketplaceFeedFilterState>) => void;
};

const toggleOptions: Array<{ key: keyof Pick<MarketplaceFeedFilterState, "urgentOnly" | "verifiedOnly" | "mediaOnly" | "freshOnly">; label: string }> = [
  { key: "urgentOnly", label: "Urgent only" },
  { key: "verifiedOnly", label: "Verified only" },
  { key: "mediaOnly", label: "With media" },
  { key: "freshOnly", label: "Fresh (24h)" },
];

export default function FeedFilters({
  filters,
  categoryOptions,
  showAdvancedFilters,
  onToggleAdvanced,
  onReset,
  onFiltersChange,
}: FeedFiltersProps) {
  return (
    <section className="rounded-3xl border border-slate-200/90 bg-white p-3 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.38)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Filter size={15} />
          Feed filters
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleAdvanced}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <SlidersHorizontal size={13} />
            {showAdvancedFilters ? "Hide" : "Show"} filters
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {categoryOptions.map((category) => {
          const active = filters.category === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => onFiltersChange((current) => ({ ...current, category }))}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {category === "all" ? "All" : category}
            </button>
          );
        })}
      </div>

      {showAdvancedFilters ? (
        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold text-slate-800">Max distance</span>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={filters.maxDistanceKm}
                onChange={(event) =>
                  onFiltersChange((current) => ({
                    ...current,
                    maxDistanceKm: Number(event.target.value) || 0,
                  }))
                }
                className="mt-1.5 w-full"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {filters.maxDistanceKm > 0 ? `${filters.maxDistanceKm} km` : "No distance cap"}
              </p>
            </label>

            {toggleOptions.map((option) => (
              <label
                key={option.key}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
              >
                {option.label}
                <input
                  type="checkbox"
                  checked={Boolean(filters[option.key])}
                  onChange={(event) =>
                    onFiltersChange((current) => ({
                      ...current,
                      [option.key]: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
