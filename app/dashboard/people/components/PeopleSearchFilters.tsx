"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";

export const PEOPLE_FILTER_PILLS = ["All", "Nearby", "Available Now", "Verified", "Top Rated", "New"] as const;
export type PeopleFilterPill = (typeof PEOPLE_FILTER_PILLS)[number];

export const PEOPLE_SORT_OPTIONS = ["Most relevant", "Distance", "Rating", "Newest", "Online first"] as const;
export type PeopleSortOption = (typeof PEOPLE_SORT_OPTIONS)[number];

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  activePill: PeopleFilterPill;
  onActivePillChange: (value: PeopleFilterPill) => void;
  activeCategory: string;
  onActiveCategoryChange: (value: string) => void;
  categoryOptions: string[];
  radiusKm: number;
  onRadiusChange: (value: number) => void;
  sortBy: PeopleSortOption;
  onSortByChange: (value: PeopleSortOption) => void;
  activeFilterCount: number;
  resultsCount: number;
};

export default function PeopleSearchFilters({
  search,
  onSearchChange,
  onClearSearch,
  activePill,
  onActivePillChange,
  activeCategory,
  onActiveCategoryChange,
  categoryOptions,
  radiusKm,
  onRadiusChange,
  sortBy,
  onSortByChange,
  activeFilterCount,
  resultsCount,
}: Props) {
  return (
    <section className="sticky top-3 z-20 overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 p-4 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.48)] backdrop-blur sm:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,164,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.9))]" />

      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">Premium Discovery</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">Search local business profiles with confidence</h2>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterCount} active filters
          </span>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="flex items-center gap-3 rounded-[1.4rem] border border-slate-200 bg-white px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition focus-within:border-[var(--brand-500)]/45 focus-within:shadow-[0_0_0_4px_var(--brand-ring)]">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search people by name, business, role, service, expertise, or location"
              className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:text-[15px]"
            />
            {search.trim() ? (
              <button
                type="button"
                onClick={onClearSearch}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>

          <label className="flex min-w-0 items-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Service</span>
            <select
              value={activeCategory}
              onChange={(event) => onActiveCategoryChange(event.target.value)}
              className="w-full bg-transparent text-sm font-medium outline-none"
            >
              <option value="All">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 items-center gap-2 rounded-[1.2rem] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Sort</span>
            <select
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value as PeopleSortOption)}
              className="w-full bg-transparent text-sm font-medium outline-none"
            >
              {PEOPLE_SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PEOPLE_FILTER_PILLS.map((pill) => (
            <button
              key={pill}
              type="button"
              onClick={() => onActivePillChange(pill)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activePill === pill
                  ? "bg-[var(--brand-900)] text-white shadow-[0_18px_35px_-24px_rgba(15,23,42,0.9)]"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
              }`}
            >
              {pill}
            </button>
          ))}

          <span className="ml-auto text-sm text-slate-500">{resultsCount} profiles visible</span>
        </div>

        <div className="rounded-[1.4rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.96))] px-4 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-slate-700">
            <span>Discovery radius</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-900">
              {radiusKm} km
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={radiusKm}
            onChange={(event) => onRadiusChange(Number(event.target.value))}
            className="mt-3 w-full accent-[var(--brand-500)]"
          />

          <div className="mt-2 flex justify-between text-xs text-slate-500">
            <span>1 km</span>
            <span>50 km</span>
          </div>
        </div>
      </div>
    </section>
  );
}
