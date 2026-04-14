"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export default function MarketplacePage() {
  const router = useRouter();
  const [openPostModal, setOpenPostModal] = useState(false);
  const [hoveredMapItemId, setHoveredMapItemId] = useState<string | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [mobileVisibleState, setMobileVisibleState] = useState({
    count: MOBILE_INITIAL_VISIBLE_ITEMS,
    key: "",
  });
  const [toasts, setToasts] = useState<ProfileToast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const mobileLoadMoreRef = useRef<HTMLDivElement | null>(null);

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
