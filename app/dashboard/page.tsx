"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RouteObservability from "@/app/components/RouteObservability";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import ProfileToastViewport, { type ProfileToast } from "@/app/components/profile/ProfileToastViewport";
import AcceptConfirmDialog from "@/app/dashboard/components/posts/AcceptConfirmDialog";
import FeedFilters from "@/app/dashboard/components/posts/FeedFilters";
import FeedGrid from "@/app/dashboard/components/posts/FeedGrid";
import { useFeedActions } from "@/app/dashboard/components/posts/useFeedActions";
import { useMarketplaceFeed } from "@/app/dashboard/components/posts/useMarketplaceFeed";
import type { PublishPostResult } from "@/app/components/CreatePostModal";
import { buildMarketplaceFeedCardId, type MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";
import type { MarketplacePrimaryActionKind } from "@/lib/marketplaceCardActions";

const CreatePostModal = dynamic(
  () => import("@/app/components/CreatePostModal").then((mod) => mod.default),
  { ssr: false }
);

export default function MarketplacePage() {
  const router = useRouter();
  const [openPostModal, setOpenPostModal] = useState(false);
  const [hoveredMapItemId, setHoveredMapItemId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ProfileToast[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const pushToast = useCallback((kind: ProfileToast["kind"], message: string) => {
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
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;

    return () => {
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
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
    refreshing,
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
      placeholder: "Search by title, details, category, creator, or location",
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
        },
        {
          id: "refresh-posts",
          label: refreshing ? "Refreshing..." : "Refresh",
          icon: RefreshCw,
          onClick: () => {
            void fetchFeed(true);
          },
          busy: refreshing,
          disabled: refreshing,
          variant: "secondary",
        },
      ],
    }),
    [fetchFeed, filters.query, refreshing, setFilters, showAdvancedFilters, setShowAdvancedFilters]
  );

  useDashboardPrompt(postsPromptConfig);

  const resolvedHoveredMapItemId = useMemo(
    () => (hoveredMapItemId && displayFeed.some((item) => item.id === hoveredMapItemId) ? hoveredMapItemId : null),
    [displayFeed, hoveredMapItemId]
  );

  const handleResetOrRefresh = useCallback(() => {
    resetFilters();
    if (feed.length === 0) {
      void fetchFeed(true);
    }
  }, [feed.length, fetchFeed, resetFilters]);

  const isSaveBusy = useCallback(
    (item: MarketplaceDisplayFeedItem) => isListingBusy(item, savingListingIds),
    [isListingBusy, savingListingIds]
  );

  const isShareBusy = useCallback(
    (item: MarketplaceDisplayFeedItem) => {
      const cardId = buildMarketplaceFeedCardId(item);
      return sharingCardId === cardId || sharingCardId === item.id;
    },
    [sharingCardId]
  );

  const isPrimaryBusy = useCallback(
    (item: MarketplaceDisplayFeedItem, primaryKind: MarketplacePrimaryActionKind) => {
      if (primaryKind === "send_quote") {
        return chatOpeningProviderId === item.providerId;
      }

      if (primaryKind === "accept") {
        return isListingBusy(item, acceptingListingIds);
      }

      if (primaryKind === "discard") {
        return isListingBusy(item, discardingListingIds);
      }

      return false;
    },
    [acceptingListingIds, chatOpeningProviderId, discardingListingIds, isListingBusy]
  );

  const handlePublished = useCallback(
    (result?: PublishPostResult) => {
      if (result?.postType === "need") {
        pushToast(
          "success",
          result.matchedCount && result.matchedCount > 0
            ? `Request published. ${result.matchedCount} provider matches are ready.`
            : "Request published. Matching is in progress."
        );
        void fetchFeed(true);
      } else {
        router.push("/dashboard/profile");
      }
    },
    [fetchFeed, pushToast, router]
  );

  return (
    <div className="min-h-screen bg-[var(--surface-app)] pb-24 pt-5 text-slate-900 sm:pt-6">
      <RouteObservability route="dashboard" />

      <div className="mx-auto w-full max-w-[1360px] space-y-4 px-3 sm:space-y-5 sm:px-6">
        {(filters.query.length > 0 || showAdvancedFilters) && (
          <FeedFilters
            filters={filters}
            categoryOptions={categoryOptions}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvanced={() => setShowAdvancedFilters((current) => !current)}
            onReset={resetFilters}
            onFiltersChange={setFilters}
          />
        )}

        {feedError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">Could not fully refresh the live feed.</p>
            <p className="mt-1 text-xs">{feedError}</p>
          </div>
        ) : null}

        <FeedGrid
          items={displayFeed}
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
      </div>

      <AcceptConfirmDialog
        open={!!acceptTarget}
        listing={acceptTarget}
        busy={!!(acceptTarget && isListingBusy(acceptTarget, acceptingListingIds))}
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => {
          void confirmAccept();
        }}
      />

      {composerOpen ? (
        <CreatePostModal
          open={composerOpen}
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
          setToasts((current) => current.filter((toast) => toast.id !== toastId));
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
