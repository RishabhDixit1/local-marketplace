"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CommunityFeedResponse } from "@/lib/api/community";
import { appName, appTagline } from "@/lib/branding";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import { isFinalOrderStatus } from "@/lib/orderWorkflow";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";
import {
  blendWelcomeFeedCards,
  buildWelcomeDemoFeedCards,
  buildWelcomeFeedCards,
  type WelcomeFeedCard,
} from "@/lib/welcomeFeed";
import CreatePostModal from "../../components/CreatePostModal";
import {
  Activity,
  ArrowRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Share2,
  ShieldCheck,
  UsersRound,
  Zap,
} from "lucide-react";

type WelcomeStats = {
  nearbyPosts: number;
  activeTasks: number;
  unreadMessages: number;
  trustScore: number;
};

type NearbyCard = WelcomeFeedCard;

type EnrichedNearbyCard = NearbyCard & {
  badge: string;
  pulse: string;
  ownerLabel: string;
  postedAgo: string;
  responseLabel: string;
  proofLabel: string;
  mediaLabel: string;
  mediaCount: number;
  mediaGallery: [string, string, string];
  audienceLabel: string;
  audienceName: string;
  audienceMeta: string;
  networkActionLabel: string;
  networkActionPath: string;
  engagementLabel: string;
  tags: [string, string];
};

type ConversationUnreadRow = {
  conversation_id: string;
  last_read_at: string | null;
};

