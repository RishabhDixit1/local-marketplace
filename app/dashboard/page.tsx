"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import ProviderPopup from "@/app/components/ProviderPopup";
import type { PublishPostResult } from "@/app/components/CreatePostModal";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
} from "@/lib/business";
import {
  defaultMarketCoordinates,
  distanceBetweenCoordinatesKm,
  getBrowserCoordinates,
  resolveCoordinates,
  type Coordinates,
} from "@/lib/geo";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";

const MarketplaceMap = dynamic(
() => import("@/app/components/MarketplaceMap").then((mod) => mod.default),
{ ssr: false }
);

const ProviderTrustPanel = dynamic(
  () => import("@/app/components/ProviderTrustPanel").then((mod) => mod.default),
  { ssr: false }
);

const CreatePostModal = dynamic(
  () => import("@/app/components/CreatePostModal").then((mod) => mod.default),
  { ssr: false }
);

import {
Search,
MapPin,
MessageCircle,
Filter,
TrendingUp,
Sparkles,
Users,
Activity,
SlidersHorizontal,
ShieldCheck,
Zap,
ImageIcon,
RotateCcw,
RefreshCw,
ChevronUp,
ChevronDown,
Bookmark,
BookmarkCheck,
Rows3,
LayoutGrid,
Flame,
Radar,
BellRing,
EyeOff,
ExternalLink,
CircleDot,
} from "lucide-react";

const FEED_LIMIT_PER_TYPE = 24;
const MAX_PROFILE_LOOKUP = 120;
const MARKETPLACE_FILTERS_STORAGE_KEY = "local-marketplace-dashboard-feed-filters-v1";
const MARKETPLACE_LAYOUT_STORAGE_KEY = "local-marketplace-dashboard-feed-layout-v1";
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const GEO_LOOKUP_TIMEOUT_MS = 1200;
const QUICK_SEARCH_CHIPS = ["Cleaning", "Repair", "Delivery", "Food", "Electrician"] as const;

/* ================= TYPES ================= */

type Listing = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  type: "service" | "product" | "demand";
  avatar: string;
  distance: number;
  lat: number;
  lng: number;
  urgent?: boolean;
  media?: FeedMedia[];
  createdAt?: string;
  creatorName?: string;
  businessSlug?: string;
  rankScore: number;
  profileCompletion: number;
  responseMinutes: number;
  verificationStatus: "verified" | "pending" | "unclaimed";
  isDemo?: boolean;
};

type FeedMedia = {
  mimeType: string;
  url: string;
};

type ServiceRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  created_at?: string;
};

type ProductRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  created_at?: string;
};

type PostRow = {
  id: string;
  text?: string;
  content?: string;
  description?: string;
  title?: string;
  user_id?: string;
  provider_id?: string;
  created_by?: string;
  created_at?: string;
};

