"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CommunityFeedResponse } from "@/lib/api/community";
import FeedMediaCarousel from "@/app/dashboard/components/posts/FeedMediaCarousel";
import AcceptConfirmDialog from "@/app/dashboard/components/posts/AcceptConfirmDialog";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { fetchAuthedJson } from "@/lib/clientApi";
import { getOrCreateDirectConversationId, insertConversationMessage } from "@/lib/directMessages";
import { mergeFeedCardSaves, type FeedCardSaveRecord, type FeedCardType } from "@/lib/feedCardSaves";
import {
  buildMarketplaceDisplayItem,
  buildMarketplaceFeedCardId,
  isClosedMarketplaceStatus,
  isUUIDLike,
  type MarketplaceDisplayFeedItem,
  type MarketplaceFeedItem,
  type MarketplaceFeedItemSource,
  type MarketplaceFeedMedia,
} from "@/lib/marketplaceFeed";
import { resolveMarketplaceCardActionModel } from "@/lib/marketplaceCardActions";
import { buildPublicProfilePath } from "@/lib/profile/utils";
import { toErrorMessage } from "@/lib/runtimeErrors";
import {
  clearPendingFeedCardSave,
  getPendingFeedCardSaves,
  prunePendingFeedCardSaves,
  removeFeedCardSave,
  stagePendingFeedCardSave,
  syncPendingFeedCardSaves,
} from "@/lib/feedCardSavesClient";
import { supabase } from "@/lib/supabase";
import { buildWelcomeFeedCards, type WelcomeFeedCard } from "@/lib/welcomeFeed";
import { ArrowRight, Bookmark, BookmarkMinus, Check, Clock3, Loader2, MapPin, Share2, Sparkles, X } from "lucide-react";

type FeedToast = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

type SavedFeedViewProps = {
  embedded?: boolean;
};

const fallbackCoverByType: Record<FeedCardType, string[]> = {
  demand: [
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
    "https://images.unsplash.com/photo-1486946255434-2466348c2166?w=1200&q=80",
  ],
  service: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
    "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&q=80",
  ],
  product: [
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&q=80",
    "https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?w=1200&q=80",
  ],
};

const typeBadgeLabel: Record<FeedCardType, string> = {
  demand: "Need",
  service: "Service",
  product: "Product",
};

const readMetaString = (metadata: Record<string, unknown> | null, key: string) => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
};

const readMetaStringArray = (metadata: Record<string, unknown> | null, key: string) => {
  if (!metadata) return [];
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
};

const readMetaNumber = (metadata: Record<string, unknown> | null, key: string) => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const looksUrgent = (value: string | null | undefined) => /urgent|today|asap|immediately/i.test(value || "");

const formatSavedAgo = (createdAt: string) => {
  const savedTime = new Date(createdAt).getTime();
  if (!Number.isFinite(savedTime)) return "saved recently";

  const diffMinutes = Math.max(1, Math.floor((Date.now() - savedTime) / 60000));
  if (diffMinutes < 60) return `saved ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `saved ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `saved ${diffDays}d ago`;
};

const buttonToneClassNames = {
  primary: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  status: "border-slate-200 bg-slate-100 text-slate-500",
  destructive: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
} as const;

const inferSavedCardSource = (card: FeedCardSaveRecord): MarketplaceFeedItemSource => {
  if (card.card_id.startsWith("welcome-help-")) return "help_request";
  if (card.card_id.startsWith("welcome-service-")) return "service_listing";
  if (card.card_id.startsWith("welcome-product-")) return "product_listing";
  if (card.card_id.startsWith("welcome-post-")) return "post";

  const parts = card.card_id.split(":");
  if (parts[0] === "dashboard" && parts.length >= 4) {
    const source = parts[1];
    if (source === "help_request" || source === "service_listing" || source === "product_listing" || source === "post") {
      return source;
    }
  }

  if (card.card_type === "service") return "service_listing";
  if (card.card_type === "product") return "product_listing";
  return "post";
};

