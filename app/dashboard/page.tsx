"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import ProviderPopup from "@/app/components/ProviderPopup";
import dynamic from "next/dynamic";
import ProviderTrustPanel from "@/app/components/ProviderTrustPanel";
import { useRouter } from "next/navigation";
import CreatePostModal from "@/app/components/CreatePostModal";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
} from "@/lib/business";

const MarketplaceMap = dynamic(
() => import("@/app/components/MarketplaceMap").then((mod) => mod.default),
{ ssr: false }
);

import {
Search,
MapPin,
MessageCircle,
Filter,
TrendingUp,
} from "lucide-react";

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
};

type ReviewRow = {
  provider_id: string;
  rating: number | null;
};

const mediaRegex = /\[([^\]]+)\]\s(https?:\/\/[^\s,]+)/g;

const parsePostText = (rawText: string) => {
  const fallback = {
    title: rawText,
    description: rawText,
    budget: 0,
    category: "Need",
    media: [] as FeedMedia[],
  };

  if (!rawText.includes(" | ")) return fallback;

  const parts = rawText.split(" | ");
  if (parts.length < 2) return fallback;

  const title = parts[0]?.trim() || fallback.title;
  const description = parts[1]?.trim() || fallback.description;

  const budgetPart = parts.find((item) => item.startsWith("Budget:"));
  const categoryPart = parts.find((item) => item.startsWith("Category:"));
  const mediaPart = parts.find((item) => item.startsWith("Media:"));

  const budgetMatch = budgetPart?.match(/(\d+(\.\d+)?)/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : 0;
  const category = categoryPart?.replace("Category:", "").trim() || fallback.category;

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

  return { title, description, budget, category, media };
};

const pseudoDistance = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000;
  }
  return Number((0.4 + (hash / 1000) * 7.6).toFixed(1));
};

/* ================= PAGE ================= */

export default function MarketplacePage() {
const router = useRouter();
const [feed, setFeed] = useState<Listing[]>([]);
const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
const [search, setSearch] = useState("");
const [category, setCategory] = useState("all");
const [sortBy, setSortBy] = useState<"best" | "distance" | "price">("best");
const [showTrendingOnly, setShowTrendingOnly] = useState(false);
const [highlightedId, setHighlightedId] = useState<string | null>(null);
const [messageLoadingId, setMessageLoadingId] = useState<string | null>(null);
const [openPostModal, setOpenPostModal] = useState(false);
const [focusTarget, setFocusTarget] = useState<{
  id: string;
  type: string;
} | null>(null);
const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

useEffect(() => {
// eslint-disable-next-line react-hooks/immutability
fetchFeed();
}, []);

useEffect(() => {
  const params = new URLSearchParams(
    window.location.search
  );
  const id = params.get("focus");
  const type = params.get("type");
  if (!id) return;
  setFocusTarget({
    id,
    type: type || "",
  });
}, []);

useEffect(() => {
  if (!focusTarget?.id || feed.length === 0) return;

  if (
    focusTarget.type &&
    ["demand", "service", "product"].includes(
      focusTarget.type
    )
  ) {
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
    setTimeout(
      () => setHighlightedId(null),
      2600
    );
  }, 120);

  return () => clearTimeout(timer);
}, [feed.length, focusTarget]);

/* ================= FETCH ================= */

const fetchFeed = async () => {
const [{ data: services }, { data: products }, { data: posts }, { data: reviews }] = await Promise.all([
  supabase.from("service_listings").select("*"),
  supabase.from("product_catalog").select("*"),
  supabase.from("posts").select("*"),
  supabase.from("reviews").select("provider_id,rating"),
]);

const serviceRows = (services as ServiceRow[] | null) || [];
const productRows = (products as ProductRow[] | null) || [];
const postRows = (posts as PostRow[] | null) || [];
const reviewRows = (reviews as ReviewRow[] | null) || [];

const profileIds = [
  ...serviceRows.map((row) => row.provider_id),
  ...productRows.map((row) => row.provider_id),
  ...postRows.map((row) => row.user_id || row.provider_id || row.created_by || "").filter(Boolean),
];

const uniqueProfileIds = Array.from(new Set(profileIds));
let profileMap = new Map<string, ProfileRow>();

if (uniqueProfileIds.length > 0) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,name,avatar_url,role,bio,location,availability,services,email,phone,website")
    .in("id", uniqueProfileIds);

  profileMap = new Map((profiles as ProfileRow[] | null)?.map((p) => [p.id, p]) || []);
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
  const serviceCount = serviceCountMap.get(providerId) || 0;
  const productCount = productCountMap.get(providerId) || 0;
  const ratings = ratingMap.get(providerId);
  const reviewCount = ratings?.count || 0;
  const averageRating = reviewCount ? Number((ratings!.sum / reviewCount).toFixed(1)) : 4.4;
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
  const distance = pseudoDistance(providerId || profile?.id || "local");
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
    distance,
    responseMinutes,
    profileCompletion,
    verificationStatus,
    rankScore,
  };
};


