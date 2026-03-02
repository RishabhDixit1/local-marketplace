"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isFinalOrderStatus } from "@/lib/orderWorkflow";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";
import CreatePostModal from "../../components/CreatePostModal";
import {
  Activity,
  ArrowRight,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Share2,
  ShieldCheck,
  Star,
  Users,
  UsersRound,
  Zap,
} from "lucide-react";

type WelcomeStats = {
  nearbyPosts: number;
  activeTasks: number;
  unreadMessages: number;
  trustScore: number;
};

type UserProfile = {
  name: string | null;
  role: string | null;
  location: string | null;
  bio: string | null;
  services: string[] | null;
  availability: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
};

type NearbyCard = {
  id: string;
  focusId: string;
  type: "demand" | "service" | "product";
  ownerId?: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  distanceKm: number;
  etaLabel: string;
  signalLabel: string;
  momentumLabel: string;
  image: string;
  actionLabel: string;
  actionPath: string;
};

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

type RawPost = {
  id: string;
  text: string | null;
};

type RawService = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  provider_id: string | null;
};

type RawProduct = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  provider_id: string | null;
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
  tasks: "/dashboard/tasks",
  chat: "/dashboard/chat",
  addService: "/dashboard/provider/add-service",
} as const;

const providerRoles = new Set(["provider", "seller", "service_provider", "business"]);

type HeroTone = "rose" | "sky" | "emerald";

type HeroScene = {
  label: string;
  title: string;
  meta: string;
  eta: string;
  tone: HeroTone;
};

const defaultHeroScenes: HeroScene[] = [
  {
    label: "Urgent Need",
    title: "Electrical fault in 2.1 km radius",
    meta: "4 providers matched in 38s",
    eta: "ETA 12m",
    tone: "rose",
  },
  {
    label: "Service Match",
    title: "Deep cleaning request now covered",
    meta: "Top match score 93",
    eta: "ETA 45m",
    tone: "sky",
  },
  {
    label: "Fast Commerce",
    title: "Nearby product order accepted",
    meta: "Chat reply in 27s",
    eta: "ETA 22m",
    tone: "emerald",
  },
];

const heroToneBadgeClasses: Record<HeroTone, string> = {
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-700",
  emerald: "bg-emerald-100 text-emerald-700",
};

const heroToneDotClasses: Record<HeroTone, string> = {
  rose: "bg-rose-300",
  sky: "bg-sky-300",
  emerald: "bg-emerald-300",
};

const heroToneGlowClasses: Record<HeroTone, string> = {
  rose: "bg-rose-300/35",
  sky: "bg-sky-300/35",
  emerald: "bg-emerald-300/35",
};

const heroToneRingClasses: Record<HeroTone, string> = {
  rose: "border-rose-200/85",
  sky: "border-sky-200/85",
  emerald: "border-emerald-200/85",
};

const heroToneTrackClasses: Record<HeroTone, string> = {
  rose: "from-rose-300/90 to-orange-200/70",
  sky: "from-sky-300/90 to-cyan-200/70",
  emerald: "from-emerald-300/90 to-lime-200/70",
};

const heroToneStrokeColors: Record<HeroTone, string> = {
  rose: "rgba(251, 113, 133, 0.9)",
  sky: "rgba(56, 189, 248, 0.9)",
  emerald: "rgba(52, 211, 153, 0.9)",
};

const heroFlowPaths = [
  { id: "flow-need-hub", d: "M16 72 Q31 57 46 52", delay: 0 },
  { id: "flow-hub-provider", d: "M46 52 Q62 36 79 30", delay: 0.25 },
  { id: "flow-hub-fulfill", d: "M46 52 Q64 67 82 74", delay: 0.5 },
  { id: "flow-provider-fulfill", d: "M79 30 Q84 50 82 74", delay: 0.75 },
] as const;

const heroNetworkNodes = [
  { id: "need", label: "Need", x: "16%", y: "72%", tone: "rose" as HeroTone },
  { id: "hub", label: "Marketplace", x: "46%", y: "52%", tone: "sky" as HeroTone },
  { id: "provider", label: "Provider", x: "79%", y: "30%", tone: "emerald" as HeroTone },
  { id: "fulfill", label: "Fulfillment", x: "82%", y: "74%", tone: "sky" as HeroTone },
] as const;