const extractSavedCategory = (card: FeedCardSaveRecord) => {
  const category = readMetaString(card.metadata, "category");
  if (category) return category;

  const subtitleParts = (card.subtitle || "")
    .split("•")
    .map((part) => part.trim())
    .filter(Boolean);

  return subtitleParts[subtitleParts.length - 1] || typeBadgeLabel[card.card_type];
};

const extractWelcomeCardCategory = (card: WelcomeFeedCard) => {
  const subtitleParts = card.subtitle
    .split("•")
    .map((part) => part.trim())
    .filter(Boolean);

  return subtitleParts[subtitleParts.length - 1] || typeBadgeLabel[card.type];
};

const buildSavedResponseMinutes = (card: FeedCardSaveRecord) => {
  const explicitMinutes = readMetaNumber(card.metadata, "responseMinutes");
  if (explicitMinutes && explicitMinutes > 0) {
    return explicitMinutes;
  }

  return looksUrgent(readMetaString(card.metadata, "etaLabel")) || looksUrgent(card.subtitle) ? 15 : 45;
};

const buildSavedMedia = (card: FeedCardSaveRecord) => {
  const mediaGallery = readMetaStringArray(card.metadata, "mediaGallery");
  const imageFromMeta = readMetaString(card.metadata, "image") || mediaGallery[0] || null;
  const fallbackPool = fallbackCoverByType[card.card_type] || fallbackCoverByType.demand;
  const image = imageFromMeta || fallbackPool[0];

  return Array.from(new Set([image, ...mediaGallery].filter(Boolean))).map((url) => ({
    mimeType: "image/jpeg",
    url,
  })) satisfies MarketplaceFeedMedia[];
};

const buildSavedFallbackDisplayItem = (card: FeedCardSaveRecord): MarketplaceDisplayFeedItem => {
  const source = inferSavedCardSource(card);
  const ownerName =
    readMetaString(card.metadata, "ownerName") ||
    readMetaString(card.metadata, "ownerLabel") ||
    readMetaString(card.metadata, "audienceName") ||
    "Saved from local feed";
  const locationLabel =
    readMetaString(card.metadata, "locationLabel") || readMetaString(card.metadata, "audienceName") || "Saved feed";
  const helpRequestId =
    readMetaString(card.metadata, "helpRequestId") || (source === "help_request" ? card.focus_id : null);
  const providerId = readMetaString(card.metadata, "ownerId") || "";
  const verificationSource = readMetaString(card.metadata, "verificationStatus");
  const avatarUrl =
    readMetaString(card.metadata, "avatarUrl") ||
    createAvatarFallback({
      label: ownerName,
      seed: `${card.card_id}:${ownerName}`,
    });

  const baseItem: MarketplaceFeedItem = {
    id: card.focus_id,
    source,
    helpRequestId,
    linkedPostId: source === "post" ? card.focus_id : null,
    linkedListingId: source === "service_listing" || source === "product_listing" ? card.focus_id : null,
    linkedHelpRequestId: source === "help_request" ? card.focus_id : null,
    metadata: card.metadata,
    providerId,
    type: card.card_type,
    title: card.title,
    description: card.subtitle || "Saved from your local feed so you can come back to it later.",
    category: extractSavedCategory(card),
    price: 0,
    avatarUrl,
    creatorName: ownerName,
    creatorUsername: ownerName,
    locationLabel,
    distanceKm: 0,
    lat: 0,
    lng: 0,
    coordinateAccuracy: "approximate",
    media: buildSavedMedia(card),
    createdAt: card.created_at,
    urgent: looksUrgent(readMetaString(card.metadata, "etaLabel")) || looksUrgent(card.subtitle),
    rankScore: 0,
    profileCompletion: 0,
    responseMinutes: buildSavedResponseMinutes(card),
    verificationStatus:
      verificationSource === "verified" || verificationSource === "unclaimed" ? verificationSource : "pending",
    publicProfilePath: readMetaString(card.metadata, "publicProfilePath") || "",
    status: readMetaString(card.metadata, "status") || "open",
    acceptedProviderId: readMetaString(card.metadata, "acceptedProviderId"),
  };

  return buildMarketplaceDisplayItem(baseItem);
};