type ProfileRow = {
  id: string;
  name?: string;
  avatar_url?: string;
  role?: string | null;
  bio?: string | null;
  location?: string | null;
  availability?: string | null;
  services?: string[] | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ReviewRow = {
  provider_id: string;
  rating: number | null;
};

type FlexibleRow = Record<string, unknown>;

type HelpRequestRow = {
  id: string;
  title: string;
  matched_count: number | null;
  status: string | null;
};

type HelpRequestMatchRow = {
  provider_id: string;
  score: number | null;
  distance_km: number | null;
  reason: string | null;
  status: string | null;
};

type HelpMatchCard = {
  providerId: string;
  name: string;
  avatar: string;
  role: string;
  score: number;
  distanceKm: number | null;
  reason: string;
  status: string;
};

type FeedLayout = "cards" | "thread";
type RealtimeHealth = "connecting" | "connected" | "reconnecting" | "error" | "idle";

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const stringFromRow = (row: FlexibleRow, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return fallback;
};

const numberFromRow = (row: FlexibleRow, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const buildDemoFeed = (): Listing[] => {
  const baseLat = 28.6139;
  const baseLng = 77.209;

  const rows: Array<Omit<Listing, "id" | "lat" | "lng" | "rankScore">> = [
    {
      title: "Need Plumber ASAP",
      description: "Bathroom pipe leaking. Need help within 2 hours.",
      price: 2500,
      category: "Need",
      provider_id: "demo-provider-amit",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=amit",
      distance: 2.0,
      urgent: true,
      creatorName: "Amit P",
      businessSlug: createBusinessSlug("Amit P", "demo-provider-amit"),
      profileCompletion: 78,
      responseMinutes: 8,
      verificationStatus: "pending",
      isDemo: true,
    },
    {
      title: "Electrician for Home",
      description: "Expert electrician for switchboard, fan, and wiring repair.",
      price: 500,
      category: "Electrician",
      provider_id: "demo-provider-mary",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=mary",
      distance: 3.8,
      creatorName: "Mary Electricals",
      businessSlug: createBusinessSlug("Mary Electricals", "demo-provider-mary"),
      profileCompletion: 91,
      responseMinutes: 14,
      verificationStatus: "verified",
      isDemo: true,
    },
    {
      title: "House Cleaning Pro",
      description: "Deep cleaning for 1BHK/2BHK with eco-safe supplies.",
      price: 1200,
      category: "Cleaning",
      provider_id: "demo-provider-sejal",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=sejal",
      distance: 4.5,
      creatorName: "Sejal HomeCare",
      businessSlug: createBusinessSlug("Sejal HomeCare", "demo-provider-sejal"),
      profileCompletion: 86,
      responseMinutes: 18,
      verificationStatus: "verified",
      isDemo: true,
    },
    {
      title: "Fresh Baked Cakes",
      description: "Custom cakes with same-day delivery in your locality.",
      price: 600,
      category: "Food",
      provider_id: "demo-provider-cakes",
      type: "product",
      avatar: "https://i.pravatar.cc/150?u=cakeshop",
      distance: 5.5,
      creatorName: "Delicious Cakes",
      businessSlug: createBusinessSlug("Delicious Cakes", "demo-provider-cakes"),
      profileCompletion: 82,
      responseMinutes: 24,
      verificationStatus: "pending",
      isDemo: true,
    },
    {
      title: "Urgent AC Repair Needed",
      description: "Split AC not cooling. Need technician by tonight.",
      price: 1800,
      category: "Need",
      provider_id: "demo-provider-rakesh",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=rakesh",
      distance: 1.7,
      urgent: true,
      creatorName: "Rakesh B",
      businessSlug: createBusinessSlug("Rakesh B", "demo-provider-rakesh"),
      profileCompletion: 69,
      responseMinutes: 6,
      verificationStatus: "unclaimed",
      isDemo: true,
    },
    {
      title: "Same-day Grocery Delivery",
      description: "Daily essentials delivered in 45-90 minutes.",
      price: 199,
      category: "Delivery",
      provider_id: "demo-provider-quickdrop",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=quickdrop",
      distance: 2.9,
      creatorName: "QuickDrop",
      businessSlug: createBusinessSlug("QuickDrop", "demo-provider-quickdrop"),
      profileCompletion: 74,
      responseMinutes: 12,
      verificationStatus: "pending",
      isDemo: true,
    },
  ];

  return rows.map((row, index) => ({
    ...row,
    id: `demo-${index + 1}`,
    lat: baseLat + index * 0.01,
    lng: baseLng + index * 0.012,
    rankScore: calculateLocalRankScore({
      distanceKm: row.distance,
      responseMinutes: row.responseMinutes,
      rating: row.verificationStatus === "verified" ? 4.8 : 4.4,
      profileCompletion: row.profileCompletion,
    }),
  }));
};

const mediaRegex = /\[([^\]]+)\]\s(https?:\/\/[^\s,]+)/g;

const parsePostText = (rawText: string) => {
  const fallback = {
    title: rawText,
    description: rawText,
    budget: 0,
    category: "Need",
    location: "",
    media: [] as FeedMedia[],
  };

  if (!rawText.includes(" | ")) return fallback;

  const parts = rawText.split(" | ");
  if (parts.length < 2) return fallback;

  const title = parts[0]?.trim() || fallback.title;
  const description = parts[1]?.trim() || fallback.description;

  const budgetPart = parts.find((item) => item.startsWith("Budget:"));
  const categoryPart = parts.find((item) => item.startsWith("Category:"));
  const locationPart = parts.find((item) => item.startsWith("Location:"));
  const mediaPart = parts.find((item) => item.startsWith("Media:"));

  const budgetMatch = budgetPart?.match(/(\d+(\.\d+)?)/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : 0;
  const category = categoryPart?.replace("Category:", "").trim() || fallback.category;
  const location = locationPart?.replace("Location:", "").trim() || fallback.location;

  const media: FeedMedia[] = [];
  if (mediaPart && !mediaPart.includes("None")) {
    const payload = mediaPart.replace("Media:", "").trim();
    for (const match of payload.matchAll(mediaRegex)) {
      media.push({
        mimeType: match[1].trim(),
        url: match[2].trim(),
      });
    }
  }

  return { title, description, budget, category, location, media };
};

const parseDateMs = (value?: string) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const isFreshListing = (value?: string) => {
  const createdAtMs = parseDateMs(value);
  if (!createdAtMs) return false;
  return Date.now() - createdAtMs <= FRESH_WINDOW_MS;
};

const formatRelativeAge = (value?: string) => {
  const createdAtMs = parseDateMs(value);
  if (!createdAtMs) return "Recently posted";

  const diffMs = Math.max(0, Date.now() - createdAtMs);
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatSyncTime = (iso?: string) => {
  if (!iso) return "--";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "--";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const getListingSignals = (item: Listing) => {
  const signals: string[] = [];
  if (item.urgent) signals.push("Urgent demand");
  if (item.distance <= 3) signals.push(`${item.distance} km nearby`);
  if (item.responseMinutes <= 15) signals.push(`Responds in ~${item.responseMinutes}m`);
  if (item.verificationStatus === "verified") signals.push("Verified business");
  if ((item.media?.length || 0) > 0) signals.push("Media attached");
  if (item.rankScore >= 85) signals.push(`High match ${item.rankScore}`);
  return signals.slice(0, 3);
};

const mapRealtimeHealth = (status: string): RealtimeHealth => {
  if (status === "SUBSCRIBED") return "connected";
  if (status === "TIMED_OUT") return "reconnecting";
  if (status === "CHANNEL_ERROR") return "error";
  if (status === "CLOSED") return "idle";
  return "connecting";
};

const REALTIME_HEALTH_STYLES: Record<
  RealtimeHealth,
  {
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  connected: {
    label: "Live",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    dotClassName: "bg-emerald-500",
  },
  connecting: {
    label: "Connecting",
    className: "border-amber-300 bg-amber-50 text-amber-700",
    dotClassName: "bg-amber-500",
  },
  reconnecting: {
    label: "Reconnecting",
    className: "border-orange-300 bg-orange-50 text-orange-700",
    dotClassName: "bg-orange-500",
  },
  error: {
    label: "Error",
    className: "border-rose-300 bg-rose-50 text-rose-700",
    dotClassName: "bg-rose-500",
  },
  idle: {
    label: "Idle",
    className: "border-slate-300 bg-slate-100 text-slate-600",
    dotClassName: "bg-slate-400",
  },
};

/* ================= PAGE ================= */

export default function MarketplacePage() {
  const router = useRouter();
  const demoFeed = useMemo(() => buildDemoFeed(), []);
  const [feed, setFeed] = useState<Listing[]>(demoFeed);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState("");
  const [feedError, setFeedError] = useState("");
  const [usingDemoFeed, setUsingDemoFeed] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [viewerCoordinates, setViewerCoordinates] = useState<Coordinates | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"best" | "distance" | "price" | "latest">("best");
  const [feedLayout, setFeedLayout] = useState<FeedLayout>("cards");
  const [showTrendingOnly, setShowTrendingOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [freshOnly, setFreshOnly] = useState(false);
  const [savedListingIds, setSavedListingIds] = useState<Set<string>>(new Set());
  const [hiddenListingIds, setHiddenListingIds] = useState<Set<string>>(new Set());
  const [listingVotes, setListingVotes] = useState<Record<string, number>>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [messageLoadingId, setMessageLoadingId] = useState<string | null>(null);
  const [feedChannelHealth, setFeedChannelHealth] = useState<RealtimeHealth>("connecting");
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [lastLiveEventAt, setLastLiveEventAt] = useState("");
  const [lastLiveEventSource, setLastLiveEventSource] = useState("market");
  const [openPostModal, setOpenPostModal] = useState(false);
  const [activeHelpRequestId, setActiveHelpRequestId] = useState<string | null>(null);
  const [activeHelpRequestTitle, setActiveHelpRequestTitle] = useState("");
  const [helpMatches, setHelpMatches] = useState<HelpMatchCard[]>([]);
  const [helpMatchesLoading, setHelpMatchesLoading] = useState(false);
  const [helpMatchesSyncing, setHelpMatchesSyncing] = useState(false);
  const [helpMatchesError, setHelpMatchesError] = useState("");
  const [helpRequestMatchedCount, setHelpRequestMatchedCount] = useState<number>(0);
  const [focusTarget, setFocusTarget] = useState<{
    id: string;
    type: string;
  } | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const reloadTimerRef = useRef<number | null>(null);
  const helpMatchesReloadTimerRef = useRef<number | null>(null);
  const fetchInFlightRef = useRef(false);

  const setHelpRequestQueryParam = useCallback((helpRequestId: string | null) => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (helpRequestId) {
      params.set("help_request", helpRequestId);
    } else {
      params.delete("help_request");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(MARKETPLACE_FILTERS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        category?: string;
        sortBy?: "best" | "distance" | "price" | "latest";
        showTrendingOnly?: boolean;
        maxDistanceKm?: number;
        verifiedOnly?: boolean;
        urgentOnly?: boolean;
        mediaOnly?: boolean;
        freshOnly?: boolean;
        showAdvancedFilters?: boolean;
      };

      if (typeof parsed.category === "string") setCategory(parsed.category);
      if (parsed.sortBy && ["best", "distance", "price", "latest"].includes(parsed.sortBy)) {
        setSortBy(parsed.sortBy);
      }
      if (typeof parsed.showTrendingOnly === "boolean") setShowTrendingOnly(parsed.showTrendingOnly);
      if (Number.isFinite(parsed.maxDistanceKm)) setMaxDistanceKm(Number(parsed.maxDistanceKm));
      if (typeof parsed.verifiedOnly === "boolean") setVerifiedOnly(parsed.verifiedOnly);
      if (typeof parsed.urgentOnly === "boolean") setUrgentOnly(parsed.urgentOnly);
      if (typeof parsed.mediaOnly === "boolean") setMediaOnly(parsed.mediaOnly);
      if (typeof parsed.freshOnly === "boolean") setFreshOnly(parsed.freshOnly);
      if (typeof parsed.showAdvancedFilters === "boolean") setShowAdvancedFilters(parsed.showAdvancedFilters);
    } catch {
      window.localStorage.removeItem(MARKETPLACE_FILTERS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLayout = window.localStorage.getItem(MARKETPLACE_LAYOUT_STORAGE_KEY);
    if (storedLayout === "cards" || storedLayout === "thread") {
      setFeedLayout(storedLayout);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      category,
      sortBy,
      showTrendingOnly,
      maxDistanceKm,
      verifiedOnly,
      urgentOnly,
      mediaOnly,
      freshOnly,
      showAdvancedFilters,
    };
    window.localStorage.setItem(MARKETPLACE_FILTERS_STORAGE_KEY, JSON.stringify(payload));
  }, [
    category,
    freshOnly,
    maxDistanceKm,
    mediaOnly,
    showAdvancedFilters,
    showTrendingOnly,
    sortBy,
    urgentOnly,
    verifiedOnly,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MARKETPLACE_LAYOUT_STORAGE_KEY, feedLayout);
  }, [feedLayout]);

  const loadHelpRequestMatches = useCallback(
    async (helpRequestId: string, soft = false) => {
      if (!helpRequestId) return;

      if (soft) {
        setHelpMatchesSyncing(true);
      } else {
        setHelpMatchesLoading(true);
      }

      const { data: helpRequest, error: helpRequestError } = await supabase
        .from("help_requests")
        .select("id,title,matched_count,status")
        .eq("id", helpRequestId)
        .maybeSingle();

      if (helpRequestError || !helpRequest) {
        if (!soft) {
          setHelpMatches([]);
        }
        setHelpMatchesError(
          helpRequestError
            ? helpRequestError.message
            : "Could not find this help request."
        );
        setHelpMatchesLoading(false);
        setHelpMatchesSyncing(false);
        return;
      }

      setActiveHelpRequestTitle(
        ((helpRequest as HelpRequestRow).title || "Help request").trim()
      );
      setHelpRequestMatchedCount(Number((helpRequest as HelpRequestRow).matched_count || 0));

      const { data: matches, error: matchesError } = await supabase
        .from("help_request_matches")
        .select("provider_id,score,distance_km,reason,status")
        .eq("help_request_id", helpRequestId)
        .order("score", { ascending: false })
        .limit(8);

      if (matchesError) {
        if (!soft) {
          setHelpMatches([]);
        }
        setHelpMatchesError(matchesError.message);
        setHelpMatchesLoading(false);
        setHelpMatchesSyncing(false);
        return;
      }

      const matchRows = ((matches as HelpRequestMatchRow[] | null) || []).filter((row) => !!row.provider_id);
      const providerIds = Array.from(new Set(matchRows.map((row) => row.provider_id)));
      let profileMap = new Map<string, { name: string; avatar_url: string; role: string }>();

      if (providerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,name,avatar_url,role")
          .in("id", providerIds);

        profileMap = new Map(
          (((profiles as FlexibleRow[] | null) || []).map((row) => [
            String(row.id || ""),
            {
              name: String(row.name || "Provider"),
              avatar_url: String(row.avatar_url || `https://i.pravatar.cc/150?u=${row.id || "provider"}`),
              role: String(row.role || "Service Provider"),
            },
          ]))
        );
      }

      const mappedMatches: HelpMatchCard[] = matchRows.map((row) => {
        const profile = profileMap.get(row.provider_id);
        return {
          providerId: row.provider_id,
          name: profile?.name || "Provider",
          avatar: profile?.avatar_url || `https://i.pravatar.cc/150?u=${row.provider_id}`,
          role: profile?.role || "Service Provider",
          score: Number(row.score || 0),
          distanceKm: Number.isFinite(Number(row.distance_km)) ? Number(row.distance_km) : null,
          reason: row.reason || "Good match for your request",
          status: row.status || "suggested",
        };
      });

      setHelpMatches(mappedMatches);
      setHelpMatchesError("");
      setHelpMatchesLoading(false);
      setHelpMatchesSyncing(false);
    },
    []
  );

  /* ================= FETCH ================= */
  const fetchFeed = useCallback(async (soft = false) => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    if (soft) {
      setSyncing(true);
    } else {
      setIsFeedLoading(true);
    }
    setFeedError("");

    try {
      const browserCoordinatesPromise = getBrowserCoordinates(GEO_LOOKUP_TIMEOUT_MS);

      const selectRowsWithFallback = async (table: string, primarySelect: string): Promise<FlexibleRow[]> => {
        const primaryResult = await supabase
          .from(table)
          .select(primarySelect)
          .limit(FEED_LIMIT_PER_TYPE);

        if (!primaryResult.error) {
          return (primaryResult.data as unknown as FlexibleRow[] | null) || [];
        }

        if (!isMissingColumnError(primaryResult.error.message)) {
          throw new Error(primaryResult.error.message);
        }

        const fallbackResult = await supabase
          .from(table)
          .select("*")
          .limit(FEED_LIMIT_PER_TYPE);

        if (fallbackResult.error) {
          throw new Error(fallbackResult.error.message);
        }

        return (fallbackResult.data as unknown as FlexibleRow[] | null) || [];
      };

      const selectOpenPostsRows = async (): Promise<FlexibleRow[]> => {
        const primaryResult = await supabase
          .from("posts")
          .select("id,text,content,description,title,user_id,provider_id,created_by,status,state,created_at")
          .eq("status", "open")
          .limit(FEED_LIMIT_PER_TYPE);

        if (!primaryResult.error) {
          return (primaryResult.data as unknown as FlexibleRow[] | null) || [];
        }

        if (!isMissingColumnError(primaryResult.error.message)) {
          throw new Error(primaryResult.error.message);
        }

        const fallbackResult = await supabase
          .from("posts")
          .select("*")
          .limit(FEED_LIMIT_PER_TYPE);

        if (fallbackResult.error) {
          throw new Error(fallbackResult.error.message);
        }

        return (fallbackResult.data as unknown as FlexibleRow[] | null) || [];
      };

      const selectCurrentUserProfile = async (currentUserId: string): Promise<FlexibleRow | null> => {
        if (!currentUserId) return null;

        const primaryResult = await supabase
          .from("profiles")
          .select("id,location,latitude,longitude")
          .eq("id", currentUserId)
          .maybeSingle();

        if (!primaryResult.error) {
          return (primaryResult.data as unknown as FlexibleRow | null) || null;
        }

        if (!isMissingColumnError(primaryResult.error.message)) {
          throw new Error(primaryResult.error.message);
        }

        const fallbackResult = await supabase
          .from("profiles")
          .select("id,location")
          .eq("id", currentUserId)
          .maybeSingle();

        if (fallbackResult.error) {
          throw new Error(fallbackResult.error.message);
        }

        return (fallbackResult.data as unknown as FlexibleRow | null) || null;
      };

      const selectProfilesWithFallback = async (profileIds: string[]): Promise<FlexibleRow[]> => {
        if (profileIds.length === 0) return [];

        const primaryResult = await supabase
          .from("profiles")
          .select("id,name,avatar_url,role,bio,location,availability,services,email,phone,website,latitude,longitude")
          .in("id", profileIds);

        if (!primaryResult.error) {
          return (primaryResult.data as unknown as FlexibleRow[] | null) || [];
        }

        if (!isMissingColumnError(primaryResult.error.message)) {
          throw new Error(primaryResult.error.message);
        }

        const fallbackResult = await supabase
          .from("profiles")
          .select("*")
          .in("id", profileIds);

        if (fallbackResult.error) {
          throw new Error(fallbackResult.error.message);
        }

        return (fallbackResult.data as unknown as FlexibleRow[] | null) || [];
      };

      const { data: sessionData } = await supabase.auth.getSession();
      let currentUserId = sessionData.session?.user?.id || "";

      if (!currentUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        currentUserId = user?.id || "";
      }

      const [currentUserProfileRow, serviceRowsRaw, productRowsRaw, postRowsRaw] = await Promise.all([
        selectCurrentUserProfile(currentUserId),
        selectRowsWithFallback("service_listings", "id,title,description,price,category,provider_id,created_at"),
        selectRowsWithFallback("product_catalog", "id,title,description,price,category,provider_id,created_at"),
        selectOpenPostsRows(),
      ]);

      const profileCoordinates = resolveCoordinates({
        row: currentUserProfileRow,
        location: stringFromRow(currentUserProfileRow || {}, ["location"], ""),
        seed: currentUserId,
      });
      const fallbackViewerCoordinates = profileCoordinates || defaultMarketCoordinates();
      setViewerCoordinates(fallbackViewerCoordinates);

      const browserCoordinates = await browserCoordinatesPromise;
      const resolvedViewerCoordinates = browserCoordinates || fallbackViewerCoordinates;
      if (browserCoordinates) {
        setViewerCoordinates(resolvedViewerCoordinates);
      }

      const serviceRows: ServiceRow[] = serviceRowsRaw
        .map((row, index) => ({
          id: stringFromRow(row, ["id"], `service-${index}`),
          title: stringFromRow(row, ["title", "name", "service_title"], "Local service"),
          description: stringFromRow(row, ["description", "details", "text"], "Service listing"),
          price: numberFromRow(row, ["price", "amount", "rate"], 0),
          category: stringFromRow(row, ["category", "service_category", "type"], "Service"),
          provider_id: stringFromRow(row, ["provider_id", "user_id", "created_by", "owner_id"], ""),
          created_at: stringFromRow(row, ["created_at", "createdAt"], ""),
        }))
        .filter((row) => !!row.provider_id);

      const productRows: ProductRow[] = productRowsRaw
        .map((row, index) => ({
          id: stringFromRow(row, ["id"], `product-${index}`),
          title: stringFromRow(row, ["title", "name", "product_name"], "Local product"),
          description: stringFromRow(row, ["description", "details", "text"], "Product listing"),
          price: numberFromRow(row, ["price", "amount", "mrp"], 0),
          category: stringFromRow(row, ["category", "product_category", "type"], "Product"),
          provider_id: stringFromRow(row, ["provider_id", "user_id", "created_by", "owner_id"], ""),
          created_at: stringFromRow(row, ["created_at", "createdAt"], ""),
        }))
        .filter((row) => !!row.provider_id);

      const postRows: PostRow[] = postRowsRaw
        .filter((row) => {
          const status = stringFromRow(row, ["status", "state"], "");
          return !status || status.toLowerCase() === "open";
        })
        .map((row, index) => ({
          id: stringFromRow(row, ["id"], `post-${index}`),
          text: stringFromRow(row, ["text", "content", "description", "title"], ""),
          content: stringFromRow(row, ["content", "text"], ""),
          description: stringFromRow(row, ["description", "text"], ""),
          title: stringFromRow(row, ["title", "name"], ""),
          user_id: stringFromRow(row, ["user_id", "author_id", "created_by"], ""),
          provider_id: stringFromRow(row, ["provider_id", "user_id"], ""),
          created_by: stringFromRow(row, ["created_by", "author_id", "user_id"], ""),
          created_at: stringFromRow(row, ["created_at", "createdAt"], ""),
        }));

      const profileIds = [
        ...serviceRows.map((row) => row.provider_id),
        ...productRows.map((row) => row.provider_id),
        ...postRows
          .map((row) => row.user_id || row.provider_id || row.created_by || "")
          .filter(Boolean),
      ];

      const uniqueProfileIds = Array.from(new Set(profileIds)).slice(0, MAX_PROFILE_LOOKUP);
      let profileMap = new Map<string, ProfileRow>();
      let reviewRows: ReviewRow[] = [];

      if (uniqueProfileIds.length > 0) {
        const [profileRowsRaw, reviewsResult] = await Promise.all([
          selectProfilesWithFallback(uniqueProfileIds),
          supabase
            .from("reviews")
            .select("provider_id,rating")
            .in("provider_id", uniqueProfileIds),
        ]);

        const normalizedProfiles: ProfileRow[] = profileRowsRaw
          .map((row) => {
            const profileId = stringFromRow(row, ["id", "user_id"], "");
            const servicesValue = row.services;
            const normalizedServices = Array.isArray(servicesValue)
              ? servicesValue.filter((item): item is string => typeof item === "string")
              : null;
            return {
              id: profileId,
              name: stringFromRow(row, ["name", "full_name", "display_name"], ""),
              avatar_url: stringFromRow(row, ["avatar_url", "avatar", "image_url"], ""),
              role: stringFromRow(row, ["role", "account_type"], ""),
              bio: stringFromRow(row, ["bio", "about"], ""),
              location: stringFromRow(row, ["location", "city"], ""),
              availability: stringFromRow(row, ["availability", "status"], ""),
              services: normalizedServices,
              email: stringFromRow(row, ["email"], ""),
              phone: stringFromRow(row, ["phone", "phone_number"], ""),
              website: stringFromRow(row, ["website", "site_url"], ""),
              latitude: (() => {
                const value = numberFromRow(row, ["latitude", "lat"], Number.NaN);
                return Number.isFinite(value) ? value : null;
              })(),
              longitude: (() => {
                const value = numberFromRow(row, ["longitude", "lng", "long"], Number.NaN);
                return Number.isFinite(value) ? value : null;
              })(),
            };
          })
          .filter((row) => !!row.id);

        profileMap = new Map(normalizedProfiles.map((row) => [row.id, row]));

        if (reviewsResult.error) {
          console.warn("Could not load review ratings for feed scoring:", reviewsResult.error.message);
        } else {
          reviewRows = (reviewsResult.data as ReviewRow[] | null) || [];
        }
      }

      const serviceCountMap = new Map<string, number>();
      const productCountMap = new Map<string, number>();
      const ratingMap = new Map<string, { sum: number; count: number }>();

      serviceRows.forEach((row) => {
        serviceCountMap.set(row.provider_id, (serviceCountMap.get(row.provider_id) || 0) + 1);
      });

      productRows.forEach((row) => {
        productCountMap.set(row.provider_id, (productCountMap.get(row.provider_id) || 0) + 1);
      });

      reviewRows.forEach((row) => {
        if (!row.provider_id) return;
        const previous = ratingMap.get(row.provider_id) || { sum: 0, count: 0 };
        ratingMap.set(row.provider_id, {
          sum: previous.sum + Number(row.rating || 0),
          count: previous.count + 1,
        });
      });

      const getProviderStats = (providerId: string) => {
        const profile = providerId ? profileMap.get(providerId) : undefined;
        const coordinates = resolveCoordinates({
          row: (profile as unknown as Record<string, unknown> | undefined) || null,
          location: profile?.location,
          seed: providerId || profile?.id || "provider",
        });
        const serviceCount = serviceCountMap.get(providerId) || 0;
        const productCount = productCountMap.get(providerId) || 0;
        const ratings = ratingMap.get(providerId);
        const reviewCount = ratings?.count || 0;
        const averageRating = reviewCount
          ? Number((((ratings?.sum || 0) / reviewCount) || 0).toFixed(1))
          : 4.4;
        const profileCompletion = calculateProfileCompletion({
          name: profile?.name,
          location: profile?.location,
          bio: profile?.bio,
          services: profile?.services,
          email: profile?.email,
          phone: profile?.phone,
          website: profile?.website,
        });
        const responseMinutes = estimateResponseMinutes({
          availability: profile?.availability,
          providerId: providerId || profile?.id || "provider",
        });
        const distance = distanceBetweenCoordinatesKm(resolvedViewerCoordinates, coordinates);
        const verificationStatus = calculateVerificationStatus({
          role: profile?.role,
          profileCompletion,
          listingsCount: serviceCount + productCount,
          averageRating,
          reviewCount,
        });
        const rankScore = calculateLocalRankScore({
          distanceKm: distance,
          responseMinutes,
          rating: averageRating,
          profileCompletion,
        });

        return {
          profile,
          coordinates,
          distance,
          responseMinutes,
          profileCompletion,
          verificationStatus,
          rankScore,
        };
      };

      /* ---------- FORMAT ---------- */
      const formattedServices: Listing[] = serviceRows.map((s) => {
        const stats = getProviderStats(s.provider_id);
        return {
          id: s.id,
          title: s.title || "Local service",
          description: s.description || "Service listing",
          price: s.price || 0,
          category: s.category || "Service",
          provider_id: s.provider_id,
          type: "service",
          avatar: stats.profile?.avatar_url || "https://i.pravatar.cc/150?img=12",
          distance: stats.distance,
          lat: stats.coordinates.latitude,
          lng: stats.coordinates.longitude,
          createdAt: s.created_at,
          creatorName: stats.profile?.name || "Local Provider",
          businessSlug: createBusinessSlug(stats.profile?.name, s.provider_id),
          rankScore: stats.rankScore,
          responseMinutes: stats.responseMinutes,
          profileCompletion: stats.profileCompletion,
          verificationStatus: stats.verificationStatus,
        };
      });

      const formattedProducts: Listing[] = productRows.map((p) => {
        const stats = getProviderStats(p.provider_id);
        return {
          id: p.id,
          title: p.title || "Local product",
          description: p.description || "Product listing",
          price: p.price || 0,
          category: p.category || "Product",
          provider_id: p.provider_id,
          type: "product",
          avatar: stats.profile?.avatar_url || "https://i.pravatar.cc/150?img=32",
          distance: stats.distance,
          lat: stats.coordinates.latitude,
          lng: stats.coordinates.longitude,
          createdAt: p.created_at,
          creatorName: stats.profile?.name || "Local Seller",
          businessSlug: createBusinessSlug(stats.profile?.name, p.provider_id),
          rankScore: stats.rankScore,
          responseMinutes: stats.responseMinutes,
          profileCompletion: stats.profileCompletion,
          verificationStatus: stats.verificationStatus,
        };
      });

      const formattedPosts: Listing[] = postRows.map((post) => {
        const rawText = post.text || post.content || post.description || post.title || "Local post";
        const parsed = parsePostText(rawText);
        const ownerId = post.user_id || post.provider_id || post.created_by || "";
        const stats = ownerId ? getProviderStats(ownerId) : null;
        const fallbackCoordinates = resolveCoordinates({
          location: parsed.location,
          seed: post.id,
        });
        const targetCoordinates = stats?.coordinates || fallbackCoordinates;
        const distance = stats?.distance || distanceBetweenCoordinatesKm(resolvedViewerCoordinates, fallbackCoordinates);

        return {
          id: post.id,
          title: parsed.title,
          description: parsed.description,
          price: parsed.budget,
          category: parsed.category,
          provider_id: ownerId,
          type: "demand",
          avatar: stats?.profile?.avatar_url || "https://i.pravatar.cc/150?img=5",
          distance,
          urgent: true,
          lat: targetCoordinates.latitude,
          lng: targetCoordinates.longitude,
          media: parsed.media,
          createdAt: post.created_at,
          creatorName: stats?.profile?.name || "Community Member",
          businessSlug: ownerId ? createBusinessSlug(stats?.profile?.name, ownerId) : undefined,
          rankScore: stats?.rankScore || 50,
          responseMinutes: stats?.responseMinutes || 30,
          profileCompletion: stats?.profileCompletion || 40,
          verificationStatus: stats?.verificationStatus || "unclaimed",
        };
      });

      const liveFeed = [...formattedPosts, ...formattedServices, ...formattedProducts];
      if (liveFeed.length === 0) {
        setFeed(demoFeed);
        setUsingDemoFeed(true);
        setFeedError("No live listings yet. Showing demo marketplace cards.");
      } else {
        setFeed(liveFeed);
        setUsingDemoFeed(false);
      }
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      if (isAbortLikeError(error)) {
        return;
      }

      const fallbackMessage = "Failed to fetch marketplace feed";
      const feedErrorMessage = isFailedFetchError(error)
        ? "Network connection issue while loading live marketplace data."
        : toErrorMessage(error, fallbackMessage);
      console.warn("Failed to load marketplace feed:", feedErrorMessage);
      if (soft) {
        setFeedError(`${feedErrorMessage}. Keeping current feed.`);
      } else {
        setFeed(demoFeed);
        setUsingDemoFeed(true);
        setFeedError(`${feedErrorMessage}. Showing demo feed.`);
      }
    } finally {
      fetchInFlightRef.current = false;
      if (soft) {
        setSyncing(false);
      } else {
        setIsFeedLoading(false);
      }
    }
  }, [demoFeed]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    const scheduleReload = (payload?: { table?: string }) => {
      setLiveEventCount((count) => count + 1);
      setLastLiveEventAt(new Date().toISOString());
      if (payload?.table) {
        setLastLiveEventSource(payload.table.replaceAll("_", " "));
      }
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      reloadTimerRef.current = window.setTimeout(() => {
        void fetchFeed(true);
      }, 300);
    };

    const channel = supabase
      .channel("dashboard-feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .subscribe((status) => {
        setFeedChannelHealth(mapRealtimeHealth(status));
      });

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      setFeedChannelHealth("idle");
      supabase.removeChannel(channel);
    };
  }, [fetchFeed]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchFeed(true);
    }, 60000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchFeed]);

  useEffect(() => {
    const mapTimer = window.setTimeout(() => {
      setMapReady(true);
    }, 900);
    return () => window.clearTimeout(mapTimer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const composeParam = params.get("compose");
    if (composeParam === "1" || composeParam === "true") {
      setOpenPostModal(true);
    }

    const id = params.get("focus");
    const type = params.get("type");
    const helpRequestParam = params.get("help_request");

    if (helpRequestParam) {
      setActiveHelpRequestId(helpRequestParam);
      void loadHelpRequestMatches(helpRequestParam);
    }

    if (!id) return;
    setFocusTarget({
      id,
      type: type || "",
    });
  }, [loadHelpRequestMatches]);

  useEffect(() => {
    if (!focusTarget?.id || feed.length === 0) return;

    if (focusTarget.type && ["demand", "service", "product"].includes(focusTarget.type)) {
      setCategory(focusTarget.type);
    } else {
      setCategory("all");
    }
    setShowTrendingOnly(false);
    setSearch("");

    const timer = setTimeout(() => {
      const target = cardRefs.current[focusTarget.id];
      if (!target) return;
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setHighlightedId(focusTarget.id);
      setTimeout(() => setHighlightedId(null), 2600);
    }, 120);

    return () => clearTimeout(timer);
  }, [feed.length, focusTarget]);

  useEffect(() => {
    if (!activeHelpRequestId) return;

    const scheduleReload = () => {
      if (helpMatchesReloadTimerRef.current) {
        window.clearTimeout(helpMatchesReloadTimerRef.current);
      }
      helpMatchesReloadTimerRef.current = window.setTimeout(() => {
        void loadHelpRequestMatches(activeHelpRequestId, true);
      }, 300);
    };

    const channel = supabase
      .channel(`help-request-live-${activeHelpRequestId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_request_matches",
          filter: `help_request_id=eq.${activeHelpRequestId}`,
        },
        scheduleReload
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "help_requests",
          filter: `id=eq.${activeHelpRequestId}`,
        },
        scheduleReload
      )
      .subscribe();

    return () => {
      if (helpMatchesReloadTimerRef.current) {
        window.clearTimeout(helpMatchesReloadTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [activeHelpRequestId, loadHelpRequestMatches]);

/* ================= FILTER + SORT ================= */

const filtered = useMemo(() => {
  const query = search.toLowerCase().trim();
  return [...feed]
    .filter((item) => {
      const haystack = `${item.title} ${item.description} ${item.category} ${item.creatorName || ""}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);

      const normalizedCategory = category.toLowerCase();
      const matchesCategory =
        category === "all" ||
        item.category.toLowerCase().includes(normalizedCategory) ||
        item.type === normalizedCategory;

      const matchesTrending = showTrendingOnly ? item.type === "demand" : true;
      const matchesDistance = maxDistanceKm > 0 ? item.distance <= maxDistanceKm : true;
      const matchesVerified = verifiedOnly ? item.verificationStatus === "verified" : true;
      const matchesUrgent = urgentOnly ? !!item.urgent : true;
      const matchesMedia = mediaOnly ? (item.media?.length || 0) > 0 : true;
      const matchesFresh = freshOnly ? isFreshListing(item.createdAt) : true;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesTrending &&
        matchesDistance &&
        matchesVerified &&
        matchesUrgent &&
        matchesMedia &&
        matchesFresh
      );
    })
    .sort((a, b) => {
      if (sortBy === "best") {
        return b.rankScore - a.rankScore || a.distance - b.distance;
      }
      if (sortBy === "distance") {
        return a.distance - b.distance;
      }
      if (sortBy === "latest") {
        return parseDateMs(b.createdAt) - parseDateMs(a.createdAt) || b.rankScore - a.rankScore;
      }
      return a.price - b.price;
    });
}, [category, feed, freshOnly, maxDistanceKm, mediaOnly, search, showTrendingOnly, sortBy, urgentOnly, verifiedOnly]);

