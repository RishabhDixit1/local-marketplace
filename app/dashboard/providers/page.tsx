"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  Star,
  Store,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type ProviderCard = {
  id: string;
  name: string;
  location: string;
  avatarUrl: string;
  bio: string;
  services: string[];
  avgRating: number | null;
  reviewCount: number;
  serviceCount: number;
  completedJobs: number;
  responseMinutes: number | null;
  isOnline: boolean;
  priceMin: number | null;
  priceMax: number | null;
  distanceKm: number | null;
  listings: Array<{
    id: string;
    title: string;
    category: string;
    price: number | null;
  }>;
  verified: boolean;
};

type FilterOptions = {
  category: string;
  minRating: number | null;
  showOnlineOnly: boolean;
  sortBy: "distance" | "rating" | "jobs" | "response";
};

const formatCurrency = (value: number | null) => {
  if (!Number.isFinite(Number(value))) return null;
  return `₹${Number(value).toLocaleString("en-IN")}`;
};

const buildPublicProfilePath = (profile: { id: string; name?: string | null }) => {
  if (!profile.name) return null;
  const slug = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return null;
  return `/profile/${slug}?provider=${encodeURIComponent(profile.id)}`;
};

export default function ProvidersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    category: "",
    minRating: null,
    showOnlineOnly: false,
    sortBy: "distance",
  });
  const [connectingProviderId, setConnectingProviderId] = useState<string | null>(null);
  const [connectedProviderIds, setConnectedProviderIds] = useState<Set<string>>(new Set());
  const [connectionError, setConnectionError] = useState<{ providerId: string; message: string } | null>(null);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    providers.forEach((p) => p.services.forEach((s) => categories.add(s)));
    return Array.from(categories).sort();
  }, [providers]);

  const filteredProviders = useMemo(() => {
    let result = [...providers];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.bio.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.services.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (filters.category) {
      result = result.filter((p) => p.services.includes(filters.category));
    }

    const minRating = filters.minRating;
    if (minRating != null) {
      result = result.filter((p) => (p.avgRating || 0) >= minRating);
    }

    if (filters.showOnlineOnly) {
      result = result.filter((p) => p.isOnline);
    }

    result.sort((a, b) => {
      switch (filters.sortBy) {
        case "rating":
          return (b.avgRating || 0) - (a.avgRating || 0);
        case "jobs":
          return b.completedJobs - a.completedJobs;
        case "response":
          return (a.responseMinutes || 60) - (b.responseMinutes || 60);
        case "distance":
        default:
          return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      }
    });

    return result;
  }, [providers, searchQuery, filters]);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuthedJson<{
        ok: boolean; providers: ProviderCard[];
      }>(supabase, "/api/community/providers-by-category", {
        method: "GET",
      });
      if (data?.ok) {
        setProviders(data.providers || []);
      } else {
        setError("Failed to load providers. Please try again.");
      }
    } catch {
      setError("Failed to load providers. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const providerIdParam = searchParams.get("provider");

  const handleConnect = useCallback(
    async (providerId: string, providerName: string) => {
      if (connectedProviderIds.has(providerId)) return;

      setConnectingProviderId(providerId);
      setConnectionError(null);

      try {
        const result = await fetchAuthedJson<{
          ok: boolean;
          viewerId: string;
          requestId?: string;
          code?: string;
          message?: string;
        }>(supabase, "/api/connections", {
          method: "POST",
          body: JSON.stringify({ targetUserId: providerId }),
        });

        if (result?.ok) {
          setConnectedProviderIds((prev) => new Set(prev).add(providerId));
        } else {
          setConnectionError({
            providerId,
            message: result?.message || "Failed to send connection request",
          });
        }
      } catch (err) {
        setConnectionError({
          providerId,
          message: err instanceof Error ? err.message : "Failed to send connection request",
        });
      } finally {
        setConnectingProviderId(null);
      }
    },
    [connectedProviderIds]
  );

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 px-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
            Local Providers
          </h1>
          <p className="text-xs text-slate-500">
            Browse service providers near you — connect, view storefronts, and get help
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, service, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
            showFilters || filters.category || filters.minRating != null || filters.showOnlineOnly
              ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {showFilters ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/create_post")}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
        >
          Post Need
        </button>
      </div>

      {showFilters && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
              >
                <option value="">All categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Minimum Rating
              </label>
              <div className="flex flex-wrap gap-2">
                {[0, 3, 4].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        minRating: prev.minRating === rating ? null : rating,
                      }))
                    }
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      filters.minRating === rating
                        ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        filters.minRating === rating
                          ? "text-amber-500"
                          : "text-slate-400"
                      }`}
                    />
                    {rating === 0 ? "All" : `${rating}+`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Sort By
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "distance" as const, label: "Distance" },
                  { key: "rating" as const, label: "Rating" },
                  { key: "jobs" as const, label: "Jobs Done" },
                  { key: "response" as const, label: "Response Time" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        sortBy: option.key,
                      }))
                    }
                    className={`inline-flex items-center rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                      filters.sortBy === option.key
                        ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Availability
              </label>
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    showOnlineOnly: !prev.showOnlineOnly,
                  }))
                }
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  filters.showOnlineOnly
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    filters.showOnlineOnly ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                />
                Online now
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setFilters({
                category: "",
                minRating: null,
                showOnlineOnly: false,
                sortBy: "distance",
              })
            }
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Reset filters
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {filteredProviders.length} provider{filteredProviders.length === 1 ? "" : "s"}{" "}
            found
          </span>
          {searchQuery && (
            <span>
              for "{searchQuery}"
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="h-16 w-16 rounded-full bg-slate-200" />
              <div className="h-4 w-2/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={loadProviders}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filteredProviders.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No providers found</p>
          <p className="mt-1 text-xs text-slate-500">
            Try adjusting your search or filters to find providers nearby
          </p>
        </div>
      )}

      {!loading &&
        !error &&
        filteredProviders.length > 0 && (
          <div className="space-y-3">
            {filteredProviders.map((provider) => (
              <div
                key={provider.id}
                className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-4 transition ${
                  providerIdParam === provider.id
                    ? "border-[var(--brand-300)] shadow-md"
                    : "shadow-sm hover:shadow-md"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-100)] text-xl font-bold text-[var(--brand-700)]">
                        {provider.avatarUrl ? (
                          <img
                            src={provider.avatarUrl}
                            alt={provider.name}
                            className="h-14 w-14 rounded-2xl object-cover"
                          />
                        ) : (
                          provider.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {provider.isOnline && (
                        <span className="absolute -right-0 bottom-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          {provider.name}
                        </h3>
                        {provider.isOnline && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Online
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                        )}
                        {provider.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-700)]">
                            Verified
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {provider.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {provider.location}
                          </span>
                        )}
                        {provider.avgRating != null && provider.avgRating > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-500" />
                            {provider.avgRating.toFixed(1)}
                          </span>
                        )}
                        {provider.completedJobs > 0 && (
                          <span>
                            {provider.completedJobs} job{provider.completedJobs === 1 ? "" : "s"}
                          </span>
                        )}
                        {provider.responseMinutes != null && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            ~{provider.responseMinutes} min
                          </span>
                        )}
                      </div>

                      {provider.bio && (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                          {provider.bio}
                        </p>
                      )}

                      {provider.listings.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {provider.listings.slice(0, 4).map((listing) => (
                            <span
                              key={listing.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              <Store className="h-3 w-3 text-slate-400" />
                              {listing.title}
                              {listing.price != null && (
                                <span className="text-[var(--brand-700)]">
                                  {formatCurrency(listing.price)}
                                </span>
                              )}
                            </span>
                          ))}
                          {provider.listings.length > 4 && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                              +{provider.listings.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {provider.priceMin != null && (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-700">
                          from {formatCurrency(provider.priceMin)}
                        </p>
                        {provider.priceMax != null &&
                          provider.priceMax !== provider.priceMin && (
                            <p className="text-[10px] text-slate-500">
                              to {formatCurrency(provider.priceMax)}
                            </p>
                          )}
                      </div>
                    )}
                    {provider.distanceKm != null && (
                      <span className="text-[10px] text-slate-400">
                        {provider.distanceKm} km away
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <Link
                    href={`/dashboard/chat?recipientId=${encodeURIComponent(provider.id)}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Chat
                  </Link>

                  {buildPublicProfilePath(provider) && (
                    <Link
                      href={buildPublicProfilePath(provider)!}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      <Store className="h-3.5 w-3.5" />
                      View Storefront
                    </Link>
                  )}

                  {connectedProviderIds.has(provider.id) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <Star className="h-3.5 w-3.5" />
                      Connected
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleConnect(provider.id, provider.name)}
                      disabled={connectingProviderId === provider.id}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        connectionError?.providerId === provider.id
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`}
                    >
                      {connectingProviderId === provider.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      {connectingProviderId === provider.id
                        ? "Connecting..."
                        : connectionError?.providerId === provider.id
                          ? "Try again"
                          : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