const heroDataStreams: Array<{
  id: string;
  left: string[];
  top: string[];
  duration: number;
  delay: number;
}> = [
  {
    id: "stream-1",
    left: ["16%", "31%", "46%", "62%", "79%"],
    top: ["72%", "58%", "52%", "40%", "30%"],
    duration: 3.2,
    delay: 0.2,
  },
  {
    id: "stream-2",
    left: ["82%", "64%", "46%", "31%", "16%"],
    top: ["74%", "67%", "52%", "57%", "72%"],
    duration: 3.6,
    delay: 1,
  },
  {
    id: "stream-3",
    left: ["46%", "64%", "82%"],
    top: ["52%", "66%", "74%"],
    duration: 2.9,
    delay: 0.7,
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const storiesScrollRef = useRef<HTMLDivElement | null>(null);
  const storiesDragRef = useRef({
    isDragging: false,
    startX: 0,
    startScrollLeft: 0,
  });

  const [openPostModal, setOpenPostModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeHeroScene, setActiveHeroScene] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [sharedCardId, setSharedCardId] = useState<string | null>(null);
  const [savedCardIds, setSavedCardIds] = useState<string[]>([]);
  const [messageCardId, setMessageCardId] = useState<string | null>(null);
  const [savingCardIds, setSavingCardIds] = useState<string[]>([]);
  const [sharingCardIds, setSharingCardIds] = useState<string[]>([]);
  const [cardMetricsById, setCardMetricsById] = useState<Record<string, CardMetrics>>({});
  const [feedToasts, setFeedToasts] = useState<FeedToast[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Neighbor");
  const [isProvider, setIsProvider] = useState(false);
  const [stats, setStats] = useState<WelcomeStats>({
    nearbyPosts: 0,
    activeTasks: 0,
    unreadMessages: 0,
    trustScore: 4.7,
  });
  const [nearbyCards, setNearbyCards] = useState<NearbyCard[]>([]);

  const pushFeedToast = (kind: FeedToast["kind"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFeedToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setFeedToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  };

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

  const fetchFeedCardMetrics = async (
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
  };

  const enrichedCards = useMemo<EnrichedNearbyCard[]>(() => {
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

    return nearbyCards.map((card, index) => {
      const liveMetrics = cardMetricsById[card.id] || { saves: 0, shares: 0 };
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
        ownerLabel: ownerPool[index % ownerPool.length],
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
  }, [cardMetricsById, nearbyCards]);

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
      const { data: myRows, error: myRowsError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", viewerId);

      if (myRowsError) {
        console.warn("Failed to load existing conversations for contextual message:", myRowsError.message);
      }

      const myConversationIds = ((myRows as Array<{ conversation_id: string }> | null) || []).map(
        (row) => row.conversation_id
      );
      let targetConversationId: string | null = null;

      if (myConversationIds.length > 0) {
        const { data: existingConversation, error: existingConversationError } = await supabase
          .from("conversation_participants")
          .select("conversation_id")
          .in("conversation_id", myConversationIds)
          .eq("user_id", recipientId)
          .limit(1)
          .maybeSingle();

        if (existingConversationError) {
          console.warn("Failed to find matching conversation for contextual message:", existingConversationError.message);
        } else {
          targetConversationId = existingConversation?.conversation_id || null;
        }
      }

      if (!targetConversationId) {
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .insert({ created_by: viewerId })
          .select("id")
          .single();

        if (conversationError || !conversation) {
          console.warn(
            "Failed to create conversation for contextual message:",
            conversationError?.message || "unknown error"
          );
        } else {
          targetConversationId = conversation.id;
          const { error: participantsError } = await supabase.from("conversation_participants").upsert(
            [
              { conversation_id: targetConversationId, user_id: viewerId },
              { conversation_id: targetConversationId, user_id: recipientId },
            ],
            {
              onConflict: "conversation_id,user_id",
              ignoreDuplicates: true,
            }
          );

          if (participantsError) {
            console.warn("Failed to attach conversation participants for contextual message:", participantsError.message);
          }
        }
      }

      if (targetConversationId) {
        targetPath = buildMessagePath(card, targetConversationId);
      }
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

  const heroScenes = useMemo<HeroScene[]>(() => {
    const topDemand = demandCards[0];
    const topService = nearbyCards.find((card) => card.type === "service");
    const topProduct = nearbyCards.find((card) => card.type === "product");

    return [
      {
        label: "Active Needs",
        title: topDemand?.title || defaultHeroScenes[0].title,
        meta: `${demandCards.length} demand posts are live nearby`,
        eta: stats.unreadMessages > 0 ? `${stats.unreadMessages} unread` : "ETA 12m",
        tone: "rose",
      },
      {
        label: "Service Supply",
        title: topService?.title || defaultHeroScenes[1].title,
        meta: `${stats.activeTasks} active tasks currently in progress`,
        eta: stats.activeTasks > 0 ? "Live now" : "ETA 45m",
        tone: "sky",
      },
      {
        label: "Trust Pulse",
        title: topProduct?.title || defaultHeroScenes[2].title,
        meta: `Local trust score ${stats.trustScore.toFixed(1)}`,
        eta: "ETA 22m",
        tone: "emerald",
      },
    ];
  }, [demandCards, nearbyCards, stats.activeTasks, stats.trustScore, stats.unreadMessages]);

  const heroQuickActions = useMemo(
    () =>
      isProvider
        ? [
            {
              title: "Respond to Needs",
              icon: Zap,
              action: () => router.push(`${routes.posts}?category=demand`),
            },
            {
              title: "Add Service",
              icon: ClipboardList,
              action: () => router.push(routes.addService),
            },
            {
              title: "Open Chat",
              icon: MessageCircle,
              action: () => router.push(routes.chat),
            },
            {
              title: "View Tasks",
              icon: Activity,
              action: () => router.push(routes.tasks),
            },
          ]
        : [
            {
              title: "Create Post",
              icon: Zap,
              action: () => setOpenPostModal(true),
            },
            {
              title: "Find People",
              icon: Users,
              action: () => router.push(routes.people),
            },
            {
              title: "Open Chat",
              icon: MessageCircle,
              action: () => router.push(routes.chat),
            },
            {
              title: "Browse Feed",
              icon: ArrowRight,
              action: () => router.push(routes.posts),
            },
          ],
    [isProvider, router]
  );

  const marketSignals = useMemo(
    () => [
      {
        label: "Open Needs",
        value: demandCards.length,
        icon: Activity,
      },
      {
        label: "Active Tasks",
        value: stats.activeTasks,
        icon: ClipboardList,
      },
      {
        label: "Unread",
        value: stats.unreadMessages,
        icon: MessageCircle,
      },
      {
        label: "Avg Trust",
        value: stats.trustScore.toFixed(1),
        icon: Star,
      },
    ],
    [demandCards.length, stats.activeTasks, stats.unreadMessages, stats.trustScore]
  );

  const currentHeroScene = heroScenes[activeHeroScene];

  useEffect(() => {
    const heroSceneTimer = window.setInterval(() => {
      setActiveHeroScene((prev) => (prev + 1) % heroScenes.length);
    }, 3200);

    return () => window.clearInterval(heroSceneTimer);
  }, [heroScenes.length]);

  useEffect(() => {
    let isActive = true;

    const loadWelcome = async () => {
      setLoading(true);
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
          }
          return;
        }

        setViewerId(currentUser.id);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("name, role, location, bio, services, availability, email, phone, website")
          .eq("id", currentUser.id)
          .maybeSingle<UserProfile>();

        const role = (profileData?.role || "").toLowerCase();
        const isProviderRole = providerRoles.has(role);

        setUserName(profileData?.name || currentUser.email?.split("@")[0] || "Neighbor");
        setIsProvider(isProviderRole);

        const [
          { count: nearbyPostsCount },
          { data: myOrders },
          { data: myConversations },
          { data: reviewsData },
          { data: savedCardRows, error: savedCardError },
        ] =
          await Promise.all([
            supabase.from("posts").select("*", { count: "exact", head: true }).eq("status", "open"),
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
          nearbyPosts: nearbyPostsCount || 0,
          activeTasks,
          unreadMessages,
          trustScore,
        });

        const [{ data: recentPosts }, { data: recentServices }, { data: recentProducts }] = await Promise.all([
          supabase.from("posts").select("id, text").eq("status", "open").limit(5),
          supabase.from("service_listings").select("id, title, category, price, provider_id").limit(5),
          supabase.from("product_catalog").select("id, title, category, price, provider_id").limit(5),
        ]);

      const demandImages = [
        "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80",
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
      ];
      const serviceImages = [
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80",
        "https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=1200&q=80",
      ];
      const productImages = [
        "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1200&q=80",
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&q=80",
      ];
      const demandSignals = ["High urgency", "Budget confirmed", "Frequent requester"];
      const serviceSignals = ["Verified provider", "4.9 avg rating", "Fast response"];
      const productSignals = ["Trusted seller", "Pickup in 30m", "Local warranty"];

      const mappedPosts: NearbyCard[] =
        (recentPosts as RawPost[] | null)?.map((post, index) => ({
          id: `post-${post.id}`,
          focusId: post.id,
          type: "demand",
          title: post.text || "New local need",
          subtitle: index % 2 === 0 ? "Shared in your connections feed" : "Posted in Residency Help group",
          priceLabel: "Budget shared in chat",
          distanceKm: Number((0.8 + index * 0.9).toFixed(1)),
          etaLabel: index === 0 ? "Starts in 15m" : `Starts in ${20 + index * 5}m`,
          signalLabel: demandSignals[index % demandSignals.length],
          momentumLabel: `${6 + index * 2} responders watching`,
          image: demandImages[index % demandImages.length],
          actionLabel: "Respond",
          actionPath: routes.posts,
        })) || [];

      const mappedServices: NearbyCard[] =
        (recentServices as RawService[] | null)?.map((service, index) => ({
          id: `service-${service.id}`,
          focusId: service.id,
          type: "service",
          ownerId: service.provider_id || undefined,
          title: service.title || "Local service",
          subtitle: service.category ? `${service.category} • shared in Services group` : "Provider offering in your circles",
          priceLabel: service.price ? `From ₹${service.price}` : "Price on request",
          distanceKm: Number((1.2 + index * 0.8).toFixed(1)),
          etaLabel: index === 0 ? "Available now" : `Available in ${15 + index * 10}m`,
          signalLabel: serviceSignals[index % serviceSignals.length],
          momentumLabel: `${3 + index} bookings in progress`,
          image: serviceImages[index % serviceImages.length],
          actionLabel: "Book",
          actionPath: routes.posts,
        })) || [];

      const mappedProducts: NearbyCard[] =
        (recentProducts as RawProduct[] | null)?.map((product, index) => ({
          id: `product-${product.id}`,
          focusId: product.id,
          type: "product",
          ownerId: product.provider_id || undefined,
          title: product.title || "Local product",
          subtitle: product.category ? `${product.category} • posted in Buy/Sell group` : "Nearby seller from your network",
          priceLabel: product.price ? `₹${product.price}` : "Price on request",
          distanceKm: Number((1.4 + index * 0.8).toFixed(1)),
          etaLabel: index === 0 ? "Same-day pickup" : `Pickup in ${30 + index * 15}m`,
          signalLabel: productSignals[index % productSignals.length],
          momentumLabel: `${4 + index} chats opened today`,
          image: productImages[index % productImages.length],
          actionLabel: "View",
          actionPath: routes.posts,
        })) || [];

      const allCards = [...mappedPosts, ...mappedServices, ...mappedProducts].slice(0, 12);
      const fallbackCards: NearbyCard[] = [
        {
          id: "demo-demand-electrician",
          focusId: "demo-demand-electrician",
          type: "demand",
          title: "Need urgent electrician nearby",
          subtitle: "Power issue in 2BHK apartment • shared in Tower A group",
          priceLabel: "Budget ₹1200",
          distanceKm: 1.1,
          etaLabel: "Starts in 20m",
          signalLabel: "High urgency",
          momentumLabel: "11 responders watching",
          image: demandImages[0],
          actionLabel: "Respond",
          actionPath: routes.posts,
        },
        {
          id: "demo-service-cleaning",
          focusId: "demo-service-cleaning",
          type: "service",
          ownerId: "demo-provider-cleaning",
          title: "Home deep cleaning by verified provider",
          subtitle: "Cleaning service • recommended by your connections",
          priceLabel: "From ₹399",
          distanceKm: 1.9,
          etaLabel: "Available now",
          signalLabel: "Verified provider",
          momentumLabel: "4 bookings in progress",
          image: serviceImages[0],
          actionLabel: "Book",
          actionPath: routes.posts,
        },
        {
          id: "demo-product-tools",
          focusId: "demo-product-tools",
          type: "product",
          ownerId: "demo-provider-tools",
          title: "Local seller: power tools kit",
          subtitle: "Tools and hardware • listed in Neighborhood Buy/Sell",
          priceLabel: "₹1499",
          distanceKm: 2.6,
          etaLabel: "Same-day pickup",
          signalLabel: "Trusted seller",
          momentumLabel: "7 chats opened today",
          image: productImages[0],
          actionLabel: "View",
          actionPath: routes.posts,
        },
        {
          id: "demo-demand-plumber",
          focusId: "demo-demand-plumber",
          type: "demand",
          title: "Plumber needed for kitchen leakage",
          subtitle: "Immediate fix requested • shared in Building Support group",
          priceLabel: "Budget ₹850",
          distanceKm: 2.1,
          etaLabel: "Starts in 35m",
          signalLabel: "Budget confirmed",
          momentumLabel: "8 responders watching",
          image: demandImages[1],
          actionLabel: "Respond",
          actionPath: routes.posts,
        },
        {
          id: "demo-service-ac",
          focusId: "demo-service-ac",
          type: "service",
          ownerId: "demo-provider-ac",
          title: "AC servicing with same-day slot",
          subtitle: "Appliance maintenance • from trusted providers network",
          priceLabel: "From ₹699",
          distanceKm: 3.0,
          etaLabel: "Available in 40m",
          signalLabel: "4.9 avg rating",
          momentumLabel: "6 bookings in progress",
          image: serviceImages[1],
          actionLabel: "Book",
          actionPath: routes.posts,
        },
        {
          id: "demo-product-bike",
          focusId: "demo-product-bikewash",
          type: "product",
          ownerId: "demo-provider-bike",
          title: "Bike wash kit + polish combo",
          subtitle: "Automotive essentials • shared in weekend riders group",
          priceLabel: "₹799",
          distanceKm: 1.7,
          etaLabel: "Pickup in 45m",
          signalLabel: "Local warranty",
          momentumLabel: "5 chats opened today",
          image: productImages[1],
          actionLabel: "View",
          actionPath: routes.posts,
        },
        {
          id: "demo-demand-tutor",
          focusId: "demo-demand-tutor",
          type: "demand",
          title: "Math tutor for class 10 board prep",
          subtitle: "Weekend evening batches • posted in parents network",
          priceLabel: "Budget ₹500/session",
          distanceKm: 2.4,
          etaLabel: "Starts in 60m",
          signalLabel: "Frequent requester",
          momentumLabel: "9 responders watching",
          image: demandImages[0],
          actionLabel: "Respond",
          actionPath: routes.posts,
        },
        {
          id: "demo-service-photo",
          focusId: "demo-service-photographer",
          type: "service",
          ownerId: "demo-provider-photo",
          title: "Event photographer for small gatherings",
          subtitle: "Creative services • suggested in creators circle",
          priceLabel: "From ₹2499",
          distanceKm: 3.3,
          etaLabel: "Available in 2h",
          signalLabel: "Fast response",
          momentumLabel: "3 bookings in progress",
          image: serviceImages[0],
          actionLabel: "Book",
          actionPath: routes.posts,
        },
        {
          id: "demo-product-organic",
          focusId: "demo-product-organic",
          type: "product",
          ownerId: "demo-provider-organic",
          title: "Organic groceries starter basket",
          subtitle: "Fresh farm produce • listed in weekly grocery group",
          priceLabel: "₹1299",
          distanceKm: 1.3,
          etaLabel: "Pickup in 30m",
          signalLabel: "Trusted seller",
          momentumLabel: "10 chats opened today",
          image: productImages[0],
          actionLabel: "View",
          actionPath: routes.posts,
        },
        {
          id: "demo-demand-paint",
          focusId: "demo-demand-paint",
          type: "demand",
          title: "Need painter for bedroom wall touch-up",
          subtitle: "Two-hour job • shared in Flat Owners group",
          priceLabel: "Budget ₹1400",
          distanceKm: 1.6,
          etaLabel: "Starts in 50m",
          signalLabel: "Budget confirmed",
          momentumLabel: "6 responders watching",
          image: demandImages[1],
          actionLabel: "Respond",
          actionPath: routes.posts,
        },
        {
          id: "demo-service-laptop",
          focusId: "demo-service-laptop",
          type: "service",
          ownerId: "demo-provider-laptop",
          title: "On-site laptop diagnostics and cleanup",
          subtitle: "Tech support • active in office professionals group",
          priceLabel: "From ₹799",
          distanceKm: 2.2,
          etaLabel: "Available in 55m",
          signalLabel: "Fast response",
          momentumLabel: "5 bookings in progress",
          image: serviceImages[1],
          actionLabel: "Book",
          actionPath: routes.posts,
        },
        {
          id: "demo-product-desk",
          focusId: "demo-product-desk",
          type: "product",
          ownerId: "demo-provider-desk",
          title: "Study desk with storage, almost new",
          subtitle: "Home furniture • posted in moving sale group",
          priceLabel: "₹3200",
          distanceKm: 2.8,
          etaLabel: "Pickup in 90m",
          signalLabel: "Trusted seller",
          momentumLabel: "12 chats opened today",
          image: productImages[1],
          actionLabel: "View",
          actionPath: routes.posts,
        },
      ];

      const nextCards = allCards.length ? allCards : fallbackCards;
      setNearbyCards(nextCards);

      const nextMetrics = await fetchFeedCardMetrics(
        nextCards.map((card) => card.id),
        currentUser.id
      );

      if (isActive) {
        setCardMetricsById(nextMetrics);
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
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadWelcome();

    return () => {
      isActive = false;
    };
  }, []);

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
  }, [nearbyCards, viewerId]);

  return (
    <>
      <div className="min-h-screen bg-linear-to-b from-slate-100 via-indigo-50 to-slate-100 text-slate-900">
        <div className="w-full max-w-550 mx-auto py-2 sm:py-4 space-y-5 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl p-5 sm:p-7 bg-linear-to-br from-sky-600 via-indigo-600 to-fuchsia-600 shadow-xl"
          >
            <div className="pointer-events-none absolute inset-0">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.3), transparent 45%), radial-gradient(circle at 85% 90%, rgba(255,255,255,0.18), transparent 42%)",
                }}
              />
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
                }}
              />
              <motion.div
                className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-cyan-300/35 blur-3xl"
                animate={{ x: [0, 28, 0], y: [0, -18, 0], opacity: [0.35, 0.7, 0.35] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute right-0 top-0 h-36 w-36 rounded-full bg-fuchsia-300/30 blur-3xl"
                animate={{ x: [0, -20, 0], y: [0, 16, 0], opacity: [0.3, 0.55, 0.3] }}
                transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <div className="relative grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Welcome back, {loading ? "..." : userName} 👋
                </h1>
                <p className="text-white/90 mt-2 max-w-2xl text-sm sm:text-base">
                  Take action fast: post needs, connect nearby, and move local tasks to completion.
                </p>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`hero-inline-${currentHeroScene.title}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.28 }}
                    className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 backdrop-blur"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${heroToneDotClasses[currentHeroScene.tone]} animate-pulse`}
                    />
                    <span className="text-[10px] uppercase tracking-[0.14em] text-white/70">Live routing</span>
                    <span className="truncate text-xs font-medium text-white">{currentHeroScene.title}</span>
                  </motion.div>
                </AnimatePresence>

                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {heroQuickActions.map((item) => (
                    <button
                      key={item.title}
                      onClick={item.action}
                      className="rounded-xl border border-white/35 bg-white/15 px-3.5 py-3 text-left text-white backdrop-blur transition-colors hover:bg-white/25"
                    >
                      <item.icon size={15} className="mb-2 text-cyan-100" />
                      <p className="text-sm font-semibold">{item.title}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {marketSignals.map((signal) => (
                    <div key={signal.label} className="rounded-xl bg-white/15 backdrop-blur px-3 py-2">
                      <div className="flex items-center gap-1.5 text-white/85 text-xs">
                        <signal.icon size={13} />
                        {signal.label}
                      </div>
                      <p className="mt-1 text-lg font-semibold text-white">{signal.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/35 bg-slate-950/30 p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/85">
                    Live Marketplace Canvas
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-200 animate-pulse" />
                    Realtime
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {heroScenes.map((scene, index) => (
                    <div key={`scene-progress-${scene.title}`} className="h-1.5 overflow-hidden rounded-full bg-white/20">
                      <motion.div
                        key={`scene-progress-fill-${scene.title}-${index === activeHeroScene}`}
                        className={`h-full rounded-full bg-linear-to-r ${heroToneTrackClasses[scene.tone]}`}
                        initial={{ width: "0%" }}
                        animate={{ width: index === activeHeroScene ? "100%" : "0%" }}
                        transition={{
                          duration: index === activeHeroScene ? 3.1 : 0.2,
                          ease: "linear",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="relative mt-2 overflow-hidden rounded-xl border border-white/20 bg-slate-950/65 p-3">
                  <div className="pointer-events-none absolute inset-0">
                    <div
                      className="absolute inset-0 opacity-25"
                      style={{
                        backgroundImage:
                          "linear-gradient(to right, rgba(148,163,184,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.28) 1px, transparent 1px)",
                        backgroundSize: "26px 26px",
                      }}
                    />
                    <motion.div
                      className={`absolute -left-14 top-2 h-32 w-32 rounded-full blur-3xl ${heroToneGlowClasses[currentHeroScene.tone]}`}
                      animate={{ x: [0, 18, 0], y: [0, -10, 0], opacity: [0.35, 0.65, 0.35] }}
                      transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.div
                      className="absolute inset-x-0 top-0 h-20 bg-linear-to-b from-white/15 to-transparent"
                      animate={{ opacity: [0.2, 0.45, 0.2] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>

                  <div className="relative h-40">
                    <div className="absolute left-1.5 top-1.5 rounded-md border border-white/20 bg-slate-900/65 px-2 py-1 text-[10px] text-white/80">
                      Radius 2.5 km
                    </div>
                    <div className="absolute right-1.5 top-1.5 rounded-md border border-white/20 bg-slate-900/65 px-2 py-1 text-[10px] text-white/80">
                      Match pulse {currentHeroScene.eta}
                    </div>

                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {heroFlowPaths.map((path) => (
                        <motion.path
                          key={path.id}
                          d={path.d}
                          fill="none"
                          stroke="rgba(148, 163, 184, 0.62)"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                          strokeDasharray="3.2 5.2"
                          animate={{ strokeDashoffset: [0, -36], opacity: [0.3, 0.75, 0.3] }}
                          transition={{
                            duration: 4.5,
                            repeat: Infinity,
                            ease: "linear",
                            delay: path.delay,
                          }}
                        />
                      ))}
                    </svg>

                    {heroDataStreams.map((stream) => (
                      <motion.span
                        key={stream.id}
                        className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${heroToneDotClasses[currentHeroScene.tone]}`}
                        style={{
                          left: stream.left[0],
                          top: stream.top[0],
                          boxShadow: `0 0 18px ${heroToneStrokeColors[currentHeroScene.tone]}`,
                        }}
                        animate={{
                          left: stream.left,
                          top: stream.top,
                          opacity: [0, 1, 1, 1, 0],
                          scale: [0.75, 1, 1, 0.95, 0.75],
                        }}
                        transition={{
                          duration: stream.duration,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: stream.delay,
                        }}
                      />
                    ))}

                    {heroNetworkNodes.map((node, index) => (
                      <div
                        key={node.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
                        style={{ left: node.x, top: node.y }}
                      >
                        <div className="relative mx-auto h-3.5 w-3.5">
                          <span className={`absolute inset-0 rounded-full ${heroToneDotClasses[node.tone]}`} />
                          <motion.span
                            className={`absolute inset-0 rounded-full border ${heroToneRingClasses[node.tone]}`}
                            animate={{ scale: [1, 2.5], opacity: [0.75, 0] }}
                            transition={{
                              duration: 2.4,
                              repeat: Infinity,
                              ease: "easeOut",
                              delay: index * 0.3,
                            }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] font-semibold text-white/90">{node.label}</p>
                      </div>
                    ))}

                    <div className="absolute bottom-0 left-0 right-0">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`hero-scene-${currentHeroScene.title}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.28 }}
                          className="rounded-lg border border-white/20 bg-slate-900/72 px-3 py-2 backdrop-blur"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${heroToneBadgeClasses[currentHeroScene.tone]}`}>
                              {currentHeroScene.label}
                            </span>
                            <span className="text-[10px] text-white/75">{currentHeroScene.eta}</span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-white">{currentHeroScene.title}</p>
                          <p className="text-[11px] text-white/80">{currentHeroScene.meta}</p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/85">
                  <div className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5">
                    <p className="text-white/70">Live Requests</p>
                    <p className="font-semibold">{stats.nearbyPosts}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5">
                    <p className="text-white/70">Active Threads</p>
                    <p className="font-semibold">{stats.unreadMessages + 12}</p>
                  </div>
                  <div className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5">
                    <p className="text-white/70">Trust Index</p>
                    <p className="font-semibold">{stats.trustScore.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {!!loadError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {loadError}
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-4">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Stories
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push(routes.posts)}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    Open feed
                  </button>
                  <button
                    onClick={() => scrollStories("left")}
                    aria-label="Scroll stories left"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    onClick={() => scrollStories("right")}
                    aria-label="Scroll stories right"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

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
                  <div className="flex w-max gap-3 sm:gap-3.5">
                    {storyItems.map((story, storyIndex) => {
                      const focusPath = buildFeedFocusPath(story);

                      return (
                        <article key={`story-${story.id}-${storyIndex}`} className="w-[170px] sm:w-[186px] shrink-0">
                          <button
                            onClick={() => router.push(focusPath)}
                            className="group w-full rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-indigo-300"
                          >
                            <div className="relative">
                              <div className="relative h-20 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                <Image src={story.image} alt={story.title} fill sizes="180px" className="object-cover" />
                              </div>
                              <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500 animate-pulse" />
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                                {story.badge}
                              </span>
                            </div>

                            <p className="mt-2 text-[11px] text-slate-600 line-clamp-1">{story.subtitle}</p>
                            <p className="mt-1 text-[12px] font-semibold text-slate-900 line-clamp-1">
                              {formatStoryPriceLine(story)}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">Radius {story.distanceKm} km</p>
                            <p className="mt-0.5 text-[11px] text-emerald-700 font-medium line-clamp-1">
                              Availability: {story.etaLabel}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 group-hover:text-indigo-500">
                              <ArrowRight size={10} />
                            </span>
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Live Local Feed</h3>
                      <p className="text-xs text-slate-500">Realtime list, scroll vertically for more.</p>
                    </div>
                    <button
                      onClick={() => router.push(routes.posts)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Explore all
                    </button>
                  </div>

                  <div data-testid="welcome-live-feed" className="mt-3 space-y-3 min-h-[280px] max-h-[56vh] overflow-y-auto pr-1">
                    {enrichedCards.map((card) => {
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
                          className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4"
                        >
                          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                    card.type === "demand"
                                      ? "bg-rose-100 text-rose-700"
                                      : card.type === "service"
                                      ? "bg-indigo-100 text-indigo-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {card.type}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{card.audienceLabel}</span>
                                <span className="text-[11px] text-slate-500">{card.postedAgo}</span>
                                <span className="text-[11px] text-slate-500">{card.distanceKm} km</span>
                              </div>

                              <p className="mt-2 text-[16px] font-semibold text-slate-900">{card.title}</p>
                              <p className="mt-1 text-xs text-slate-600">{card.subtitle}</p>

                              <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                                  {card.ownerLabel.slice(0, 2).toUpperCase()}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-[12px] font-semibold text-slate-800 line-clamp-1">{card.ownerLabel}</p>
                                  <p className="text-[11px] text-slate-500 line-clamp-1">{card.audienceName}</p>
                                </div>
                              </div>

                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{card.priceLabel}</span>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{card.etaLabel}</span>
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700">{card.momentumLabel}</span>
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
                                  className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
                                >
                                  {card.actionLabel}
                                  <ArrowRight size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleMessageCard(card)}
                                  disabled={messageInFlight}
                                  aria-label={`Message about ${card.title}`}
                                  title="Open contextual chat"
                                  data-testid="feed-action-message"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-65"
                                >
                                  <MessageCircle size={12} />
                                  {messageInFlight ? "Opening..." : "Message"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => router.push(networkPath)}
                                  aria-label={`${card.networkActionLabel} for ${card.title}`}
                                  title="Open connection or group context"
                                  data-testid="feed-action-network"
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600"
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
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-65"
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
                                      ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                      : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-600"
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

                            <aside className="rounded-xl border border-slate-200 bg-linear-to-br from-slate-50 to-indigo-50/60 p-2.5">
                              <div data-testid="feed-card-main-image" className="relative h-36 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-40">
                                <Image src={card.mediaGallery[0]} alt={`${card.title} main visual`} fill sizes="330px" className="object-cover" />
                                <span className="absolute left-2 top-2 rounded-full bg-slate-900/75 px-2 py-0.5 text-[10px] font-semibold text-white">
                                  {card.ownerLabel}
                                </span>
                                <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                  +{card.mediaCount} photos
                                </span>
                                <span className="absolute left-2 bottom-2 rounded-full bg-indigo-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
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
                                  <p className="font-semibold text-slate-800 line-clamp-1">{card.proofLabel}</p>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="text-slate-500">{card.signalLabel}</p>
                                  <p className="font-semibold text-slate-800 line-clamp-1">{card.responseLabel}</p>
                                </div>
                              </div>
                            </aside>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

          </div>

          <section className="rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 sm:p-5 shadow-sm">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-2xl border border-indigo-100 bg-linear-to-br from-indigo-50 via-white to-cyan-50 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-600">About Local Marketplace</p>
                <h2 className="mt-2 text-lg sm:text-xl font-semibold text-slate-900">
                  A realtime neighborhood network for needs, services, and products.
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
                      <div className="rounded-lg bg-indigo-100 p-2">
                        <card.icon className="text-indigo-600" size={16} />
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
                : "border-indigo-200 bg-indigo-50/95 text-indigo-800"
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