const visibleFeed = useMemo(
  () => filtered.filter((item) => !hiddenListingIds.has(item.id)),
  [filtered, hiddenListingIds]
);

const activeFilterCount =
  Number(showTrendingOnly) +
  Number(maxDistanceKm > 0) +
  Number(verifiedOnly) +
  Number(urgentOnly) +
  Number(mediaOnly) +
  Number(freshOnly);

const filteredStats = useMemo(() => {
  const verified = visibleFeed.filter((item) => item.verificationStatus === "verified").length;
  const urgent = visibleFeed.filter((item) => item.urgent).length;
  const withMedia = visibleFeed.filter((item) => (item.media?.length || 0) > 0).length;
  const avgMatch = visibleFeed.length
    ? Math.round(visibleFeed.reduce((sum, item) => sum + item.rankScore, 0) / visibleFeed.length)
    : 0;
  return {
    total: visibleFeed.length,
    verified,
    urgent,
    withMedia,
    avgMatch,
  };
}, [visibleFeed]);

const trendingDemands = useMemo(
  () =>
    visibleFeed
      .filter((item) => item.type === "demand")
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 3),
  [visibleFeed]
);

const feedMix = useMemo(() => {
  const demand = visibleFeed.filter((item) => item.type === "demand").length;
  const service = visibleFeed.filter((item) => item.type === "service").length;
  const product = visibleFeed.filter((item) => item.type === "product").length;
  return { demand, service, product };
}, [visibleFeed]);

