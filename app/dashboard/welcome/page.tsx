"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import AcceptConfirmDialog from "@/app/dashboard/components/posts/AcceptConfirmDialog";
import FeedMediaCarousel from "@/app/dashboard/components/posts/FeedMediaCarousel";
import ConnectionActionGroup from "@/app/components/connections/ConnectionActionGroup";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import type { CommunityFeedResponse } from "@/lib/api/community";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { appTagline } from "@/lib/branding";
import { fetchAuthedJson } from "@/lib/clientApi";
import type { FeedCardSavePayload } from "@/lib/feedCardSaves";
import {
  clearPendingFeedCardSave,
  getPendingFeedCardIds,
  persistFeedCardSave,
  prunePendingFeedCardSaves,
  removeFeedCardSave,
  stagePendingFeedCardSave,
  syncPendingFeedCardSaves,
} from "@/lib/feedCardSavesClient";
import { createMarketplaceReadinessSummary } from "@/lib/profile/readiness";
import { getProfileRoleFamily } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import { isClosedMarketplaceStatus, isUUIDLike, type MarketplaceDisplayFeedItem, type MarketplaceFeedMedia } from "@/lib/marketplaceFeed";
import type { ConnectionDecision } from "@/lib/connectionState";
import { useConnectionRequests } from "@/lib/hooks/useConnectionRequests";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";
import { buildWelcomeFeedCards, type WelcomeFeedCard } from "@/lib/welcomeFeed";
import { resolveWelcomeCommand } from "@/lib/welcomePrompt";
import CreatePostModal from "../../components/CreatePostModal";
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Loader2,
  MapPin,
  Share2,
  Sparkles,
  UsersRound,
  Zap,
} from "lucide-react";

type NearbyCard = WelcomeFeedCard;

type EnrichedNearbyCard = NearbyCard & {
  badge: string;
  ownerLabel: string;
  ownerAvatarUrl: string;
  postedAgo: string;
  distanceLabel: string;
  statusLabel: string | null;
  networkMetaLabel: string;
  isUrgent: boolean;
  media: MarketplaceFeedMedia[];
  audienceLabel: string;
  audienceName: string;
  audienceMeta: string;
  networkActionLabel: string;
  networkActionPath: string;
  engagementLabel: string;
  surfaceReason: string;
  tags: [string, string];
  saves: number;
  shares: number;
};

type FeedCardSaveRow = {
  card_id: string;
};

type FeedCardShareRow = {
  card_id: string;
};

type FeedCardMetricRow = {
  card_id: string;
  saves: number | string | null;
  shares: number | string | null;
};

type FeedShareChannel = "native" | "clipboard";

type CardMetrics = {
  saves: number;
  shares: number;
};

type FeedToast = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

const routes = {
  posts: "/dashboard",
  people: "/dashboard/people",
  chat: "/dashboard/chat",
} as const;

const providerRoles = new Set(["provider", "seller", "service_provider", "business"]);
const FEED_PAGE_SIZE = 8;
const POST_OWNER_FIELD_VARIANTS: ReadonlyArray<ReadonlyArray<string>> = [
  ["user_id", "author_id", "created_by", "requester_id", "owner_id", "provider_id"],
  ["user_id", "author_id", "created_by", "requester_id", "owner_id"],
  ["user_id", "author_id", "created_by", "requester_id"],
  ["user_id", "author_id", "created_by"],
  ["user_id", "author_id"],
  ["user_id"],
  ["author_id"],
  ["created_by"],
  ["requester_id"],
  ["owner_id"],
  ["provider_id"],
];

const MARKETPLACE_HERO_LINES = [
  "Post a Need. Get Local Help. Let Others Earn.",
  "Where Neighbours Help and Earn in Real Time.",
  "Small Tasks. Real People. Instant Help.",
  "Post What You Need. Someone Nearby Will Help.",
  "Local Help Marketplace for Everyday Needs.",
] as const;

const buildWelcomeDistanceLabel = (distanceKm: number) => (distanceKm > 0 ? `${distanceKm.toFixed(1)} km away` : "Nearby");
const isTaskRequestCard = (card: NearbyCard) => Boolean(card.helpRequestId);

const isUrgentWelcomeCard = (card: NearbyCard) => {
  const urgencySource = `${card.signalLabel} ${card.etaLabel}`.toLowerCase();
  return urgencySource.includes("urgent") || urgencySource.includes("today") || urgencySource.includes("evening");
};

const formatWelcomeCountLabel = (count: number, singular: string) =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

const formatTimeAgo = (value: string | null | undefined) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return "Just now";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "Just now";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (1000 * 60)));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return parsed.toLocaleDateString([], { month: "short", day: "numeric" });
};

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const buildPostOwnerFilter = (userId: string, fields: readonly string[]) =>
  fields.map((field) => `${field}.eq.${userId}`).join(",");

const countOwnedPosts = async (userId: string) => {
  for (const ownerFields of POST_OWNER_FIELD_VARIANTS) {
    const result = await supabase.from("posts").select("id", { count: "exact", head: true }).or(buildPostOwnerFilter(userId, ownerFields));
    if (!result.error) return Number(result.count || 0);
    if (isMissingColumnError(result.error.message || "")) continue;
    return 0;
  }
  return 0;
};

