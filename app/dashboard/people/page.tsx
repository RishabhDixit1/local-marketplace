"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProviderTrustPanel from "@/app/components/ProviderTrustPanel";
import {
  BadgeCheck,
  Clock3,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Users,
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
const RADIUS_OPTIONS = [1, 5, 10, 15];
const SORT_OPTIONS = ["Best Match", "Nearest", "Top Rated", "Most Listings", "Fast Response"] as const;

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
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("Best Match");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [viewerCoordinates, setViewerCoordinates] = useState<Coordinates | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const loadProviders = useCallback(async (soft = false) => {
    if (!soft) setLoading(true);
    if (soft) setSyncing(true);
    setErrorMessage("");

    const browserCoordinatesPromise = getBrowserCoordinates(4500);

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

    const [{ data: profiles, error: profilesError }, { data: services }, { data: products }, { data: reviews }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,name,avatar_url,role,bio,location,availability,services,email,phone,website,latitude,longitude"),
        supabase.from("service_listings").select("provider_id,category,price"),
        supabase.from("product_catalog").select("provider_id,category,price"),
        supabase.from("reviews").select("provider_id,rating"),
      ]);

    if (profilesError || !profiles) {
      setProviders(demoPeople);
      setUsingDemo(true);
      setLoading(false);
      setSyncing(false);
      setErrorMessage(`Could not load providers: ${profilesError?.message || "unknown error"}`);
      return;
    }

    const serviceRows = (services as ServiceRow[] | null) || [];
    const productRows = (products as ProductRow[] | null) || [];
    const reviewRows = (reviews as ReviewRow[] | null) || [];
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
      .filter((person) => {
        if (activeTab === "All") return true;
        if (activeTab === "Nearby") return person.distanceKm <= 1;
        if (activeTab === "Active Now") return onlineUserIds.has(person.id) || person.online;
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
  }, [activeTab, onlineUserIds, providers, radiusKm, search, sortBy]);

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
  const activeNow = providers.filter((provider) => onlineUserIds.has(provider.id) || provider.online).length;
  const avgRating = providers.length
    ? (providers.reduce((sum, provider) => sum + provider.rating, 0) / providers.length).toFixed(1)
    : "0.0";
  const featuredProviders = [...filteredProviders].sort((a, b) => b.rankScore - a.rankScore).slice(0, 3);

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-5 sm:space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 p-4 sm:p-6 text-white shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">People Near You</h1>
            <p className="mt-1 text-white/85">Search, compare, and contact nearby providers quickly.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs rounded-full border border-white/30 bg-white/15 px-3 py-1.5">
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {syncing ? "Syncing live changes..." : `Last sync ${lastSyncedAt ? formatSyncTime(lastSyncedAt) : "--"}`}
            {!syncing && viewerCoordinates && (
              <span className="hidden sm:inline text-[10px] text-white/80">
                center {viewerCoordinates.latitude.toFixed(3)}, {viewerCoordinates.longitude.toFixed(3)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="font-semibold text-lg">{peopleNearby}</p>
            <p className="text-white/70">People Nearby</p>
          </div>
          <div>
            <p className="font-semibold text-lg">{activeNow}</p>
            <p className="text-white/70">Active Now</p>
          </div>
          <div>
            <p className="font-semibold text-lg">{avgRating} ★</p>
            <p className="text-white/70">Avg Rating</p>
          </div>
        </div>
      </div>

      {!!errorMessage && !usingDemo && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      )}

      {!!featuredProviders.length && (
        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">Featured Providers</h2>
            <span className="text-xs text-slate-500 inline-flex items-center gap-1">
              <Sparkles size={12} /> Top matches
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {featuredProviders.map((person) => (
              <button
                key={`featured-${person.id}`}
                onClick={() => setSelectedProvider(person.id)}
                className="relative overflow-hidden rounded-xl border border-slate-200 bg-white text-left"
              >
                <Image
                  src={person.coverImage}
                  alt={person.name}
                  width={900}
                  height={420}
                  className="h-28 w-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 w-full p-3">
                  <p className="text-sm font-semibold text-white truncate">{person.name}</p>
                  <p className="text-xs text-slate-200 truncate">{person.role}</p>
                  <p className="text-[11px] text-emerald-300 mt-1">Match score {person.rankScore}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {usingDemo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Showing demo people because no provider listings were found in DB yet.
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-white border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus-within:ring-2 focus-within:ring-purple-600">
          <Search size={16} className="text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, skill, bio, location..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-slate-500"
          />
        </div>

        <select
          value={String(radiusKm)}
          onChange={(event) => setRadiusKm(Number(event.target.value))}
          className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none w-full sm:w-auto"
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
          className="rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none w-full sm:w-auto"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm transition ${
              activeTab === tab
                ? "bg-purple-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-purple-600 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 text-slate-500 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading nearby providers...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredProviders.map((person) => {
            const isOnline = onlineUserIds.has(person.id) || person.online;
            return (
              <div key={person.id} className="rounded-xl bg-white p-4 shadow border border-slate-200">
              <Image
                src={person.coverImage}
                alt={`${person.name} cover`}
                width={900}
                height={420}
                className="mb-3 h-28 w-full rounded-lg object-cover"
              />
              <div className="flex items-start gap-3 sm:gap-4">
                <button onClick={() => setSelectedProvider(person.id)} className="shrink-0">
                  <Image
                    src={person.avatar}
                    alt={person.name}
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-full object-cover border border-slate-200"
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900 truncate">
                      {person.name}
                      <span
                        className={`ml-2 inline-flex items-center gap-1 text-xs ${
                          person.verificationStatus === "verified"
                            ? "text-emerald-600"
                            : person.verificationStatus === "pending"
                            ? "text-amber-600"
                            : "text-slate-500"
                        }`}
                      >
                        <BadgeCheck size={12} />
                        {person.verificationStatus === "verified"
                          ? "Verified"
                          : person.verificationStatus === "pending"
                          ? "Pending"
                          : "Unclaimed"}
                      </span>
                      {isOnline && <span className="ml-2 text-emerald-600 text-xs">● Online</span>}
                    </h3>
                    <span className="text-xs text-slate-500 shrink-0">{person.distanceKm} km away</span>
                  </div>

                  <p className="text-sm text-slate-500">{person.role}</p>
                  <p className="mt-1 text-sm text-slate-500 line-clamp-2">{person.bio}</p>

                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {person.location}
                    </span>
                    <span>{person.serviceCount} services</span>
                    <span>{person.productCount} products</span>
                    <span>{person.openLeads} open leads</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{person.completedJobs} jobs done</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 inline-flex items-center gap-1">
                      <Clock3 size={12} />
                      {person.responseMinutes} min response
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">from INR {person.startingPrice}</span>
                    <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-700">{person.profileCompletion}% profile</span>
                    <span className="rounded-full bg-fuchsia-100 px-2 py-1 text-fuchsia-700">Match {person.rankScore}</span>
                  </div>

                  {person.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {person.tags.slice(0, 3).map((tag) => (
                        <span
                          key={`${person.id}-${tag}`}
                          className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-slate-700">
                      <span className="inline-flex items-center gap-1">
                        <Star size={14} className="text-amber-400 fill-amber-400" />
                        {person.rating}
                      </span>{" "}
                      <span className="text-slate-500">({person.reviews} reviews)</span>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => void startChat(person.id)}
                        disabled={loadingChatId === person.id}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 inline-flex items-center gap-1 transition-colors disabled:opacity-70"
                      >
                        <MessageCircle size={14} />
                        {loadingChatId === person.id ? "Opening..." : "Chat"}
                      </button>
                      <button
                        onClick={() => setSelectedProvider(person.id)}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-500"
                      >
                        View Profile
                      </button>
                      {!usingDemo && (
                        <button
                          onClick={() => router.push(`/business/${person.businessSlug}`)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Business Page
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              </div>
            );
          })}

          {!filteredProviders.length && (
            <div className="col-span-full rounded-xl bg-white p-8 text-center">
              <Users className="mx-auto mb-3 text-slate-500" />
              <p className="text-slate-500">No providers found for current filters.</p>
            </div>
          )}
        </div>
      )}

      <ProviderTrustPanel
        userId={selectedProvider || ""}
        open={!!selectedProvider}
        onClose={() => setSelectedProvider(null)}
      />
    </div>
  );
}