const feedMixPercentages = useMemo(() => {
  const total = Math.max(1, feedMix.demand + feedMix.service + feedMix.product);
  return {
    demand: Math.round((feedMix.demand / total) * 100),
    service: Math.round((feedMix.service / total) * 100),
    product: Math.round((feedMix.product / total) * 100),
  };
}, [feedMix.demand, feedMix.product, feedMix.service]);

const hottestCategories = useMemo(
  () =>
    [...visibleFeed]
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 4)
      .map((item) => item.category)
      .filter((value, index, array) => array.indexOf(value) === index),
  [visibleFeed]
);

const startupReadinessScore = useMemo(() => {
  const verifiedSignal =
    filteredStats.total > 0 ? Math.round((filteredStats.verified / filteredStats.total) * 100) : 0;
  const fastResponseCount = feed.filter((item) => item.responseMinutes <= 15).length;
  const responseSignal =
    feed.length > 0 ? Math.round((fastResponseCount / feed.length) * 100) : 0;
  const streamSignal =
    feedChannelHealth === "connected"
      ? 100
      : feedChannelHealth === "connecting" || feedChannelHealth === "reconnecting"
      ? 72
      : feedChannelHealth === "idle"
      ? 56
      : 35;

  return Math.round(verifiedSignal * 0.45 + responseSignal * 0.35 + streamSignal * 0.2);
}, [
  feed,
  feedChannelHealth,
  filteredStats.total,
  filteredStats.verified,
]);

