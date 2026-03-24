"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { getOrCreateDirectConversationId, insertConversationMessage } from "@/lib/directMessages";
import {
  clearPendingFeedCardSave,
  getPendingFeedCardIds,
  persistFeedCardSave,
  prunePendingFeedCardSaves,
  removeFeedCardSave,
  stagePendingFeedCardSave,
  syncPendingFeedCardSaves,
} from "@/lib/feedCardSavesClient";
import {
  buildMarketplaceFeedCardId,
  isClosedMarketplaceStatus,
  isUUIDLike,
  type MarketplaceDisplayFeedItem,
  type MarketplaceFeedItem,
} from "@/lib/marketplaceFeed";
import { resolveMarketplaceCardActionModel, type MarketplacePrimaryActionKind, type MarketplaceSecondaryActionKind } from "@/lib/marketplaceCardActions";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/runtimeErrors";

type ToastKind = "success" | "error" | "info";

type UseFeedActionsParams = {
  viewerId: string | null;
  setViewerId: Dispatch<SetStateAction<string | null>>;
  setFeed: Dispatch<SetStateAction<MarketplaceFeedItem[]>>;
  refreshFeed: (hardRefresh?: boolean) => Promise<void>;
  pushToast: (kind: ToastKind, message: string) => void;
};

