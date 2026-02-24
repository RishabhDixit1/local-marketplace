"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProviderTrustPanel from "@/app/components/ProviderTrustPanel";
import { BadgeCheck, Clock3, MapPin, MessageCircle, Search, Sparkles, Star, Users } from "lucide-react";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
} from "@/lib/business";

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
};

type ServiceRow = {
  provider_id: string;
  category?: string | null;
};

type ProductRow = {
  provider_id: string;
  category?: string | null;
};

type ReviewRow = {
  provider_id: string;
  rating: number;
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
  responseMinutes: number;
  startingPrice: number;
  tags: string[];
  profileCompletion: number;
  rankScore: number;
  verificationStatus: "verified" | "pending" | "unclaimed";
};

const TABS = ["All", "Nearby", "Active Now", "Verified"] as const;
const RADIUS_OPTIONS = [1, 5, 10];
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
    responseMinutes: 6,
    startingPrice: 299,
    tags: ["Electrician", "Repair", "Urgent"],
    profileCompletion: 88,
    rankScore: 91,
    verificationStatus: "verified",
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
    responseMinutes: 11,
    startingPrice: 399,
    tags: ["Cleaning", "Home", "Office"],
    profileCompletion: 82,
    rankScore: 84,
    verificationStatus: "verified",
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
    responseMinutes: 5,
    startingPrice: 349,
    tags: ["Plumbing", "Fittings", "Emergency"],
    profileCompletion: 92,
    rankScore: 95,
    verificationStatus: "verified",
  },
];

const pseudoDistance = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000;
  }
  return Number((0.3 + (hash / 1000) * 7.7).toFixed(1));
};

const hashNumber = (seed: string, min: number, max: number) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 10000;
  }
  return min + (hash % (max - min + 1));
};