const clearAdvancedFilters = () => {
  setMaxDistanceKm(0);
  setVerifiedOnly(false);
  setUrgentOnly(false);
  setMediaOnly(false);
  setFreshOnly(false);
};

const toggleSaveListing = (listingId: string) => {
  setSavedListingIds((previous) => {
    const next = new Set(previous);
    if (next.has(listingId)) {
      next.delete(listingId);
    } else {
      next.add(listingId);
    }
    return next;
  });
};

const hideListing = (listingId: string) => {
  setHiddenListingIds((previous) => {
    const next = new Set(previous);
    next.add(listingId);
    return next;
  });
};

const voteOnListing = (listingId: string, direction: "up" | "down", baselineScore: number) => {
  setListingVotes((previous) => {
    const current = previous[listingId] ?? Math.max(1, Math.round(baselineScore / 7));
    const nextValue = direction === "up" ? current + 1 : Math.max(0, current - 1);
    return {
      ...previous,
      [listingId]: nextValue,
    };
  });
};


/* ================= BOOK ================= */

const bookNow = async (item: Listing) => {
if (item.isDemo) {
  if (item.type === "demand") {
    router.push("/dashboard/provider/add-service");
    return;
  }
  router.push("/dashboard/people");
  return;
}

const {
data: { user },
} = await supabase.auth.getUser();


if (!user) return alert("Login required");

await supabase.from("orders").insert({
  listing_id: item.id,
  listing_type: item.type,
  consumer_id: user.id,
  provider_id: item.provider_id,
  price: item.price,
  status: "new_lead",
});

alert("Booking request sent 🚀");


};

