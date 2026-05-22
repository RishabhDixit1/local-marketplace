"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MapPin, MessageCircle, SlidersHorizontal, UserPlus, X, Store, Star, User, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageContextStrip from "@/app/components/PageContextStrip";
import RouteObservability from "@/app/components/RouteObservability";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import ProfileToastViewport, {
  type ProfileToast,
} from "@/app/components/profile/ProfileToastViewport";
import AcceptConfirmDialog from "@/app/dashboard/components/posts/AcceptConfirmDialog";
import FeedFilters from "@/app/dashboard/components/posts/FeedFilters";
import FeedGrid from "@/app/dashboard/components/posts/FeedGrid";
import { useFeedActions } from "@/app/dashboard/components/posts/useFeedActions";
import { useMarketplaceFeed } from "@/app/dashboard/components/posts/useMarketplaceFeed";
import type { PublishPostResult } from "@/app/components/CreatePostModal";
import WhatHappensNext from "@/app/components/trust/WhatHappensNext";
import {
  buildMarketplaceFeedCardId,
  type MarketplaceDisplayFeedItem,
} from "@/lib/marketplaceFeed";
import type { MarketplacePrimaryActionKind } from "@/lib/marketplaceCardActions";

const CreatePostModal = dynamic(
  () => import("@/app/components/CreatePostModal").then((mod) => mod.default),
  { ssr: false },
);

const MOBILE_INITIAL_VISIBLE_ITEMS = 8;
const MOBILE_VISIBLE_INCREMENT = 6;

const buildPublicProfilePath = (profile: { id: string; name?: string | null }) => {
  if (!profile.name) return null;
  const slug = profile.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return null;
  return `/profile/${slug}?provider=${encodeURIComponent(profile.id)}`;
};

