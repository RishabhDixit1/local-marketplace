"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AcceptConfirmDialog from "@/app/dashboard/components/posts/AcceptConfirmDialog";
import FeedGrid from "@/app/dashboard/components/posts/FeedGrid";
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
import { buildPublicProfilePath, getProfileRoleFamily } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";
import { getOrCreateDirectConversationId, insertConversationMessage } from "@/lib/directMessages";
import { isClosedMarketplaceStatus, type MarketplaceDisplayFeedItem, type MarketplaceFeedMedia } from "@/lib/marketplaceFeed";
import {
  resolveMarketplaceCardActionModel,
  type MarketplaceCardActionModel,
  type MarketplacePrimaryActionKind,
  type MarketplaceSecondaryActionKind,
} from "@/lib/marketplaceCardActions";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";
import { buildWelcomeFeedCards, type WelcomeFeedCard } from "@/lib/welcomeFeed";
import { Loader2, UsersRound, Zap } from "lucide-react";

const CreatePostModal = dynamic(() => import("@/app/components/CreatePostModal").then((mod) => mod.default), {
  ssr: false,
});

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

const HERO_TAGLINES = [
  "Where Neighbours Help and Earn in Real Time.",
  "Small Tasks. Real People. Instant Help.",
  "Post What You Need. Someone Nearby Will Help.",
] as const;

const buildWelcomeDistanceLabel = (distanceKm: number) => (distanceKm > 0 ? `${distanceKm.toFixed(1)} km away` : "Nearby");
const isUrgentWelcomeCard = (card: NearbyCard) => {
  const urgencySource = `${card.signalLabel} ${card.etaLabel}`.toLowerCase();
  return urgencySource.includes("urgent") || urgencySource.includes("today") || urgencySource.includes("evening");
};

const formatWelcomeCountLabel = (count: number, singular: string) =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