const messageProvider = async (providerId: string) => {
if (providerId.startsWith("demo-provider-")) {
  router.push("/dashboard/people");
  return;
}

setMessageLoadingId(providerId);

const {
data: { user },
} = await supabase.auth.getUser();

if (!user) {
  setMessageLoadingId(null);
  alert("Login required");
  return;
}

if (user.id === providerId) {
  setMessageLoadingId(null);
  alert("This is your own listing.");
  return;
}

const { data: myConversations } = await supabase
  .from("conversation_participants")
  .select("conversation_id")
  .eq("user_id", user.id);

const myConversationIds = myConversations?.map((row) => row.conversation_id) || [];

let targetConversationId: string | null = null;

if (myConversationIds.length > 0) {
  const { data: providerConversation } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .in("conversation_id", myConversationIds)
    .eq("user_id", providerId)
    .limit(1)
    .maybeSingle();

  targetConversationId = providerConversation?.conversation_id || null;
}

if (!targetConversationId) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !conversation) {
    setMessageLoadingId(null);
    alert(`Unable to start chat. ${error?.message || ""}`.trim());
    return;
  }

  targetConversationId = conversation.id;

  const { error: participantError } = await supabase.from("conversation_participants").upsert([
    {
      conversation_id: targetConversationId,
      user_id: user.id,
    },
    {
      conversation_id: targetConversationId,
      user_id: providerId,
    },
  ], {
    onConflict: "conversation_id,user_id",
    ignoreDuplicates: true,
  });

  if (participantError) {
    setMessageLoadingId(null);
    alert(`Unable to start chat. ${participantError.message}`);
    return;
  }
}

setMessageLoadingId(null);
router.push(`/dashboard/chat?open=${targetConversationId}`);
};

const categories = ["all", "demand", "service", "product"];

const dashboardStats = useMemo(() => {
  const providers = new Set(feed.map((item) => item.provider_id).filter(Boolean)).size;
  const urgentCount = feed.filter((item) => item.type === "demand" && item.urgent).length;
  const avgMatch = feed.length
    ? Math.round(feed.reduce((sum, item) => sum + item.rankScore, 0) / feed.length)
    : 0;
  const fastResponses = feed.filter((item) => item.responseMinutes <= 15).length;

  return {
    providers,
    urgentCount,
    avgMatch,
    fastResponses,
  };
}, [feed]);

const realtimeStyle = REALTIME_HEALTH_STYLES[feedChannelHealth];
const liveSourceLabel = lastLiveEventSource
  ? `${lastLiveEventSource.charAt(0).toUpperCase()}${lastLiveEventSource.slice(1)}`
  : "market";
const layoutLabel = feedLayout === "thread" ? "Thread Feed" : "Card Feed";

/* ================= UI ================= */