/* ---------- FORMAT ---------- */

const formattedServices: Listing[] =
  serviceRows.map((s) => {
    const stats = getProviderStats(s.provider_id);
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      price: s.price,
      category: s.category,
      provider_id: s.provider_id,
      type: "service",
      avatar: stats.profile?.avatar_url || "https://i.pravatar.cc/150?img=12",
      distance: stats.distance,
      lat: 28.61 + Math.random() * 0.05,
      lng: 77.2 + Math.random() * 0.05,
      createdAt: s.created_at,
      creatorName: stats.profile?.name || "Local Provider",
      businessSlug: createBusinessSlug(stats.profile?.name, s.provider_id),
      rankScore: stats.rankScore,
      responseMinutes: stats.responseMinutes,
      profileCompletion: stats.profileCompletion,
      verificationStatus: stats.verificationStatus,
    };
  });

const formattedProducts: Listing[] =
  productRows.map((p) => {
    const stats = getProviderStats(p.provider_id);
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      provider_id: p.provider_id,
      type: "product",
      avatar: stats.profile?.avatar_url || "https://i.pravatar.cc/150?img=32",
      distance: stats.distance,
      lat: 28.61 + Math.random() * 0.05,
      lng: 77.2 + Math.random() * 0.05,
      createdAt: p.created_at,
      creatorName: stats.profile?.name || "Local Seller",
      businessSlug: createBusinessSlug(stats.profile?.name, p.provider_id),
      rankScore: stats.rankScore,
      responseMinutes: stats.responseMinutes,
      profileCompletion: stats.profileCompletion,
      verificationStatus: stats.verificationStatus,
    };
  });

