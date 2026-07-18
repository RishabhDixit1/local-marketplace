"use client";

import {
  AnimatePresence,
  motion,
  type Variants,
} from "framer-motion";
import type React from "react";
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
import { ConfirmDialog } from "@/app/components/ui/ConfirmDialog";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { Input } from "@/app/components/ui/Input";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

const staggerCardVariants: Variants = {
  hidden: (i: number) => ({
    opacity: 0,
    y: 16,
    scale: 0.97,
    transition: { delay: i * 0.04 },
  }),
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.35,
      ease: [0.2, 0.8, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: -8,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const feedGridClassName =
  "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,23rem),1fr))] 2xl:gap-4";

type ToastKind = "success" | "error" | "info";

type FeedGridProps = {
  items: MarketplaceDisplayFeedItem[];
  cardTestId?: string;
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
  pushToast?: (kind: ToastKind, message: string) => void;
  renderHeaderAction?: (item: MarketplaceDisplayFeedItem) => ReactNode;
};

export default function FeedGrid({
  items,
  cardTestId = "feed-card",
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
  pushToast,
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
  const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<{
    id: string;
    title: string;
    details: string;
    category: string;
    budget: number;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    variant: "danger" | "warning" | "info";
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const handleOwnerArchive = useCallback(
    async (item: MarketplaceDisplayFeedItem) => {
      if (item.source !== "post") return;
      setConfirmDialog({
        title: "Archive post?",
        message: "It will no longer appear in the feed. You can restore it later.",
        variant: "warning",
        confirmLabel: "Archive",
        onConfirm: async () => {
          setConfirmDialog(null);
          setOwnerBusyId(item.id);
          try {
            await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/posts/manage", {
              method: "PATCH",
              body: JSON.stringify({ postId: item.id, action: "archive" }),
            });
            setPendingRemovalIds((current) => new Set(current).add(item.id));
            pushToast?.("success", "Post archived.");
            onFeedRefresh?.();
          } catch (error) {
            pushToast?.("error", error instanceof Error ? error.message : "Unable to archive this post.");
          } finally {
            setOwnerBusyId(null);
          }
        },
      });
    },
    [onFeedRefresh, pushToast],
  );

  const handleOwnerDelete = useCallback(
    async (item: MarketplaceDisplayFeedItem) => {
      const isHelpRequest = item.source === "help_request";
      setConfirmDialog({
        title: isHelpRequest ? "Delete request?" : "Delete post?",
        message: isHelpRequest
          ? "Delete this request from your live feed? This cannot be undone."
          : "Permanently delete this post? This cannot be undone.",
        variant: "danger",
        confirmLabel: "Delete",
        onConfirm: async () => {
          setConfirmDialog(null);
          setOwnerBusyId(item.id);
          try {
            if (isHelpRequest && item.helpRequestId) {
              await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/needs/status", {
                method: "POST",
                body: JSON.stringify({
                  helpRequestId: item.helpRequestId,
                  status: "cancelled",
                }),
              });
            } else {
              await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, `/api/posts/manage?postId=${item.id}`, {
                method: "DELETE",
              });
            }
            setPendingRemovalIds((current) => new Set(current).add(item.id));
            pushToast?.("success", isHelpRequest ? "Request deleted." : "Post deleted.");
            onFeedRefresh?.();
          } catch (error) {
            pushToast?.("error", error instanceof Error ? error.message : "Unable to delete this post.");
          } finally {
            setOwnerBusyId(null);
          }
        },
      });
    },
    [onFeedRefresh, pushToast],
  );

  const handleOwnerSaveEdit = useCallback(async () => {
    if (!editingPost) return;
    setOwnerBusyId(editingPost.id);
    try {
      await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/posts/manage", {
        method: "PATCH",
        body: JSON.stringify({
          postId: editingPost.id,
          action: "edit",
          title: editingPost.title,
          details: editingPost.details,
          category: editingPost.category,
          budget: editingPost.budget,
        }),
      });
      setEditingPost(null);
      pushToast?.("success", "Post updated.");
      onFeedRefresh?.();
    } catch (error) {
      pushToast?.("error", error instanceof Error ? error.message : "Unable to save changes.");
    } finally {
      setOwnerBusyId(null);
    }
  }, [editingPost, onFeedRefresh, pushToast]);

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
      <div className={feedGridClassName}>
        {skeletonCards.map((key) => (
          <div
            key={key}
            className="w-full max-w-[40rem] justify-self-center overflow-hidden rounded-[1.4rem] border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3.5 shadow-sm sm:rounded-[1.6rem] sm:p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--surface-soft)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--surface-soft)]" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--surface-soft)]" />
              </div>
            </div>
            <div className="mt-3 h-40 animate-pulse rounded-[1.2rem] bg-[var(--surface-soft)] sm:h-44 sm:rounded-[1.4rem]" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[var(--surface-soft)]" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-[var(--surface-soft)]" />
            <div className="mt-4 flex gap-2">
              <div className="h-9 w-9 animate-pulse rounded-xl bg-[var(--surface-soft)] sm:h-10 sm:w-28 sm:flex-1" />
              <div className="h-9 w-9 animate-pulse rounded-xl bg-[var(--surface-soft)] sm:h-10 sm:w-28 sm:flex-1" />
              <div className="ml-auto h-9 w-9 animate-pulse rounded-full bg-[var(--surface-soft)]" />
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
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--surface-border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <Pencil size={16} className="text-[var(--brand-700)]" />
                <h2 className="text-sm font-bold text-[var(--ink-950)]">Edit Post</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="rounded-full p-1.5 text-[var(--ink-500)] hover:bg-[var(--surface-soft)]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--ink-500)]">
                  Title
                </label>
                <Input
                  value={editingPost.title}
                  onChange={(e) =>
                    setEditingPost({ ...editingPost, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[var(--ink-500)]">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editingPost.details}
                  onChange={(e) =>
                    setEditingPost({ ...editingPost, details: e.target.value })
                  }
                  className="w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--ink-950)] focus:border-[var(--brand-500)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--ink-500)]">
                    Category
                  </label>
                  <Input
                    value={editingPost.category}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        category: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--ink-500)]">
                    Budget (INR)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={editingPost.budget}
                    onChange={(e) =>
                      setEditingPost({
                        ...editingPost,
                        budget: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 border-t border-[var(--surface-border)] px-5 py-4">
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
                className="rounded-2xl border border-[var(--surface-border)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={feedGridClassName}>
      <AnimatePresence mode="popLayout">
        {items.filter((item) => !pendingRemovalIds.has(item.id)).map((item, index) => {
          const actionModel = resolveActionModel(item);
          const isOwner =
            !!viewerId &&
            item.providerId === viewerId &&
            (item.source === "post" || item.source === "help_request");
          const canEditOwnerItem = item.source === "post";

          return (
            <motion.div
              key={item.id}
              custom={index}
              variants={staggerCardVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
              data-feed-card-id={item.id}
              className="h-full w-full min-w-0 max-w-[40rem] justify-self-center"
              ref={(node) => {
                cardRefs.current.set(item.id, node as unknown as HTMLElement | null);
              }}
            >
              <FeedCard
                item={item}
                index={index}
                testId={cardTestId}
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
                  hide: false,
                  report: false,
                  overflow: false,
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
                overflowButtons={actionModel.overflowButtons}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
      </div>

      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title ?? ""}
        message={confirmDialog?.message ?? ""}
        variant={confirmDialog?.variant ?? "danger"}
        confirmLabel={confirmDialog?.confirmLabel ?? "Confirm"}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />
    </>
  );
}
