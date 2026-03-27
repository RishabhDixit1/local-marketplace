"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import type {
  MarketplaceCardActionModel,
  MarketplacePrimaryActionKind,
  MarketplaceSecondaryActionKind,
} from "@/lib/marketplaceCardActions";
import type { MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";
import FeedCard from "@/app/dashboard/components/posts/FeedCard";
import FeedEmptyState from "@/app/dashboard/components/posts/FeedEmptyState";

type FeedGridProps = {
  items: MarketplaceDisplayFeedItem[];
  loading: boolean;
  hasAnyFeed: boolean;
  feedError: string | null;
  focusItemId: string;
  activeItemId: string | null;
  hoveredItemId: string | null;
  onActiveItemChange: (itemId: string) => void;
  onHoverItemChange: (itemId: string | null) => void;
  onResetOrRefresh: () => void;
  onOpenComposer: () => void;
  resolveActionModel: (item: MarketplaceDisplayFeedItem) => MarketplaceCardActionModel;
  isSavedListing: (item: MarketplaceDisplayFeedItem) => boolean;
  isSaveBusy: (item: MarketplaceDisplayFeedItem) => boolean;
  isShareBusy: (item: MarketplaceDisplayFeedItem) => boolean;
  isPrimaryBusy: (item: MarketplaceDisplayFeedItem, primaryKind: MarketplacePrimaryActionKind) => boolean;
  onPrimaryAction: (item: MarketplaceDisplayFeedItem, primaryKind: MarketplacePrimaryActionKind) => void | Promise<void>;
  onSecondaryAction: (item: MarketplaceDisplayFeedItem, action: MarketplaceSecondaryActionKind) => void | Promise<void>;
  renderHeaderAction?: (item: MarketplaceDisplayFeedItem) => ReactNode;
};

export default function FeedGrid({
  items,
  loading,
  hasAnyFeed,
  feedError,
  focusItemId,
  activeItemId,
  hoveredItemId,
  onActiveItemChange,
  onHoverItemChange,
  onResetOrRefresh,
  onOpenComposer,
  resolveActionModel,
  isSavedListing,
  isSaveBusy,
  isShareBusy,
  isPrimaryBusy,
  onPrimaryAction,
  onSecondaryAction,
  renderHeaderAction,
}: FeedGridProps) {
  const cardRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const deepLinkHandledRef = useRef(false);
  const skeletonCards = useMemo(() => Array.from({ length: 6 }, (_, index) => `skeleton-${index}`), []);

  useEffect(() => {
    if (!focusItemId || deepLinkHandledRef.current) return;
    if (!items.some((item) => item.id === focusItemId)) return;

    deepLinkHandledRef.current = true;
    onActiveItemChange(focusItemId);

    const frameId = window.requestAnimationFrame(() => {
      cardRefs.current.get(focusItemId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focusItemId, items, onActiveItemChange]);

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {skeletonCards.map((key) => (
          <div key={key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <div className="mt-3 h-44 animate-pulse rounded-2xl bg-slate-100" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <FeedEmptyState
        hasAnyFeed={hasAnyFeed}
        feedError={feedError}
        onResetOrRefresh={onResetOrRefresh}
        onOpenComposer={onOpenComposer}
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item, index) => {
        const actionModel = resolveActionModel(item);

        return (
          <div
            key={item.id}
            data-feed-card-id={item.id}
            ref={(node) => {
              cardRefs.current.set(item.id, node);
            }}
          >
            <FeedCard
              item={item}
              index={index}
              active={activeItemId === item.id || hoveredItemId === item.id}
              saved={isSavedListing(item)}
              buttons={actionModel.buttons}
              actionBusyState={{
                accept: isPrimaryBusy(item, "accept"),
                decline: isPrimaryBusy(item, "decline"),
                send_quote: isPrimaryBusy(item, "send_quote"),
                view_profile: false,
                save: isSaveBusy(item),
                share: isShareBusy(item),
              }}
              onPrimaryAction={(action) => onPrimaryAction(item, action)}
              onSecondaryAction={(action) => onSecondaryAction(item, action)}
              onFocus={() => onActiveItemChange(item.id)}
              onHoverChange={(hovered) => onHoverItemChange(hovered ? item.id : null)}
              headerAction={renderHeaderAction ? renderHeaderAction(item) : null}
            />
          </div>
        );
      })}
    </div>
  );
}