export const useFeedActions = ({
  viewerId,
  setViewerId,
  setFeed,
  refreshFeed,
  pushToast,
}: UseFeedActionsParams) => {
  const router = useRouter();
  const [savedListingIds, setSavedListingIds] = useState<Set<string>>(new Set());
  const [savingListingIds, setSavingListingIds] = useState<Set<string>>(new Set());
  const [acceptingListingIds, setAcceptingListingIds] = useState<Set<string>>(new Set());
  const [chatOpeningProviderId, setChatOpeningProviderId] = useState<string | null>(null);
  const [sharingCardId, setSharingCardId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<MarketplaceDisplayFeedItem | null>(null);

  const ensureViewerId = useCallback(async () => {
    if (viewerId) return viewerId;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error(error?.message || "Login required to continue.");
    }

    setViewerId(user.id);
    return user.id;
  }, [setViewerId, viewerId]);

  const buildFeedContextPath = useCallback((item: MarketplaceDisplayFeedItem) => {
    const params = new URLSearchParams({
      source: "posts_feed",
      focus: item.id,
    });
    return `/dashboard?${params.toString()}`;
  }, []);

  const buildSaveMetadata = useCallback((item: MarketplaceDisplayFeedItem) => {
    const gallery = item.media.map((entry) => entry.url).filter(Boolean).slice(0, 3);
    return {
      subtitle: item.displayDescription,
      ownerName: item.displayCreator,
      category: item.category,
      status: item.status,
      priceLabel: item.priceLabel,
      etaLabel: `Responds in ~${item.responseMinutes} mins`,
      locationLabel: item.locationLabel,
      mediaGallery: gallery,
      image: gallery[0] || item.avatarUrl || null,
      tags: [item.type, item.category, item.verificationStatus],
    };
  }, []);

  const loadSavedListings = useCallback(async () => {
    if (!viewerId) {
      setSavedListingIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("feed_card_saves")
      .select("card_id")
      .eq("user_id", viewerId)
      .limit(300);

    if (error) {
      if (/relation .* does not exist|table .* does not exist/i.test(error.message || "")) {
        setSavedListingIds(new Set(getPendingFeedCardIds(viewerId)));
        return;
      }
      setSavedListingIds(new Set(getPendingFeedCardIds(viewerId)));
      return;
    }

    const persistedCardIds = (((data as Array<{ card_id?: string }> | null) || [])
      .map((row) => row.card_id)
      .filter((cardId): cardId is string => typeof cardId === "string" && cardId.length > 0));
    prunePendingFeedCardSaves(viewerId, persistedCardIds);
    const nextSavedIds = new Set([...persistedCardIds, ...getPendingFeedCardIds(viewerId)]);
    setSavedListingIds(nextSavedIds);
    void syncPendingFeedCardSaves(supabase, viewerId, persistedCardIds);
  }, [viewerId]);

  useEffect(() => {
    void loadSavedListings();
  }, [loadSavedListings]);

  useEffect(() => {
    if (!viewerId) return;

    const channel = supabase
      .channel(`posts-feed-saves-${viewerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_saves",
          filter: `user_id=eq.${viewerId}`,
        },
        (payload) => {
          const previous = (payload.old as { card_id?: string } | null)?.card_id || "";
          const next = (payload.new as { card_id?: string } | null)?.card_id || "";
          const cardId = next || previous;
          if (!cardId) return;

          setSavedListingIds((current) => {
            const updated = new Set(current);
            if (payload.eventType === "DELETE") {
              clearPendingFeedCardSave(viewerId, cardId);
              updated.delete(cardId);
            } else {
              prunePendingFeedCardSaves(viewerId, [cardId]);
              updated.add(cardId);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [viewerId]);

  const isSavedListing = useCallback(
    (item: MarketplaceFeedItem | MarketplaceDisplayFeedItem) => {
      const cardId = buildMarketplaceFeedCardId(item);
      return savedListingIds.has(cardId) || savedListingIds.has(item.id);
    },
    [savedListingIds]
  );

  const isListingBusy = useCallback(
    (item: MarketplaceFeedItem | MarketplaceDisplayFeedItem, busyIds: Set<string>) => {
      const cardId = buildMarketplaceFeedCardId(item);
      return busyIds.has(cardId) || busyIds.has(item.id);
    },
    []
  );

  const toggleSaveListing = useCallback(
    async (item: MarketplaceDisplayFeedItem) => {
      const cardId = buildMarketplaceFeedCardId(item);
      const wasSaved = isSavedListing(item);
      const shouldSave = !wasSaved;

      setSavingListingIds((current) => new Set(current).add(cardId));
      setSavedListingIds((current) => {
        const next = new Set(current);
        if (shouldSave) {
          next.add(cardId);
        } else {
          next.delete(cardId);
          next.delete(item.id);
        }
        return next;
      });

      try {
        const activeViewerId = await ensureViewerId();
        const savePayload = {
          card_id: cardId,
          focus_id: item.id,
          card_type: item.type,
          title: item.displayTitle,
          subtitle: item.displayDescription,
          action_path: buildFeedContextPath(item),
          metadata: buildSaveMetadata(item),
        };

        if (shouldSave) {
          stagePendingFeedCardSave(activeViewerId, savePayload);
          await persistFeedCardSave(supabase, savePayload);
          pushToast("success", "Post saved.");
          return;
        }

        clearPendingFeedCardSave(activeViewerId, cardId);
        await removeFeedCardSave(supabase, cardId);
        pushToast("success", "Removed from saved.");
      } catch (error) {
        try {
          const activeViewerId = await ensureViewerId();
          const rollbackPayload = {
            card_id: cardId,
            focus_id: item.id,
            card_type: item.type,
            title: item.displayTitle,
            subtitle: item.displayDescription,
            action_path: buildFeedContextPath(item),
            metadata: buildSaveMetadata(item),
          };

          if (shouldSave) {
            clearPendingFeedCardSave(activeViewerId, cardId);
          } else {
            stagePendingFeedCardSave(activeViewerId, rollbackPayload);
          }
        } catch {
          // Ignore viewer lookup failures during rollback.
        }

        setSavedListingIds((current) => {
          const next = new Set(current);
          if (wasSaved) {
            next.add(cardId);
          } else {
            next.delete(cardId);
          }
          return next;
        });

        pushToast("error", toErrorMessage(error, "Unable to update save state."));
      } finally {
        setSavingListingIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          next.delete(item.id);
          return next;
        });
      }
    },
    [buildFeedContextPath, buildSaveMetadata, ensureViewerId, isSavedListing, pushToast]
  );

  const openListingProfile = useCallback(
    (item: MarketplaceDisplayFeedItem) => {
      if (!item.publicProfilePath) {
        pushToast("info", "This profile does not have a public page yet.");
        return;
      }

      router.push(item.publicProfilePath);
    },
    [pushToast, router]
  );

  const shareListing = useCallback(
    async (item: MarketplaceDisplayFeedItem) => {
      const cardId = buildMarketplaceFeedCardId(item);
      setSharingCardId(cardId);

      try {
        if (typeof window === "undefined") {
          throw new Error("Sharing is available only in the browser.");
        }

        const sharePath = item.publicProfilePath || buildFeedContextPath(item);
        const shareUrl = new URL(sharePath, window.location.origin).toString();
        const payload = {
          title: item.displayTitle,
          text: `${item.displayTitle} | ${item.locationLabel || item.distanceLabel}`,
          url: shareUrl,
        };

        if (navigator.share) {
          await navigator.share(payload);
          pushToast("success", "Post shared.");
          return;
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(shareUrl);
          pushToast("success", "Link copied.");
          return;
        }

        throw new Error("Sharing is not supported in this browser.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        pushToast("error", toErrorMessage(error, "Unable to share this post."));
      } finally {
        setSharingCardId((current) => (current === cardId ? null : current));
      }
    },
    [buildFeedContextPath, pushToast]
  );

  const openQuoteThread = useCallback(
    async (item: MarketplaceDisplayFeedItem) => {
      const ownerId = item.providerId?.trim() || "";
      if (!ownerId || !isUUIDLike(ownerId)) {
        pushToast("info", "This action is available only for live accounts.");
        return;
      }

      try {
        const activeViewerId = await ensureViewerId();
        if (activeViewerId === ownerId) {
          pushToast("info", "This is your own post.");
          return;
        }

        if (isClosedMarketplaceStatus(item.status)) {
          pushToast("info", "This request is closed, so quotes are no longer available.");
          return;
        }

        setChatOpeningProviderId(ownerId);
        const conversationId = await getOrCreateDirectConversationId(supabase, activeViewerId, ownerId);

        const interestMessage =
          item.helpRequestId && item.acceptedProviderId === activeViewerId
            ? `Hi, I am preparing a quote for "${item.displayTitle}" and will share it shortly.`
            : `Hi, I am interested in "${item.displayTitle}" and can help with it.`;

        await insertConversationMessage(supabase, {
          conversationId,
          senderId: activeViewerId,
          content: interestMessage,
        });

        const params = new URLSearchParams({ open: conversationId });

        if (item.helpRequestId && item.acceptedProviderId === activeViewerId) {
          params.set("quote", "1");
          params.set("helpRequest", item.helpRequestId);
        }

        router.push(`/dashboard/chat?${params.toString()}`);
        pushToast("success", "Interest sent to the creator.");
      } catch (error) {
        pushToast("error", toErrorMessage(error, "Unable to start the quote flow."));
      } finally {
        setChatOpeningProviderId((current) => (current === ownerId ? null : current));
      }
    },
    [ensureViewerId, pushToast, router]
  );

  const openAcceptDialog = useCallback(
    (item: MarketplaceDisplayFeedItem) => {
      if (!item.helpRequestId) {
        pushToast("info", "Accept is available for active task requests.");
        return;
      }

      if (viewerId && item.providerId === viewerId) {
        pushToast("info", "You cannot accept your own task.");
        return;
      }

      if (item.acceptedProviderId && viewerId && item.acceptedProviderId !== viewerId) {
        pushToast("info", "This task is already accepted.");
        return;
      }

      if (isClosedMarketplaceStatus(item.status)) {
        pushToast("info", "This task is no longer open.");
        return;
      }

      setAcceptTarget(item);
    },
    [pushToast, viewerId]
  );

  const confirmAccept = useCallback(async () => {
    if (!acceptTarget?.helpRequestId) {
      setAcceptTarget(null);
      return;
    }

    const cardId = buildMarketplaceFeedCardId(acceptTarget);
    setAcceptingListingIds((current) => new Set(current).add(cardId));

    try {
      const activeViewerId = await ensureViewerId();

      if (acceptTarget.providerId === activeViewerId) {
        throw new Error("You cannot accept your own task.");
      }

      const { data, error } = await supabase.rpc("accept_help_request", {
        target_help_request_id: acceptTarget.helpRequestId,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("Request already accepted or unavailable.");
      }

      setFeed((current) =>
        current.map((item) =>
          item.helpRequestId === acceptTarget.helpRequestId
            ? {
                ...item,
                acceptedProviderId: activeViewerId,
                status: "accepted",
              }
            : item
        )
      );

      pushToast("success", "Task accepted successfully.");
      setAcceptTarget(null);
      void refreshFeed(false);
    } catch (error) {
      pushToast("error", toErrorMessage(error, "Unable to accept this task right now."));
    } finally {
      setAcceptingListingIds((current) => {
        const next = new Set(current);
        next.delete(cardId);
        return next;
      });
    }
  }, [acceptTarget, ensureViewerId, pushToast, refreshFeed, setFeed]);

  const handlePrimaryAction = useCallback(
    async (item: MarketplaceDisplayFeedItem, primaryKind: MarketplacePrimaryActionKind) => {
      if (primaryKind === "view_profile") {
        openListingProfile(item);
        return;
      }

      if (primaryKind === "send_quote") {
        await openQuoteThread(item);
        return;
      }

      if (primaryKind === "accept") {
        openAcceptDialog(item);
      }
    },
    [openAcceptDialog, openListingProfile, openQuoteThread]
  );

  const handleSecondaryAction = useCallback(
    async (item: MarketplaceDisplayFeedItem, action: MarketplaceSecondaryActionKind) => {
      if (action === "share") {
        await shareListing(item);
        return;
      }

      await toggleSaveListing(item);
    },
    [shareListing, toggleSaveListing]
  );

  const resolveActionModel = useCallback(
    (item: MarketplaceDisplayFeedItem) =>
      resolveMarketplaceCardActionModel({
        item,
        viewerId,
      }),
    [viewerId]
  );

  return {
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
    chatOpeningProviderId,
    sharingCardId,
  };
};
