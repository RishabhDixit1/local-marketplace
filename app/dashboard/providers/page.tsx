"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Quote,
  Search,
  Star,
  Store,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import { buildPublicProfilePath } from "@/lib/profile/utils";
import ProfileToastViewport, {
  type ProfileToast,
} from "@/app/components/profile/ProfileToastViewport";

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
  verified: boolean;
  listings: Array<{
    id: string;
    title: string;
    category: string;
    price: number | null;
  }>;
};

type PaginationInfo = {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
};

type Facets = {
  categories: { category: string; count: number }[];
  minPrice: number | null;
  maxPrice: number | null;
  avgRatingRange: { min: number; max: number };
  totalProviders: number;
  onlineCount: number;
};

type FilterOptions = {
  category: string;
  minRating: number | null;
  showOnlineOnly: boolean;
  sortBy: "distance" | "rating" | "jobs" | "response";
};

const FAVORITES_STORAGE_KEY = "serviq_provider_favorites";

const getFavorites = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
};

const saveFavorites = (ids: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
};

const formatCurrency = (value: number | null) => {
  if (!Number.isFinite(Number(value))) return null;
  return `₹${Number(value).toLocaleString("en-IN")}`;
};

function ProviderCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 animate-pulse rounded-2xl bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-28 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-6 w-24 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-6 w-20 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        <div className="h-8 w-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-8 w-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-8 w-20 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