export default function MarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openPostModal, setOpenPostModal] = useState(false);
  const [hoveredMapItemId, setHoveredMapItemId] = useState<string | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [providers, setProviders] = useState<{ id: string; name: string; location: string; avatarUrl: string; bio: string; avgRating: number | null; reviewCount: number; serviceCount: number; completedJobs: number; responseMinutes: number | null; isOnline: boolean; priceMin: number | null; priceMax: number | null; distanceKm: number | null; listings: { id: string; title: string; category: string; price: number | null }[]; verified: boolean }[]>([]);
  const [toasts, setToasts] = useState<ProfileToast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const mobileLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [showPostExplainer, setShowPostExplainer] = useState(false);
  const [mobileVisibleState, setMobileVisibleState] = useState({
    count: MOBILE_INITIAL_VISIBLE_ITEMS,
    key: "",
  });
  const [connectingProviderId, setConnectingProviderId] = useState<string | null>(null);
  const [connectedProviderIds, setConnectedProviderIds] = useState<Set<string>>(new Set());

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
    [],
  );

  const handleConnect = useCallback(
    async (providerId: string, providerName: string) => {
      if (connectedProviderIds.has(providerId)) return;

      setConnectingProviderId(providerId);

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
          pushToast("error", result?.message || `Failed to connect with ${providerName}`);
        }
      } catch (err) {
        pushToast(
          "error",
          err instanceof Error ? err.message : `Failed to connect with ${providerName}`
        );
      } finally {
        setConnectingProviderId(null);
      }
    },
    [connectedProviderIds, pushToast]
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const syncViewport = () => {
      setIsSmallScreen(mediaQuery.matches);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  const {
    viewerId,
    setViewerId,
    feed,
    setFeed,
    filters,
    setFilters,
    showAdvancedFilters,
    setShowAdvancedFilters,
    feedError,
    categoryOptions,
    displayFeed,
    showFeedLoading,
    activeMapItemId,
    setActiveMapItemId,
    focusItemId,
    composeRequested,
    consumeComposeRequest,
    fetchFeed,
    resetFilters,
  } = useMarketplaceFeed({ pushToast });

  useEffect(() => {
    let active = true;
    const category = searchParams.get("category") || filters.category;
    const url = category
      ? `/api/community/providers-by-category?category=${encodeURIComponent(category)}`
      : `/api/community/providers-by-category?limit=6`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setProviders(data.providers || []);
      })
      .catch(() => {});

    return () => { active = false; };
  }, [searchParams, filters.category]);

  const {
    acceptTarget,
    setAcceptTarget,
    confirmAccept,
    resolveActionModel,
    handlePrimaryAction,
    handleSecondaryAction,
    isSavedListing,
    isListingBusy,
    savingListingIds,
    acceptingListingIds,
    discardingListingIds,
    chatOpeningProviderId,
    sharingCardId,
  } = useFeedActions({
    viewerId,
    setViewerId,
    setFeed,
    refreshFeed: fetchFeed,
    pushToast,
  });

  const composerOpen = openPostModal || composeRequested;

  const postsPromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: isSmallScreen
        ? "Search titles, category, or location"
        : "Search by title, details, category, creator, or location",
      value: filters.query,
      onValueChange: (nextValue: string) => {
        setFilters((current) => ({ ...current, query: nextValue }));
      },
      onSubmit: () => {
        // Search is live as the query changes.
      },
      actions: [
        {
          id: "filters",
          label: showAdvancedFilters ? "Hide Filters" : "Filters",
          icon: SlidersHorizontal,
          onClick: () => {
            setShowAdvancedFilters((current) => !current);
          },
          variant: "secondary",
          active: showAdvancedFilters,
          showWhenFocused: true,
        },
      ],
    }),
    [
      filters.query,
      isSmallScreen,
      setFilters,
      showAdvancedFilters,
      setShowAdvancedFilters,
    ],
  );

  useDashboardPrompt(postsPromptConfig);

  const mobileFeedResetKey = useMemo(() => {
    return [
      filters.category,
      filters.freshOnly,
      filters.maxDistanceKm,
      filters.mediaOnly,
      filters.query,
      filters.type,
      filters.urgentOnly,
      filters.verifiedOnly,
    ].join("|");
  }, [
    filters.category,
    filters.freshOnly,
    filters.maxDistanceKm,
    filters.mediaOnly,
    filters.query,
    filters.type,
    filters.urgentOnly,
    filters.verifiedOnly,
  ]);

  const rawMobileVisibleCount =
    mobileVisibleState.key === mobileFeedResetKey
      ? mobileVisibleState.count
      : MOBILE_INITIAL_VISIBLE_ITEMS;

  const updateMobileVisibleCount = useCallback(
    (updater: number | ((current: number) => number)) => {
      setMobileVisibleState((current) => {
        const currentCount =
          current.key === mobileFeedResetKey
            ? current.count
            : MOBILE_INITIAL_VISIBLE_ITEMS;
        const nextCount =
          typeof updater === "function" ? updater(currentCount) : updater;

        return {
          count: nextCount,
          key: mobileFeedResetKey,
        };
      });
    },
    [mobileFeedResetKey],
  );

  const resolvedHoveredMapItemId = useMemo(
    () =>
      hoveredMapItemId &&
      displayFeed.some((item) => item.id === hoveredMapItemId)
        ? hoveredMapItemId
        : null,
    [displayFeed, hoveredMapItemId],
  );

  const resolvedMobileVisibleCount = useMemo(() => {
    if (!isSmallScreen || !focusItemId) return rawMobileVisibleCount;

    const focusIndex = displayFeed.findIndex((item) => item.id === focusItemId);
    if (focusIndex === -1) return rawMobileVisibleCount;

    return Math.max(rawMobileVisibleCount, focusIndex + 1);
  }, [displayFeed, focusItemId, isSmallScreen, rawMobileVisibleCount]);

  const visibleFeed = useMemo(() => {
    if (!isSmallScreen) {
      return displayFeed;
    }

    return displayFeed.slice(0, resolvedMobileVisibleCount);
  }, [displayFeed, isSmallScreen, resolvedMobileVisibleCount]);

  const hasMoreMobileItems =
    isSmallScreen && visibleFeed.length < displayFeed.length;

  useEffect(() => {
    if (
      !hasMoreMobileItems ||
      !mobileLoadMoreRef.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;

        updateMobileVisibleCount((current) => {
          if (current >= displayFeed.length) {
            return current;
          }

          return Math.min(
            current + MOBILE_VISIBLE_INCREMENT,
            displayFeed.length,
          );
        });
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(mobileLoadMoreRef.current);

    return () => observer.disconnect();
  }, [displayFeed.length, hasMoreMobileItems, updateMobileVisibleCount]);

  const handleResetOrRefresh = useCallback(() => {
    resetFilters();
    if (feed.length === 0) {
      void fetchFeed(true);
    }
  }, [feed.length, fetchFeed, resetFilters]);

  const isSaveBusy = useCallback(
    (item: MarketplaceDisplayFeedItem) => isListingBusy(item, savingListingIds),
    [isListingBusy, savingListingIds],
  );

  const isShareBusy = useCallback(
    (item: MarketplaceDisplayFeedItem) => {
      const cardId = buildMarketplaceFeedCardId(item);
      return sharingCardId === cardId || sharingCardId === item.id;
    },
    [sharingCardId],
  );

  const isPrimaryBusy = useCallback(
    (
      item: MarketplaceDisplayFeedItem,
      primaryKind: MarketplacePrimaryActionKind,
    ) => {
      if (primaryKind === "send_quote") {
        return chatOpeningProviderId === item.providerId;
      }

      if (
        primaryKind === "accept" ||
        primaryKind === "withdraw" ||
        primaryKind === "decline"
      ) {
        return isListingBusy(item, acceptingListingIds);
      }

      if (primaryKind === "discard") {
        return isListingBusy(item, discardingListingIds);
      }

      return false;
    },
    [
      acceptingListingIds,
      chatOpeningProviderId,
      discardingListingIds,
      isListingBusy,
    ],
  );

  const handlePublished = useCallback(
    (result?: PublishPostResult) => {
      if (result?.postType === "need") {
        pushToast(
          "success",
          result.matchedCount && result.matchedCount > 0
            ? `Request published. ${result.matchedCount} provider matches are ready.`
            : "Request published. Matching is in progress.",
        );
        setShowPostExplainer(true);
        setTimeout(() => setShowPostExplainer(false), 8000);
        void fetchFeed(true);
      } else {
        router.push("/dashboard/profile");
      }
    },
    [fetchFeed, pushToast, router],
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--surface-app)] pb-24 pt-5 text-slate-900 sm:pt-6">
      <RouteObservability route="dashboard" />

      <div className="mx-auto w-full max-w-[1360px] space-y-4 px-3 sm:space-y-5 sm:px-6">
        {/* ── Location hero ── */}
        <div className="overflow-hidden rounded-2xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] to-white px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-100)]">
                <MapPin className="h-5 w-5 text-[var(--brand-700)]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Serving Crossings Republik, Ghaziabad</h2>
                <p className="text-xs text-slate-500">Uttar Pradesh 201016 — Hyperlocal marketplace</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Electrician", "Plumber", "AC Repair", "RO Repair", "Carpenter", "Appliance Repair"].map((cat) => (
                <Link
                  key={cat}
                  href={`/dashboard?category=${encodeURIComponent(cat)}`}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
            <MapPin className="h-3 w-3" />
            <span>Covering: Mahagun Mascot, Panchsheel Wellington, Galleria Market, Avantika Retail Street, and 12+ areas</span>
          </div>
        </div>

        {filters.category ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--brand-200)] bg-gradient-to-r from-[var(--brand-50)] to-white px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-100)]">
                <Store className="h-4 w-4 text-[var(--brand-700)]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {providers.length > 0
                    ? `${providers.length} ${filters.category} provider${providers.length === 1 ? "" : "s"} near Crossings Republik`
                    : `Showing results for ${filters.category}`}
                </h2>
                <p className="text-xs text-slate-500">
                  Browse services, providers, and requests — or refine below
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              <X className="h-3 w-3" />
              Clear filter
            </Link>
          </div>
        ) : (
          <PageContextStrip
            label="Find Help"
            description="Browse the full marketplace — nearby needs, services, products, and providers."
            action={{ label: "Post Need", href: "/dashboard/create_post" }}
          />
        )}

         <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <User className="h-4 w-4 text-[var(--brand-600)]" />
                  {filters.category
                    ? "Available Providers"
                    : "Local Providers Near You"}
                </h3>
                {!filters.category && (
                  <Link
                    href="/dashboard/providers"
                    className="inline-flex items-center gap-1 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
                  >
                    Browse All
                    <SlidersHorizontal className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {providers.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className="group flex min-w-[240px] max-w-[280px] shrink-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--brand-200)] hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-100)] text-sm font-bold text-[var(--brand-700)]">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                          <p className="truncate text-xs text-slate-500">{p.location || "Crossings Republik"}</p>
                        </div>
                        {p.isOnline && (
                          <div className="ml-auto">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                          </div>
                        )}
                      </div>
                      {p.bio && (
                        <p className="line-clamp-2 text-xs text-slate-600">{p.bio}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {p.avgRating ? (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-amber-500" />
                            {p.avgRating.toFixed(1)}
                          </span>
                        ) : null}
                        <span>{p.serviceCount} service{p.serviceCount === 1 ? "" : "s"}</span>
                        {p.completedJobs > 0 && (
                          <span>{p.completedJobs} job{p.completedJobs === 1 ? "" : "s"}</span>
                        )}
                      </div>
                      {p.listings.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {p.listings.slice(0, 3).map((l) => (
                            <span
                              key={l.id}
                              className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {l.title}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2">
                        <Link
                          href={`/dashboard/chat?recipientId=${encodeURIComponent(p.id)}`}
                          className="inline-flex items-center gap-1 rounded-xl bg-[var(--brand-900)] px-2.5 py-1.5 text-[10px] font-semibold text-white transition hover:bg-[var(--brand-800)]"
                        >
                          <MessageCircle className="h-3 w-3" />
                          Chat
                        </Link>

                        {buildPublicProfilePath(p) && (
                          <Link
                            href={buildPublicProfilePath(p)!}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                          >
                            <Store className="h-3 w-3" />
                            Storefront
                          </Link>
                        )}

                        {connectedProviderIds.has(p.id) ? (
                          <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
                            <Star className="h-3 w-3" />
                            Connected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleConnect(p.id, p.name)}
                            disabled={connectingProviderId === p.id}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {connectingProviderId === p.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <UserPlus className="h-3 w-3" />
                            )}
                            {connectingProviderId === p.id ? "..." : "Connect"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  No nearby providers yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Be the first to offer services in your area, or check back later
                </p>
                <Link
                  href="/dashboard/providers"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
                >
                  Browse Providers
                  <SlidersHorizontal className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

         {showPostExplainer && (
          <WhatHappensNext kind="post_need" />
        )}

        {showAdvancedFilters && (
          <FeedFilters
            filters={filters}
            categoryOptions={categoryOptions}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvanced={() =>
              setShowAdvancedFilters((current) => !current)
            }
            onReset={resetFilters}
            onFiltersChange={setFilters}
          />
        )}

        {feedError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">
              Could not fully refresh the live feed.
            </p>
            <p className="mt-1 text-xs">{feedError}</p>
          </div>
        ) : null}

        <FeedGrid
          items={visibleFeed}
          loading={showFeedLoading}
          hasAnyFeed={feed.length > 0}
          feedError={feedError}
          focusItemId={focusItemId}
          activeItemId={activeMapItemId}
          hoveredItemId={resolvedHoveredMapItemId}
          viewerId={viewerId}
          onActiveItemChange={setActiveMapItemId}
          onHoverItemChange={setHoveredMapItemId}
          onResetOrRefresh={handleResetOrRefresh}
          onOpenComposer={() => setOpenPostModal(true)}
          resolveActionModel={resolveActionModel}
          isSavedListing={isSavedListing}
          isSaveBusy={isSaveBusy}
          isShareBusy={isShareBusy}
          isPrimaryBusy={isPrimaryBusy}
          onPrimaryAction={handlePrimaryAction}
          onSecondaryAction={handleSecondaryAction}
          onFeedRefresh={() => void fetchFeed(true)}
        />

        {hasMoreMobileItems ? (
          <div className="pb-2 sm:hidden">
            <div ref={mobileLoadMoreRef} className="h-3 w-full" aria-hidden />
            <button
              type="button"
              onClick={() =>
                updateMobileVisibleCount((current) =>
                  Math.min(
                    current + MOBILE_VISIBLE_INCREMENT,
                    displayFeed.length,
                  ),
                )
              }
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Show more posts
            </button>
          </div>
        ) : null}
      </div>

      <AcceptConfirmDialog
        open={!!acceptTarget}
        listing={acceptTarget}
        busy={
          !!(acceptTarget && isListingBusy(acceptTarget, acceptingListingIds))
        }
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => {
          void confirmAccept();
        }}
      />

      {composerOpen ? (
        <CreatePostModal
          open={composerOpen}
          allowedPostTypes={["need"]}
          onClose={() => {
            setOpenPostModal(false);
            if (composeRequested) {
              consumeComposeRequest();
            }
          }}
          onPublished={handlePublished}
        />
      ) : null}

      <ProfileToastViewport
        toasts={toasts}
        onDismiss={(toastId) => {
          setToasts((current) =>
            current.filter((toast) => toast.id !== toastId),
          );
          const timeoutId = toastTimersRef.current.get(toastId);
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            toastTimersRef.current.delete(toastId);
          }
        }}
      />
    </div>
  );
}