const buildSavedWelcomeProfilePath = (card: WelcomeFeedCard) => {
  if (!card.ownerId || card.ownerId.startsWith("demo-")) {
    return "/dashboard/people";
  }

  return buildPublicProfilePath({
    id: card.ownerId,
    name: card.ownerName || "Connected user",
  }) || "/dashboard/people";
};

const buildSavedWelcomeDisplayItem = (card: WelcomeFeedCard): MarketplaceDisplayFeedItem => {
  const creatorName = card.ownerName?.trim() || "Connected user";
  const avatarUrl = createAvatarFallback({
    label: creatorName,
    seed: `${card.ownerId || card.id}:${card.type}`,
  });
  const source: MarketplaceFeedItemSource =
    card.helpRequestId || card.source === "help_request"
      ? "help_request"
      : card.type === "service"
        ? "service_listing"
        : card.type === "product"
          ? "product_listing"
          : "post";

  return buildMarketplaceDisplayItem({
    id: card.focusId,
    source,
    helpRequestId: card.helpRequestId || null,
    canonicalKey: card.canonicalKey,
    linkedPostId: source === "post" ? card.focusId : null,
    linkedListingId: source === "service_listing" || source === "product_listing" ? card.focusId : null,
    linkedHelpRequestId: card.helpRequestId || null,
    metadata: null,
    providerId: card.ownerId || "",
    type: card.type,
    title: card.title,
    description: card.subtitle,
    category: extractWelcomeCardCategory(card),
    price: 0,
    avatarUrl,
    creatorName,
    creatorUsername: creatorName,
    locationLabel: card.distanceKm > 0 ? `${card.distanceKm.toFixed(1)} km away` : "Nearby",
    distanceKm: card.distanceKm,
    lat: 0,
    lng: 0,
    coordinateAccuracy: "approximate",
    media: [{ mimeType: "image/jpeg", url: card.image }],
    createdAt: card.createdAt,
    urgent: looksUrgent(card.signalLabel) || looksUrgent(card.etaLabel),
    rankScore: 0,
    profileCompletion: 0,
    responseMinutes: looksUrgent(card.signalLabel) || looksUrgent(card.etaLabel) ? 15 : 45,
    verificationStatus: "pending",
    publicProfilePath: buildSavedWelcomeProfilePath(card),
    status: card.status || "open",
    acceptedProviderId: card.acceptedProviderId || null,
  });
};