function ProviderQuickViewModal({
  provider,
  isFavorite,
  onClose,
  onToggleFavorite,
  onConnect,
  connecting,
}: {
  provider: ProviderCard;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onConnect: (id: string, name: string) => void;
  connecting: boolean;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} ref={backdropRef} />

      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        aria-modal="true"
        role="dialog"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">Provider Details</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleFavorite(provider.id)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                isFavorite
                  ? "border-rose-200 bg-rose-50 text-rose-600"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-3xl font-bold text-[var(--brand-700)]">
                {provider.avatarUrl ? (
                  <img
                    src={provider.avatarUrl}
                    alt={provider.name}
                    className="h-20 w-20 rounded-2xl object-cover"
                  />
                ) : (
                  provider.name.charAt(0).toUpperCase()
                )}
              </div>
              {provider.isOnline && (
                <span className="absolute -right-1 bottom-0 h-5 w-5 rounded-full border-3 border-white bg-emerald-500 shadow-sm" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="text-lg font-bold text-slate-900">{provider.name}</h4>
                {provider.verified && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <TrendingUp className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>

              {provider.location && (
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {provider.location}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {provider.avgRating != null && provider.avgRating > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-semibold text-amber-700">
                      {provider.avgRating.toFixed(1)}
                    </span>
                    {provider.reviewCount > 0 && (
                      <span className="text-xs text-amber-600">({provider.reviewCount} reviews)</span>
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
                    <Star className="h-3.5 w-3.5 text-slate-300" />
                    No reviews yet
                  </span>
                )}

                {provider.completedJobs > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    {provider.completedJobs} job{provider.completedJobs === 1 ? "" : "s"}
                  </span>
                )}

                {provider.responseMinutes != null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    <Clock className="h-3.5 w-3.5" />
                    ~{provider.responseMinutes} min response
                  </span>
                )}

                {provider.distanceKm != null && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {provider.distanceKm} km away
                  </span>
                )}
              </div>
            </div>
          </div>

          {provider.bio && (
            <div className="mt-5">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">About</h5>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{provider.bio}</p>
            </div>
          )}

          {provider.listings.length > 0 && (
            <div className="mt-5">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Services ({provider.listings.length})
              </h5>
              <div className="mt-2 grid gap-2">
                {provider.listings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">{listing.title}</span>
                    </div>
                    {listing.price != null && (
                      <span className="text-sm font-bold text-[var(--brand-700)]">
                        {formatCurrency(listing.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {provider.services.length > 0 && (
            <div className="mt-5">
              <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Categories</h5>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {provider.services.map((s) => (
                  <span
                    key={s}
                    className="inline-flex rounded-lg bg-[var(--brand-50)] px-2.5 py-1 text-xs font-medium text-[var(--brand-700)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/90 px-5 py-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/chat?recipientId=${encodeURIComponent(provider.id)}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)] hover:shadow-md"
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </Link>

             <Link
               href={`/dashboard/chat?recipientId=${encodeURIComponent(provider.id)}&draft_kind=interest&draft_title=${encodeURIComponent(`Quote request for ${provider.name}`)}`}
               className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-4 py-2 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
             >
               <Quote className="h-4 w-4" />
               Request Quote
             </Link>

            {buildPublicProfilePath(provider) && (
              <Link
                href={buildPublicProfilePath(provider)!}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Store className="h-4 w-4" />
                Full Profile
              </Link>
            )}
          </div>

          <button
            type="button"
            onClick={() => onConnect(provider.id, provider.name)}
            disabled={connecting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {connecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProvidersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    offset: 0,
    limit: 24,
    hasMore: false,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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
  const [initialLoad, setInitialLoad] = useState(true);
  const [favoriteProviderIds, setFavoriteProviderIds] = useState<Set<string>>(new Set());
  const [quickViewProvider, setQuickViewProvider] = useState<ProviderCard | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [toasts, setToasts] = useState<ProfileToast[]>([]);

  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreCallbackRef = useRef<() => void>(() => {});
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setFavoriteProviderIds(getFavorites());
  }, []);

  const toggleFavorite = useCallback((providerId: string) => {
    setFavoriteProviderIds((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      saveFavorites(next);
      return next;
    });
  }, []);

  const pushToast = useCallback(
    (kind: ProfileToast["kind"], message: string) => {
      const toastId =
        typeof window !== "undefined" && window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      setToasts((current) => [...current, { id: toastId, kind, message }]);

      const timeoutId = window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== toastId));
        toastTimersRef.current.delete(toastId);
      }, 4600);

      toastTimersRef.current.set(toastId, timeoutId);
    },
    []
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  const categoryOptions = useMemo(() => {
    return facets?.categories || [];
  }, [facets]);

  const loadProviders = useCallback(async (append = false) => {
    const offset = append ? providers.length : 0;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      const categoryFromUrl = searchParams.get("category");

      if (categoryFromUrl && !append) {
        params.set("category", categoryFromUrl);
      } else if (filters.category) {
        params.set("category", filters.category);
      }

      if (filters.minRating != null) {
        params.set("minRating", String(filters.minRating));
      }

      if (filters.showOnlineOnly) {
        params.set("onlineOnly", "true");
      }

      if (filters.sortBy) {
        params.set("sortBy", filters.sortBy);
      }

      if (searchQuery) {
        params.set("search", searchQuery);
      }

      if (append) {
        params.set("offset", String(offset));
      }
      params.set("limit", "24");

      const data = await fetchAuthedJson<{
        ok: boolean;
        providers: ProviderCard[];
        facets: Facets;
        pagination: PaginationInfo;
      }>(supabase, `/api/community/providers-by-category?${params.toString()}`, {
        method: "GET",
      });

      if (data?.ok) {
        if (append) {
          setProviders((prev) => [...prev, ...(data.providers || [])]);
        } else {
          setProviders(data.providers || []);
          setFacets(data.facets);
        }
        setPagination(data.pagination);

        if (categoryFromUrl && !append && initialLoad) {
          setFilters((prev) => ({ ...prev, category: categoryFromUrl }));
        }
      } else {
        setError("Failed to load providers. Please try again.");
      }
    } catch {
      setError("Failed to load providers. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setInitialLoad(false);
    }
  }, [providers.length, searchParams, filters, searchQuery, initialLoad]);

  useEffect(() => {
    const categoryFromUrl = searchParams.get("category");
    if (categoryFromUrl && initialLoad) {
      setFilters((prev) => ({ ...prev, category: categoryFromUrl }));
    }
  }, [searchParams, initialLoad]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadProviders();
    }, 300);
    return () => clearTimeout(timeout);
  }, [filters, searchQuery]);

  useEffect(() => {
    loadMoreCallbackRef.current = () => {
      if (pagination.hasMore && !loadingMore && !loading) {
        loadProviders(true);
      }
    };
  }, [pagination.hasMore, loadingMore, loading, loadProviders]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          loadMoreCallbackRef.current();
        }
      },
      {
        rootMargin: "150px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const filteredProviders = useMemo(() => {
    let result = [...providers];

    if (showFavoritesOnly) {
      result = result.filter((p) => favoriteProviderIds.has(p.id));
    }

    return result;
  }, [providers, showFavoritesOnly, favoriteProviderIds]);

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
          pushToast("success", `Connection request sent to ${providerName}`);
        } else {
          const errMsg = result?.message || `Failed to connect with ${providerName}`;
          pushToast("error", errMsg);
          setConnectionError({
            providerId,
            message: errMsg,
          });
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : `Failed to connect with ${providerName}`;
        pushToast("error", errMsg);
        setConnectionError({
          providerId,
          message: errMsg,
        });
      } finally {
        setConnectingProviderId(null);
      }
    },
    [connectedProviderIds, pushToast]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.minRating != null) count++;
    if (filters.showOnlineOnly) count++;
    if (searchQuery) count++;
    return count;
  }, [filters, searchQuery]);

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Local Providers</h1>
          <p className="text-xs text-slate-500">
            Browse service providers near you — connect, view storefronts, and get help
          </p>
        </div>
        {pagination.total > 0 && (
          <div className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            <Users className="h-3.5 w-3.5" />
            {pagination.total} providers
          </div>
        )}
      </div>

      {categoryOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilters((prev) => ({ ...prev, category: "" }))}
            className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              !filters.category
                ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            All
          </button>
          {categoryOptions.slice(0, 8).map(({ category, count }) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  category: prev.category === category ? "" : category,
                }))
              }
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                filters.category === category
                  ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {category}
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          ))}
          {categoryOptions.length > 8 && (
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              +{categoryOptions.length - 8} more
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      )}

      {categoryOptions.length > 8 && showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
          {categoryOptions.slice(8).map(({ category, count }) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  category: prev.category === category ? "" : category,
                }))
              }
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                filters.category === category
                  ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {category}
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-[var(--brand-400)] focus-within:ring-1 focus-within:ring-[var(--brand-400)]">
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
          onClick={() => setShowFavoritesOnly((prev) => !prev)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
            showFavoritesOnly
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${showFavoritesOnly ? "fill-current" : ""}`} />
          Favorites
          {favoriteProviderIds.size > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] text-slate-700">
              {favoriteProviderIds.size}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
            showFilters || activeFilterCount > 0
              ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-700)]"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-900)] px-1 text-[10px] text-white">
              {activeFilterCount}
            </span>
          )}
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard/create_post")}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)] hover:shadow-md"
        >
          Post Need
        </button>
      </div>

      {showFilters && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
              >
                <option value="">All categories</option>
                {categoryOptions.map(({ category, count }) => (
                  <option key={category} value={category}>
                    {category} ({count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Minimum Rating</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: null as number | null, label: "All" },
                  { value: 3, label: "3+ ⭐" },
                  { value: 4, label: "4+ ⭐" },
                ].map((option) => (
                  <button
                    key={option.value ?? "all"}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        minRating: prev.minRating === option.value ? null : option.value,
                      }))
                    }
                    className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      filters.minRating === option.value
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
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Sort By</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "distance" as const, label: "Nearest" },
                  { key: "rating" as const, label: "Top Rated" },
                  { key: "jobs" as const, label: "Most Jobs" },
                  { key: "response" as const, label: "Fastest" },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilters((prev) => ({ ...prev, sortBy: option.key }))}
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
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Availability</label>
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, showOnlineOnly: !prev.showOnlineOnly }))}
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
                Online now only
              </button>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFilters({
                  category: "",
                  minRating: null,
                  showOnlineOnly: false,
                  sortBy: "distance",
                });
                setSearchQuery("");
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {filteredProviders.length} provider{filteredProviders.length === 1 ? "" : "s"} found
            {filters.category && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] px-2 py-0.5 text-[var(--brand-700)]">
                in {filters.category}
              </span>
            )}
            {showFavoritesOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">
                <Heart className="h-2.5 w-2.5" />
                Favorites
              </span>
            )}
          </span>
          {searchQuery && <span>for &ldquo;{searchQuery}&rdquo;</span>}
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProviderCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => loadProviders()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filteredProviders.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <Users className="h-8 w-8 text-slate-400" />
          </div>
          <p className="mt-4 text-base font-bold text-slate-800">
            {showFavoritesOnly ? "No favorite providers yet" : "No providers found"}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">
            {showFavoritesOnly
              ? "Heart some providers to save them to your favorites"
              : "Try adjusting your search or filters to find providers nearby"}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilters({
                    category: "",
                    minRating: null,
                    showOnlineOnly: false,
                    sortBy: "distance",
                  });
                  setSearchQuery("");
                  setShowFavoritesOnly(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
              >
                Clear Filters
              </button>
            )}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Market
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && filteredProviders.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredProviders.map((provider) => {
            const isFavorite = favoriteProviderIds.has(provider.id);

            return (
              <div
                key={provider.id}
                className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-4 transition shadow-sm hover:border-[var(--brand-300)] hover:shadow-lg hover:shadow-slate-200/50 ${
                  quickViewProvider?.id === provider.id ? "border-[var(--brand-400)] ring-2 ring-[var(--brand-100)]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setQuickViewProvider(provider)}
                      className="relative"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-xl font-bold text-[var(--brand-700)] transition hover:opacity-80">
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
                        <span className="absolute -right-0.5 bottom-0 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuickViewProvider(provider)}
                          className="truncate text-sm font-bold text-slate-900 hover:text-[var(--brand-700)] transition"
                        >
                          {provider.name}
                        </button>
                        {provider.isOnline && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                            Online
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                        )}
                        {provider.verified && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
                            <TrendingUp className="h-2.5 w-2.5" />
                            Verified
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {provider.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {provider.location}
                          </span>
                        )}
                        {provider.distanceKm != null && (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                            {provider.distanceKm} km away
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {provider.avgRating != null && provider.avgRating > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            <span className="text-xs font-semibold text-amber-700">
                              {provider.avgRating.toFixed(1)}
                            </span>
                            {provider.reviewCount > 0 && (
                              <span className="text-xs text-amber-600">({provider.reviewCount})</span>
                            )}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                            <Star className="h-3.5 w-3.5 text-slate-300" />
                            No reviews
                          </span>
                        )}
                        {provider.completedJobs > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            <TrendingUp className="h-3 w-3 text-emerald-600" />
                            {provider.completedJobs} jobs
                          </span>
                        )}
                        {provider.responseMinutes != null && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            <Clock className="h-3 w-3" />
                            ~{provider.responseMinutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(provider.id)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition ${
                        isFavorite
                          ? "border-rose-200 bg-rose-50 text-rose-600"
                          : "border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:text-slate-600"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
                    </button>
                    {provider.priceMin != null && (
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-700">
                          from {formatCurrency(provider.priceMin)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {provider.bio && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{provider.bio}</p>
                )}

                {provider.listings.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {provider.listings.slice(0, 4).map((listing) => (
                      <span
                        key={listing.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                      >
                        <Store className="h-3 w-3 text-slate-400" />
                        {listing.title}
                        {listing.price != null && (
                          <span className="font-semibold text-[var(--brand-700)]">
                            {formatCurrency(listing.price)}
                          </span>
                        )}
                      </span>
                    ))}
                    {provider.listings.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setQuickViewProvider(provider)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-200 transition"
                      >
                        +{provider.listings.length - 4} more
                      </button>
                    )}
                  </div>
                )}

                 <div className="mt-1.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                   <Link
                     href={`/dashboard/chat?recipientId=${encodeURIComponent(provider.id)}`}
                     className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)] hover:shadow-md"
                   >
                     <MessageCircle className="h-3.5 w-3.5" />
                     Chat
                   </Link>

                   <Link
                     href={`/dashboard/chat?recipientId=${encodeURIComponent(provider.id)}&draft_kind=interest&draft_title=${encodeURIComponent(`Quote request for ${provider.name}`)}`}
                     className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
                   >
                     <Quote className="h-3.5 w-3.5" />
                     Request Quote
                   </Link>

                   {buildPublicProfilePath(provider) && (
                     <Link
                       href={buildPublicProfilePath(provider)!}
                       className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                     >
                       <Store className="h-3.5 w-3.5" />
                       View Profile
                     </Link>
                   )}

                   <button
                     type="button"
                     onClick={() => setQuickViewProvider(provider)}
                     className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                   >
                     Quick View
                   </button>

                  {connectedProviderIds.has(provider.id) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <Star className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />
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
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {connectingProviderId === provider.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )}
                      {connectingProviderId === provider.id
                        ? "..."
                        : connectionError?.providerId === provider.id
                          ? "Retry"
                          : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && filteredProviders.length > 0 && (
        <div ref={loadMoreSentinelRef} className="flex justify-center pt-6 pb-2">
          {loadingMore && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more providers...
            </div>
          )}
          {!loadingMore && !pagination.hasMore && (
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" />
              All {pagination.total} providers loaded
            </div>
          )}
        </div>
      )}

      {quickViewProvider && (
        <ProviderQuickViewModal
          provider={quickViewProvider}
          isFavorite={favoriteProviderIds.has(quickViewProvider.id)}
          onClose={() => setQuickViewProvider(null)}
          onToggleFavorite={toggleFavorite}
          onConnect={handleConnect}
          connecting={connectingProviderId === quickViewProvider.id}
        />
      )}

      <ProfileToastViewport toasts={toasts} onDismiss={(toastId) => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
        const timerId = toastTimersRef.current.get(toastId);
        if (timerId) {
          window.clearTimeout(timerId);
          toastTimersRef.current.delete(toastId);
        }
      }} />
    </div>
  );
}