return (
  <div className="min-h-screen bg-transparent text-slate-900">
    <div className="max-w-[2200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
      <div className="market-hero-surface rounded-3xl border border-sky-200/25 bg-gradient-to-r from-slate-900 via-indigo-900 to-sky-800 shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
        <div className="market-orb-float absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="market-orb-float-delayed absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="market-orb-float absolute -left-10 top-16 h-36 w-36 rounded-full bg-cyan-200/10 blur-3xl" />

        <div className="relative p-5 sm:p-7 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles size={13} />
                Market Command Feed
              </div>
              <h1 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                Ship faster with realtime local demand intelligence
              </h1>
              <p className="mt-2 max-w-2xl text-sm sm:text-base text-white/90">
                Production-ready marketplace stream for nearby needs, verified providers, and conversion-focused actions.
              </p>
            </div>

            <div className="w-full lg:w-[560px] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs text-white/90">
                <span className="inline-flex items-center gap-1.5">
                  {syncing ? <RefreshCw size={12} className="animate-spin" /> : <Radar size={12} />}
                  {syncing ? "Syncing marketplace..." : `Last sync ${formatSyncTime(lastSyncedAt)}`}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 ${realtimeStyle.className}`}>
                    <span className={`h-2 w-2 rounded-full ${realtimeStyle.dotClassName}`} />
                    {realtimeStyle.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => void fetchFeed(true)}
                    disabled={syncing}
                    className="inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/25 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <RefreshCw size={11} className={syncing ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/profile")}
                  className="rounded-xl border border-white/35 bg-white/15 px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/25 transition-colors"
                >
                  Complete Profile
                </button>
                <button
                  type="button"
                  onClick={() => setOpenPostModal(true)}
                  className="rounded-xl border border-white/40 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                >
                  Post New Need
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/provider/add-service")}
                  className="rounded-xl border border-white/35 bg-white/15 px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/25 transition-colors"
                >
                  Add Service
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeed(demoFeed);
                    setUsingDemoFeed(true);
                    setFeedError("Demo seed loaded. Add your real posts/services to replace it.");
                  }}
                  className="rounded-xl border border-white/35 bg-white/15 px-3 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-white/25 transition-colors"
                >
                  Load Demo Seed
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Providers</p>
              <p className="mt-1 text-xl font-bold text-white">{dashboardStats.providers || 520}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Urgent Needs</p>
              <p className="mt-1 text-xl font-bold text-white">{dashboardStats.urgentCount}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Avg Match</p>
              <p className="mt-1 text-xl font-bold text-white">{dashboardStats.avgMatch}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Fast Replies</p>
              <p className="mt-1 text-xl font-bold text-white">{dashboardStats.fastResponses}</p>
            </div>
            <div className="rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[11px] uppercase tracking-wide text-white/80">Live Events</p>
              <p className="mt-1 text-xl font-bold text-white">{liveEventCount}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-100/90 px-2.5 py-1 font-semibold text-emerald-800">
              Startup readiness {startupReadinessScore}%
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-white/90">
              {filteredStats.total} active listings in view
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-white/90">
              {activeFilterCount > 0 ? `${activeFilterCount} active filters` : "No active advanced filters"}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div className="max-w-[2200px] mx-auto px-4 sm:px-6 mt-5">
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 sm:p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 bg-white p-3 rounded-xl flex-1 border border-slate-200 shadow-sm">
            <Search size={16} className="text-slate-500" />
            <input
              placeholder="Search services, products, needs..."
              className="bg-transparent outline-none flex-1 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-4">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value === "best"
                    ? "best"
                    : e.target.value === "price"
                    ? "price"
                    : e.target.value === "latest"
                    ? "latest"
                    : "distance"
                )
              }
              className="bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm shadow-sm"
            >
              <option value="best">Sort: Best Match</option>
              <option value="distance">Sort: Distance</option>
              <option value="price">Sort: Price</option>
              <option value="latest">Sort: Latest</option>
            </select>

            <button
              onClick={() => setShowTrendingOnly(!showTrendingOnly)}
              className={`border px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition-colors ${
                showTrendingOnly
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
              }`}
            >
              <Filter size={16} />
              {showTrendingOnly ? "Trending On" : "Trending"}
            </button>

            <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setFeedLayout("cards")}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    feedLayout === "cards" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <LayoutGrid size={14} />
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setFeedLayout("thread")}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                    feedLayout === "thread" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Rows3 size={14} />
                  Thread
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className="border px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm bg-white border-slate-200 text-slate-700 hover:border-indigo-300 transition-colors"
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mb-4 mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
            <Activity size={12} />
            {filteredStats.total} results
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
            <ShieldCheck size={12} />
            {filteredStats.verified} verified
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
            <Zap size={12} />
            {filteredStats.urgent} urgent
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
            <ImageIcon size={12} />
            {filteredStats.withMedia} with media
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-700">
            Match {filteredStats.avgMatch}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
            <Flame size={12} />
            {layoutLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
            <BellRing size={12} />
            {liveEventCount} updates
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <RotateCcw size={12} />
              Reset advanced
            </button>
          )}
        </div>

        {lastLiveEventAt && (
          <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
            Live event from {liveSourceLabel} at {formatSyncTime(lastLiveEventAt)}.
          </div>
        )}

        <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                category === cat
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1">
          {QUICK_SEARCH_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setCategory("all");
                setSearch(chip);
              }}
              className="px-4 py-2 bg-slate-100 rounded-xl text-sm text-slate-700 whitespace-nowrap hover:bg-indigo-600 hover:text-white transition-colors"
            >
              {chip}
            </button>
          ))}
          {hottestCategories.map((chip) => (
            <button
              key={`hot-${chip}`}
              onClick={() => {
                setCategory("all");
                setSearch(chip);
              }}
              className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 whitespace-nowrap hover:bg-amber-100 transition-colors"
            >
              <span className="inline-flex items-center gap-1">
                <Flame size={12} />
                {chip}
              </span>
            </button>
          ))}
        </div>

        {showAdvancedFilters && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-slate-600">
                Max distance
                <select
                  value={String(maxDistanceKm)}
                  onChange={(event) => setMaxDistanceKm(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="0">Any distance</option>
                  <option value="3">Within 3 km</option>
                  <option value="8">Within 8 km</option>
                  <option value="15">Within 15 km</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setVerifiedOnly((value) => !value)}
                className={`mt-5 h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  verifiedOnly
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                Verified only
              </button>
              <button
                type="button"
                onClick={() => setUrgentOnly((value) => !value)}
                className={`mt-5 h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  urgentOnly
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                Urgent only
              </button>
              <button
                type="button"
                onClick={() => setMediaOnly((value) => !value)}
                className={`mt-5 h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  mediaOnly
                    ? "border-violet-300 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                Media only
              </button>
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setFreshOnly((value) => !value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  freshOnly
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                Last 24 hours only
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    <div className="max-w-[2200px] mx-auto px-4 sm:px-6 grid lg:grid-cols-3 gap-6 pb-20">
      <div className="lg:col-span-2 space-y-5">
        {isFeedLoading && feed.length === 0 ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div
                key={`feed-skeleton-${index}`}
                className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse"
              >
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="mt-4 h-5 w-2/3 rounded bg-slate-200" />
                <div className="mt-3 h-4 w-full rounded bg-slate-200" />
                <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {(usingDemoFeed || !!feedError || isFeedLoading) && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">
                      {usingDemoFeed ? "Demo seed feed is active" : "Syncing live feed"}
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      {feedError || "Live listings are loading in the background. You can still browse and interact."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void fetchFeed(true)}
                      disabled={syncing}
                      className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {syncing ? "Refreshing..." : "Refresh Live Data"}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/provider/add-service")}
                      className="rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-700 hover:border-indigo-500 transition-colors"
                    >
                      Add Service
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!!activeHelpRequestId && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Help request matching
                    </p>
                    <p className="mt-1 text-xs text-emerald-700">
                      {activeHelpRequestTitle
                        ? `"${activeHelpRequestTitle}" • ${helpRequestMatchedCount} matches`
                        : `${helpRequestMatchedCount} matches found`}
                    </p>
                    {helpMatchesSyncing && (
                      <p className="mt-1 text-[11px] text-emerald-700 inline-flex items-center gap-1">
                        <RefreshCw size={11} className="animate-spin" />
                        Syncing new matches...
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void loadHelpRequestMatches(activeHelpRequestId, true)}
                      disabled={helpMatchesLoading || helpMatchesSyncing}
                      className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Refresh matches
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveHelpRequestId(null);
                        setHelpRequestQueryParam(null);
                      }}
                      className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                {!!helpMatchesError && (
                  <p className="mt-2 text-xs text-rose-700">{helpMatchesError}</p>
                )}

                {helpMatchesLoading ? (
                  <div className="mt-3 text-xs text-emerald-700 inline-flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin" />
                    Loading provider matches...
                  </div>
                ) : helpMatches.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {helpMatches.slice(0, 4).map((match) => (
                      <div
                        key={`${activeHelpRequestId}-${match.providerId}`}
                        className="rounded-xl border border-emerald-200 bg-white px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Image
                              src={match.avatar}
                              alt={match.name}
                              width={30}
                              height={30}
                              className="h-7 w-7 rounded-full object-cover"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{match.name}</p>
                              <p className="truncate text-[11px] text-slate-500">{match.role}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-emerald-700">Score {Math.round(match.score)}</p>
                            <p className="text-[11px] text-slate-500">
                              {match.distanceKm !== null ? `${match.distanceKm.toFixed(1)} km` : "Nearby"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            {match.reason}
                          </span>
                          <button
                            type="button"
                            onClick={() => void messageProvider(match.providerId)}
                            className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                          >
                            Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedProvider(match.providerId)}
                            className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                          >
                            Trust profile
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-emerald-800">
                    Matching is in progress. Providers will appear here as scores are computed.
                  </p>
                )}
              </div>
            )}

            {feed.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-slate-900">No listings available yet</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Create your first post or listing to populate the dashboard.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenPostModal(true)}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
                  >
                    Post a Need
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/provider/add-product")}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-400 transition-colors"
                  >
                    Add Product
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                      <TrendingUp size={16} />
                      Hot Lane Near You
                    </h2>
                    {hiddenListingIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setHiddenListingIds(new Set())}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Restore hidden ({hiddenListingIds.size})
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {trendingDemands.map((item) => (
                      <button
                        key={`trend-${item.id}`}
                        type="button"
                        onClick={() => {
                          const target = cardRefs.current[item.id];
                          if (!target) return;
                          target.scrollIntoView({ behavior: "smooth", block: "center" });
                          setHighlightedId(item.id);
                          setTimeout(() => setHighlightedId(null), 1200);
                        }}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
                      >
                        <div className="text-xs text-slate-500">
                          {item.distance} km away • {item.responseMinutes}m response
                        </div>
                        <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                        <div className="mt-1 text-xs text-indigo-700">₹ {item.price} • {formatRelativeAge(item.createdAt)}</div>
                      </button>
                    ))}
                    {trendingDemands.length === 0 && (
                      <div className="sm:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        No active demand trends for these filters yet.
                      </div>
                    )}
                  </div>
                </div>

                {visibleFeed.map((item, index) => {
                  const listingSignals = getListingSignals(item);
                  const freshLabel = formatRelativeAge(item.createdAt);
                  const freshClassName = isFreshListing(item.createdAt)
                    ? "text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded"
                    : "text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded";
                  const threadMode = feedLayout === "thread";
                  const voteScore = listingVotes[item.id] ?? Math.max(1, Math.round(item.rankScore / 7));
                  const saved = savedListingIds.has(item.id);
                  const enterDelay = Math.min(index * 45, 320);

                  return (
                    <div
                      key={item.id}
                      ref={(el) => {
                        cardRefs.current[item.id] = el;
                      }}
                      style={{ "--enter-delay": `${enterDelay}ms` } as CSSProperties}
                      className={`post-card-enter group border bg-white transition-all duration-300 shadow-sm hover:shadow-lg ${
                        threadMode ? "overflow-hidden rounded-2xl" : "rounded-3xl p-4 sm:p-6"
                      } ${
                        highlightedId === item.id
                          ? "border-indigo-400 shadow-[0_0_0_2px_rgba(99,102,241,0.35)]"
                          : "border-slate-200/90"
                      }`}
                    >
                      <div className={`flex ${threadMode ? "flex-row gap-0" : "flex-col gap-4 sm:flex-row"}`}>
                        <div
                          className={`flex flex-col items-center gap-1 border-slate-200 bg-slate-50 ${
                            threadMode
                              ? "w-14 shrink-0 border-r py-4"
                              : "w-full flex-row rounded-2xl border px-2 py-2 sm:w-16 sm:flex-col sm:rounded-xl sm:border-0 sm:bg-transparent sm:p-0"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => voteOnListing(item.id, "up", item.rankScore)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700"
                            title="Boost post"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <p className="text-xs font-semibold text-slate-700">{voteScore}</p>
                          <button
                            type="button"
                            onClick={() => voteOnListing(item.id, "down", item.rankScore)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700"
                            title="Lower priority"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSaveListing(item.id)}
                            className="mt-1 rounded-lg p-1.5 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700"
                            title="Save listing"
                          >
                            {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => hideListing(item.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                            title="Hide listing"
                          >
                            <EyeOff size={16} />
                          </button>
                        </div>

                        <div className={`min-w-0 flex-1 ${threadMode ? "p-4 sm:p-5" : ""}`}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                              {item.type}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded ${
                                item.verificationStatus === "verified"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : item.verificationStatus === "pending"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.verificationStatus === "verified"
                                ? "Verified"
                                : item.verificationStatus === "pending"
                                ? "Pending"
                                : "Unclaimed"}
                            </span>
                            {item.urgent && (
                              <span className="text-xs bg-red-500 text-white font-semibold px-2 py-1 rounded">
                                URGENT
                              </span>
                            )}
                            <span className={freshClassName}>{freshLabel}</span>
                            {saved && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                                Saved
                              </span>
                            )}
                          </div>

                          <div className="flex items-start gap-3">
                            <ProviderPopup userId={item.provider_id}>
                              <Image
                                src={item.avatar}
                                alt={`${item.title} avatar`}
                                width={46}
                                height={46}
                                onClick={() => setSelectedProvider(item.provider_id)}
                                className="h-11 w-11 rounded-full border border-slate-200 cursor-pointer object-cover hover:scale-105 transition"
                              />
                            </ProviderPopup>
                            <div className="min-w-0 flex-1">
                              <h3 className={`font-semibold text-slate-900 ${threadMode ? "text-base" : "text-lg"}`}>
                                {item.title}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>by {item.creatorName || "Local Provider"}</span>
                                {!!item.businessSlug && (
                                  <button
                                    onClick={() => router.push(`/business/${item.businessSlug}`)}
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-500"
                                  >
                                    Business profile
                                    <ExternalLink size={11} />
                                  </button>
                                )}
                              </div>
                              <p className={`text-slate-500 mt-1 ${threadMode ? "line-clamp-2 text-sm" : "text-sm"}`}>
                                {item.description}
                              </p>
                            </div>
                          </div>

                          {!!item.media?.length && (
                            <div className={`mt-3 grid gap-2 ${threadMode ? "sm:grid-cols-2" : ""}`}>
                              {item.media.slice(0, threadMode ? 1 : 3).map((mediaItem, index) => {
                                if (mediaItem.mimeType.startsWith("image/")) {
                                  return (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      key={`${item.id}-media-${index}`}
                                      src={mediaItem.url}
                                      alt="Post attachment"
                                      className={`w-full rounded-xl border border-slate-200 object-cover ${
                                        threadMode ? "max-h-44" : "max-h-64"
                                      }`}
                                    />
                                  );
                                }
                                if (mediaItem.mimeType.startsWith("video/")) {
                                  return (
                                    <video
                                      key={`${item.id}-media-${index}`}
                                      src={mediaItem.url}
                                      controls
                                      preload="metadata"
                                      className={`w-full rounded-xl border border-slate-200 ${threadMode ? "max-h-52" : "max-h-72"}`}
                                    />
                                  );
                                }
                                if (mediaItem.mimeType.startsWith("audio/")) {
                                  return (
                                    <div
                                      key={`${item.id}-media-${index}`}
                                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                                    >
                                      <audio src={mediaItem.url} controls className="w-full" preload="metadata" />
                                    </div>
                                  );
                                }
                                return null;
                              })}
                              {!threadMode && item.media.length > 3 && (
                                <p className="text-xs text-slate-500">
                                  +{item.media.length - 3} more attachment(s)
                                </p>
                              )}
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={13} />
                              {item.distance} km
                            </span>
                            <span>~{item.responseMinutes} min response</span>
                            <span>{item.profileCompletion}% profile</span>
                            <span className="text-indigo-600">Match {item.rankScore}</span>
                          </div>

                          {listingSignals.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {listingSignals.map((signal) => (
                                <span
                                  key={`${item.id}-${signal}`}
                                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700"
                                >
                                  {signal}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                            <button
                              onClick={() => bookNow(item)}
                              disabled={!item.provider_id}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:brightness-110 transition disabled:opacity-60"
                            >
                              {item.type === "demand" ? "Accept Job" : "Book Now"}
                            </button>
                            <button
                              onClick={() => messageProvider(item.provider_id)}
                              disabled={!item.provider_id}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-60"
                            >
                              {messageLoadingId === item.provider_id ? (
                                "Starting..."
                              ) : (
                                <>
                                  <MessageCircle size={15} />
                                  Chat
                                </>
                              )}
                            </button>
                            {!!item.businessSlug && (
                              <button
                                onClick={() => router.push(`/business/${item.businessSlug}`)}
                                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
                              >
                                Business Page
                              </button>
                            )}
                            {item.price > 0 && (
                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                ₹ {item.price}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!visibleFeed.length && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-8">
                    <h3 className="text-xl font-semibold text-slate-900">No listings match current filters</h3>
                    <p className="text-slate-500 mt-2">
                      Try widening your filters or create a new post/listing to activate this market segment.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setCategory("all");
                          setSortBy("best");
                          setShowTrendingOnly(false);
                          clearAdvancedFilters();
                          setHiddenListingIds(new Set());
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
                      >
                        Reset filters
                      </button>
                      <button
                        onClick={() => setOpenPostModal(true)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
                      >
                        Post a Need
                      </button>
                      <button
                        onClick={() => router.push("/dashboard/provider/add-service")}
                        className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200"
                      >
                        Add Service
                      </button>
                      <button
                        onClick={() => router.push("/dashboard/provider/add-product")}
                        className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200"
                      >
                        Add Product
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-slate-900 font-semibold">
            <CircleDot size={16} />
            Feed Pulse
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Realtime community activity and composition in your current filter context.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Needs</p>
              <p className="text-sm font-semibold text-slate-900">{feedMix.demand}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Services</p>
              <p className="text-sm font-semibold text-slate-900">{feedMix.service}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Products</p>
              <p className="text-sm font-semibold text-slate-900">{feedMix.product}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Need velocity</span>
                <span>{feedMixPercentages.demand}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-rose-500 transition-all duration-700"
                  style={{ width: `${feedMixPercentages.demand}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Service supply</span>
                <span>{feedMixPercentages.service}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                  style={{ width: `${feedMixPercentages.service}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Product lane</span>
                <span>{feedMixPercentages.product}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${feedMixPercentages.product}%` }}
                />
              </div>
            </div>
          </div>
          <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${realtimeStyle.className}`}>
            <span className={`h-2 w-2 rounded-full ${realtimeStyle.dotClassName}`} />
            Stream {realtimeStyle.label.toLowerCase()}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Prioritize top scoring urgent needs to increase conversion while stream quality is high.
          </p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h2 className="flex items-center gap-2 mb-3 text-slate-900 font-semibold">
            <MapPin size={17} />
            Nearby Map
          </h2>

          <div className="h-[15rem] sm:h-60 rounded-xl">
            {mapReady ? (
              <MarketplaceMap
                items={visibleFeed.slice(0, 40).map((item) => ({
                  id: item.id,
                  title: item.title,
                  lat: item.lat,
                  lng: item.lng,
                }))}
                center={
                  viewerCoordinates
                    ? { lat: viewerCoordinates.latitude, lng: viewerCoordinates.longitude }
                    : null
                }
              />
            ) : (
              <div className="h-full rounded-xl border border-slate-200 bg-slate-100 animate-pulse grid place-items-center text-xs text-slate-500">
                Loading map...
              </div>
            )}
          </div>

          {viewerCoordinates && (
            <p className="mt-2 text-[11px] text-slate-500">
              Search center: {viewerCoordinates.latitude.toFixed(3)}, {viewerCoordinates.longitude.toFixed(3)}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200">
              <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                <Users size={12} />
                Providers
              </p>
              <p className="text-sm font-semibold text-slate-900">{dashboardStats.providers}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200">
              <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                <Activity size={12} />
                Urgent
              </p>
              <p className="text-sm font-semibold text-slate-900">{dashboardStats.urgentCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-1">
            Create Post
          </h3>
          <p className="text-xs text-slate-500">
            Launch a demand or offering in under a minute.
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Need something
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
              Offer a service
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Sell a product
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenPostModal(true)}
            className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold py-2.5 rounded-xl hover:brightness-110 transition"
          >
            Continue →
          </button>
        </div>
      </div>
    </div>

    <button
      type="button"
      onClick={() => setOpenPostModal(true)}
      className="market-fab-float fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-indigo-600 to-sky-500 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full text-xl sm:text-2xl shadow-2xl hover:scale-110 transition"
    >
      +
    </button>
    {selectedProvider && (
      <ProviderTrustPanel
        userId={selectedProvider}
        open
        onClose={() => setSelectedProvider(null)}
      />
    )}
    {openPostModal && (
      <CreatePostModal
        open={openPostModal}
        onClose={() => setOpenPostModal(false)}
        onPublished={(result?: PublishPostResult) => {
          void fetchFeed(true);

          if (result?.helpRequestId) {
            setActiveHelpRequestId(result.helpRequestId);
            setHelpRequestMatchedCount(Number(result.matchedCount || 0));
            setHelpRequestQueryParam(result.helpRequestId);
            void loadHelpRequestMatches(result.helpRequestId);
          }
        }}
      />
    )}
  </div>
);
}