type MessageUnreadRow = {
  conversation_id: string;
  created_at: string;
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

const MARKETPLACE_HERO_LINES = [
  "Post a Need. Get Local Help. Let Others Earn.",
  "Where Neighbours Help and Earn in Real Time.",
  "Small Tasks. Real People. Instant Help.",
  "Post What You Need. Someone Nearby Will Help.",
  "Local Help Marketplace for Everyday Needs.",
] as const;

export default function WelcomePage() {
  const router = useRouter();
  const storiesScrollRef = useRef<HTMLDivElement | null>(null);
  const storiesDragRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const [openPostModal, setOpenPostModal] = useState(false);
  const [heroLineIndex, setHeroLineIndex] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [feedEmptyReason, setFeedEmptyReason] = useState<"no_connections" | "no_connected_content" | null>(null);
  const [acceptedConnectionCount, setAcceptedConnectionCount] = useState(0);
  const [sharedCardId, setSharedCardId] = useState<string | null>(null);
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);
  const [messageCardId, setMessageCardId] = useState<string | null>(null);
  const [savingCardIds, setSavingCardIds] = useState<string[]>([]);
  const [sharingCardIds, setSharingCardIds] = useState<string[]>([]);
  const [cardMetricsById, setCardMetricsById] = useState<Record<string, CardMetrics>>({});
  const [feedToasts, setFeedToasts] = useState<FeedToast[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isProvider, setIsProvider] = useState(false);
  const [stats, setStats] = useState<WelcomeStats>({
    nearbyPosts: 0,
    activeTasks: 0,
    unreadMessages: 0,
    trustScore: 4.7,
  });
  const [nearbyCards, setNearbyCards] = useState<NearbyCard[]>([]);
  const activeRef = useRef(true);

  const pushFeedToast = (kind: FeedToast["kind"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFeedToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setFeedToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  };

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
        const payload = await fetchAuthedJson<CommunityFeedResponse>(supabase, "/api/community/feed");
        if (!payload.ok) {
          throw new Error(payload.message || "Unable to load connected feed.");
        }

        if (!activeRef.current) {
          return null;
        }

        const nextRole = (payload.currentUserProfile?.role || "").toLowerCase();
        setIsProvider(providerRoles.has(nextRole));

        const buildResult = buildWelcomeFeedCards(payload);
        const nextCards = buildResult.cards.slice(0, 12);
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
        setStats((current) => ({
          ...current,
          nearbyPosts: buildResult.cards.length,
        }));

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

  const demoNearbyCards = useMemo(() => buildWelcomeDemoFeedCards(), []);

  const displayCards = useMemo(
    () =>
      blendWelcomeFeedCards(nearbyCards, {
        minimumCardCount: 6,
        demoCards: demoNearbyCards,
      }),
    [demoNearbyCards, nearbyCards]
  );

  const hasLiveCards = nearbyCards.length > 0;
  const hasDemoCards = displayCards.some((card) => card.isDemo);
  const isDemoOnlyFeed = hasDemoCards && !hasLiveCards;
  const isMixedFeed = hasDemoCards && hasLiveCards;

  const enrichedCards = useMemo<EnrichedNearbyCard[]>(() => {
    const demoMetricsSeed = Object.fromEntries(
      demoNearbyCards.map((card, index) => [
        card.id,
        {
          saves: 12 + index * 3,
          shares: 4 + index * 2,
        },
      ])
    ) as Record<string, CardMetrics>;
    const demandAltMedia = [
      "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=1200&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
      "https://images.unsplash.com/photo-1486946255434-2466348c2166?w=1200&q=80",
      "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=1200&q=80",
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=80",
    ];
    const serviceAltMedia = [
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&q=80",
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&q=80",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80",
      "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80",
    ];
    const productAltMedia = [
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&q=80",
      "https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?w=1200&q=80",
      "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=1200&q=80",
      "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=1200&q=80",
      "https://images.unsplash.com/photo-1503602642458-232111445657?w=1200&q=80",
    ];
    const demandOwners = ["Ananya R.", "Kunal S.", "Priya N.", "Rohit J.", "Megha D."];
    const serviceOwners = ["UrbanFix Crew", "SparkClean Pro", "HandyNest", "QuickCare Team", "FixRight Local"];
    const productOwners = ["ToolKart Local", "FreshStreet Market", "CityMart Seller", "HomePro Supply", "DailyBasket Hub"];
    const audiences = [
      {
        label: "Connections",
        name: "Tower A Circle",
        meta: "18 nearby contacts in this thread",
        actionLabel: "View circle",
        actionPath: routes.people,
      },
      {
        label: "Group",
        name: "Sunrise Residency Group",
        meta: "42 members active right now",
        actionLabel: "Open group",
        actionPath: `${routes.posts}?view=groups`,
      },
      {
        label: "Connections",
        name: "Trusted Providers List",
        meta: "11 known providers are tracking this",
        actionLabel: "View network",
        actionPath: routes.people,
      },
      {
        label: "Group",
        name: "Neighborhood Buy/Sell",
        meta: "37 local buyers online",
        actionLabel: "Open group",
        actionPath: `${routes.posts}?view=groups`,
      },
    ] as const;
    const demandTagPool: [string, string][] = [
      ["Urgent fix", "Apartment cluster"],
      ["Budget confirmed", "Evening slot"],
      ["Needs today", "Near your block"],
    ];
    const serviceTagPool: [string, string][] = [
      ["Verified provider", "Fast response"],
      ["Repeat bookings", "Background checked"],
      ["High rating", "Local team"],
    ];
    const productTagPool: [string, string][] = [
      ["Price negotiable", "Pickup nearby"],
      ["Trusted seller", "Condition verified"],
      ["Same-day pickup", "Repeat buyers"],
    ];

    return displayCards.map((card, index) => {
      const liveMetrics = cardMetricsById[card.id] || demoMetricsSeed[card.id] || { saves: 0, shares: 0 };
      const totalEngagement = liveMetrics.saves + liveMetrics.shares;
      const mediaPool = card.type === "demand" ? demandAltMedia : card.type === "service" ? serviceAltMedia : productAltMedia;
      const ownerPool = card.type === "demand" ? demandOwners : card.type === "service" ? serviceOwners : productOwners;
      const audience = audiences[index % audiences.length];
      const tags =
        card.type === "demand"
          ? demandTagPool[index % demandTagPool.length]
          : card.type === "service"
          ? serviceTagPool[index % serviceTagPool.length]
          : productTagPool[index % productTagPool.length];
      const mediaGallery: [string, string, string] = [
        card.image,
        mediaPool[(index + 1) % mediaPool.length],
        mediaPool[(index + 3) % mediaPool.length],
      ];

      return {
        ...card,
        badge: card.type === "demand" ? "Need" : card.type === "service" ? "Service" : "Product",
        pulse: card.type === "demand" ? "Urgent" : card.type === "service" ? "Trusted" : "Fast deal",
        ownerLabel: card.ownerName || ownerPool[index % ownerPool.length],
        postedAgo: `${2 + index * 3}m ago`,
        responseLabel:
          card.type === "demand"
            ? "Replies in ~4 min"
            : card.type === "service"
            ? "Provider replies in ~6 min"
            : "Seller replies in ~5 min",
        proofLabel:
          card.type === "demand"
            ? `${totalEngagement} live interactions`
            : card.type === "service"
            ? `${liveMetrics.saves} saves by local buyers`
            : `${liveMetrics.shares} shares in nearby groups`,
        mediaLabel: card.type === "demand" ? "Issue photos" : card.type === "service" ? "Before/after media" : "Product gallery",
        mediaCount: 3 + (index % 5),
        mediaGallery,
        audienceLabel: audience.label,
        audienceName: audience.name,
        audienceMeta: audience.meta,
        networkActionLabel: audience.actionLabel,
        networkActionPath: audience.actionPath,
        engagementLabel:
          `${liveMetrics.saves} saves • ${liveMetrics.shares} shares • ${card.momentumLabel}`,
        tags,
      };
    });
  }, [cardMetricsById, demoNearbyCards, displayCards]);

  const storyBaseItems = useMemo(() => {
    if (!enrichedCards.length) return [];

    const targetCount = 10;
    return Array.from({ length: targetCount }, (_, index) => enrichedCards[index % enrichedCards.length]);
  }, [enrichedCards]);

  const storyItems = useMemo(() => storyBaseItems, [storyBaseItems]);

  const formatStoryPriceLine = (story: EnrichedNearbyCard) => {
    if (story.type === "demand") {
      return /^budget/i.test(story.priceLabel) ? story.priceLabel : `Budget ${story.priceLabel}`;
    }
    return /^price/i.test(story.priceLabel) ? story.priceLabel : `Price ${story.priceLabel}`;
  };

  const scrollStories = (direction: "left" | "right") => {
    const container = storiesScrollRef.current;
    if (!container) return;

    const delta = Math.round(container.clientWidth * 0.55);
    container.scrollBy({
      left: direction === "left" ? -delta : delta,
      behavior: "smooth",
    });
  };

  const handleStoriesWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!storiesScrollRef.current) return;

    if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      event.preventDefault();
      storiesScrollRef.current.scrollBy({
        left: event.deltaY,
      });
    }
  };

  const handleStoriesPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = storiesScrollRef.current;
    if (!container) return;

    storiesDragRef.current.isDragging = true;
    storiesDragRef.current.startX = event.clientX;
    storiesDragRef.current.startScrollLeft = container.scrollLeft;
    container.setPointerCapture(event.pointerId);
  };

  const handleStoriesPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = storiesScrollRef.current;
    if (!container || !storiesDragRef.current.isDragging) return;

    const dragDelta = event.clientX - storiesDragRef.current.startX;
    container.scrollLeft = storiesDragRef.current.startScrollLeft - dragDelta;
  };

  const handleStoriesPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = storiesScrollRef.current;
    if (!container) return;

    storiesDragRef.current.isDragging = false;
    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  };

  const markCardShared = (cardId: string) => {
    setSharedCardId(cardId);
    window.setTimeout(() => {
      setSharedCardId((current) => (current === cardId ? null : current));
    }, 2200);
  };

  const persistCardSave = async (card: EnrichedNearbyCard, shouldSave: boolean): Promise<boolean> => {
    if (!viewerId) {
      return false;
    }

    if (shouldSave) {
      const { error } = await supabase.from("feed_card_saves").upsert(
        {
          user_id: viewerId,
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
            mediaGallery: card.mediaGallery,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,card_id" }
      );

      if (error) {
        console.warn("Failed to save feed card:", error.message);
        return false;
      }

      return true;
    }

    const { error } = await supabase
      .from("feed_card_saves")
      .delete()
      .eq("user_id", viewerId)
      .eq("card_id", card.id);

    if (error) {
      console.warn("Failed to remove saved feed card:", error.message);
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

      const persisted = await persistCardSave(card, shouldSave);
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
    if (card.networkActionPath.startsWith(routes.people)) {
      return appendCardContextQuery(card.networkActionPath, card, {
        intent: "connections",
        tab: "Nearby",
        q: card.audienceName,
        provider: card.ownerId || undefined,
      });
    }

    return appendCardContextQuery(card.networkActionPath, card, {
      view: "groups",
      group: card.audienceName,
      focus: card.focusId,
      type: card.type,
      category: card.type,
      q: card.audienceName,
    });
  };

  const buildMessagePath = (card: EnrichedNearbyCard, conversationId?: string) =>
    appendCardContextQuery(routes.chat, card, {
      open: conversationId,
      focus: card.focusId,
      type: card.type,
    });

  const handleMessageCard = async (card: EnrichedNearbyCard) => {
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

  const handleShareCard = async (card: EnrichedNearbyCard) => {
    const focusPath = buildFeedFocusPath(card);
    const shareUrl = `${window.location.origin}${focusPath}`;
    const shareText = `${card.title} • ${card.priceLabel} • ${card.etaLabel} • ${card.audienceName}`;
    setSharingCardIds((current) => (current.includes(card.id) ? current : [...current, card.id]));

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${card.badge}: ${card.title}`,
          text: shareText,
          url: shareUrl,
        });
        markCardShared(card.id);
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
      markCardShared(card.id);
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

  const demandCards = useMemo(
    () => nearbyCards.filter((card) => card.type === "demand"),
    [nearbyCards]
  );

  const aboutCards = useMemo(
    () => [
      {
        title: "Realtime Matching Engine",
        desc: "Every post is routed by urgency, category, and local radius so nearby providers can respond fast.",
        metric: `${demandCards.length} live needs`,
        icon: Zap,
      },
      {
        title: "Trust Layer Built In",
        desc: "Profiles, reviews, and fulfillment history help customers choose reliable local providers quickly.",
        metric: `${stats.trustScore.toFixed(1)} trust index`,
        icon: ShieldCheck,
      },
      {
        title: "Conversation to Completion",
        desc: "From first message to final delivery, chat and task updates stay in one execution thread.",
        metric: `${stats.unreadMessages + 12} active threads`,
        icon: MessageCircle,
      },
      {
        title: "Neighborhood Supply Grid",
        desc: "Services and products from nearby sellers reduce wait time and increase successful local outcomes.",
        metric: `${stats.activeTasks} tasks in motion`,
        icon: Activity,
      },
    ],
    [demandCards.length, stats.activeTasks, stats.trustScore, stats.unreadMessages]
  );

  const liveStatusLabel = isFeedLoading
    ? "Syncing feed"
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

        const [
          communityResult,
          { data: myOrders },
          { data: myConversations },
          { data: reviewsData },
          { data: savedCardRows, error: savedCardError },
        ] =
          await Promise.all([
            loadConnectedFeed(currentUser.id),
            supabase
              .from("orders")
              .select("status")
              .or(`consumer_id.eq.${currentUser.id},provider_id.eq.${currentUser.id}`),
            supabase
              .from("conversation_participants")
              .select("conversation_id,last_read_at")
              .eq("user_id", currentUser.id),
            supabase.from("reviews").select("rating").eq("provider_id", currentUser.id),
            supabase.from("feed_card_saves").select("card_id").eq("user_id", currentUser.id),
          ]);

        if (savedCardError) {
          console.warn("Failed to load saved feed cards:", savedCardError.message);
        } else if (isActive) {
          const nextSavedIds = ((savedCardRows as FeedCardSaveRow[] | null) || []).map((row) => row.card_id);
          setSavedCardIds(nextSavedIds);
        }

        const activeTasks =
          myOrders?.filter((order) => !isFinalOrderStatus(order.status)).length || 0;

        const conversationRows = (myConversations as ConversationUnreadRow[] | null) || [];
        const conversationIds = conversationRows.map((row) => row.conversation_id);
        const lastReadAtByConversation = new Map(conversationRows.map((row) => [row.conversation_id, row.last_read_at]));
        let unreadMessages = 0;

        if (conversationIds.length > 0) {
          const { data: unreadMessageRows } = await supabase
            .from("messages")
            .select("conversation_id,created_at")
            .in("conversation_id", conversationIds)
            .neq("sender_id", currentUser.id)
            .order("created_at", { ascending: false })
            .limit(2000);

          unreadMessages = ((unreadMessageRows as MessageUnreadRow[] | null) || []).reduce((count, message) => {
            const lastReadAt = lastReadAtByConversation.get(message.conversation_id) || null;
            if (!lastReadAt) return count + 1;
            return message.created_at > lastReadAt ? count + 1 : count;
          }, 0);
        }

        let trustScore = 4.7;
        if (reviewsData && reviewsData.length > 0) {
          const avg = reviewsData.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewsData.length;
          trustScore = Number(avg.toFixed(1));
        }

        setStats({
          nearbyPosts: communityResult?.cards.length || 0,
          activeTasks,
          unreadMessages,
          trustScore,
        });
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
            setSavedCardIds((current) => current.filter((id) => id !== changedCardId));
          } else {
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

          <div className="grid min-w-0 grid-cols-1 gap-4">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isDemoOnlyFeed
                      ? "bg-amber-50 text-amber-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isDemoOnlyFeed ? "bg-amber-500" : "bg-emerald-500 animate-pulse"
                    }`}
                  />
                  Live Stories
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(routes.posts)}
                    className="text-xs font-medium text-[var(--brand-700)] hover:text-[var(--brand-900)]"
                  >
                    Open feed
                  </button>
                  <button
                    onClick={() => scrollStories("left")}
                    aria-label="Scroll stories left"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)]"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => scrollStories("right")}
                    aria-label="Scroll stories right"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)]"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {hasDemoCards && (
                <div
                  className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
                    isMixedFeed
                      ? "border-[color:var(--brand-300)] bg-cyan-50 text-[var(--brand-700)]"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {isMixedFeed
                    ? `${nearbyCards.length} live cards are shown first. Preview stories stay in rotation so the Welcome rail and feed remain visually full while more real local posts arrive.`
                    : feedEmptyReason === "no_connections"
                    ? "Preview stories are active for visualization while you build your first connections. Accepted connections and their local posts will replace these cards automatically."
                    : "Connected users are live, but they have not published yet. Preview stories are filling the rail until real local posts arrive."}
                </div>
              )}

              <div className="mt-4">
                <div
                  ref={storiesScrollRef}
                  onWheel={handleStoriesWheel}
                  onPointerDown={handleStoriesPointerDown}
                  onPointerMove={handleStoriesPointerMove}
                  onPointerUp={handleStoriesPointerUp}
                  onPointerCancel={handleStoriesPointerUp}
                  className="w-full max-w-full cursor-grab active:cursor-grabbing select-none overflow-x-auto overflow-y-hidden pb-1 overscroll-x-contain touch-pan-x [scrollbar-width:thin]"
                >
                  {isFeedLoading && storyItems.length === 0 ? (
                    <div className="flex w-max gap-3 sm:gap-3.5">
                      {[0, 1, 2, 3].map((index) => (
                        <div
                          key={`story-skeleton-${index}`}
                          className="h-[168px] w-[170px] shrink-0 animate-pulse rounded-xl border border-slate-200 bg-white p-2.5 sm:w-[186px]"
                        >
                          <div className="h-20 rounded-lg bg-slate-200" />
                          <div className="mt-3 h-3 w-4/5 rounded bg-slate-200" />
                          <div className="mt-2 h-3 w-3/5 rounded bg-slate-200" />
                          <div className="mt-2 h-3 w-2/5 rounded bg-slate-200" />
                        </div>
                      ))}
                    </div>
                  ) : storyItems.length > 0 ? (
                    <div className="flex w-max gap-3 sm:gap-3.5">
                      {storyItems.map((story, storyIndex) => {
                        const focusPath = buildFeedFocusPath(story);

                        return (
                          <article key={`story-${story.id}-${storyIndex}`} className="w-[170px] shrink-0 sm:w-[186px]">
                            <button
                              onClick={() => router.push(focusPath)}
                              className="group w-full rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-[color:var(--brand-500)]"
                            >
                              <div className="relative">
                                <div className="relative h-20 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                  <Image src={story.image} alt={story.title} fill sizes="180px" className="object-cover" />
                                </div>
                                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500 animate-pulse" />
                                <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                  {story.badge}
                                </span>
                                {story.isDemo && (
                                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800">
                                    Preview
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 line-clamp-1 text-[11px] text-slate-600">{story.subtitle}</p>
                              <p className="mt-1 line-clamp-1 text-[12px] font-semibold text-slate-900">
                                {formatStoryPriceLine(story)}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">Radius {story.distanceKm} km</p>
                              <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-emerald-700">
                                Availability: {story.etaLabel}
                              </p>
                              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-700)] group-hover:text-[var(--brand-900)]">
                                <ArrowRight size={10} />
                              </span>
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                      {feedEmptyReason === "no_connections"
                        ? "Accept a connection request in People to unlock connected local stories here."
                        : "Your connections are active, but no one has shared local posts yet."}
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Live Local Feed</h3>
                      <p className="text-xs text-slate-500">Realtime list, scroll vertically for more.</p>
                    </div>
                    <button
                      onClick={() => router.push(routes.posts)}
                      className="text-xs font-medium text-[var(--brand-700)] hover:text-[var(--brand-900)]"
                    >
                      Explore all
                    </button>
                  </div>

                  <div data-testid="welcome-live-feed" className="mt-3 min-h-[280px] max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                    {isFeedLoading && enrichedCards.length === 0 ? (
                      <>
                        {[0, 1, 2].map((index) => (
                          <div key={`welcome-feed-skeleton-${index}`} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="h-3 w-20 rounded bg-slate-200" />
                            <div className="mt-3 h-5 w-3/5 rounded bg-slate-200" />
                            <div className="mt-2 h-4 w-full rounded bg-slate-200" />
                            <div className="mt-2 h-4 w-4/5 rounded bg-slate-200" />
                            <div className="mt-4 h-32 rounded-xl bg-slate-200" />
                          </div>
                        ))}
                      </>
                    ) : enrichedCards.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                        <h4 className="text-base font-semibold text-slate-900">
                          {feedEmptyReason === "no_connections"
                            ? "Connect with someone to unlock your local live feed"
                            : "Your connections have not posted yet"}
                        </h4>
                        <p className="mt-2 text-sm text-slate-600">
                          {feedEmptyReason === "no_connections"
                            ? "Use the People tab to send or accept a connection request. Accepted connections will start appearing here automatically."
                            : "As soon as a connected user posts a need, service, or product, it will appear here without a manual refresh."}
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
                            Post a Need
                          </button>
                        </div>
                      </div>
                    ) : (
                      enrichedCards.map((card, cardIndex) => {
                        const focusPath = buildFeedFocusPath(card);
                        const networkPath = buildNetworkActionPath(card);
                        const isSaved = savedCardIds.includes(card.id);
                        const messageInFlight = messageCardId === card.id;
                        const saveInFlight = savingCardIds.includes(card.id);
                        const shareInFlight = sharingCardIds.includes(card.id);

                        return (
                          <article
                            key={`feed-inline-${card.id}`}
                            data-testid="welcome-feed-card"
                            data-card-id={card.id}
                            className="post-card-enter rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4"
                            style={{ "--enter-delay": `${Math.min(cardIndex * 55, 360)}ms` } as CSSProperties}
                          >
                            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
                              <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                      card.type === "demand"
                                        ? "bg-rose-100 text-rose-700"
                                        : card.type === "service"
                                        ? "bg-cyan-100 text-[var(--brand-700)]"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {card.type}
                                  </span>
                                  {card.isDemo && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                                      Preview
                                    </span>
                                  )}
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{card.audienceLabel}</span>
                                  <span className="text-[11px] text-slate-500">{card.postedAgo}</span>
                                  <span className="text-[11px] text-slate-500">{card.distanceKm} km</span>
                                </div>

                                <h3 className="mt-2 text-[16px] font-semibold text-slate-900">{card.title}</h3>
                                <p className="mt-1 text-xs text-slate-600">{card.subtitle}</p>

                                <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-semibold text-[var(--brand-700)]">
                                    {card.ownerLabel.slice(0, 2).toUpperCase()}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="line-clamp-1 text-[12px] font-semibold text-slate-800">{card.ownerLabel}</p>
                                    <p className="line-clamp-1 text-[11px] text-slate-500">{card.audienceName}</p>
                                  </div>
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{card.priceLabel}</span>
                                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{card.etaLabel}</span>
                                  <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-[var(--brand-700)]">{card.momentumLabel}</span>
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                  {card.tags.map((tag) => (
                                    <span key={`${card.id}-${tag}`} className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => router.push(focusPath)}
                                    aria-label={`${card.actionLabel} post ${card.title}`}
                                    title={`${card.actionLabel} this post`}
                                    data-testid="feed-action-primary"
                                    className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-900)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--brand-700)]"
                                  >
                                    {card.actionLabel}
                                    <ArrowRight size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleMessageCard(card)}
                                    disabled={messageInFlight || !!card.isDemo}
                                    aria-label={card.isDemo ? `${card.title} preview only` : `Message about ${card.title}`}
                                    title={card.isDemo ? "Preview cards do not open real chats" : "Open contextual chat"}
                                    data-testid="feed-action-message"
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-65"
                                  >
                                    <MessageCircle size={12} />
                                    {card.isDemo ? "Preview only" : messageInFlight ? "Opening..." : "Message"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => router.push(networkPath)}
                                    aria-label={`${card.networkActionLabel} for ${card.title}`}
                                    title="Open connection or group context"
                                    data-testid="feed-action-network"
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)]"
                                  >
                                    <UsersRound size={12} />
                                    {card.networkActionLabel}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleShareCard(card)}
                                    disabled={shareInFlight}
                                    aria-label={`Share ${card.title}`}
                                    title="Share post"
                                    data-testid="feed-action-share"
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-65"
                                  >
                                    <Share2 size={12} />
                                    {shareInFlight ? "Sharing..." : sharedCardId === card.id ? "Shared" : "Share"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void toggleCardSave(card)}
                                    disabled={saveInFlight}
                                    aria-label={`${isSaved ? "Unsave" : "Save"} ${card.title}`}
                                    title={isSaved ? "Remove from saved" : "Save post"}
                                    data-testid="feed-action-save"
                                    className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${
                                      isSaved && !saveInFlight
                                        ? "border-[color:var(--brand-300)] bg-cyan-50 text-[var(--brand-700)]"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-[color:var(--brand-500)] hover:text-[var(--brand-700)]"
                                    }`}
                                  >
                                    <Bookmark size={12} />
                                    {saveInFlight ? "Saving..." : isSaved ? "Saved" : "Save"}
                                  </button>
                                </div>

                                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                  <span>{card.audienceMeta}</span>
                                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                                  <span>{card.engagementLabel}</span>
                                </div>
                              </div>

                              <aside className="rounded-xl border border-slate-200 bg-linear-to-br from-slate-50 to-cyan-50/70 p-2.5">
                                <div data-testid="feed-card-main-image" className="relative h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-40">
                                  <Image src={card.mediaGallery[0]} alt={`${card.title} main visual`} fill sizes="330px" className="object-cover" />
                                  <span className="absolute left-2 top-2 rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    {card.ownerLabel}
                                  </span>
                                  <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                    +{card.mediaCount} photos
                                  </span>
                                  <span className="absolute left-2 bottom-2 rounded-full bg-[var(--brand-900)]/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                                    {card.pulse}
                                  </span>
                                </div>

                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {card.mediaGallery.slice(1).map((mediaItem, mediaIndex) => (
                                    <div key={`${card.id}-media-${mediaIndex}`} className="relative h-20 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                                      <Image
                                        src={mediaItem}
                                        alt={`${card.title} gallery ${mediaIndex + 2}`}
                                        fill
                                        sizes="150px"
                                        className="object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-2 grid gap-2 text-[11px]">
                                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                                    <p className="text-slate-500">{card.mediaLabel}</p>
                                    <p className="line-clamp-1 font-semibold text-slate-800">{card.proofLabel}</p>
                                  </div>
                                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                                    <p className="text-slate-500">{card.signalLabel}</p>
                                    <p className="line-clamp-1 font-semibold text-slate-800">{card.responseLabel}</p>
                                  </div>
                                </div>
                              </aside>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </section>

          </div>

          <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-2xl border border-cyan-100 bg-linear-to-br from-cyan-50 via-white to-slate-50 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-700)]">About {appName}</p>
                <h2 className="mt-2 text-lg sm:text-xl font-semibold text-slate-900">
                  {appTagline}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  We help people post local needs quickly, match with nearby providers, and close tasks with trust, speed, and clarity.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-700">
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Post</span>
                  <ArrowRight size={12} className="text-slate-400" />
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Match</span>
                  <ArrowRight size={12} className="text-slate-400" />
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Chat</span>
                  <ArrowRight size={12} className="text-slate-400" />
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Complete</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {aboutCards.map((card, index) => (
                  <article
                    key={`about-card-${index}`}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="rounded-lg bg-cyan-100 p-2">
                        <card.icon className="text-[var(--brand-700)]" size={16} />
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {card.metric}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{card.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{card.desc}</p>
                  </article>
                ))}
              </div>
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
            router.push(`/dashboard?help_request=${encodeURIComponent(result.helpRequestId)}`);
            return;
          }
          router.push("/dashboard");
        }}
      />
    </>
  );
}