const formattedPosts: Listing[] =
  postRows.map((post) => {
    const rawText =
      post.text ||
      post.content ||
      post.description ||
      post.title ||
      "Local post";
    const parsed = parsePostText(rawText);
    const ownerId =
      post.user_id ||
      post.provider_id ||
      post.created_by ||
      "";
    const stats = ownerId ? getProviderStats(ownerId) : null;

    return {
      id: post.id,
      title: parsed.title,
      description: parsed.description,
      price: parsed.budget,
      category: parsed.category,
      provider_id: ownerId,
      type: "demand",
      avatar: stats?.profile?.avatar_url || "https://i.pravatar.cc/150?img=5",
      distance: stats?.distance || pseudoDistance(post.id),
      urgent: true,
      lat: 28.61 + Math.random() * 0.05,
      lng: 77.2 + Math.random() * 0.05,
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

const combined = [
  ...formattedPosts,
  ...formattedServices,
  ...formattedProducts,
];

setFeed(combined);


};

/* ================= FILTER + SORT ================= */

const filtered = feed
.filter((item) => {
const matchesSearch = item.title
.toLowerCase()
.includes(search.toLowerCase());


  const matchesCategory =
    category === "all" ||
    item.category === category ||
    item.type === category;

  const matchesTrending = showTrendingOnly
    ? item.type === "demand"
    : true;

  return matchesSearch && matchesCategory && matchesTrending;
})
.sort((a, b) => {
  if (sortBy === "best") {
    return b.rankScore - a.rankScore || a.distance - b.distance;
  }
  if (sortBy === "distance") {
    return a.distance - b.distance;
  }
  return a.price - b.price;
});


/* ================= BOOK ================= */

const bookNow = async (item: Listing) => {
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

  const { error: participantError } = await supabase.from("conversation_participants").insert([
    {
      conversation_id: targetConversationId,
      user_id: user.id,
    },
    {
      conversation_id: targetConversationId,
      user_id: providerId,
    },
  ]);

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

/* ================= UI ================= */

return ( <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white">


  {/* HERO */}
  <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl sm:rounded-3xl p-5 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold">
        Discover Local Services & Products
      </h1>
      <p className="text-white/90 mt-2 text-sm sm:text-base">
        Book trusted providers near you in real-time.
      </p>
    </div>
  </div>

  {/* SEARCH + SORT */}
  <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">

    <div className="flex flex-col md:flex-row gap-3 mb-6">

      <div className="flex items-center gap-2 bg-slate-900 p-3 rounded-xl flex-1 border border-slate-800">
        <Search size={16} />
        <input
          placeholder="Search services, products, needs..."
          className="bg-transparent outline-none flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <select
        value={sortBy}
        onChange={(e) =>
          setSortBy(
            e.target.value === "best"
              ? "best"
              : e.target.value === "price"
              ? "price"
              : "distance"
          )
        }
        className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl text-sm w-full md:w-auto"
      >
        <option value="best">Sort: Best Match</option>
        <option value="distance">Sort: Distance</option>
        <option value="price">Sort: Price</option>
      </select>

      <button
        onClick={() =>
          setShowTrendingOnly(!showTrendingOnly)
        }
        className="bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm w-full md:w-auto"
      >
        <Filter size={16} />
        Trending
      </button>
    </div>

    {/* CATEGORY FILTER */}
    <div className="flex flex-wrap gap-2 sm:gap-3 mb-6">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => setCategory(cat)}
          className={`px-4 py-2 rounded-full text-sm ${
            category === cat
              ? "bg-indigo-600"
              : "bg-slate-800"
          }`}
        >
          {cat.toUpperCase()}
        </button>
      ))}
    </div>

    {/* QUICK CHIPS */}
    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 mb-6">
      {[
        "Cleaning",
        "Repair",
        "Delivery",
        "Food",
        "Electrician",
      ].map((chip) => (
        <button
          key={chip}
          onClick={() => setCategory(chip)}
          className="px-4 py-2 bg-slate-800 rounded-xl text-sm whitespace-nowrap hover:bg-indigo-600 transition"
        >
          {chip}
        </button>
      ))}
    </div>
  </div>

  {/* MAIN GRID */}
  <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-3 gap-6 pb-20">

    {/* FEED */}
    <div className="lg:col-span-2 space-y-5">

      {/* TRENDING */}
      <div>
        <h2 className="flex items-center gap-2 text-indigo-400 mb-3">
          <TrendingUp size={16} />
          Trending Near You
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {feed
            .filter((i) => i.type === "demand")
            .sort((a, b) => b.rankScore - a.rankScore)
            .slice(0, 2)
            .map((item) => (
              <div
                key={"trend-" + item.id}
                className="bg-slate-900 p-4 rounded-xl border border-slate-800"
              >
                <div className="text-sm text-slate-400">
                  {item.distance} km away
                </div>
                <div className="font-semibold">
                  {item.title}
                </div>
                <div className="text-indigo-400 font-bold">
                  ₹ {item.price}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* LIST */}
      {filtered.map((item) => (
        <motion.div
          key={item.id}
          whileHover={{ scale: 1.02 }}
          ref={(el) => {
            cardRefs.current[item.id] = el;
          }}
          className={`p-4 sm:p-6 bg-slate-900 border rounded-2xl transition-all duration-500 ${
            highlightedId === item.id
              ? "border-indigo-400 shadow-[0_0_0_2px_rgba(99,102,241,0.35)]"
              : "border-slate-800"
          }`}
        >
          <div className="flex flex-col sm:flex-row gap-4">

            <ProviderPopup userId={item.provider_id}>
  <Image
    src={item.avatar}
    alt={`${item.title} avatar`}
    width={48}
    height={48}
    onClick={() =>
      setSelectedProvider(item.provider_id)
    }
    className="w-12 h-12 rounded-full cursor-pointer hover:scale-110 transition object-cover"
  />
</ProviderPopup>

            <div className="flex-1 min-w-0">

              <div className="flex flex-wrap gap-2 mb-1">
                <span className="text-xs bg-slate-800 px-2 py-1 rounded">
                  {item.type}
                </span>

                <span
                  className={`text-xs px-2 py-1 rounded ${
                    item.verificationStatus === "verified"
                      ? "bg-emerald-900/30 text-emerald-300"
                      : item.verificationStatus === "pending"
                      ? "bg-amber-900/40 text-amber-300"
                      : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {item.verificationStatus === "verified"
                    ? "Verified"
                    : item.verificationStatus === "pending"
                    ? "Pending"
                    : "Unclaimed"}
                </span>

                {item.urgent && (
                  <span className="text-xs bg-red-500 px-2 py-1 rounded">
                    URGENT
                  </span>
                )}

                <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded">
                  Recently Posted
                </span>
              </div>

              <h3 className="font-semibold text-lg">
                {item.title}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>by {item.creatorName || "Local Provider"}</span>
                {!!item.businessSlug && (
                  <button
                    onClick={() => router.push(`/business/${item.businessSlug}`)}
                    className="text-indigo-300 hover:text-indigo-200"
                  >
                    View business profile
                  </button>
                )}
              </div>

              <p className="text-sm text-slate-400 mt-1">
                {item.description}
              </p>

              {!!item.media?.length && (
                <div className="mt-3 grid gap-2">
                  {item.media.slice(0, 3).map((mediaItem, index) => {
                    if (mediaItem.mimeType.startsWith("image/")) {
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${item.id}-media-${index}`}
                          src={mediaItem.url}
                          alt="Post attachment"
                          className="w-full max-h-64 rounded-xl border border-slate-700 object-cover"
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
                          className="w-full max-h-72 rounded-xl border border-slate-700"
                        />
                      );
                    }

                    if (mediaItem.mimeType.startsWith("audio/")) {
                      return (
                        <div
                          key={`${item.id}-media-${index}`}
                          className="rounded-xl border border-slate-700 bg-slate-950/60 p-3"
                        >
                          <audio src={mediaItem.url} controls className="w-full" preload="metadata" />
                        </div>
                      );
                    }

                    return null;
                  })}
                  {item.media.length > 3 && (
                    <p className="text-xs text-slate-400">
                      +{item.media.length - 3} more attachment(s)
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm mt-3 text-slate-400">
                <MapPin size={14} />
                {item.distance} km
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs mt-2 text-slate-400">
                <span>~{item.responseMinutes} min response</span>
                <span>•</span>
                <span>{item.profileCompletion}% profile</span>
                <span>•</span>
                <span className="text-indigo-300">Match {item.rankScore}</span>
              </div>

              {item.price > 0 && (
                <div className="text-indigo-400 font-bold mt-2">
                  ₹ {item.price}
                </div>
              )}

              <div className="flex flex-wrap gap-2 sm:gap-3 mt-4">
                <button
                  onClick={() =>
                    bookNow(item)
                  }
                  disabled={!item.provider_id}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-sm"
                >
                  {item.type === "demand"
                    ? "Accept Job"
                    : "Book Now"}
                </button>

                <button
                  onClick={() =>
                    messageProvider(item.provider_id)
                  }
                  disabled={!item.provider_id}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-sm"
                >
                  {messageLoadingId === item.provider_id ? "..." : <MessageCircle size={16} />}
                </button>

                {!!item.businessSlug && (
                  <button
                    onClick={() => router.push(`/business/${item.businessSlug}`)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-sm"
                  >
                    Business Page
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ))}

      {!filtered.length && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
          <h3 className="text-xl font-semibold">No live listings yet</h3>
          <p className="text-slate-400 mt-2">
            Start the local economy by posting a need or adding your first service/product listing.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => setOpenPostModal(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600"
            >
              Post a Need
            </button>
            <button
              onClick={() => router.push("/dashboard/provider/add-service")}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700"
            >
              Add Service
            </button>
            <button
              onClick={() => router.push("/dashboard/provider/add-product")}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700"
            >
              Add Product
            </button>
          </div>
        </div>
      )}
    </div>

    {/* SIDEBAR */}
    <div className="space-y-6">

      {/* MAP */}
      <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800">
        <h2 className="flex items-center gap-2 mb-3">
          <MapPin size={18} />
          Nearby Map
        </h2>

        <div className="h-60 bg-slate-800 rounded-xl overflow-hidden">
          <MarketplaceMap
            items={feed.map((item) => ({
              id: item.id,
              title: item.title,
              lat: item.lat,
              lng: item.lng,
            }))}
          />
        </div>
      </div>

      {/* CREATE POST */}
      <div className="bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800">
        <h3 className="font-semibold mb-4">
          Create Post
        </h3>

        <div className="space-y-2 text-sm">
          <label className="flex gap-2">
            <input type="radio" />
            Need something
          </label>

          <label className="flex gap-2">
            Offer a service
          </label>

          <label className="flex gap-2">
            Sell a product
          </label>
        </div>

        <button className="w-full mt-4 bg-indigo-600 py-2 rounded-xl">
          Continue →
        </button>
      </div>
    </div>
  </div>

  {/* FLOATING CTA */}
  <button className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-indigo-600 to-pink-600 w-12 h-12 sm:w-14 sm:h-14 rounded-full text-xl sm:text-2xl shadow-2xl hover:scale-110 transition">
    +
  </button>
  <ProviderTrustPanel
  userId={selectedProvider || ""}
  open={!!selectedProvider}
  onClose={() => setSelectedProvider(null)}
/>
  <CreatePostModal
  open={openPostModal}
  onClose={() => setOpenPostModal(false)}
  onPublished={fetchFeed}
/>
</div>


);
}