export default function WelcomePage() {
  const router = useRouter();
  const { profile: viewerProfile } = useProfileContext();
  const feedSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTimerRef = useRef<number | null>(null);

  const [openPostModal, setOpenPostModal] = useState(false);
  const [welcomePromptValue, setWelcomePromptValue] = useState("");
  const [heroLineIndex, setHeroLineIndex] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [feedEmptyReason, setFeedEmptyReason] = useState<"no_connections" | "no_connected_content" | null>(null);
  const [acceptedConnectionCount, setAcceptedConnectionCount] = useState(0);
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);
  const [messageCardId, setMessageCardId] = useState<string | null>(null);
  const [acceptingCardId, setAcceptingCardId] = useState<string | null>(null);
  const [acceptTargetCard, setAcceptTargetCard] = useState<EnrichedNearbyCard | null>(null);
  const [savingCardIds, setSavingCardIds] = useState<string[]>([]);
  const [sharingCardIds, setSharingCardIds] = useState<string[]>([]);
  const [cardMetricsById, setCardMetricsById] = useState<Record<string, CardMetrics>>({});
  const [feedToasts, setFeedToasts] = useState<FeedToast[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [providerServicesCount, setProviderServicesCount] = useState(0);
  const [providerProductsCount, setProviderProductsCount] = useState(0);
  const [seekerPostsCount, setSeekerPostsCount] = useState(0);
  const [, setReadinessLoading] = useState(false);
  const [nearbyCards, setNearbyCards] = useState<NearbyCard[]>([]);
  const [visibleFeedCount, setVisibleFeedCount] = useState(FEED_PAGE_SIZE);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const {
    schemaReady: connectionSchemaReady,
    schemaMessage: connectionSchemaMessage,
    busyTargetId: busyConnectionTargetId,
    busyRequestId: busyConnectionRequestId,
    busyActionKey: busyConnectionActionKey,
    getConnectionState,
    sendRequest,
    respond,
  } = useConnectionRequests();
  const activeRef = useRef(true);
  const viewerRoleFamily = getProfileRoleFamily(viewerProfile?.role);
  const viewerIsProvider = viewerRoleFamily === "provider";

  const pushFeedToast = useCallback((kind: FeedToast["kind"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFeedToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setFeedToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  }, []);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  const adjustCardMetrics = (cardId: string, updates: Partial<CardMetrics>) => {
    setCardMetricsById((current) => {
      const existing = current[cardId] || { saves: 0, shares: 0 };
      return {
        ...current,
        [cardId]: {
          saves: Math.max(0, updates.saves ?? existing.saves),
          shares: Math.max(0, updates.shares ?? existing.shares),
        },
      };
    });
  };

  const fetchFeedCardMetrics = useCallback(async (
    cardIds: string[],
    userId: string
  ): Promise<Record<string, CardMetrics>> => {
    const normalizedIds = Array.from(new Set(cardIds.filter(Boolean)));
    const emptyMetrics = Object.fromEntries(normalizedIds.map((id) => [id, { saves: 0, shares: 0 }]));

    if (normalizedIds.length === 0) {
      return {};
    }

    const metricResult = await supabase.rpc("get_feed_card_metrics", {
      card_ids: normalizedIds,
    });

    if (!metricResult.error) {
      const rows = (metricResult.data as FeedCardMetricRow[] | null) || [];
      const metrics: Record<string, CardMetrics> = { ...emptyMetrics };

      rows.forEach((row) => {
        if (!row?.card_id) return;
        const saves = Number(row.saves || 0);
        const shares = Number(row.shares || 0);
        metrics[row.card_id] = {
          saves: Number.isFinite(saves) ? saves : 0,
          shares: Number.isFinite(shares) ? shares : 0,
        };
      });

      return metrics;
    }

    const metricErrorMessage = metricResult.error.message.toLowerCase();
    const missingMetricsFunction =
      metricErrorMessage.includes("get_feed_card_metrics") ||
      metricErrorMessage.includes("function public.get_feed_card_metrics");

    if (!missingMetricsFunction) {
      console.warn("Failed to load feed card metrics:", metricResult.error.message);
      return emptyMetrics;
    }

    const [{ data: saveRows, error: saveRowsError }, { data: shareRows, error: shareRowsError }] = await Promise.all([
      supabase.from("feed_card_saves").select("card_id").eq("user_id", userId).in("card_id", normalizedIds),
      supabase.from("feed_card_shares").select("card_id").eq("user_id", userId).in("card_id", normalizedIds),
    ]);

    if (saveRowsError || shareRowsError) {
      console.warn(
        "Failed to load fallback feed metrics:",
        saveRowsError?.message || shareRowsError?.message || "unknown error"
      );
      return emptyMetrics;
    }

    const metrics: Record<string, CardMetrics> = { ...emptyMetrics };

    ((saveRows as FeedCardSaveRow[] | null) || []).forEach((row) => {
      if (!row?.card_id) return;
      const existing = metrics[row.card_id] || { saves: 0, shares: 0 };
      metrics[row.card_id] = {
        saves: existing.saves + 1,
        shares: existing.shares,
      };
    });

    ((shareRows as FeedCardShareRow[] | null) || []).forEach((row) => {
      if (!row?.card_id) return;
      const existing = metrics[row.card_id] || { saves: 0, shares: 0 };
      metrics[row.card_id] = {
        saves: existing.saves,
        shares: existing.shares + 1,
      };
    });

    return metrics;
  }, []);

  const loadConnectedFeed = useCallback(
    async (userId: string, options: { soft?: boolean } = {}) => {
      const { soft = false } = options;

      if (!soft) {
        setIsFeedLoading(true);
      }
      setLoadError("");

      try {
        const payload = await fetchAuthedJson<CommunityFeedResponse>(supabase, "/api/community/feed?scope=connected");
        if (!payload.ok) {
          throw new Error(payload.message || "Unable to load connected feed.");
        }

        if (!activeRef.current) {
          return null;
        }

        const nextRole = (payload.currentUserProfile?.role || "").toLowerCase();
        setIsProvider(providerRoles.has(nextRole));

        const buildResult = buildWelcomeFeedCards(payload);
        const nextCards = buildResult.cards;
        const nextMetrics = nextCards.length
          ? await fetchFeedCardMetrics(
              nextCards.map((card) => card.id),
              userId
            )
          : {};

        if (!activeRef.current) {
          return buildResult;
        }

        setAcceptedConnectionCount(buildResult.acceptedConnectionIds.length);
        setFeedEmptyReason(buildResult.emptyReason);
        setNearbyCards(nextCards);
        setCardMetricsById(nextMetrics);

        return buildResult;
      } catch (error) {
        if (isAbortLikeError(error)) {
          return null;
        }

        const message = isFailedFetchError(error)
          ? "Network issue while loading your connected local feed."
          : toErrorMessage(error, "Failed to load connected local feed.");
        console.warn("Connected welcome feed failed:", message);

        if (activeRef.current) {
          setLoadError(message);
          if (!soft) {
            setNearbyCards([]);
            setCardMetricsById({});
            setAcceptedConnectionCount(0);
            setFeedEmptyReason(null);
          }
        }

        return null;
      } finally {
        if (!soft && activeRef.current) {
          setIsFeedLoading(false);
        }
      }
    },
    [fetchFeedCardMetrics]
  );

  const enrichedCards = useMemo<EnrichedNearbyCard[]>(() => {
    return nearbyCards.map((card) => {
      const metrics = cardMetricsById[card.id] || { saves: 0, shares: 0 };
      const ownerLabel = card.ownerName?.trim() || "Connected user";
      const engagementParts = [];

      if (metrics.saves > 0) engagementParts.push(formatWelcomeCountLabel(metrics.saves, "save"));
      if (metrics.shares > 0) engagementParts.push(formatWelcomeCountLabel(metrics.shares, "share"));

      return {
        ...card,
        badge: card.type === "demand" ? "Need" : card.type === "service" ? "Service" : "Product",
        ownerLabel,
        ownerAvatarUrl: createAvatarFallback({ label: ownerLabel, seed: card.ownerId || card.id }),
        postedAgo: formatTimeAgo(card.createdAt),
        distanceLabel: buildWelcomeDistanceLabel(card.distanceKm),
        statusLabel: card.isDemo ? "Preview" : null,
        networkMetaLabel: card.isDemo ? "Preview in feed" : "In your network",
        isUrgent: isUrgentWelcomeCard(card),
        media: [{ mimeType: "image/jpeg", url: card.image }],
        audienceLabel: "Connected feed",
        audienceName: ownerLabel,
        audienceMeta: `${ownerLabel} is in your accepted network`,
        networkActionLabel: "Open profile",
        networkActionPath: routes.people,
        engagementLabel: engagementParts.length > 0 ? engagementParts.join(" • ") : "New in your live feed",
        surfaceReason: card.isDemo
          ? "Preview card while your connected marketplace fills in."
          : `${ownerLabel} is in your accepted network.`,
        tags: [card.signalLabel, card.etaLabel],
        saves: metrics.saves,
        shares: metrics.shares,
      };
    });
  }, [cardMetricsById, nearbyCards]);

  const resolvedVisibleFeedCount =
    enrichedCards.length > 0 ? Math.min(enrichedCards.length, Math.max(FEED_PAGE_SIZE, visibleFeedCount)) : 0;

  const visibleCards = useMemo(
    () => enrichedCards.slice(0, resolvedVisibleFeedCount),
    [enrichedCards, resolvedVisibleFeedCount]
  );

  const hasMoreFeedCards = visibleCards.length < enrichedCards.length;

  useEffect(() => {
    if (!viewerId || !viewerProfile) {
      setProviderServicesCount(0);
      setProviderProductsCount(0);
      setSeekerPostsCount(0);
      setReadinessLoading(false);
      return;
    }

    let active = true;

    const loadReadinessInsights = async () => {
      setReadinessLoading(true);

      try {
        if (viewerRoleFamily === "provider") {
          const [{ count: servicesCount }, { count: productsCount }] = await Promise.all([
            supabase.from("service_listings").select("id", { count: "exact", head: true }).eq("provider_id", viewerId),
            supabase.from("product_catalog").select("id", { count: "exact", head: true }).eq("provider_id", viewerId),
          ]);

          if (!active) return;

          setProviderServicesCount(Number(servicesCount || 0));
          setProviderProductsCount(Number(productsCount || 0));
          setSeekerPostsCount(0);
        } else {
          const postsCount = await countOwnedPosts(viewerId);
          if (!active) return;

          setProviderServicesCount(0);
          setProviderProductsCount(0);
          setSeekerPostsCount(Number(postsCount || 0));
        }
      } catch {
        if (!active) return;
        setProviderServicesCount(0);
        setProviderProductsCount(0);
        setSeekerPostsCount(0);
      } finally {
        if (active) {
          setReadinessLoading(false);
        }
      }
    };

    void loadReadinessInsights();

    return () => {
      active = false;
    };
  }, [viewerId, viewerProfile, viewerRoleFamily]);

  const welcomeReadinessSummary = useMemo(
    () =>
      viewerProfile
        ? createMarketplaceReadinessSummary({
            profile: viewerProfile,
            providerServicesCount,
            providerProductsCount,
            seekerPostsCount,
          })
        : null,
    [providerProductsCount, providerServicesCount, seekerPostsCount, viewerProfile]
  );

  const handleWelcomePromptSubmit = useCallback(() => {
    const defaultHref =
      welcomeReadinessSummary?.actions[0]?.href || (viewerIsProvider ? "/dashboard/provider/add-service" : "/dashboard?compose=1");
    const resolution = resolveWelcomeCommand(welcomePromptValue, {
      defaultHref,
      providerDefaultHref: "/dashboard/provider/add-service",
      isProvider: viewerIsProvider,
    });

    if (resolution.kind === "refresh") {
      if (viewerId) {
        void loadConnectedFeed(viewerId, { soft: false });
      }
      return;
    }

    router.push(resolution.href);
  }, [loadConnectedFeed, router, viewerId, viewerIsProvider, welcomePromptValue, welcomeReadinessSummary]);

  const welcomePromptConfig = useMemo<DashboardPromptConfig>(() => {
    const defaultHref =
      welcomeReadinessSummary?.actions[0]?.href || (viewerIsProvider ? "/dashboard/provider/add-service" : "/dashboard?compose=1");
    const primaryAction = welcomeReadinessSummary?.actions[0];

    return {
      placeholder: "Ask what to do next in ServiQ",
      value: welcomePromptValue,
      onValueChange: setWelcomePromptValue,
      onSubmit: handleWelcomePromptSubmit,
      actions: [
        {
          id: primaryAction?.id || "next-best-action",
          label: primaryAction?.ctaLabel || (viewerIsProvider ? "Add service" : "Post need"),
          onClick: () => {
            router.push(primaryAction?.href || defaultHref);
          },
          variant: "primary",
        },
        {
          id: "refresh-welcome-feed",
          label: isFeedLoading ? "Refreshing..." : "Refresh",
          icon: Loader2,
          onClick: () => {
            if (!viewerId) return;
            void loadConnectedFeed(viewerId, { soft: false });
          },
          variant: "secondary",
          disabled: !viewerId || isFeedLoading,
          busy: isFeedLoading,
        },
      ],
    };
  }, [
    handleWelcomePromptSubmit,
    isFeedLoading,
    loadConnectedFeed,
    router,
    viewerId,
    viewerIsProvider,
    welcomePromptValue,
    welcomeReadinessSummary,
  ]);

  useDashboardPrompt(welcomePromptConfig);

  const buildCardSavePayload = (card: EnrichedNearbyCard): FeedCardSavePayload => ({
    card_id: card.id,
    focus_id: card.focusId,
    card_type: card.type,
    title: card.title,
    subtitle: card.subtitle,
    action_path: card.actionPath,
    metadata: {
      priceLabel: card.priceLabel,
      etaLabel: card.etaLabel,
      ownerLabel: card.ownerLabel,
      audienceLabel: card.audienceLabel,
      audienceName: card.audienceName,
      tags: card.tags,
      image: card.image,
      signalLabel: card.signalLabel,
    },
  });

  const persistCardSave = async (payload: FeedCardSavePayload, shouldSave: boolean): Promise<boolean> => {
    if (!viewerId) {
      return false;
    }

    if (shouldSave) {
      try {
        await persistFeedCardSave(supabase, payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        console.warn("Failed to save feed card:", message);
        return false;
      }

      return true;
    }

    try {
      await removeFeedCardSave(supabase, payload.card_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn("Failed to remove saved feed card:", message);
      return false;
    }

    return true;
  };

  const persistShareEvent = async (card: EnrichedNearbyCard, channel: FeedShareChannel) => {
    if (!viewerId) {
      return;
    }

    const { error } = await supabase.from("feed_card_shares").insert({
      user_id: viewerId,
      card_id: card.id,
      focus_id: card.focusId,
      card_type: card.type,
      title: card.title,
      channel,
      metadata: {
        subtitle: card.subtitle,
        actionPath: card.actionPath,
        audienceLabel: card.audienceLabel,
        audienceName: card.audienceName,
        priceLabel: card.priceLabel,
        etaLabel: card.etaLabel,
      },
    });

    if (error) {
      console.warn("Failed to store feed card share:", error.message);
    }
  };
  const toggleCardSave = async (card: EnrichedNearbyCard) => {
    const wasSaved = savedCardIds.includes(card.id);
    const shouldSave = !wasSaved;
    const savePayload = buildCardSavePayload(card);
    setSavingCardIds((current) => (current.includes(card.id) ? current : [...current, card.id]));

    setSavedCardIds((current) => {
      if (shouldSave) {
        return current.includes(card.id) ? current : [...current, card.id];
      }
      return current.filter((id) => id !== card.id);
    });

    try {
      if (!viewerId) {
        pushFeedToast("info", "Sign in to sync saved posts across devices.");
        return;
      }

      if (shouldSave) {
        stagePendingFeedCardSave(viewerId, savePayload);
      } else {
        clearPendingFeedCardSave(viewerId, card.id);
      }

      const persisted = await persistCardSave(savePayload, shouldSave);
      if (persisted) {
        const existingMetrics = cardMetricsById[card.id] || { saves: 0, shares: 0 };
        adjustCardMetrics(card.id, {
          saves: existingMetrics.saves + (shouldSave ? 1 : -1),
        });
        pushFeedToast("success", shouldSave ? "Post saved." : "Removed from saved.");
        return;
      }

      setSavedCardIds((current) => {
        if (wasSaved) {
          return current.includes(card.id) ? current : [...current, card.id];
        }
        return current.filter((id) => id !== card.id);
      });
      if (shouldSave) {
        clearPendingFeedCardSave(viewerId, card.id);
      } else {
        stagePendingFeedCardSave(viewerId, savePayload);
      }
      pushFeedToast("error", "Could not update saved state. Try again.");
    } finally {
      setSavingCardIds((current) => current.filter((id) => id !== card.id));
    }
  };

  const appendCardContextQuery = (
    path: string,
    card: EnrichedNearbyCard,
    extras?: Record<string, string | null | undefined>
  ) => {
    const [pathname, rawQuery = ""] = path.split("?");
    const params = new URLSearchParams(rawQuery);

    params.set("source", "welcome_feed");
    params.set("context_card", card.id);
    params.set("context_focus", card.focusId);
    params.set("context_type", card.type);
    params.set("context_title", card.title);
    params.set("context_audience", card.audienceName);

    if (extras) {
      Object.entries(extras).forEach(([key, value]) => {
        if (!value) return;
        params.set(key, value);
      });
    }

    const nextQuery = params.toString();
    return nextQuery ? `${pathname}?${nextQuery}` : pathname;
  };

  const buildFeedFocusPath = (card: EnrichedNearbyCard) =>
    appendCardContextQuery(card.actionPath, card, {
      focus: card.focusId,
      type: card.type,
    });

  const buildNetworkActionPath = (card: EnrichedNearbyCard) => {
    return appendCardContextQuery(card.networkActionPath, card, {
      intent: "connections",
      tab: "Nearby",
      q: card.ownerLabel,
      provider: card.ownerId || undefined,
    });
  };

  const buildMessagePath = (card: EnrichedNearbyCard, conversationId?: string) =>
    appendCardContextQuery(routes.chat, card, {
      open: conversationId,
      focus: card.focusId,
      type: card.type,
    });

  const handleConnect = useCallback(
    async (targetUserId: string) => {
      try {
        if (!connectionSchemaReady) {
          throw new Error(connectionSchemaMessage || "Connections are not configured yet.");
        }

        if (!isUUIDLike(targetUserId)) {
          throw new Error("This profile cannot accept live connections yet.");
        }

        if (viewerId === targetUserId) {
          throw new Error("This is your own profile.");
        }

        const previousState = getConnectionState(targetUserId);
        await sendRequest(targetUserId);
        pushFeedToast(
          "success",
          previousState.kind === "incoming_pending" ? "Connection accepted instantly." : "Connection request sent."
        );
      } catch (error) {
        pushFeedToast("error", error instanceof Error ? error.message : "Unable to send connection request.");
      }
    },
    [connectionSchemaMessage, connectionSchemaReady, getConnectionState, pushFeedToast, sendRequest, viewerId]
  );

  const handleConnectionDecision = useCallback(
    async (requestId: string, decision: ConnectionDecision) => {
      try {
        if (!connectionSchemaReady) {
          throw new Error(connectionSchemaMessage || "Connections are not configured yet.");
        }

        await respond(requestId, decision);
        pushFeedToast(
          "success",
          decision === "accepted"
            ? "Connection accepted."
            : decision === "rejected"
            ? "Connection request declined."
            : "Connection request cancelled."
        );
      } catch (error) {
        pushFeedToast("error", error instanceof Error ? error.message : "Unable to update connection request.");
      }
    },
    [connectionSchemaMessage, connectionSchemaReady, pushFeedToast, respond]
  );

  const acceptHelpRequestCard = useCallback(async (card: EnrichedNearbyCard) => {
    if (!viewerId) {
      pushFeedToast("info", "Sign in to accept tasks.");
      return false;
    }

    if (!card.helpRequestId) {
      pushFeedToast("info", "Accept is available for task requests.");
      return false;
    }

    if (card.ownerId === viewerId) {
      pushFeedToast("info", "You cannot accept your own task.");
      return false;
    }

    if (card.acceptedProviderId && card.acceptedProviderId !== viewerId) {
      pushFeedToast("info", "This task is already accepted.");
      return false;
    }

    if (isClosedMarketplaceStatus(card.status)) {
      pushFeedToast("info", "This task is no longer open.");
      return false;
    }

    if (card.acceptedProviderId === viewerId) {
      return true;
    }

    const { data, error } = await supabase.rpc("accept_help_request", {
      target_help_request_id: card.helpRequestId,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Request already accepted or unavailable.");
    }

    setNearbyCards((current) => current.filter((item) => item.id !== card.id));

    return true;
  }, [pushFeedToast, viewerId]);

  const toAcceptDialogListing = useCallback(
    (card: EnrichedNearbyCard): MarketplaceDisplayFeedItem => ({
      id: card.id,
      source: card.helpRequestId ? "help_request" : card.type === "service" ? "service_listing" : card.type === "product" ? "product_listing" : "post",
      helpRequestId: card.helpRequestId || null,
      providerId: card.ownerId || "",
      type: card.type,
      title: card.title,
      description: card.subtitle,
      category: card.badge,
      price: 0,
      avatarUrl: card.ownerAvatarUrl,
      creatorName: card.ownerLabel,
      creatorUsername: card.ownerLabel,
      locationLabel: card.distanceLabel,
      distanceKm: 0,
      lat: 0,
      lng: 0,
      media: card.media,
      createdAt: card.createdAt,
      urgent: card.isUrgent,
      rankScore: 0,
      profileCompletion: 0,
      responseMinutes: 0,
      verificationStatus: "verified",
      publicProfilePath: "",
      status: card.status || "",
      acceptedProviderId: card.acceptedProviderId || null,
      displayTitle: card.title,
      displayDescription: card.subtitle,
      displayCreator: card.ownerLabel,
      timeLabel: card.postedAgo,
      priceLabel: card.priceLabel,
      distanceLabel: card.distanceLabel,
    }),
    []
  );

  const handleMessageCard = async (card: EnrichedNearbyCard) => {
    if (card.ownerId && viewerId && card.ownerId === viewerId) {
      pushFeedToast("info", "This is your own post.");
      return;
    }

    if (card.helpRequestId) {
      if (!viewerId) {
        router.push(buildMessagePath(card));
        return;
      }

      if (card.ownerId === viewerId) {
        pushFeedToast("info", "This is your own task request.");
        return;
      }

      if (card.acceptedProviderId && card.acceptedProviderId !== viewerId) {
        pushFeedToast("info", "This task has already been accepted.");
        return;
      }

      if (isClosedMarketplaceStatus(card.status)) {
        pushFeedToast("info", "This task is no longer open.");
        return;
      }

      setMessageCardId(card.id);

      try {
        const accepted = await acceptHelpRequestCard(card);
        if (!accepted) return;

        const recipientId = card.ownerId || null;
        const isUuidRecipient =
          !!recipientId &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId);

        if (!recipientId || !isUuidRecipient) {
          router.push("/dashboard/tasks");
          pushFeedToast("success", "Task moved to In Progress.");
          return;
        }

        const targetConversationId = await getOrCreateDirectConversationId(supabase, viewerId, recipientId);
        const params = new URLSearchParams({
          open: targetConversationId,
          quote: "1",
          helpRequest: card.helpRequestId,
        });

        router.push(`/dashboard/chat?${params.toString()}`);
        pushFeedToast("success", "Quote flow opened.");
        return;
      } catch (error) {
        pushFeedToast("error", toErrorMessage(error, "Unable to start the quote flow."));
        return;
      } finally {
        setMessageCardId((current) => (current === card.id ? null : current));
      }
    }

    const fallbackChatPath = buildMessagePath(card);
    const recipientId = card.ownerId || null;
    const isUuidRecipient = !!recipientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId);

    if (!viewerId || !recipientId || !isUuidRecipient || recipientId === viewerId || recipientId.startsWith("demo-")) {
      router.push(fallbackChatPath);
      return;
    }

    setMessageCardId(card.id);
    let targetPath = fallbackChatPath;

    try {
      const targetConversationId = await getOrCreateDirectConversationId(supabase, viewerId, recipientId);

      if (targetConversationId) {
        targetPath = buildMessagePath(card, targetConversationId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn("Failed to prepare contextual chat:", message);
    } finally {
      setMessageCardId((current) => (current === card.id ? null : current));
    }

    router.push(targetPath);
  };

  const handlePrimaryCardAction = async (card: EnrichedNearbyCard) => {
    if (card.isDemo) {
      router.push(buildFeedFocusPath(card));
      return;
    }

    if (card.helpRequestId) {
      setAcceptTargetCard(card);
      return;
    }

    if (card.actionLabel === "Respond" || card.actionLabel === "Book") {
      await handleMessageCard(card);
      return;
    }

    if (card.actionLabel === "Connect") {
      router.push(buildNetworkActionPath(card));
      return;
    }

    router.push(buildFeedFocusPath(card));
  };

  const confirmAcceptCard = useCallback(async () => {
    if (!acceptTargetCard) return;

    setAcceptingCardId(acceptTargetCard.id);
    try {
      const accepted = await acceptHelpRequestCard(acceptTargetCard);
      if (!accepted) return;
      setAcceptTargetCard(null);
      pushFeedToast("success", "Task moved to In Progress.");
      router.push("/dashboard/tasks");
    } catch (error) {
      pushFeedToast("error", toErrorMessage(error, "Unable to accept this task right now."));
    } finally {
      setAcceptingCardId((current) => (current === acceptTargetCard.id ? null : current));
    }
  }, [acceptHelpRequestCard, acceptTargetCard, pushFeedToast, router]);

  const handleShareCard = async (card: EnrichedNearbyCard) => {
    const focusPath = buildFeedFocusPath(card);
    const shareUrl = `${window.location.origin}${focusPath}`;
    const shareText = `${card.title} | ${card.priceLabel} | ${card.etaLabel} | ${card.ownerLabel}`;
    setSharingCardIds((current) => (current.includes(card.id) ? current : [...current, card.id]));

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${card.badge}: ${card.title}`,
          text: shareText,
          url: shareUrl,
        });
        const existingMetrics = cardMetricsById[card.id] || { saves: 0, shares: 0 };
        adjustCardMetrics(card.id, {
          shares: existingMetrics.shares + 1,
        });
        void persistShareEvent(card, "native");
        pushFeedToast("success", "Post shared.");
        return;
      }

      if (!navigator.clipboard?.writeText) {
        pushFeedToast("error", "Share is not supported in this browser context.");
        return;
      }

      await navigator.clipboard.writeText(`${card.title}\n${shareText}\n${shareUrl}`);
      const existingMetrics = cardMetricsById[card.id] || { saves: 0, shares: 0 };
      adjustCardMetrics(card.id, {
        shares: existingMetrics.shares + 1,
      });
      void persistShareEvent(card, "clipboard");
      pushFeedToast("success", "Share link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      pushFeedToast("error", "Unable to share right now.");
    } finally {
      setSharingCardIds((current) => current.filter((id) => id !== card.id));
    }
  };

  const liveStatusLabel = isFeedLoading
    ? "Syncing feed"
    : nearbyCards.length > 0
    ? `${nearbyCards.length} connected posts live`
    : acceptedConnectionCount > 0
    ? `${acceptedConnectionCount} connections live`
    : "Connect to unlock";

  useEffect(() => {
    const lineTimer = window.setInterval(() => {
      setHeroLineIndex((current) => (current + 1) % MARKETPLACE_HERO_LINES.length);
    }, 3200);

    return () => window.clearInterval(lineTimer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadWelcome = async () => {
      setLoadError("");

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
          if (isActive) {
            setViewerId(null);
            setSavedCardIds([]);
            setCardMetricsById({});
            setNearbyCards([]);
            setAcceptedConnectionCount(0);
            setFeedEmptyReason(null);
            setIsFeedLoading(false);
          }
          return;
        }

        setViewerId(currentUser.id);

        const [communityResult, { data: savedCardRows, error: savedCardError }] = await Promise.all([
          loadConnectedFeed(currentUser.id),
          supabase.from("feed_card_saves").select("card_id").eq("user_id", currentUser.id),
        ]);

        if (!isActive) {
          return;
        }

        if (savedCardError) {
          console.warn("Failed to load saved feed cards:", savedCardError.message);
          setSavedCardIds(getPendingFeedCardIds(currentUser.id));
        } else {
          const persistedSavedIds = ((savedCardRows as FeedCardSaveRow[] | null) || []).map((row) => row.card_id);
          prunePendingFeedCardSaves(currentUser.id, persistedSavedIds);
          const nextSavedIds = Array.from(new Set([...persistedSavedIds, ...getPendingFeedCardIds(currentUser.id)]));
          setSavedCardIds(nextSavedIds);
          void syncPendingFeedCardSaves(supabase, currentUser.id, persistedSavedIds);
        }

        if (!communityResult) {
          setIsFeedLoading(false);
        }
      } catch (error) {
        if (isAbortLikeError(error)) {
          return;
        }

        const message = isFailedFetchError(error)
          ? "Network issue while loading your welcome dashboard."
          : toErrorMessage(error, "Failed to load welcome dashboard.");
        console.warn("Welcome load failed:", message);
        if (isActive) {
          setLoadError(message);
          setIsFeedLoading(false);
        }
      }
    };

    void loadWelcome();

    return () => {
      isActive = false;
    };
  }, [loadConnectedFeed]);

  useEffect(() => {
    if (!viewerId) return;

    let reloadTimer: number | null = null;
    const scheduleReload = () => {
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }

      reloadTimer = window.setTimeout(() => {
        void loadConnectedFeed(viewerId, { soft: true });
      }, 320);
    };

    const channel = supabase
      .channel(`welcome-live-feed-${viewerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connection_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "help_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleReload)
      .subscribe();

    const poller = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadConnectedFeed(viewerId, { soft: true });
    }, 120000);

    return () => {
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }
      window.clearInterval(poller);
      void supabase.removeChannel(channel);
    };
  }, [loadConnectedFeed, viewerId]);

  useEffect(() => {
    if (!viewerId || nearbyCards.length === 0) return;

    let isActive = true;
    const cardIds = nearbyCards.map((card) => card.id);
    const cardIdSet = new Set(cardIds);

    const refreshMetrics = async () => {
      const nextMetrics = await fetchFeedCardMetrics(cardIds, viewerId);
      if (isActive) {
        setCardMetricsById(nextMetrics);
      }
    };

    const extractCardId = (payload: { new: unknown; old: unknown }) => {
      const nextRow = (payload.new as { card_id?: string } | null) || null;
      const prevRow = (payload.old as { card_id?: string } | null) || null;
      return nextRow?.card_id || prevRow?.card_id || null;
    };

    const channel = supabase
      .channel(`welcome-feed-interactions-${viewerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_saves",
          filter: `user_id=eq.${viewerId}`,
        },
        (payload) => {
          const changedCardId = extractCardId(payload);
          if (!changedCardId || !cardIdSet.has(changedCardId)) {
            return;
          }

          if (payload.eventType === "DELETE") {
            clearPendingFeedCardSave(viewerId, changedCardId);
            setSavedCardIds((current) => current.filter((id) => id !== changedCardId));
          } else {
            prunePendingFeedCardSaves(viewerId, [changedCardId]);
            setSavedCardIds((current) => (current.includes(changedCardId) ? current : [...current, changedCardId]));
          }

          void refreshMetrics();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_shares",
          filter: `user_id=eq.${viewerId}`,
        },
        (payload) => {
          const changedCardId = extractCardId(payload);
          if (!changedCardId || !cardIdSet.has(changedCardId)) {
            return;
          }
          void refreshMetrics();
        }
      )
      .subscribe();

    void refreshMetrics();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [fetchFeedCardMetrics, nearbyCards, viewerId]);

  useEffect(() => {
    setVisibleFeedCount((current) => {
      if (enrichedCards.length === 0) {
        return FEED_PAGE_SIZE;
      }

      return Math.min(Math.max(current, FEED_PAGE_SIZE), enrichedCards.length);
    });
  }, [enrichedCards.length]);

  useEffect(() => {
    if (isFeedLoading || !hasMoreFeedCards) {
      setLoadingMoreFeed(false);
      return;
    }

    const sentinel = feedSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loadMoreTimerRef.current) {
          return;
        }

        setLoadingMoreFeed(true);
        loadMoreTimerRef.current = window.setTimeout(() => {
          setVisibleFeedCount((current) => Math.min(current + FEED_PAGE_SIZE, enrichedCards.length));
          setLoadingMoreFeed(false);
          loadMoreTimerRef.current = null;
        }, 180);
      },
      { rootMargin: "220px 0px" }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      if (loadMoreTimerRef.current) {
        window.clearTimeout(loadMoreTimerRef.current);
        loadMoreTimerRef.current = null;
      }
    };
  }, [enrichedCards.length, hasMoreFeedCards, isFeedLoading]);

  return (
    <>
      <div className="min-h-screen bg-[var(--surface-app)] text-slate-900">
        <div className="mx-auto w-full max-w-[1480px] py-2 sm:py-4 space-y-5 sm:space-y-6">
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative min-h-[230px] overflow-hidden rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_16%,rgba(14,165,164,0.14),transparent_44%),radial-gradient(circle_at_88%_84%,rgba(14,116,144,0.12),transparent_44%)]" />
              <div
                className="absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                }}
              />
            </div>

            <div className="relative space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-700)]">Welcome Command Center</p>
                  <h2 className="brand-display mt-1 text-xl font-semibold text-slate-900 sm:text-2xl">{MARKETPLACE_HERO_LINES[4]}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{appTagline}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--brand-500)]/25 bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-700)] shadow-sm">
                  <span className={`h-1.5 w-1.5 rounded-full ${acceptedConnectionCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                  {liveStatusLabel}
                </span>
              </div>

              <div className="grid gap-2.5 md:grid-cols-2">
                <button
                  onClick={() => setOpenPostModal(true)}
                  className="group rounded-xl border border-transparent bg-[var(--brand-900)] px-3 py-2.5 text-left text-white transition hover:bg-[var(--brand-700)]"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/12 ring-1 ring-white/20">
                      <Zap size={14} />
                    </span>
                    <p className="text-base font-semibold">Post a Need</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-200">Get local help quickly.</p>
                </button>

                <button
                  onClick={() => router.push(isProvider ? `${routes.posts}?category=demand` : routes.people)}
                  className="group rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-slate-900 transition hover:border-[var(--brand-500)]/35 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--brand-500)]/12 ring-1 ring-[var(--brand-500)]/20 text-[var(--brand-700)]">
                      <UsersRound size={14} />
                    </span>
                    <p className="text-base font-semibold">Earn Nearby</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">Respond to nearby tasks and earn.</p>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {MARKETPLACE_HERO_LINES[heroLineIndex]}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  {MARKETPLACE_HERO_LINES[(heroLineIndex + 1) % MARKETPLACE_HERO_LINES.length]}
                </span>
              </div>
            </div>
          </motion.section>

          {!!loadError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {loadError}
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Connected Local Live Feed
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">Realtime posts from accepted connections only</h3>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                    This stream stays limited to people you are already connected with. New needs, service offers, and product
                    posts sync in automatically and keep loading as you scroll.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push(routes.people)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)]"
                >
                  <UsersRound size={14} />
                  Manage connections
                </button>
                <button
                  type="button"
                  onClick={() => setOpenPostModal(true)}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-900)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
                >
                  <Zap size={14} />
                  Post to network
                </button>
              </div>
            </div>

            <div data-testid="welcome-live-feed" className="mt-5">
              {isFeedLoading && enrichedCards.length === 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2].map((index) => (
                    <div key={`welcome-feed-skeleton-${index}`} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
                        <div>
                          <div className="h-3 w-24 rounded bg-slate-200" />
                          <div className="mt-3 h-6 w-3/5 rounded bg-slate-200" />
                          <div className="mt-2 h-4 w-full rounded bg-slate-200" />
                          <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
                          <div className="mt-4 flex gap-2">
                            <div className="h-8 w-24 rounded bg-slate-200" />
                            <div className="h-8 w-20 rounded bg-slate-200" />
                            <div className="h-8 w-20 rounded bg-slate-200" />
                          </div>
                        </div>
                        <div className="h-48 rounded-2xl bg-slate-200" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : enrichedCards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <h4 className="text-base font-semibold text-slate-900">
                    {feedEmptyReason === "no_connections"
                      ? "Your connected live feed unlocks after your first accepted connection"
                      : "Your connections are live, but nothing has been posted yet"}
                  </h4>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    {feedEmptyReason === "no_connections"
                      ? "Send or accept connection requests in People. Once a connection is accepted, their local posts will begin appearing here automatically in realtime."
                      : "As soon as someone in your accepted network shares a need, service, or product, it will show up here without needing a manual refresh."}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(routes.people)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-900)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
                    >
                      <UsersRound size={14} />
                      Open People
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenPostModal(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)]"
                    >
                      <Zap size={14} />
                      Create a post
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {visibleCards.map((card, cardIndex) => {
                    const networkPath = buildNetworkActionPath(card);
                    const isSaved = savedCardIds.includes(card.id);
                    const isTaskRequest = isTaskRequestCard(card);
                    const isOwnPost = Boolean(viewerId && card.ownerId === viewerId);
                    const messageInFlight = messageCardId === card.id;
                    const acceptInFlight = acceptingCardId === card.id;
                    const saveInFlight = savingCardIds.includes(card.id);
                    const shareInFlight = sharingCardIds.includes(card.id);
                    const primaryActionBusy = acceptInFlight;
                    return (
                      <article
                        key={`welcome-feed-${card.id}`}
                        data-testid="welcome-feed-card"
                        data-card-id={card.id}
                        className="post-card-enter overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.45)] transition-all hover:border-[var(--brand-500)]/35 hover:shadow-[0_28px_42px_-28px_rgba(14,165,164,0.3)]"
                        style={{ "--enter-delay": `${Math.min(cardIndex * 55, 360)}ms` } as CSSProperties}
                      >
                        <header className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => router.push(networkPath)}
                            className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
                            aria-label={`Open ${card.ownerLabel} profile`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={card.ownerAvatarUrl}
                              alt={`${card.ownerLabel} avatar`}
                              className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => router.push(networkPath)}
                                className="min-w-0 max-w-full truncate text-left text-base font-semibold text-slate-900 transition hover:text-[var(--brand-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
                                aria-label={`Open ${card.ownerLabel} profile`}
                              >
                                {card.ownerLabel}
                              </button>
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                  card.type === "demand"
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : card.type === "service"
                                    ? "border-cyan-200 bg-cyan-50 text-[var(--brand-700)]"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {card.badge}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2 overflow-hidden text-[11px] text-slate-500">
                              <span>{card.postedAgo}</span>
                              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                <MapPin size={11} />
                                {card.distanceLabel}
                              </span>
                              {card.isUrgent ? <span className="shrink-0 text-rose-600">Urgent</span> : null}
                            </div>
                          </div>
                          {card.ownerId && isUUIDLike(card.ownerId) ? (
                            <div className="shrink-0 self-center">
                              <ConnectionActionGroup
                                state={getConnectionState(card.ownerId)}
                                busy={
                                  busyConnectionTargetId === card.ownerId ||
                                  (getConnectionState(card.ownerId).requestId
                                    ? busyConnectionRequestId === getConnectionState(card.ownerId).requestId
                                    : false)
                                }
                                busyActionKey={busyConnectionActionKey}
                                onConnect={() => void handleConnect(card.ownerId!)}
                                onAccept={() =>
                                  getConnectionState(card.ownerId).requestId
                                    ? void handleConnectionDecision(getConnectionState(card.ownerId).requestId!, "accepted")
                                    : undefined
                                }
                                onReject={() =>
                                  getConnectionState(card.ownerId).requestId
                                    ? void handleConnectionDecision(getConnectionState(card.ownerId).requestId!, "rejected")
                                    : undefined
                                }
                                onCancel={() =>
                                  getConnectionState(card.ownerId).requestId
                                    ? void handleConnectionDecision(getConnectionState(card.ownerId).requestId!, "cancelled")
                                    : undefined
                                }
                                size="compact"
                              />
                            </div>
                          ) : null}
                        </header>

                        <div className="mt-2.5" data-testid="feed-card-main-image">
                          <FeedMediaCarousel media={card.media} title={card.title} showCountBadge={card.media.length > 1} />
                        </div>

                        <div className="mt-2.5">
                          <h3 className="line-clamp-2 text-[15px] font-semibold leading-tight text-slate-900">{card.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{card.subtitle}</p>
                        </div>

                        <div className="mt-3 flex items-center gap-1.5">
                          {isTaskRequest ? (
                            <button
                              type="button"
                              onClick={() => void handlePrimaryCardAction(card)}
                              disabled={primaryActionBusy || isOwnPost}
                              aria-label={`Accept post ${card.title}`}
                              title={isOwnPost ? "You cannot accept your own post" : "Accept task"}
                              data-testid="feed-action-primary"
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                                isOwnPost
                                  ? "border-slate-200 bg-slate-100 text-slate-500"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {primaryActionBusy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void handleMessageCard(card)}
                            disabled={messageInFlight || isOwnPost}
                            aria-label={`Show interest in ${card.title}`}
                            title={isOwnPost ? "You cannot show interest in your own post" : "Show interest"}
                            data-testid="feed-action-message"
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                              isOwnPost
                                ? "border-slate-200 bg-slate-100 text-slate-500"
                                : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                            }`}
                          >
                            {messageInFlight ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                          </button>

                          <div className="ml-auto flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleShareCard(card)}
                              disabled={shareInFlight}
                              aria-label={`Share ${card.title}`}
                              title="Share post"
                              data-testid="feed-action-share"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              {shareInFlight ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => void toggleCardSave(card)}
                              disabled={saveInFlight}
                              aria-label={`${isSaved ? "Unsave" : "Save"} ${card.title}`}
                              title={isSaved ? "Remove from saved" : "Save post"}
                              data-testid="feed-action-save"
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                                isSaved && !saveInFlight
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                              }`}
                            >
                              {saveInFlight ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : isSaved ? (
                                <BookmarkCheck size={16} />
                              ) : (
                                <Bookmark size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}

                  {hasMoreFeedCards && (
                    <div ref={feedSentinelRef} className="md:col-span-2 flex justify-center py-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                        {loadingMoreFeed ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 text-[var(--brand-700)]" />
                        )}
                        {loadingMoreFeed ? "Loading more connected posts..." : "Scroll for more connected posts"}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

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
                : "border-cyan-200 bg-cyan-50/95 text-[var(--brand-700)]"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      <CreatePostModal
        open={openPostModal}
        onClose={() => setOpenPostModal(false)}
        onPublished={(result) => {
          setOpenPostModal(false);
          if (result?.helpRequestId) {
            router.push(`/dashboard?focus=${encodeURIComponent(result.helpRequestId)}&source=create_post`);
            return;
          }
          router.push("/dashboard");
        }}
      />
      <AcceptConfirmDialog
        open={!!acceptTargetCard}
        listing={acceptTargetCard ? toAcceptDialogListing(acceptTargetCard) : null}
        busy={!!(acceptTargetCard && acceptingCardId === acceptTargetCard.id)}
        onCancel={() => {
          if (acceptingCardId) return;
          setAcceptTargetCard(null);
        }}
        onConfirm={() => void confirmAcceptCard()}
      />
    </>
  );
}