export default function SavedFeedView({ embedded = false }: SavedFeedViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<FeedCardSaveRecord[]>([]);
  const [liveActionItemsByCardId, setLiveActionItemsByCardId] = useState<Record<string, MarketplaceDisplayFeedItem>>({});
  const [loadError, setLoadError] = useState("");
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);
  const [sharingCardId, setSharingCardId] = useState<string | null>(null);
  const [messageCardId, setMessageCardId] = useState<string | null>(null);
  const [acceptingCardId, setAcceptingCardId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<{ cardId: string; item: MarketplaceDisplayFeedItem } | null>(null);
  const [feedToasts, setFeedToasts] = useState<FeedToast[]>([]);

  const pushFeedToast = useCallback((kind: FeedToast["kind"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFeedToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setFeedToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  const buildSavedFeedPath = useCallback((card: FeedCardSaveRecord) => {
    const basePath = card.action_path || "/dashboard";
    const [pathname, rawQuery = ""] = basePath.split("?");
    const params = new URLSearchParams(rawQuery);

    params.set("source", "saved_feed");
    params.set("context_card", card.card_id);
    params.set("context_focus", card.focus_id);
    params.set("context_type", card.card_type);
    params.set("context_title", card.title);
    params.set("focus", card.focus_id);
    params.set("type", card.card_type);

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, []);

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
  }, [viewerId]);

  const loadLiveActionItems = useCallback(async () => {
    if (!viewerId) {
      setLiveActionItemsByCardId({});
      return;
    }

    try {
      const [allFeedPayload, connectedFeedPayload] = await Promise.all([
        fetchAuthedJson<CommunityFeedResponse>(supabase, "/api/community/feed?scope=all", { method: "GET" }),
        fetchAuthedJson<CommunityFeedResponse>(supabase, "/api/community/feed?scope=connected", { method: "GET" }),
      ]);

      const nextLiveActionItems: Record<string, MarketplaceDisplayFeedItem> = {};

      if (allFeedPayload.ok) {
        allFeedPayload.feedItems.forEach((item) => {
          nextLiveActionItems[buildMarketplaceFeedCardId(item)] = buildMarketplaceDisplayItem(item);
        });
      }

      if (connectedFeedPayload.ok) {
        buildWelcomeFeedCards(connectedFeedPayload).cards.forEach((card) => {
          nextLiveActionItems[card.id] = buildSavedWelcomeDisplayItem(card);
        });
      }

      setLiveActionItemsByCardId(nextLiveActionItems);
    } catch (error) {
      console.warn("Failed to hydrate saved feed actions:", toErrorMessage(error, "Unable to load live post actions."));
    }
  }, [viewerId]);

  const loadSavedFeed = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setLoadError("");
    let resolvedUserId = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let currentUser = sessionData.session?.user || null;

      if (!currentUser) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          throw authError;
        }
        currentUser = authData.user;
      }

      if (!currentUser) {
        setViewerId(null);
        setSavedCards([]);
        setLoadError("Sign in to sync and view your saved feed cards.");
        return;
      }

      setViewerId(currentUser.id);
      resolvedUserId = currentUser.id;

      const { data, error } = await supabase
        .from("feed_card_saves")
        .select("id, card_id, focus_id, card_type, title, subtitle, action_path, metadata, created_at, updated_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) {
        throw error;
      }

      const serverRows = ((data as FeedCardSaveRecord[] | null) || []).filter((row) => !!row.card_id);
      const persistedCardIds = serverRows.map((row) => row.card_id);
      prunePendingFeedCardSaves(currentUser.id, persistedCardIds);

      const mergedRows = mergeFeedCardSaves(serverRows, getPendingFeedCardSaves(currentUser.id));
      setSavedCards(mergedRows);

      const syncedCount = await syncPendingFeedCardSaves(supabase, currentUser.id, persistedCardIds);
      if (syncedCount > 0) {
        const { data: refreshedData, error: refreshedError } = await supabase
          .from("feed_card_saves")
          .select("id, card_id, focus_id, card_type, title, subtitle, action_path, metadata, created_at, updated_at")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(150);

        if (!refreshedError) {
          const refreshedRows = ((refreshedData as FeedCardSaveRecord[] | null) || []).filter((row) => !!row.card_id);
          prunePendingFeedCardSaves(
            currentUser.id,
            refreshedRows.map((row) => row.card_id)
          );
          setSavedCards(mergeFeedCardSaves(refreshedRows, getPendingFeedCardSaves(currentUser.id)));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load saved feed.";
      console.warn("Failed to load saved feed:", message);
      if (resolvedUserId) {
        setSavedCards(getPendingFeedCardSaves(resolvedUserId));
      }
      setLoadError(message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadSavedFeed(true);
  }, [loadSavedFeed]);

  useEffect(() => {
    if (!viewerId) {
      setLiveActionItemsByCardId({});
      return;
    }

    void loadLiveActionItems();
  }, [loadLiveActionItems, viewerId]);

  useEffect(() => {
    if (!viewerId) return;

    const channel = supabase
      .channel(`saved-feed-${viewerId}${embedded ? "-settings" : ""}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_saves",
          filter: `user_id=eq.${viewerId}`,
        },
        () => {
          void loadSavedFeed(false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [embedded, loadSavedFeed, viewerId]);

  const saveStats = useMemo(() => {
    return savedCards.reduce(
      (summary, card) => {
        summary.total += 1;
        summary[card.card_type] += 1;
        return summary;
      },
      { total: 0, demand: 0, service: 0, product: 0 }
    );
  }, [savedCards]);

  const handleShareCard = useCallback(async (card: FeedCardSaveRecord) => {
    const sharePath = buildSavedFeedPath(card);
    const shareUrl = `${window.location.origin}${sharePath}`;
    const shareText = card.subtitle || `Saved ${typeBadgeLabel[card.card_type].toLowerCase()} from your local feed`;

    setSharingCardId(card.card_id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${typeBadgeLabel[card.card_type]}: ${card.title}`,
          text: shareText,
          url: shareUrl,
        });
        pushFeedToast("success", "Saved post shared.");
        return;
      }

      if (!navigator.clipboard?.writeText) {
        pushFeedToast("error", "Share is not supported in this browser context.");
        return;
      }

      await navigator.clipboard.writeText(`${card.title}\n${shareText}\n${shareUrl}`);
      pushFeedToast("success", "Share link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      pushFeedToast("error", "Unable to share right now.");
    } finally {
      setSharingCardId((current) => (current === card.card_id ? null : current));
    }
  }, [buildSavedFeedPath, pushFeedToast]);

  const handleRemoveCard = useCallback(async (card: FeedCardSaveRecord) => {
    if (!viewerId) {
      pushFeedToast("info", "Sign in to update saved posts.");
      return;
    }

    setRemovingCardId(card.card_id);
    const previousCards = savedCards;
    setSavedCards((current) => current.filter((entry) => entry.card_id !== card.card_id));
    clearPendingFeedCardSave(viewerId, card.card_id);

    try {
      await removeFeedCardSave(supabase, card.card_id);
      pushFeedToast("success", "Removed from saved feed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove saved post.";
      console.warn("Failed to remove saved card:", message);
      stagePendingFeedCardSave(viewerId, {
        card_id: card.card_id,
        focus_id: card.focus_id,
        card_type: card.card_type,
        title: card.title,
        subtitle: card.subtitle,
        action_path: card.action_path,
        metadata: card.metadata,
      });
      setSavedCards(previousCards);
      pushFeedToast("error", "Could not remove saved post. Try again.");
    } finally {
      setRemovingCardId((current) => (current === card.card_id ? null : current));
    }
  }, [pushFeedToast, savedCards, viewerId]);

  const resolvedActionItemsByCardId = useMemo(() => {
    const next: Record<string, MarketplaceDisplayFeedItem> = {};
    savedCards.forEach((card) => {
      next[card.card_id] = liveActionItemsByCardId[card.card_id] || buildSavedFallbackDisplayItem(card);
    });
    return next;
  }, [liveActionItemsByCardId, savedCards]);

  const handleOpenProfile = useCallback((item: MarketplaceDisplayFeedItem) => {
    if (!item.publicProfilePath) {
      pushFeedToast("info", "This profile does not have a public page yet.");
      return;
    }

    router.push(item.publicProfilePath);
  }, [pushFeedToast, router]);

  const openInterestThread = useCallback(async (card: FeedCardSaveRecord, item: MarketplaceDisplayFeedItem) => {
    const ownerId = item.providerId?.trim() || "";
    const fallbackPath = buildSavedFeedPath(card);

    if (!ownerId || !isUUIDLike(ownerId)) {
      router.push(fallbackPath);
      return;
    }

    setMessageCardId(card.card_id);

    try {
      const activeViewerId = await ensureViewerId();
      if (activeViewerId === ownerId) {
        pushFeedToast("info", "This is your own post.");
        return;
      }

      if (isClosedMarketplaceStatus(item.status)) {
        pushFeedToast(
          "info",
          item.helpRequestId ? "This request is closed, so quotes are no longer available." : "This post is no longer open."
        );
        return;
      }

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
      pushFeedToast("success", "Interest sent to the creator.");
    } catch (error) {
      pushFeedToast("error", toErrorMessage(error, "Unable to start the quote flow."));
    } finally {
      setMessageCardId((current) => (current === card.card_id ? null : current));
    }
  }, [buildSavedFeedPath, ensureViewerId, pushFeedToast, router]);

  const declineSavedCard = useCallback(async (card: FeedCardSaveRecord, item: MarketplaceDisplayFeedItem) => {
    if (!item.helpRequestId) {
      pushFeedToast("info", "Decline is available for accepted task requests.");
      return;
    }

    setAcceptingCardId(card.card_id);

    try {
      const activeViewerId = await ensureViewerId();
      const isCreator = item.providerId === activeViewerId;
      const isAcceptedProvider = item.acceptedProviderId === activeViewerId;

      if (!isCreator && !isAcceptedProvider) {
        throw new Error("You can only decline requests you created or accepted.");
      }

      await fetchAuthedJson<{ ok: true; helpRequestId: string; status: "cancelled" }>(supabase, "/api/needs/reopen", {
        method: "POST",
        body: JSON.stringify({ helpRequestId: item.helpRequestId }),
      });

      setLiveActionItemsByCardId((current) => ({
        ...current,
        [card.card_id]: {
          ...item,
          status: "open",
          acceptedProviderId: null,
        },
      }));

      pushFeedToast("success", "Request declined.");
    } catch (error) {
      pushFeedToast("error", toErrorMessage(error, "Unable to decline this task right now."));
    } finally {
      setAcceptingCardId((current) => (current === card.card_id ? null : current));
    }
  }, [ensureViewerId, pushFeedToast]);

  const openAcceptDialog = useCallback((card: FeedCardSaveRecord, item: MarketplaceDisplayFeedItem) => {
    if (!item.helpRequestId) {
      pushFeedToast("info", "Accept is available for active task requests.");
      return;
    }

    if (viewerId && item.providerId === viewerId) {
      pushFeedToast("info", "You cannot accept your own task.");
      return;
    }

    if (item.acceptedProviderId && viewerId && item.acceptedProviderId !== viewerId) {
      pushFeedToast("info", "This task is already accepted.");
      return;
    }

    if (isClosedMarketplaceStatus(item.status)) {
      pushFeedToast("info", "This task is no longer open.");
      return;
    }

    setAcceptTarget({ cardId: card.card_id, item });
  }, [pushFeedToast, viewerId]);

  const confirmAccept = useCallback(async () => {
    if (!acceptTarget?.item.helpRequestId) {
      setAcceptTarget(null);
      return;
    }

    setAcceptingCardId(acceptTarget.cardId);

    try {
      const activeViewerId = await ensureViewerId();

      if (acceptTarget.item.providerId === activeViewerId) {
        throw new Error("You cannot accept your own task.");
      }

      await fetchAuthedJson<{ ok: true; helpRequestId: string; status: "accepted" }>(supabase, "/api/needs/accept", {
        method: "POST",
        body: JSON.stringify({ helpRequestId: acceptTarget.item.helpRequestId }),
      });

      setLiveActionItemsByCardId((current) => ({
        ...current,
        [acceptTarget.cardId]: {
          ...acceptTarget.item,
          status: "accepted",
          acceptedProviderId: activeViewerId,
        },
      }));

      pushFeedToast("success", "Task accepted successfully.");
      setAcceptTarget(null);
      router.push("/dashboard/tasks");
      void loadLiveActionItems();
    } catch (error) {
      pushFeedToast("error", toErrorMessage(error, "Unable to accept this task right now."));
    } finally {
      setAcceptingCardId((current) => (current === acceptTarget.cardId ? null : current));
    }
  }, [acceptTarget, ensureViewerId, loadLiveActionItems, pushFeedToast, router]);

  const handlePrimaryAction = useCallback(async (card: FeedCardSaveRecord, item: MarketplaceDisplayFeedItem, kind: "accept" | "decline" | "send_quote") => {
    if (kind === "send_quote") {
      await openInterestThread(card, item);
      return;
    }

    if (kind === "decline") {
      await declineSavedCard(card, item);
      return;
    }

    openAcceptDialog(card, item);
  }, [declineSavedCard, openAcceptDialog, openInterestThread]);

  return (
    <div className={embedded ? "space-y-5" : "w-full max-w-[1180px] mx-auto space-y-5 sm:space-y-6"}>
      <section
        className={`overflow-hidden rounded-3xl border ${
          embedded
            ? "border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_38%),linear-gradient(135deg,#ffffff_0%,#eff6ff_55%,#f8fafc_100%)] p-5 shadow-sm"
            : "border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#0f766e_48%,#082f49_100%)] p-5 text-white shadow-xl sm:p-7"
        }`}
      >
        <p
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
            embedded
              ? "border border-slate-200 bg-white/80 text-slate-700"
              : "border border-white/25 bg-white/10 text-white/90"
          }`}
        >
          <Bookmark size={13} />
          Saved
        </p>

        <h1 className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${embedded ? "text-slate-950" : "text-white"}`}>
          {embedded ? "Saved posts from Welcome and Explore" : "Your saved local opportunities"}
        </h1>
        <p className={`mt-1.5 max-w-2xl text-sm sm:text-base ${embedded ? "text-slate-600" : "text-white/80"}`}>
          Revisit posts you bookmarked, compare opportunities quickly, and jump back into the exact feed context when you are ready.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          {[
            { label: "Total saved", value: saveStats.total },
            { label: "Needs", value: saveStats.demand },
            { label: "Services", value: saveStats.service },
            { label: "Products", value: saveStats.product },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border px-3 py-2.5 ${
                embedded ? "border-slate-200 bg-white/85 text-slate-900" : "border-white/20 bg-white/10 text-white"
              }`}
            >
              <p className={embedded ? "text-slate-500" : "text-white/75"}>{stat.label}</p>
              <p className="mt-1 text-lg font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {!!loadError && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      )}

      {loading ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading saved feed...
          </div>
        </section>
      ) : savedCards.length === 0 ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No saved cards yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Save posts from Welcome or Explore to build your shortlist of needs, services, and products.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/welcome")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
            >
              Browse Welcome
              <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
            >
              Open Explore
            </button>
          </div>
        </section>
      ) : (
        <section data-testid="saved-feed-list" className="grid gap-3 md:grid-cols-2">
          {savedCards.map((card, index) => {
            const metadata = card.metadata || {};
            const mediaGallery = readMetaStringArray(metadata, "mediaGallery");
            const imageFromMeta = readMetaString(metadata, "image") || mediaGallery[0] || null;
            const fallbackPool = fallbackCoverByType[card.card_type] || fallbackCoverByType.demand;
            const image = imageFromMeta || fallbackPool[index % fallbackPool.length];
            const priceLabel = readMetaString(metadata, "priceLabel");
            const etaLabel = readMetaString(metadata, "etaLabel");
            const audienceName = readMetaString(metadata, "audienceName");
            const locationLabel = readMetaString(metadata, "locationLabel");
            const ownerName = readMetaString(metadata, "ownerName") || readMetaString(metadata, "ownerLabel");
            const displayCreator = ownerName || audienceName || "Saved from local feed";
            const tags = readMetaStringArray(metadata, "tags").slice(0, 2);
            const categoryLabel = readMetaString(metadata, "category") || typeBadgeLabel[card.card_type];
            const resolvedItem = resolvedActionItemsByCardId[card.card_id];
            const actionModel = resolveMarketplaceCardActionModel({
              item: resolvedItem,
              viewerId,
            });
            const acceptButton = actionModel.buttons.find(
              (
                button
              ): button is (typeof actionModel.buttons)[number] & {
                kind: "accept" | "decline";
              } => button.kind === "accept" || button.kind === "decline"
            );
            const sendQuoteButton = actionModel.buttons.find(
              (
                button
              ): button is (typeof actionModel.buttons)[number] & {
                kind: "send_quote";
              } => button.kind === "send_quote"
            );
            const isRemoving = removingCardId === card.card_id;
            const isSharing = sharingCardId === card.card_id;
            const isMessaging = messageCardId === card.card_id;
            const isAccepting = acceptingCardId === card.card_id;
            const urgent = looksUrgent(etaLabel) || looksUrgent(card.subtitle);
            const media: MarketplaceFeedMedia[] = Array.from(new Set([image, ...mediaGallery].filter(Boolean))).map((url) => ({
              mimeType: "image/jpeg",
              url,
            }));
            const avatarUrl =
              readMetaString(metadata, "avatarUrl") ||
              resolvedItem.avatarUrl ||
              createAvatarFallback({
                label: displayCreator,
                seed: `${card.card_id}:${displayCreator}`,
              });

            return (
              <article
                key={card.id}
                data-testid="saved-feed-card"
                data-card-id={card.card_id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3.5 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.45)] transition hover:border-[var(--brand-500)]/28 hover:shadow-[0_26px_42px_-28px_rgba(14,165,164,0.32)]"
              >
                <header className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleOpenProfile(resolvedItem)}
                    className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
                    aria-label={`Open ${displayCreator} profile`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt={`${displayCreator} avatar`}
                      className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(resolvedItem)}
                        className="min-w-0 max-w-full truncate text-left text-base font-semibold text-slate-900 transition hover:text-[var(--brand-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
                        aria-label={`Open ${displayCreator} profile`}
                      >
                        {displayCreator}
                      </button>
                      {card.sync_state === "pending" ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Syncing
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 overflow-hidden text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 truncate">
                        <Clock3 size={11} />
                        {formatSavedAgo(card.created_at)}
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1 truncate">
                        <MapPin size={11} />
                        {locationLabel || audienceName || "Saved feed"}
                      </span>
                      {urgent ? <span className="shrink-0 text-rose-600">Urgent</span> : null}
                    </div>
                  </div>
                </header>

                <div className="mt-2.5">
                  <FeedMediaCarousel media={media} title={card.title} />
                </div>

                <div className="mt-2.5">
                  <h3 className="line-clamp-2 text-base font-semibold leading-tight text-slate-900">{card.title}</h3>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600">
                    {card.subtitle || "Saved from your local feed so you can come back to it later."}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                        card.card_type === "demand"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : card.card_type === "service"
                            ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {typeBadgeLabel[card.card_type]}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {categoryLabel}
                    </span>
                    {priceLabel ? (
                      <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
                        {priceLabel}
                      </span>
                    ) : null}
                    {etaLabel ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        {etaLabel}
                      </span>
                    ) : null}
                    {!etaLabel ? (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          urgent
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {urgent ? "Urgent" : "Saved"}
                      </span>
                    ) : null}
                    {tags.map((tag) => (
                      <span
                        key={`${card.id}-${tag}`}
                        className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  {acceptButton ? (
                    <button
                      type="button"
                      onClick={() => void handlePrimaryAction(card, resolvedItem, acceptButton.kind)}
                      disabled={acceptButton.disabled || isAccepting}
                      data-testid="saved-feed-accept"
                      aria-label={isAccepting ? "Accepting saved post" : acceptButton.label}
                      title={isAccepting ? "Working..." : acceptButton.label}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                        buttonToneClassNames[acceptButton.tone]
                      }`}
                    >
                      {isAccepting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : acceptButton.kind === "decline" ? (
                        <X className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}

                  {sendQuoteButton ? (
                    <button
                      type="button"
                      onClick={() => void handlePrimaryAction(card, resolvedItem, "send_quote")}
                      disabled={sendQuoteButton.disabled || isMessaging}
                      data-testid="saved-feed-interest"
                      aria-label={isMessaging ? "Opening saved post chat" : sendQuoteButton.label}
                      title={isMessaging ? "Opening..." : sendQuoteButton.label}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                        buttonToneClassNames[sendQuoteButton.tone]
                      }`}
                    >
                      {isMessaging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </button>
                  ) : null}

                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleShareCard(card)}
                      disabled={isSharing}
                      data-testid="saved-feed-share"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-65"
                      aria-label={isSharing ? "Sharing saved post" : "Share saved post"}
                      title={isSharing ? "Sharing..." : "Share"}
                    >
                      {isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoveCard(card)}
                      disabled={isRemoving}
                      data-testid="saved-feed-remove"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-65"
                      aria-label={isRemoving ? "Unsaving post" : "Unsave post"}
                      title={isRemoving ? "Unsaving..." : "Unsave"}
                    >
                      {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkMinus className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {(locationLabel || audienceName) ? (
                  <p className="mt-2 truncate text-[11px] text-slate-400">
                    {displayCreator}
                    {(locationLabel || audienceName) ? ` · ${locationLabel || audienceName}` : ""}
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      )}

      <AcceptConfirmDialog
        open={!!acceptTarget}
        listing={acceptTarget?.item || null}
        busy={!!(acceptTarget && acceptingCardId === acceptTarget.cardId)}
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => {
          void confirmAccept();
        }}
      />

      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-6 right-4 z-[1200] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:right-6"
      >
        {feedToasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur ${
              toast.kind === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
                : toast.kind === "error"
                  ? "border-rose-200 bg-rose-50/95 text-rose-800"
                  : "border-cyan-200 bg-cyan-50/95 text-cyan-800"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