const getWelcomeCardCategory = (card: Pick<EnrichedNearbyCard, "badge" | "subtitle">) => {
  const subtitleParts = card.subtitle
    .split("•")
    .map((part) => part.trim())
    .filter(Boolean);

  return subtitleParts.length > 1 ? subtitleParts[subtitleParts.length - 1] || card.badge : card.badge;
};

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
  const [heroTaglineIndex, setHeroTaglineIndex] = useState(0);
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
  const [activeFeedCardId, setActiveFeedCardId] = useState<string | null>(null);
  const [hoveredFeedCardId, setHoveredFeedCardId] = useState<string | null>(null);
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

  const adjustCardMetrics = useCallback((cardId: string, updates: Partial<CardMetrics>) => {
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
  }, []);

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
        networkActionPath:
          card.ownerId && !card.ownerId.startsWith("demo-")
            ? buildPublicProfilePath({ id: card.ownerId, name: ownerLabel }) || routes.people
            : routes.people,
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

  const welcomeSearchQuery = welcomePromptValue.trim().toLowerCase();

  const filteredCards = useMemo(() => {
    if (!welcomeSearchQuery) {
      return enrichedCards;
    }

    const queryTokens = welcomeSearchQuery.split(/\s+/).filter(Boolean);
    return enrichedCards.filter((card) => {
      const haystack = [
        card.title,
        card.subtitle,
        card.ownerLabel,
        card.badge,
        card.audienceLabel,
        card.audienceMeta,
        card.surfaceReason,
        card.engagementLabel,
        card.distanceLabel,
        card.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return queryTokens.every((token) => haystack.includes(token));
    });
  }, [enrichedCards, welcomeSearchQuery]);

  const resolvedVisibleFeedCount =
    filteredCards.length > 0 ? Math.min(filteredCards.length, Math.max(FEED_PAGE_SIZE, visibleFeedCount)) : 0;

  const visibleCards = useMemo(
    () => filteredCards.slice(0, resolvedVisibleFeedCount),
    [filteredCards, resolvedVisibleFeedCount]
  );

  const hasMoreFeedCards = visibleCards.length < filteredCards.length;
  const isSearchActive = welcomeSearchQuery.length > 0;

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
    const normalizedQuery = welcomePromptValue.trim().toLowerCase();
    if (/(refresh|reload|sync|update)/.test(normalizedQuery)) {
      if (viewerId) {
        void loadConnectedFeed(viewerId, { soft: false });
      }
      return;
    }

    setVisibleFeedCount(FEED_PAGE_SIZE);
  }, [loadConnectedFeed, viewerId, welcomePromptValue]);

  const welcomePromptConfig = useMemo<DashboardPromptConfig>(() => {
    const defaultHref =
      welcomeReadinessSummary?.actions[0]?.href || (viewerIsProvider ? "/dashboard/provider/add-service" : "/dashboard?compose=1");
    const primaryAction = welcomeReadinessSummary?.actions[0];

    return {
      placeholder: "Search the live feed by title, owner, category, or location",
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

  const buildCardSavePayload = useCallback(
    (card: EnrichedNearbyCard): FeedCardSavePayload => ({
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
        ownerId: card.ownerId || null,
        audienceLabel: card.audienceLabel,
        audienceName: card.audienceName,
        publicProfilePath: card.networkActionPath,
        helpRequestId: card.helpRequestId || null,
        acceptedProviderId: card.acceptedProviderId || null,
        status: card.status || "open",
        source: card.source || null,
        avatarUrl: card.ownerAvatarUrl,
        tags: card.tags,
        image: card.image,
        signalLabel: card.signalLabel,
      },
    }),
    []
  );

  const persistCardSave = useCallback(async (payload: FeedCardSavePayload, shouldSave: boolean): Promise<boolean> => {
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
  }, [viewerId]);

  const persistShareEvent = useCallback(async (card: EnrichedNearbyCard, channel: FeedShareChannel) => {
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
  }, [viewerId]);

  const toggleCardSave = useCallback(async (card: EnrichedNearbyCard) => {
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
  }, [adjustCardMetrics, buildCardSavePayload, cardMetricsById, persistCardSave, pushFeedToast, savedCardIds, viewerId]);

  const appendCardContextQuery = useCallback((
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
  }, []);

  const buildFeedFocusPath = useCallback(
    (card: EnrichedNearbyCard) =>
      appendCardContextQuery(card.actionPath, card, {
        focus: card.focusId,
        type: card.type,
      }),
    [appendCardContextQuery]
  );

  const buildNetworkActionPath = useCallback((card: EnrichedNearbyCard) => {
    return appendCardContextQuery(card.networkActionPath, card, {
      intent: "connections",
      tab: "Nearby",
      q: card.ownerLabel,
      provider: card.ownerId || undefined,
    });
  }, [appendCardContextQuery]);

  const buildMessagePath = useCallback(
    (card: EnrichedNearbyCard, conversationId?: string) =>
      appendCardContextQuery(routes.chat, card, {
        open: conversationId,
        focus: card.focusId,
        type: card.type,
      }),
    [appendCardContextQuery]
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

    await fetchAuthedJson<{ ok: true; helpRequestId: string; status: "accepted" }>(supabase, "/api/needs/accept", {
      method: "POST",
      body: JSON.stringify({ helpRequestId: card.helpRequestId }),
    });

    setNearbyCards((current) => current.filter((item) => item.id !== card.id));

    return true;
  }, [pushFeedToast, viewerId]);

  const toMarketplaceFeedItem = useCallback(
    (card: EnrichedNearbyCard): MarketplaceDisplayFeedItem => ({
      id: card.id,
      source:
        card.helpRequestId || card.source === "help_request"
          ? "help_request"
          : card.type === "service"
            ? "service_listing"
            : card.type === "product"
              ? "product_listing"
              : "post",
      helpRequestId: card.helpRequestId || null,
      canonicalKey: card.canonicalKey,
      linkedPostId: card.source === "post" ? card.focusId : null,
      linkedListingId: card.source === "service" || card.source === "product" ? card.focusId : null,
      linkedHelpRequestId: card.helpRequestId || null,
      metadata: {
        audience_label: card.audienceLabel,
        audience_name: card.audienceName,
        surface_reason: card.surfaceReason,
      },
      providerId: card.ownerId || "",
      type: card.type,
      title: card.title,
      description: card.subtitle,
      category: getWelcomeCardCategory(card),
      price: 0,
      avatarUrl: card.ownerAvatarUrl,
      creatorName: card.ownerLabel,
      creatorUsername: card.ownerLabel,
      locationLabel: card.distanceLabel,
      distanceKm: card.distanceKm,
      lat: 0,
      lng: 0,
      coordinateAccuracy: "approximate",
      media: card.media,
      createdAt: card.createdAt,
      urgent: card.isUrgent,
      rankScore: 0,
      profileCompletion: 0,
      responseMinutes: card.isUrgent ? 15 : 45,
      verificationStatus: "pending",
      publicProfilePath: buildNetworkActionPath(card),
      status: card.status || "open",
      acceptedProviderId: card.acceptedProviderId || null,
      displayTitle: card.title,
      displayDescription: card.subtitle,
      displayCreator: card.ownerLabel,
      timeLabel: card.postedAgo,
      priceLabel: card.priceLabel,
      distanceLabel: card.distanceLabel,
    }),
    [buildNetworkActionPath]
  );

  const openWelcomeQuoteThread = useCallback(async (card: EnrichedNearbyCard) => {
    if (card.isDemo) {
      router.push(buildFeedFocusPath(card));
      return;
    }

    const fallbackChatPath = buildMessagePath(card);
    const recipientId = card.ownerId || null;
    const isUuidRecipient = !!recipientId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recipientId);

    if (!recipientId || !isUuidRecipient || recipientId.startsWith("demo-")) {
      router.push(fallbackChatPath);
      return;
    }

    setMessageCardId(card.id);

    try {
      const activeViewerId = await ensureViewerId();
      if (activeViewerId === recipientId) {
        pushFeedToast("info", "This is your own post.");
        return;
      }

      if (isClosedMarketplaceStatus(card.status)) {
        pushFeedToast(
          "info",
          card.helpRequestId ? "This request is closed, so quotes are no longer available." : "This post is no longer open."
        );
        return;
      }

      const targetConversationId = await getOrCreateDirectConversationId(supabase, activeViewerId, recipientId);
      const interestMessage =
        card.helpRequestId && card.acceptedProviderId === activeViewerId
          ? `Hi, I am preparing a quote for "${card.title}" and will share it shortly.`
          : `Hi, I am interested in "${card.title}" and can help with it.`;

      await insertConversationMessage(supabase, {
        conversationId: targetConversationId,
        senderId: activeViewerId,
        content: interestMessage,
      });

      const params = new URLSearchParams({ open: targetConversationId });
      if (card.helpRequestId && card.acceptedProviderId === activeViewerId) {
        params.set("quote", "1");
        params.set("helpRequest", card.helpRequestId);
      }

      router.push(`/dashboard/chat?${params.toString()}`);
      pushFeedToast("success", "Interest sent to the creator.");
    } catch (error) {
      pushFeedToast("error", toErrorMessage(error, "Unable to start the quote flow."));
    } finally {
      setMessageCardId((current) => (current === card.id ? null : current));
    }
  }, [buildFeedFocusPath, buildMessagePath, ensureViewerId, pushFeedToast, router]);

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

  const handleShareCard = useCallback(async (card: EnrichedNearbyCard) => {
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
  }, [adjustCardMetrics, buildFeedFocusPath, cardMetricsById, persistShareEvent, pushFeedToast]);

  const livePostCount = nearbyCards.length;
  const cardById = useMemo(() => new Map(enrichedCards.map((card) => [card.id, card])), [enrichedCards]);
  const visibleFeedItems = useMemo(() => visibleCards.map((card) => toMarketplaceFeedItem(card)), [toMarketplaceFeedItem, visibleCards]);

  const resolveWelcomeActionModel = useCallback(
    (item: MarketplaceDisplayFeedItem): MarketplaceCardActionModel => {
      const model = resolveMarketplaceCardActionModel({
        item,
        viewerId,
      });

      return {
        ...model,
        buttons: model.buttons.filter((button) => button.kind !== "discard"),
      };
    },
    [viewerId]
  );

  const handleWelcomePrimaryAction = useCallback(
    async (item: MarketplaceDisplayFeedItem, primaryKind: MarketplacePrimaryActionKind) => {
      const card = cardById.get(item.id);
      if (!card) return;

      if (primaryKind === "view_profile") {
        router.push(buildNetworkActionPath(card));
        return;
      }

      if (primaryKind === "accept") {
        if (card.isDemo) {
          router.push(buildFeedFocusPath(card));
          return;
        }

        setAcceptTargetCard(card);
        return;
      }

      if (primaryKind === "send_quote") {
        await openWelcomeQuoteThread(card);
      }
    },
    [buildFeedFocusPath, buildNetworkActionPath, cardById, openWelcomeQuoteThread, router]
  );

  const handleWelcomeSecondaryAction = useCallback(
    async (item: MarketplaceDisplayFeedItem, action: MarketplaceSecondaryActionKind) => {
      const card = cardById.get(item.id);
      if (!card) return;

      if (action === "share") {
        await handleShareCard(card);
        return;
      }

      await toggleCardSave(card);
    },
    [cardById, handleShareCard, toggleCardSave]
  );

  const renderWelcomeHeaderAction = useCallback(
    (item: MarketplaceDisplayFeedItem) => {
      const card = cardById.get(item.id);
      if (!card?.statusLabel) return null;

      return (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {card.statusLabel}
        </span>
      );
    },
    [cardById]
  );

  const isWelcomePrimaryBusy = useCallback(
    (item: MarketplaceDisplayFeedItem, primaryKind: MarketplacePrimaryActionKind) => {
      if (primaryKind === "accept") return acceptingCardId === item.id;
      if (primaryKind === "send_quote") return messageCardId === item.id;
      return false;
    },
    [acceptingCardId, messageCardId]
  );

  useEffect(() => {
    const t = window.setInterval(() => {
      setHeroTaglineIndex((i) => (i + 1) % HERO_TAGLINES.length);
    }, 3400);
    return () => window.clearInterval(t);
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
      if (filteredCards.length === 0) {
        return FEED_PAGE_SIZE;
      }

      return Math.min(Math.max(current, FEED_PAGE_SIZE), filteredCards.length);
    });
  }, [filteredCards.length]);

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
          setVisibleFeedCount((current) => Math.min(current + FEED_PAGE_SIZE, filteredCards.length));
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
  }, [filteredCards.length, hasMoreFeedCards, isFeedLoading]);

  return (
    <>
      <div className="min-h-screen bg-[var(--surface-app)] text-slate-900">
        <div className="mx-auto w-full max-w-[1480px] py-2 sm:py-4 space-y-5 sm:space-y-6">
          {!!loadError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {loadError}
            </div>
          )}

          {/* ── Compact startup hero ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* subtle gradient mesh */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(14,165,164,0.12),transparent_55%),radial-gradient(ellipse_at_100%_100%,rgba(14,116,144,0.10),transparent_55%)]" />

            <div className="relative flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3.5">
              {/* left: brand copy */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--brand-700)]">
                    ServiQ
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border border-[var(--brand-500)]/25 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-700)] shadow-sm backdrop-blur-sm ${
                      acceptedConnectionCount > 0 ? "" : "opacity-70"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        acceptedConnectionCount > 0 ? "animate-pulse bg-emerald-500" : "bg-amber-400"
                      }`}
                    />
                    {isFeedLoading
                      ? "Syncing…"
                      : livePostCount > 0
                      ? `${livePostCount} posts live`
                      : acceptedConnectionCount > 0
                      ? `${acceptedConnectionCount} connected`
                      : "Connect to unlock"}
                  </span>
                </div>
                <h2 className="mt-0.5 text-[15px] font-semibold leading-snug text-slate-900 sm:text-base">
                  Local Help Marketplace for Everyday Needs.
                </h2>
                <p className="mt-0.5 text-[11px] leading-5 text-slate-500 sm:text-xs">{appTagline}</p>
                <p className="mt-1 text-[10px] font-medium text-[var(--brand-600)]">
                  {HERO_TAGLINES[heroTaglineIndex]}
                </p>
              </div>

              {/* right: CTA pair */}
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setOpenPostModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[var(--brand-700)] active:scale-[.97]"
                >
                  <Zap size={13} />
                  Post a Need
                </button>
                <button
                  type="button"
                  onClick={() => router.push(isProvider ? `${routes.posts}?category=demand` : routes.people)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)] active:scale-[.97]"
                >
                  <UsersRound size={13} />
                  Earn Nearby
                </button>
              </div>
            </div>
          </motion.div>

          {/* ── Live feed ── */}
          <div data-testid="welcome-live-feed">
              {isFeedLoading && enrichedCards.length === 0 ? (
                <FeedGrid
                  items={[]}
                  loading
                  hasAnyFeed={nearbyCards.length > 0}
                  feedError={loadError || null}
                  focusItemId=""
                  activeItemId={activeFeedCardId}
                  hoveredItemId={hoveredFeedCardId}
                  onActiveItemChange={setActiveFeedCardId}
                  onHoverItemChange={setHoveredFeedCardId}
                  onResetOrRefresh={() => {
                    if (!viewerId) return;
                    void loadConnectedFeed(viewerId, { soft: false });
                  }}
                  onOpenComposer={() => setOpenPostModal(true)}
                  resolveActionModel={resolveWelcomeActionModel}
                  isSavedListing={() => false}
                  isSaveBusy={() => false}
                  isShareBusy={() => false}
                  isPrimaryBusy={() => false}
                  onPrimaryAction={() => {}}
                  onSecondaryAction={() => {}}
                  renderHeaderAction={() => null}
                  viewerId={viewerId}
                  onFeedRefresh={() => { if (viewerId) void loadConnectedFeed(viewerId, { soft: true }); }}
                />
              ) : isSearchActive && filteredCards.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
                  <h4 className="text-base font-semibold text-slate-900">No live cards match your search</h4>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Try a different title, category, location, or owner name. The live feed keeps filtering as you type.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWelcomePromptValue("")}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-900)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
                    >
                      Clear search
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (viewerId) {
                          void loadConnectedFeed(viewerId, { soft: false });
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)]"
                    >
                      <Loader2 size={14} />
                      Refresh
                    </button>
                  </div>
                </div>
              ) : filteredCards.length === 0 ? (
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
                <div className="space-y-3">
                  <FeedGrid
                    items={visibleFeedItems}
                    loading={false}
                    hasAnyFeed={nearbyCards.length > 0}
                    feedError={loadError || null}
                    focusItemId=""
                    activeItemId={activeFeedCardId}
                    hoveredItemId={hoveredFeedCardId}
                    onActiveItemChange={setActiveFeedCardId}
                    onHoverItemChange={setHoveredFeedCardId}
                    onResetOrRefresh={() => {
                      if (!viewerId) return;
                      void loadConnectedFeed(viewerId, { soft: false });
                    }}
                    onOpenComposer={() => setOpenPostModal(true)}
                    resolveActionModel={resolveWelcomeActionModel}
                    isSavedListing={(item) => savedCardIds.includes(item.id)}
                    isSaveBusy={(item) => savingCardIds.includes(item.id)}
                    isShareBusy={(item) => sharingCardIds.includes(item.id)}
                    isPrimaryBusy={isWelcomePrimaryBusy}
                    onPrimaryAction={handleWelcomePrimaryAction}
                    onSecondaryAction={handleWelcomeSecondaryAction}
                    renderHeaderAction={renderWelcomeHeaderAction}
                    viewerId={viewerId}
                    onFeedRefresh={() => { if (viewerId) void loadConnectedFeed(viewerId, { soft: true }); }}
                  />

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
          if (result?.postType === "service" || result?.postType === "product") {
            router.push("/dashboard/profile");
          } else if (result?.helpRequestId) {
            router.push(`/dashboard?focus=${encodeURIComponent(result.helpRequestId)}&source=create_post`);
          } else {
            router.push("/dashboard");
          }
        }}
      />
      <AcceptConfirmDialog
        open={!!acceptTargetCard}
        listing={acceptTargetCard ? toMarketplaceFeedItem(acceptTargetCard) : null}
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