export default function PeoplePage() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]>("Best Match");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [usingDemo, setUsingDemo] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      const [{ data: profiles, error: profilesError }, { data: services }, { data: products }, { data: reviews }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,name,avatar_url,role,bio,location,availability,services,email,phone,website"),
          supabase.from("service_listings").select("provider_id,category"),
          supabase.from("product_catalog").select("provider_id,category"),
          supabase.from("reviews").select("provider_id,rating"),
        ]);

      if (profilesError || !profiles) {
        setProviders(demoPeople);
        setUsingDemo(true);
        setLoading(false);
        return;
      }

      const serviceRows = (services as ServiceRow[] | null) || [];
      const productRows = (products as ProductRow[] | null) || [];
      const reviewRows = (reviews as ReviewRow[] | null) || [];

      const serviceCountMap = new Map<string, number>();
      const productCountMap = new Map<string, number>();
      const tagMap = new Map<string, Set<string>>();
      const ratingMap = new Map<string, { sum: number; count: number }>();

      serviceRows.forEach((row) => {
        serviceCountMap.set(row.provider_id, (serviceCountMap.get(row.provider_id) || 0) + 1);
        if (!tagMap.has(row.provider_id)) tagMap.set(row.provider_id, new Set());
        if (row.category) tagMap.get(row.provider_id)?.add(row.category);
      });

      productRows.forEach((row) => {
        productCountMap.set(row.provider_id, (productCountMap.get(row.provider_id) || 0) + 1);
        if (!tagMap.has(row.provider_id)) tagMap.set(row.provider_id, new Set());
        if (row.category) tagMap.get(row.provider_id)?.add(row.category);
      });

      reviewRows.forEach((row) => {
        const previous = ratingMap.get(row.provider_id) || { sum: 0, count: 0 };
        ratingMap.set(row.provider_id, {
          sum: previous.sum + (row.rating || 0),
          count: previous.count + 1,
        });
      });

      const cards: ProviderCard[] = (profiles as ProfileRow[])
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
          const distanceKm = pseudoDistance(profile.id);
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
            completedJobs: hashNumber(profile.id, 8, 140),
            responseMinutes,
            startingPrice: hashNumber(profile.id, 199, 1499),
            tags: Array.from(tagMap.get(profile.id) || []),
            profileCompletion,
            rankScore,
            verificationStatus,
          };
        });

      if (cards.length === 0) {
        setProviders(demoPeople);
        setUsingDemo(true);
      } else {
        setProviders(cards);
        setUsingDemo(false);
      }
      setLoading(false);
    };

    load();
  }, []);

  const filteredProviders = useMemo(() => {
    const query = search.toLowerCase().trim();

    const filtered = providers
      .filter((person) => {
        if (!query) return true;
        return (
          `${person.name} ${person.role} ${person.bio} ${person.location} ${person.tags.join(" ")}`
            .toLowerCase()
            .includes(query)
        );
      })
      .filter((person) => person.distanceKm <= radiusKm)
      .filter((person) => {
        if (activeTab === "All") return true;
        if (activeTab === "Nearby") return person.distanceKm <= 1;
        if (activeTab === "Active Now") return person.online;
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
  }, [activeTab, providers, radiusKm, search, sortBy]);

  const startChat = async (providerId: string) => {
    if (!currentUserId) {
      alert("Login required");
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
      const { error: participantError } = await supabase.from("conversation_participants").insert([
        { conversation_id: targetConversationId, user_id: currentUserId },
        { conversation_id: targetConversationId, user_id: providerId },
      ]);

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
  const activeNow = providers.filter((provider) => provider.online).length;
  const avgRating = providers.length
    ? (providers.reduce((sum, provider) => sum + provider.rating, 0) / providers.length).toFixed(1)
    : "0.0";
  const featuredProviders = [...filteredProviders]
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 3);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 p-4 sm:p-6 text-white shadow">
        <h1 className="text-xl sm:text-2xl font-bold">People Near You</h1>
        <p className="mt-1 text-white/85">Search, compare, and contact nearby providers quickly.</p>

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
            <p className="font-semibold text-lg">{avgRating} ⭐</p>
            <p className="text-white/70">Avg Rating</p>
          </div>
        </div>
      </div>

      {!!featuredProviders.length && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-semibold text-white">Featured Providers</h2>
            <span className="text-xs text-slate-400 inline-flex items-center gap-1">
              <Sparkles size={12} /> Top matches
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {featuredProviders.map((person) => (
              <button
                key={`featured-${person.id}`}
                onClick={() => setSelectedProvider(person.id)}
                className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-left"
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
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Showing demo people because no provider listings were found in DB yet.
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm text-white focus-within:ring-2 focus-within:ring-purple-600">
          <Search size={16} className="text-neutral-400" />
          <input
            type="text"
            placeholder="Search by name, skill, bio, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent outline-none placeholder:text-neutral-500"
          />
        </div>

        <select
          value={String(radiusKm)}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="rounded-lg bg-neutral-900 px-3 py-2.5 text-sm text-white focus:outline-none w-full sm:w-auto"
        >
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>
              {radius} km
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as (typeof SORT_OPTIONS)[number])}
          className="rounded-lg bg-neutral-900 px-3 py-2.5 text-sm text-white focus:outline-none w-full sm:w-auto"
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
                : "bg-neutral-800 text-neutral-300 hover:bg-purple-600 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl bg-neutral-900 p-6 text-neutral-400">Loading nearby providers...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredProviders.map((person) => (
            <div key={person.id} className="rounded-xl bg-neutral-900 p-4 shadow border border-slate-800">
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
                    className="h-14 w-14 rounded-full object-cover border border-slate-700"
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-white truncate">
                      {person.name}
                      <span
                        className={`ml-2 inline-flex items-center gap-1 text-xs ${
                          person.verificationStatus === "verified"
                            ? "text-emerald-400"
                            : person.verificationStatus === "pending"
                            ? "text-amber-300"
                            : "text-slate-400"
                        }`}
                      >
                        <BadgeCheck size={12} />
                        {person.verificationStatus === "verified"
                          ? "Verified"
                          : person.verificationStatus === "pending"
                          ? "Pending"
                          : "Unclaimed"}
                      </span>
                      {person.online && <span className="ml-2 text-emerald-400 text-xs">● Online</span>}
                    </h3>
                    <span className="text-xs text-neutral-400 shrink-0">{person.distanceKm} km away</span>
                  </div>

                  <p className="text-sm text-neutral-400">{person.role}</p>
                  <p className="mt-1 text-sm text-neutral-500 line-clamp-2">{person.bio}</p>

                  <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {person.location}
                    </span>
                    <span>{person.serviceCount} services</span>
                    <span>{person.productCount} products</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                      {person.completedJobs} jobs done
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300 inline-flex items-center gap-1">
                      <Clock3 size={12} />
                      {person.responseMinutes} min response
                    </span>
                    <span className="rounded-full bg-emerald-900/40 px-2 py-1 text-emerald-300">
                      from ₹{person.startingPrice}
                    </span>
                    <span className="rounded-full bg-indigo-900/40 px-2 py-1 text-indigo-300">
                      {person.profileCompletion}% profile
                    </span>
                    <span className="rounded-full bg-fuchsia-900/40 px-2 py-1 text-fuchsia-300">
                      Match {person.rankScore}
                    </span>
                  </div>

                  {person.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {person.tags.slice(0, 3).map((tag) => (
                        <span
                          key={`${person.id}-${tag}`}
                          className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-neutral-300">
                      <span className="inline-flex items-center gap-1">
                        <Star size={14} className="text-amber-400 fill-amber-400" />
                        {person.rating}
                      </span>{" "}
                      <span className="text-neutral-500">({person.reviews} reviews)</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => startChat(person.id)}
                        disabled={loadingChatId === person.id}
                        className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm text-white hover:bg-neutral-700 inline-flex items-center gap-1"
                      >
                        <MessageCircle size={14} />
                        {loadingChatId === person.id ? "..." : "Chat"}
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
                          className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-700"
                        >
                          Business Page
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!filteredProviders.length && (
            <div className="col-span-full rounded-xl bg-neutral-900 p-8 text-center">
              <Users className="mx-auto mb-3 text-neutral-400" />
              <p className="text-neutral-400">No providers found for current filters.</p>
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
