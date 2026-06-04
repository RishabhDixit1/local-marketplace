"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  MapPin,
  Search,
  Star,
  X,
  Zap,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";

type ProviderData = {
  id: string; name: string; location: string; lat: number | null; lng: number | null;
  avatarUrl: string; bio: string; role: string; services: string[];
  avgRating: number | null; reviewCount: number; serviceCount: number;
  completedJobs: number; responseMinutes: number | null; isOnline: boolean;
  priceMin: number | null; priceMax: number | null; distanceKm: number | null;
  verified: boolean;
  listings: { id: string; title: string; price: number | null }[];
};

type Facets = {
  categories: { category: string; count: number }[];
  minPrice: number | null;
  maxPrice: number | null;
  avgRatingRange: { min: number; max: number };
  totalProviders: number;
  onlineCount: number;
};

type Pagination = {
  total: number; offset: number; limit: number; hasMore: boolean;
};

const CATEGORIES = [
  "Electrician", "Plumber", "AC Repair", "RO Repair", "Carpenter",
  "Appliance Repair", "Mobile Repair", "Bike Repair", "Tailoring", "Clothing",
];

const SORT_OPTIONS = [
  { value: "distance", label: "Nearest" },
  { value: "rating", label: "Top Rated" },
  { value: "jobs", label: "Most Jobs" },
  { value: "response", label: "Fastest Response" },
];

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [minRating, setMinRating] = useState(searchParams.get("minRating") ? parseFloat(searchParams.get("minRating")!) : null);
  const [onlineOnly, setOnlineOnly] = useState(searchParams.get("onlineOnly") === "true");
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "distance");
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [facets, setFacets] = useState<Facets | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [allProviders, setAllProviders] = useState<ProviderData[]>([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const doSearch = useCallback(async (searchOffset = 0, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      if (category) params.set("category", category);
      if (minRating) params.set("minRating", minRating.toString());
      if (onlineOnly) params.set("onlineOnly", "true");
      if (sortBy) params.set("sortBy", sortBy);
      if (userLocation) {
        params.set("lat", userLocation.lat.toString());
        params.set("lng", userLocation.lng.toString());
      }
      params.set("limit", "50");
      if (searchOffset > 0) params.set("offset", searchOffset.toString());

      const res = await fetch(`/api/community/providers-by-category?${params.toString()}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Search failed");

      if (append) {
        setAllProviders((prev) => [...prev, ...(data.providers || [])]);
      } else {
        setAllProviders(data.providers || []);
      }
      setFacets(data.facets);
      setPagination(data.pagination);
      setOffset(searchOffset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query, category, minRating, onlineOnly, sortBy, userLocation]);

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (minRating) params.set("minRating", minRating.toString());
    if (onlineOnly) params.set("onlineOnly", "true");
    if (sortBy) params.set("sortBy", sortBy);
    router.replace(`/search?${params.toString()}`);
    doSearch(0, false);
  };

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setMinRating(null);
    setOnlineOnly(false);
    setSortBy("distance");
    setShowFilters(false);
    router.replace("/search");
  };

  const activeFilterCount = [category, minRating, onlineOnly, sortBy !== "distance"].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0 text-sm font-bold text-[var(--brand-700)]">ServiQ</Link>
          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search services, providers..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-[var(--brand-400)] focus:bg-white focus:ring-2 focus:ring-[var(--brand-ring)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                showFilters || activeFilterCount > 0
                  ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand-600)] text-[10px] font-bold text-white">{activeFilterCount}</span>
              )}
            </button>
            <button type="submit" className="rounded-xl bg-[var(--brand-900)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-800)]">
              Search
            </button>
          </form>
        </div>
        {showFilters && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={minRating ?? ""}
                onChange={(e) => setMinRating(e.target.value ? parseFloat(e.target.value) : null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
              >
                <option value="">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={onlineOnly}
                  onChange={(e) => setOnlineOnly(e.target.checked)}
                  className="rounded"
                />
                Online Only
              </label>

              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  <X className="h-3 w-3" />
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        {facets && !loading && (
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
            <span>{pagination?.total ?? facets.totalProviders} provider{(pagination?.total ?? facets.totalProviders) !== 1 ? "s" : ""} found</span>
            {facets.onlineCount > 0 && (
              <span className="text-emerald-600">{facets.onlineCount} online now</span>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-600">{error}</div>
        )}

        {loading && allProviders.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}

        {!loading && allProviders.length === 0 && !error && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No providers found</p>
            <p className="mt-1 text-xs text-slate-400">Try different search terms or filters</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white">
                Clear Filters
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allProviders.map((provider) => (
            <Link
              key={provider.id}
              href={`/profile/${provider.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--brand-500)]/30 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-lg font-bold text-[var(--brand-700)]">
                  {provider.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{provider.name}</h3>
                      <p className="mt-0.5 text-xs text-slate-500">{provider.location || "Crossings Republik"}</p>
                    </div>
                    {provider.verified && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">Verified</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    {provider.avgRating ? (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
                        {provider.avgRating.toFixed(1)}
                      </span>
                    ) : null}
                    {provider.responseMinutes ? (
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-[var(--brand-500)]" />
                        {provider.responseMinutes} min
                      </span>
                    ) : null}
                    {provider.completedJobs > 0 && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-slate-400" />
                        {provider.completedJobs} jobs
                      </span>
                    )}
                    {provider.distanceKm != null && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {provider.distanceKm} km
                      </span>
                    )}
                  </div>
                  {provider.bio && (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{provider.bio}</p>
                  )}
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)] opacity-0 transition group-hover:opacity-100">
                    View Profile <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {pagination?.hasMore && (
          <div className="mt-8 text-center">
            <button
              onClick={() => doSearch(offset + 50, true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load More ({pagination.total - offset - 50 > 0 ? pagination.total - offset - 50 : 0} remaining)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <SearchPageContent />
    </Suspense>
  );
}
