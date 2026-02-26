"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProviderTrustPanel from "@/app/components/ProviderTrustPanel";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BadgeCheck,
  Clock3,
  Filter,
  Gauge,
  Globe2,
  Loader2,
  MapPin,
  MessageCircle,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Target,
  Users,
  Zap,
} from "lucide-react";
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
import { extractPresenceUserIds, GLOBAL_PRESENCE_CHANNEL } from "@/lib/realtime";

type ProfileRow = {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
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

type ServiceRow = {
  provider_id: string;
  category?: string | null;
  price?: number | null;
};

type ProductRow = {
  provider_id: string;
  category?: string | null;
  price?: number | null;
};

type ReviewRow = {
  provider_id: string;
  rating: number;
};

type ProviderOrderStatsRow = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

type ProviderCard = {
  id: string;
  name: string;
  businessSlug: string;
  avatar: string;
  coverImage: string;
  role: string;
  bio: string;
  location: string;
  distanceKm: number;
  rating: number;
  reviews: number;
  verified: boolean;
  online: boolean;
  serviceCount: number;
  productCount: number;
  completedJobs: number;
  openLeads: number;
  responseMinutes: number;
  startingPrice: number;
  tags: string[];
  profileCompletion: number;
  rankScore: number;
  verificationStatus: "verified" | "pending" | "unclaimed";
  latitude: number;
  longitude: number;
};

const TABS = ["All", "Nearby", "Active Now", "Verified"] as const;
const DEFAULT_RADIUS_KM = 5;
const RADIUS_OPTIONS = [1, 5, 10, 15, 25];
const SORT_OPTIONS = ["Best Match", "Nearest", "Top Rated", "Most Listings", "Fast Response"] as const;
const FAST_RESPONSE_THRESHOLD_MINUTES = 15;
const PEOPLE_PREFERENCES_STORAGE_KEY = "local-marketplace-people-preferences-v1";
const GEO_LOOKUP_TIMEOUT_MS = 1200;

const demoPeople: ProviderCard[] = [
  {
    id: "demo-1",
    name: "Test Electrician",
    businessSlug: "test-electrician-demo-1",
    avatar: "https://i.pravatar.cc/200?img=12",
    coverImage: "https://picsum.photos/seed/electrician-cover/900/420",
    role: "Electrician",
    bio: "Home electrical repair and emergency support.",
    location: "Nearby",
    distanceKm: 1.2,
    rating: 4.8,
    reviews: 22,
    verified: true,
    online: true,
    serviceCount: 4,
    productCount: 0,
    completedJobs: 48,
    openLeads: 3,
    responseMinutes: 6,
    startingPrice: 299,
    tags: ["Electrician", "Repair", "Urgent"],
    profileCompletion: 88,
    rankScore: 91,
    verificationStatus: "verified",
    latitude: 12.9726,
    longitude: 77.6003,
  },
  {
    id: "demo-2",
    name: "Test Cleaning Team",
    businessSlug: "test-cleaning-team-demo-2",
    avatar: "https://i.pravatar.cc/200?img=32",
    coverImage: "https://picsum.photos/seed/cleaning-cover/900/420",
    role: "Cleaning Service",
    bio: "Residential deep cleaning and move-in cleaning.",
    location: "West Side",
    distanceKm: 2.7,
    rating: 4.6,
    reviews: 14,
    verified: true,
    online: true,
    serviceCount: 3,
    productCount: 0,
    completedJobs: 36,
    openLeads: 2,
    responseMinutes: 11,
    startingPrice: 399,
    tags: ["Cleaning", "Home", "Office"],
    profileCompletion: 82,
    rankScore: 84,
    verificationStatus: "verified",
    latitude: 12.9681,
    longitude: 77.6124,
  },
  {
    id: "demo-3",
    name: "Test Plumbing Pro",
    businessSlug: "test-plumbing-pro-demo-3",
    avatar: "https://i.pravatar.cc/200?img=19",
    coverImage: "https://picsum.photos/seed/plumbing-cover/900/420",
    role: "Plumber",
    bio: "Leakage, fittings, bathroom pipeline and kitchen sink fixes.",
    location: "East End",
    distanceKm: 3.1,
    rating: 4.9,
    reviews: 31,
    verified: true,
    online: true,
    serviceCount: 5,
    productCount: 1,
    completedJobs: 72,
    openLeads: 4,
    responseMinutes: 5,
    startingPrice: 349,
    tags: ["Plumbing", "Fittings", "Emergency"],
    profileCompletion: 92,
    rankScore: 95,
    verificationStatus: "verified",
    latitude: 12.9789,
    longitude: 77.5886,
  },
];

const hashNumber = (seed: string, min: number, max: number) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 10000;
  }
  return min + (hash % (max - min + 1));
};

const formatSyncTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);

const describeMatchReason = (person: ProviderCard, online: boolean) => {
  const reasons: string[] = [];
  if (online) reasons.push("Online now");
  if (person.distanceKm <= 2) reasons.push(`${person.distanceKm} km away`);
  if (person.responseMinutes <= FAST_RESPONSE_THRESHOLD_MINUTES) {
    reasons.push(`${person.responseMinutes} min response`);
  }
  if (person.rating >= 4.7 && person.reviews >= 3) reasons.push(`${person.rating}★ trusted`);
  if (person.verified) reasons.push("Verified business");
  if (person.completedJobs >= 40) reasons.push(`${person.completedJobs}+ jobs done`);
  return reasons.slice(0, 3);
};

export default function PeoplePage() {
  const router = useRouter();
  const reloadTimerRef = useRef<number | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("Best Match");
  const [minRating, setMinRating] = useState<number>(0);
  const [maxResponseMinutes, setMaxResponseMinutes] = useState<number>(0);
  const [minProfileCompletion, setMinProfileCompletion] = useState<number>(0);
  const [requireReviews, setRequireReviews] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [instantOnly, setInstantOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [viewerCoordinates, setViewerCoordinates] = useState<Coordinates | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(PEOPLE_PREFERENCES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        search?: string;
        activeTab?: (typeof TABS)[number];
        radiusKm?: number;
        sortBy?: (typeof SORT_OPTIONS)[number];
        minRating?: number;
        maxResponseMinutes?: number;
        minProfileCompletion?: number;
        requireReviews?: boolean;
        verifiedOnly?: boolean;
        instantOnly?: boolean;
        showAdvancedFilters?: boolean;
      };

      if (typeof parsed.search === "string") setSearch(parsed.search);
      if (TABS.includes((parsed.activeTab as (typeof TABS)[number]) || "All")) {
        setActiveTab((parsed.activeTab as (typeof TABS)[number]) || "All");
      }
      if (Number.isFinite(parsed.radiusKm) && RADIUS_OPTIONS.includes(Number(parsed.radiusKm))) {
        setRadiusKm(Number(parsed.radiusKm));
      }
      if (SORT_OPTIONS.includes((parsed.sortBy as (typeof SORT_OPTIONS)[number]) || "Best Match")) {
        setSortBy((parsed.sortBy as (typeof SORT_OPTIONS)[number]) || "Best Match");
      }
      if (Number.isFinite(parsed.minRating)) setMinRating(Math.max(0, Number(parsed.minRating)));
      if (Number.isFinite(parsed.maxResponseMinutes)) {
        setMaxResponseMinutes(Math.max(0, Number(parsed.maxResponseMinutes)));
      }
      if (Number.isFinite(parsed.minProfileCompletion)) {
        setMinProfileCompletion(Math.max(0, Math.min(100, Number(parsed.minProfileCompletion))));
      }
      if (typeof parsed.requireReviews === "boolean") setRequireReviews(parsed.requireReviews);
      if (typeof parsed.verifiedOnly === "boolean") setVerifiedOnly(parsed.verifiedOnly);
      if (typeof parsed.instantOnly === "boolean") setInstantOnly(parsed.instantOnly);
      if (typeof parsed.showAdvancedFilters === "boolean") setShowAdvancedFilters(parsed.showAdvancedFilters);
    } catch {
      window.localStorage.removeItem(PEOPLE_PREFERENCES_STORAGE_KEY);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (typeof window === "undefined") return;

    const payload = {
      search,
      activeTab,
      radiusKm,
      sortBy,
      minRating,
      maxResponseMinutes,
      minProfileCompletion,
      requireReviews,
      verifiedOnly,
      instantOnly,
      showAdvancedFilters,
    };

    window.localStorage.setItem(PEOPLE_PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
  }, [
    activeTab,
    instantOnly,
    maxResponseMinutes,
    minProfileCompletion,
    minRating,
    radiusKm,
    requireReviews,
    search,
    showAdvancedFilters,
    sortBy,
    verifiedOnly,
  ]);

  const loadProviders = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    if (soft) setSyncing(true);
    setErrorMessage("");

    const browserCoordinatesPromise = getBrowserCoordinates(GEO_LOOKUP_TIMEOUT_MS);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      setProviders(demoPeople);
      setUsingDemo(true);
      setLoading(false);
      setSyncing(false);
      setErrorMessage(`Auth error: ${authError.message}`);
      return;
    }

    setCurrentUserId(user?.id || null);

    const [{ data: services, error: servicesError }, { data: products, error: productsError }] = await Promise.all([
      supabase.from("service_listings").select("provider_id,category,price"),
      supabase.from("product_catalog").select("provider_id,category,price"),
    ]);

    if (servicesError || productsError) {
      setProviders(demoPeople);
      setUsingDemo(true);
      setLoading(false);
      setSyncing(false);
      setErrorMessage(
        `Could not load provider listings: ${servicesError?.message || productsError?.message || "unknown error"}`
      );
      return;
    }

    const serviceRows = (services as ServiceRow[] | null) || [];
    const productRows = (products as ProductRow[] | null) || [];
    const providerIdsFromListings = Array.from(
      new Set(
        [...serviceRows.map((row) => row.provider_id), ...productRows.map((row) => row.provider_id)].filter(
          (id): id is string => Boolean(id)
        )
      )
    );
    const profileIdsToLoad = Array.from(
      new Set([...(user?.id ? [user.id] : []), ...providerIdsFromListings])
    );

    const [{ data: profiles, error: profilesError }, { data: reviews, error: reviewsError }] = await Promise.all([
      profileIdsToLoad.length
        ? supabase
            .from("profiles")
            .select("*")
            .in("id", profileIdsToLoad)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
      providerIdsFromListings.length
        ? supabase.from("reviews").select("provider_id,rating").in("provider_id", providerIdsFromListings)
        : Promise.resolve({ data: [] as ReviewRow[], error: null }),
    ]);

    if (profilesError) {
      setProviders(demoPeople);
      setUsingDemo(true);
      setLoading(false);
      setSyncing(false);
      setErrorMessage(`Could not load providers: ${profilesError?.message || "unknown error"}`);
      return;
    }

    if (reviewsError) {
      console.warn("Could not load provider reviews:", reviewsError.message);
    }

    const reviewRows = reviewsError ? [] : (reviews as ReviewRow[] | null) || [];
    const profileRows = (profiles as ProfileRow[] | null) || [];
    const currentUserProfile = profileRows.find((profile) => profile.id === user?.id) || null;
    const profileCoordinates = currentUserProfile
      ? resolveCoordinates({
          row: currentUserProfile as unknown as Record<string, unknown>,
          location: currentUserProfile.location,
          seed: currentUserProfile.id,
        })
      : null;
    const browserCoordinates = await browserCoordinatesPromise;
    const effectiveViewerCoordinates = browserCoordinates || profileCoordinates || defaultMarketCoordinates();
    setViewerCoordinates(effectiveViewerCoordinates);

    const serviceCountMap = new Map<string, number>();
    const productCountMap = new Map<string, number>();
    const tagMap = new Map<string, Set<string>>();
    const ratingMap = new Map<string, { sum: number; count: number }>();
    const providerPriceMap = new Map<string, number[]>();

    serviceRows.forEach((row) => {
      serviceCountMap.set(row.provider_id, (serviceCountMap.get(row.provider_id) || 0) + 1);
      if (!tagMap.has(row.provider_id)) tagMap.set(row.provider_id, new Set());
      if (row.category) tagMap.get(row.provider_id)?.add(row.category);
      if (Number.isFinite(Number(row.price))) {
        const existing = providerPriceMap.get(row.provider_id) || [];
        providerPriceMap.set(row.provider_id, [...existing, Number(row.price)]);
      }
    });

    productRows.forEach((row) => {
      productCountMap.set(row.provider_id, (productCountMap.get(row.provider_id) || 0) + 1);
      if (!tagMap.has(row.provider_id)) tagMap.set(row.provider_id, new Set());
      if (row.category) tagMap.get(row.provider_id)?.add(row.category);
      if (Number.isFinite(Number(row.price))) {
        const existing = providerPriceMap.get(row.provider_id) || [];
        providerPriceMap.set(row.provider_id, [...existing, Number(row.price)]);
      }
    });

    reviewRows.forEach((row) => {
      const previous = ratingMap.get(row.provider_id) || { sum: 0, count: 0 };
      ratingMap.set(row.provider_id, {
        sum: previous.sum + (row.rating || 0),
        count: previous.count + 1,
      });
    });

    const providerIds = profileRows
      .filter((profile) => profile.id !== user?.id)
      .filter((profile) => {
        const servicesCount = serviceCountMap.get(profile.id) || 0;
        const productsCount = productCountMap.get(profile.id) || 0;
        return servicesCount + productsCount > 0;
      })
      .map((profile) => profile.id);

    const { data: providerOrderStatsRows, error: providerOrderStatsError } = providerIds.length
      ? await supabase.rpc("get_provider_order_stats", { provider_ids: providerIds })
      : { data: [] as ProviderOrderStatsRow[], error: null };

    if (providerOrderStatsError) {
      console.warn("Unable to load provider order stats:", providerOrderStatsError.message);
    }

    const completedJobsMap = new Map<string, number>();
    const openLeadsMap = new Map<string, number>();

    ((providerOrderStatsRows as ProviderOrderStatsRow[] | null) || []).forEach((row) => {
      completedJobsMap.set(row.provider_id, Number(row.completed_jobs || 0));
      openLeadsMap.set(row.provider_id, Number(row.open_leads || 0));
    });

    const cards: ProviderCard[] = profileRows
      .filter((profile) => profile.id !== user?.id)
      .filter((profile) => {
        const servicesCount = serviceCountMap.get(profile.id) || 0;
        const productsCount = productCountMap.get(profile.id) || 0;
        return servicesCount + productsCount > 0;
      })
      .map((profile) => {
        const servicesCount = serviceCountMap.get(profile.id) || 0;
        const productsCount = productCountMap.get(profile.id) || 0;
        const ratings = ratingMap.get(profile.id);
        const reviewCount = ratings?.count || 0;
        const avgRating = reviewCount > 0 ? Number((ratings!.sum / reviewCount).toFixed(1)) : 4.5;
        const providerCoordinates = resolveCoordinates({
          row: profile as unknown as Record<string, unknown>,
          location: profile.location,
          seed: profile.id,
        });
        const distanceKm = distanceBetweenCoordinatesKm(effectiveViewerCoordinates, providerCoordinates);
        const responseMinutes = estimateResponseMinutes({
          availability: profile.availability,
          providerId: profile.id,
        });
        const profileCompletion = calculateProfileCompletion({
          name: profile.name,
          location: profile.location,
          bio: profile.bio,
          services: profile.services,
          email: profile.email,
          phone: profile.phone,
          website: profile.website,
        });
        const verificationStatus = calculateVerificationStatus({
          role: profile.role,
          profileCompletion,
          listingsCount: servicesCount + productsCount,
          averageRating: avgRating,
          reviewCount,
        });
        const rankScore = calculateLocalRankScore({
          distanceKm,
          responseMinutes,
          rating: avgRating,
          profileCompletion,
        });

        const prices = providerPriceMap.get(profile.id) || [];
        const startingPrice = prices.length
          ? Math.max(1, Math.min(...prices.map((value) => Math.floor(value))))
          : hashNumber(profile.id, 199, 1499);

        return {
          id: profile.id,
          name: profile.name || "Local Provider",
          businessSlug: createBusinessSlug(profile.name, profile.id),
          avatar: profile.avatar_url || `https://i.pravatar.cc/200?u=${profile.id}`,
          coverImage: `https://picsum.photos/seed/provider-${profile.id}/900/420`,
          role: profile.role || "Service Provider",
          bio: profile.bio || "Trusted neighborhood provider.",
          location: profile.location || "Nearby",
          distanceKm,
          rating: avgRating,
          reviews: reviewCount,
          verified: verificationStatus === "verified",
          online: (profile.availability || "").toLowerCase() !== "offline",
          serviceCount: servicesCount,
          productCount: productsCount,
          completedJobs: completedJobsMap.get(profile.id) ?? hashNumber(`done-${profile.id}`, 8, 140),
          openLeads: openLeadsMap.get(profile.id) ?? hashNumber(`open-${profile.id}`, 1, 6),
          responseMinutes,
          startingPrice,
          tags: Array.from(tagMap.get(profile.id) || []),
          profileCompletion,
          rankScore,
          verificationStatus,
          latitude: providerCoordinates.latitude,
          longitude: providerCoordinates.longitude,
        };
      });

    if (cards.length === 0) {
      setProviders(demoPeople);
      setUsingDemo(true);
    } else {
      setProviders(cards);
      setUsingDemo(false);
    }

    setLastSyncedAt(new Date().toISOString());
    setLoading(false);
    setSyncing(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    if (!currentUserId) return;

    const presenceChannel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    presenceChannelRef.current = presenceChannel;

    const syncOnlineUsers = () => {
      setOnlineUserIds(extractPresenceUserIds(presenceChannel.presenceState()));
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .on("presence", { event: "join" }, syncOnlineUsers)
      .on("presence", { event: "leave" }, syncOnlineUsers)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;
        await presenceChannel.track({
          user_id: currentUserId,
          page: "people",
          last_seen_at: new Date().toISOString(),
        });
      });

    const heartbeatTimer = window.setInterval(() => {
      void presenceChannel.track({
        user_id: currentUserId,
        page: "people",
        last_seen_at: new Date().toISOString(),
      });
    }, 30000);

    return () => {
      window.clearInterval(heartbeatTimer);
      if (presenceChannelRef.current) {
        void presenceChannelRef.current.untrack();
        supabase.removeChannel(presenceChannelRef.current);
        presenceChannelRef.current = null;
      }
      setOnlineUserIds(new Set());
    };
  }, [currentUserId]);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      reloadTimerRef.current = window.setTimeout(() => {
        void loadProviders(true);
      }, 250);
    };

    const channel = supabase
      .channel("people-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [loadProviders]);

  const isProviderOnline = useCallback(
    (provider: ProviderCard) => onlineUserIds.has(provider.id) || provider.online,
    [onlineUserIds]
  );

  const filteredProviders = useMemo(() => {
    const query = search.toLowerCase().trim();

    const filtered = providers
      .filter((person) => {
        if (!query) return true;
        return `${person.name} ${person.role} ${person.bio} ${person.location} ${person.tags.join(" ")}`
          .toLowerCase()
          .includes(query);
      })
      .filter((person) => person.distanceKm <= radiusKm)
      .filter((person) => person.rating >= minRating)
      .filter((person) => (maxResponseMinutes > 0 ? person.responseMinutes <= maxResponseMinutes : true))
      .filter((person) => person.profileCompletion >= minProfileCompletion)
      .filter((person) => (requireReviews ? person.reviews > 0 : true))
      .filter((person) => (verifiedOnly ? person.verified : true))
      .filter((person) => (instantOnly ? isProviderOnline(person) && person.responseMinutes <= FAST_RESPONSE_THRESHOLD_MINUTES : true))
      .filter((person) => {
        if (activeTab === "All") return true;
        if (activeTab === "Nearby") return person.distanceKm <= 1;
        if (activeTab === "Active Now") return isProviderOnline(person);
        if (activeTab === "Verified") return person.verified;
        return true;
      });

    if (sortBy === "Best Match") {
      filtered.sort((a, b) => b.rankScore - a.rankScore || a.distanceKm - b.distanceKm);
    } else if (sortBy === "Top Rated") {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "Most Listings") {
      filtered.sort((a, b) => b.serviceCount + b.productCount - (a.serviceCount + a.productCount));
    } else if (sortBy === "Fast Response") {
      filtered.sort((a, b) => a.responseMinutes - b.responseMinutes);
    } else {
      filtered.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    return filtered;
  }, [
    activeTab,
    instantOnly,
    isProviderOnline,
    maxResponseMinutes,
    minProfileCompletion,
    minRating,
    providers,
    radiusKm,
    requireReviews,
    search,
    sortBy,
    verifiedOnly,
  ]);

  const startChat = async (providerId: string) => {
    if (!currentUserId) {
      alert("Login required");
      return;
    }

    if (providerId.startsWith("demo-")) {
      router.push("/dashboard");
      return;
    }

    if (providerId === currentUserId) {
      alert("This is your own profile.");
      return;
    }

    setLoadingChatId(providerId);

    const { data: myRows } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", currentUserId);

    const myConversationIds = myRows?.map((row) => row.conversation_id) || [];
    let targetConversationId: string | null = null;

    if (myConversationIds.length > 0) {
      const { data: existing } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .in("conversation_id", myConversationIds)
        .eq("user_id", providerId)
        .limit(1)
        .maybeSingle();

      targetConversationId = existing?.conversation_id || null;
    }

    if (!targetConversationId) {
      const { data: conversation, error } = await supabase
        .from("conversations")
        .insert({ created_by: currentUserId })
        .select("id")
        .single();

      if (error || !conversation) {
        setLoadingChatId(null);
        alert(`Unable to start chat. ${error?.message || ""}`.trim());
        return;
      }

      targetConversationId = conversation.id;
      const { error: participantError } = await supabase.from("conversation_participants").upsert([
        { conversation_id: targetConversationId, user_id: currentUserId },
        { conversation_id: targetConversationId, user_id: providerId },
      ], {
        onConflict: "conversation_id,user_id",
        ignoreDuplicates: true,
      });

      if (participantError) {
        setLoadingChatId(null);
        alert(`Unable to start chat. ${participantError.message}`);
        return;
      }
    }

    setLoadingChatId(null);
    router.push(`/dashboard/chat?open=${targetConversationId}`);
  };

  const peopleNearby = providers.filter((provider) => provider.distanceKm <= 5).length;
  const activeNow = providers.filter((provider) => isProviderOnline(provider)).length;
  const verifiedCount = providers.filter((provider) => provider.verified).length;
  const fastResponders = providers.filter(
    (provider) => provider.responseMinutes <= FAST_RESPONSE_THRESHOLD_MINUTES
  ).length;
  const totalListings = providers.reduce((sum, provider) => sum + provider.serviceCount + provider.productCount, 0);
  const totalOpenLeads = providers.reduce((sum, provider) => sum + provider.openLeads, 0);
  const averageResponse = providers.length
    ? Math.round(providers.reduce((sum, provider) => sum + provider.responseMinutes, 0) / providers.length)
    : 0;
  const activeCoverage = providers.length ? Math.round((activeNow / providers.length) * 100) : 0;
  const verifiedLiveCount = providers.filter((provider) => provider.verified && isProviderOnline(provider)).length;
  const avgRating = providers.length
    ? (providers.reduce((sum, provider) => sum + provider.rating, 0) / providers.length).toFixed(1)
    : "0.0";
  const networkPulseLabel =
    activeCoverage >= 65 ? "High network activity" : activeCoverage >= 35 ? "Moderate network activity" : "Low network activity";
  const activeFilterCount =
    Number(minRating > 0) +
    Number(maxResponseMinutes > 0) +
    Number(minProfileCompletion > 0) +
    Number(requireReviews) +
    Number(verifiedOnly) +
    Number(instantOnly);

  const topSpecialties = useMemo(() => {
    const counts = new Map<string, number>();
    providers.forEach((provider) => {
      provider.tags.forEach((tag) => {
        const normalized = tag.trim();
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));
  }, [providers]);

  const clearAdvancedFilters = () => {
    setMinRating(0);
    setMaxResponseMinutes(0);
    setMinProfileCompletion(0);
    setRequireReviews(false);
    setVerifiedOnly(false);
    setInstantOnly(false);
  };
  const resetAllFilters = () => {
    setSearch("");
    setActiveTab("All");
    setRadiusKm(DEFAULT_RADIUS_KM);
    setSortBy("Best Match");
    setShowAdvancedFilters(false);
    clearAdvancedFilters();
  };
  const featuredProviders = [...filteredProviders].sort((a, b) => b.rankScore - a.rankScore).slice(0, 3);
  const liveProviders = filteredProviders.filter((provider) => isProviderOnline(provider)).slice(0, 8);

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-5 sm:space-y-6 lg:space-y-7">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-900 to-cyan-900 p-5 text-white shadow-2xl sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.24),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.28),transparent_44%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:34px_34px]" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
                {syncing ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
                {syncing ? "Syncing live network..." : networkPulseLabel}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-[34px]">People Network</h1>
                <p className="mt-1.5 max-w-2xl text-sm text-white/80 sm:text-base">
                  Discover, verify, and connect with trusted providers in a realtime local graph.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/85">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1">
                  <Globe2 size={12} />
                  {providers.length} providers indexed
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1">
                  <Radar size={12} />
                  {activeCoverage}% active coverage
                </span>
                {!!lastSyncedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1">
                    <RefreshCw size={12} />
                    synced {formatSyncTime(lastSyncedAt)}
                  </span>
                )}
                {viewerCoordinates && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-1">
                    <MapPin size={12} />
                    center {viewerCoordinates.latitude.toFixed(2)}, {viewerCoordinates.longitude.toFixed(2)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void loadProviders(true)}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard/tasks")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Go To Tasks
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard icon={MapPin} label="Nearby" value={peopleNearby} helper="within 5 km" />
            <MetricCard icon={Activity} label="Active Now" value={activeNow} helper={`${activeCoverage}% coverage`} />
            <MetricCard icon={Star} label="Avg Rating" value={`${avgRating}★`} helper={`${verifiedCount} verified`} />
            <MetricCard icon={Zap} label="Fast Response" value={fastResponders} helper={`~${averageResponse || "--"} min avg`} />
            <MetricCard icon={BarChart3} label="Open Leads" value={formatCompactNumber(totalOpenLeads)} helper={`${totalListings} listings`} />
            <MetricCard icon={ShieldCheck} label="Verified Live" value={verifiedLiveCount} helper="trusted + online" />
          </div>

          {!!topSpecialties.length && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Top specialties in network</p>
              <div className="flex flex-wrap gap-2">
                {topSpecialties.map((item) => (
                  <span
                    key={`specialty-${item.tag}`}
                    className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs"
                  >
                    {item.tag}
                    <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold">{item.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {!!errorMessage && !usingDemo && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      )}

      {usingDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Showing demo people because no provider listings were found in DB yet.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
            <Search size={16} className="text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, skill, bio, location..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={String(radiusKm)}
              onChange={(event) => setRadiusKm(Number(event.target.value))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
            >
              {RADIUS_OPTIONS.map((radius) => (
                <option key={radius} value={radius}>
                  {radius} km
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as (typeof SORT_OPTIONS)[number])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Filter size={12} />
            {filteredProviders.length} matches
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Gauge size={12} />
            sorted by {sortBy}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
            <Target size={12} />
            {activeTab}
          </span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAdvancedFilters}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700 transition hover:bg-slate-100"
            >
              <RotateCcw size={12} />
              clear advanced
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-slate-600">
                Minimum rating
                <select
                  value={String(minRating)}
                  onChange={(event) => setMinRating(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="0">Any rating</option>
                  <option value="4">4.0+</option>
                  <option value="4.5">4.5+</option>
                  <option value="4.8">4.8+</option>
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Max response time
                <select
                  value={String(maxResponseMinutes)}
                  onChange={(event) => setMaxResponseMinutes(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="0">Any response time</option>
                  <option value="15">15 min or less</option>
                  <option value="30">30 min or less</option>
                  <option value="60">60 min or less</option>
                </select>
              </label>

              <label className="text-xs text-slate-600">
                Minimum profile completion
                <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={minProfileCompletion}
                    onChange={(event) => setMinProfileCompletion(Number(event.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="mt-1 text-[11px] text-slate-500">At least {minProfileCompletion}% complete</div>
                </div>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRequireReviews((value) => !value)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  requireReviews
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {requireReviews ? "Reviews required" : "Allow unrated"}
              </button>
              <button
                type="button"
                onClick={() => setVerifiedOnly((value) => !value)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  verifiedOnly
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={12} />
                  Verified only
                </span>
              </button>
              <button
                type="button"
                onClick={() => setInstantOnly((value) => !value)}
                className={`rounded-full border px-3 py-1.5 transition ${
                  instantOnly
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <Zap size={12} />
                  Online + fast response
                </span>
              </button>
            </div>
          </div>
        )}
      </section>

      {!!featuredProviders.length && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Top matches right now</h2>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Sparkles size={12} />
              Ranked by local score
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {featuredProviders.map((person) => {
              const isOnline = isProviderOnline(person);
              return (
                <button
                  key={`featured-${person.id}`}
                  onClick={() => setSelectedProvider(person.id)}
                  className="relative overflow-hidden rounded-xl border border-slate-200 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <Image
                    src={person.coverImage}
                    alt={person.name}
                    width={900}
                    height={420}
                    className="h-32 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/25 to-transparent" />
                  <div className="absolute bottom-0 w-full p-3 text-white">
                    <p className="truncate text-sm font-semibold">{person.name}</p>
                    <p className="truncate text-xs text-white/80">{person.role}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/85">
                      <span>Match {person.rankScore}</span>
                      <span>•</span>
                      <span>{person.distanceKm} km</span>
                      {isOnline && <span className="text-emerald-300">• live</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {!!liveProviders.length && (
        <section className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
              Live providers now
            </p>
            <span className="text-xs text-slate-600">{liveProviders.length} active in current filters</span>
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {liveProviders.map((provider) => (
              <button
                key={`live-${provider.id}`}
                type="button"
                onClick={() => setSelectedProvider(provider.id)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-700 transition hover:bg-emerald-50"
              >
                <Image
                  src={provider.avatar}
                  alt={provider.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 rounded-full object-cover"
                />
                <span className="font-medium">{provider.name}</span>
                <span className="text-[11px] text-slate-500">{provider.responseMinutes}m</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
              <div className="mt-3 h-5 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading nearby providers...
          </div>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredProviders.map((person) => {
            const isOnline = isProviderOnline(person);
            const matchReasons = describeMatchReason(person, isOnline);
            return (
              <article
                key={person.id}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative">
                  <Image
                    src={person.coverImage}
                    alt={`${person.name} cover`}
                    width={900}
                    height={420}
                    className="h-32 w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
                  <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
                    {person.distanceKm} km away
                  </span>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <button onClick={() => setSelectedProvider(person.id)} className="shrink-0">
                      <Image
                        src={person.avatar}
                        alt={person.name}
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">{person.name}</h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            person.verificationStatus === "verified"
                              ? "bg-emerald-100 text-emerald-700"
                              : person.verificationStatus === "pending"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <BadgeCheck size={11} />
                          {person.verificationStatus === "verified"
                            ? "Verified"
                            : person.verificationStatus === "pending"
                            ? "Pending"
                            : "Unclaimed"}
                        </span>
                        {isOnline && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Live</span>}
                      </div>
                      <p className="text-sm text-slate-500">{person.role}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{person.bio}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-4">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {person.location}
                    </span>
                    <span>{person.serviceCount + person.productCount} listings</span>
                    <span>{person.openLeads} open leads</span>
                    <span>{person.completedJobs} jobs done</span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 size={12} />
                        response {person.responseMinutes} min
                      </span>
                      <span>profile {person.profileCompletion}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
                        style={{ width: `${Math.max(8, Math.min(100, person.profileCompletion))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">from INR {person.startingPrice}</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700">Match {person.rankScore}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700 inline-flex items-center gap-1">
                      <Star size={11} className="fill-amber-500 text-amber-500" />
                      {person.rating} ({person.reviews})
                    </span>
                  </div>

                  {!!matchReasons.length && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {matchReasons.map((reason) => (
                        <span
                          key={`${person.id}-${reason}`}
                          className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-medium text-cyan-700"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}

                  {person.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {person.tags.slice(0, 4).map((tag) => (
                        <span
                          key={`${person.id}-${tag}`}
                          className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void startChat(person.id)}
                      disabled={loadingChatId === person.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                    >
                      <MessageCircle size={14} />
                      {loadingChatId === person.id ? "Opening..." : "Chat"}
                    </button>
                    <button
                      onClick={() => setSelectedProvider(person.id)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
                    >
                      View Profile
                    </button>
                    {!usingDemo && (
                      <button
                        onClick={() => router.push(`/business/${person.businessSlug}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Business Page
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {!filteredProviders.length && (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <Users className="mx-auto mb-3 text-slate-400" />
              <p className="text-base font-semibold text-slate-800">No providers found for current filters.</p>
              <p className="mt-1 text-sm text-slate-500">Try widening radius, changing tab, or resetting filters.</p>
              <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                >
                  Reset all filters
                </button>
                <button
                  type="button"
                  onClick={() => void loadProviders(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  Sync providers
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <ProviderTrustPanel
        userId={selectedProvider || ""}
        open={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-white/75">{label}</p>
        <Icon size={14} className="text-white/80" />
      </div>
      <p className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[11px] text-white/65">{helper}</p>
    </div>
  );
}
