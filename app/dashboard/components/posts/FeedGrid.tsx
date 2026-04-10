"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  MarketplaceCardActionModel,
  MarketplacePrimaryActionKind,
  MarketplaceSecondaryActionKind,
} from "@/lib/marketplaceCardActions";
import type { MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";
import FeedCard from "@/app/dashboard/components/posts/FeedCard";
import FeedEmptyState from "@/app/dashboard/components/posts/FeedEmptyState";
import { Loader2, Pencil, Save, X } from "lucide-react";

type FeedGridProps = {
  items: MarketplaceDisplayFeedItem[];
  loading: boolean;
  hasAnyFeed: boolean;
  feedError: string | null;
  focusItemId: string;
  activeItemId: string | null;
  hoveredItemId: string | null;
  viewerId?: string | null;
  onActiveItemChange: (itemId: string) => void;
  onHoverItemChange: (itemId: string | null) => void;
  onResetOrRefresh: () => void;
  onOpenComposer: () => void;
  resolveActionModel: (
    item: MarketplaceDisplayFeedItem,
  ) => MarketplaceCardActionModel;
  isSavedListing: (item: MarketplaceDisplayFeedItem) => boolean;
  isSaveBusy: (item: MarketplaceDisplayFeedItem) => boolean;
  isShareBusy: (item: MarketplaceDisplayFeedItem) => boolean;
  isPrimaryBusy: (
    item: MarketplaceDisplayFeedItem,
    primaryKind: MarketplacePrimaryActionKind,
  ) => boolean;
  onPrimaryAction: (
    item: MarketplaceDisplayFeedItem,
    primaryKind: MarketplacePrimaryActionKind,
  ) => void | Promise<void>;
  onSecondaryAction: (
    item: MarketplaceDisplayFeedItem,
    action: MarketplaceSecondaryActionKind,
  ) => void | Promise<void>;
  onFeedRefresh?: () => void;
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
  viewerId,
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
  onFeedRefresh,
  renderHeaderAction,
}: FeedGridProps) {
  const cardRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const deepLinkHandledRef = useRef(false);
  const skeletonCards = useMemo(
    () => Array.from({ length: 6 }, (_, index) => `skeleton-${index}`),
    [],
  );

  // Owner post management state
  const [ownerBusyId, setOwnerBusyId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<{
    id: string;
    title: string;
    details: string;
    category: string;
    budget: number;
  } | null>(null);

  const handleOwnerArchive = useCallback(
    async (item: MarketplaceDisplayFeedItem) => {
      if (item.source !== "post") return;
      if (
        !window.confirm(
          "Archive this post? It will no longer appear in the feed.",
        )
      )
        return;
      setOwnerBusyId(item.id);
      try {
        const res = await fetch("/api/posts/manage", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: item.id, action: "archive" }),
        });
        if (res.ok) onFeedRefresh?.();
      } finally {
        setOwnerBusyId(null);
      }
    },
    [onFeedRefresh],
  );

  const handleOwnerDelete = useCallback(
    async (item: MarketplaceDisplayFeedItem) => {
      const confirmMessage =
        item.source === "help_request"
          ? "Delete this request from your live feed? This cannot be undone."
          : "Permanently delete this post? This cannot be undone.";
      if (!window.confirm(confirmMessage)) return;

      setOwnerBusyId(item.id);
      try {
        const res =
          item.source === "help_request" && item.helpRequestId
            ? await fetch("/api/needs/status", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  helpRequestId: item.helpRequestId,
                  status: "cancelled",
                }),
              })
            : await fetch(`/api/posts/manage?postId=${item.id}`, {
                method: "DELETE",
                credentials: "include",
              });
        if (res.ok) onFeedRefresh?.();
      } finally {
        setOwnerBusyId(null);
      }
    },
    [onFeedRefresh],
  );

  const handleOwnerSaveEdit = useCallback(async () => {
    if (!editingPost) return;
    setOwnerBusyId(editingPost.id);
    try {
      const res = await fetch("/api/posts/manage", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: editingPost.id,
          action: "edit",
          title: editingPost.title,
          details: editingPost.details,
          category: editingPost.category,
          budget: editingPost.budget,
        }),
      });
      if (res.ok) {
        setEditingPost(null);
        onFeedRefresh?.();
      }
    } finally {
      setOwnerBusyId(null);
    }
  }, [editingPost, onFeedRefresh]);

  useEffect(() => {
    if (!focusItemId || deepLinkHandledRef.current) return;
    if (!items.some((item) => item.id === focusItemId)) return;

    deepLinkHandledRef.current = true;
    onActiveItemChange(focusItemId);

    const frameId = window.requestAnimationFrame(() => {
      cardRefs.current
        .get(focusItemId)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focusItemId, items, onActiveItemChange]);

  if (loading) {
    return (
      <div className="grid gap-3 xl:grid-cols-2">
        {skeletonCards.map((key) => (
          <div
            key={key}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
          >
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
    <>
      {/* ── Edit Post Modal ──────────────────────────────────────── */}
      {editingPost && (
        <div className="fixed inset-0 z-[var(--layer-modal)] flex items-end justify-center bg-slate-950/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-[var(--brand-700)]" />
                <h2 className="text-sm font-bold text-slate-900">Edit Post</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Title
                </label>
                <input
                  value={editingPost.title}
                  onChange={(e) =>
                    setEditingPost({ ...editingPost, title: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/30"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingPost.details}
                  onChange={(e) =>
                    setEditingPost({ ...editingPost, details: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Category
                  </label>
                  <input
                    value={editingPost.category}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        category: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    Budget (INR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingPost.budget}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        budget: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/30"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => void handleOwnerSaveEdit()}
                disabled={ownerBusyId === editingPost.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
              >
                {ownerBusyId === editingPost.id ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                Save changes
              </button>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {items.map((item, index) => {
          const actionModel = resolveActionModel(item);
          const isOwner =
            !!viewerId &&
            item.providerId === viewerId &&
            (item.source === "post" || item.source === "help_request");
          const canEditOwnerItem = item.source === "post";

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
                  withdraw: isPrimaryBusy(item, "withdraw"),
                  decline: isPrimaryBusy(item, "decline"),
                  send_quote: isPrimaryBusy(item, "send_quote"),
                  view_profile: false,
                  discard: isPrimaryBusy(item, "discard"),
                  save: isSaveBusy(item),
                  share: isShareBusy(item),
                }}
                onPrimaryAction={(action) => onPrimaryAction(item, action)}
                onSecondaryAction={(action) => onSecondaryAction(item, action)}
                onFocus={() => onActiveItemChange(item.id)}
                onHoverChange={(hovered) =>
                  onHoverItemChange(hovered ? item.id : null)
                }
                headerAction={
                  renderHeaderAction ? renderHeaderAction(item) : null
                }
                isOwner={isOwner}
                ownerBusy={ownerBusyId === item.id}
                onOwnerEdit={
                  canEditOwnerItem
                    ? () =>
                        setEditingPost({
                          id: item.id,
                          title: item.title,
                          details: item.description,
                          category: item.category,
                          budget: item.price,
                        })
                    : undefined
                }
                onOwnerArchive={
                  canEditOwnerItem
                    ? () => void handleOwnerArchive(item)
                    : undefined
                }
                onOwnerDelete={() => void handleOwnerDelete(item)}
                ownerDeleteLabel={
                  item.source === "help_request"
                    ? "Delete request"
                    : "Delete post"
                }
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
