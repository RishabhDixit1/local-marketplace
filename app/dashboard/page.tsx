"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProviderPopup from "@/app/components/ProviderPopup";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
} from "lucide-react";

const FEED_LIMIT_PER_TYPE = 48;
const MAX_PROFILE_LOOKUP = 120;

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
};

type ReviewRow = {
  provider_id: string;
  rating: number | null;
};

type FlexibleRow = Record<string, unknown>;

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
  const demoFeed = useMemo(() => buildDemoFeed(), []);
  const [feed, setFeed] = useState<Listing[]>(demoFeed);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [usingDemoFeed, setUsingDemoFeed] = useState(true);
  const [mapReady, setMapReady] = useState(false);
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

  /* ================= FETCH ================= */
  const fetchFeed = useCallback(async () => {
    setIsFeedLoading(true);
    setFeedError("");

    try {
      let serviceRowsRaw: FlexibleRow[] = [];
      let productRowsRaw: FlexibleRow[] = [];
      let postRowsRaw: FlexibleRow[] = [];

      const servicePrimary = await supabase
        .from("service_listings")
        .select("id,title,description,price,category,provider_id,created_at")
        .limit(FEED_LIMIT_PER_TYPE);
      if (servicePrimary.error) {
        if (isMissingColumnError(servicePrimary.error.message)) {
          const serviceFallback = await supabase
            .from("service_listings")
            .select("*")
            .limit(FEED_LIMIT_PER_TYPE);
          if (serviceFallback.error) {
            throw new Error(serviceFallback.error.message);
          }
          serviceRowsRaw = (serviceFallback.data as FlexibleRow[] | null) || [];
        } else {
          throw new Error(servicePrimary.error.message);
        }
      } else {
        serviceRowsRaw = (servicePrimary.data as FlexibleRow[] | null) || [];
      }

      const productPrimary = await supabase
        .from("product_catalog")
        .select("id,title,description,price,category,provider_id,created_at")
        .limit(FEED_LIMIT_PER_TYPE);
      if (productPrimary.error) {
        if (isMissingColumnError(productPrimary.error.message)) {
          const productFallback = await supabase
            .from("product_catalog")
            .select("*")
            .limit(FEED_LIMIT_PER_TYPE);
          if (productFallback.error) {
            throw new Error(productFallback.error.message);
          }
          productRowsRaw = (productFallback.data as FlexibleRow[] | null) || [];
        } else {
          throw new Error(productPrimary.error.message);
        }
      } else {
        productRowsRaw = (productPrimary.data as FlexibleRow[] | null) || [];
      }

      const postsPrimary = await supabase
        .from("posts")
        .select("id,text,content,description,title,user_id,provider_id,created_by,status,state,created_at")
        .eq("status", "open")
        .limit(FEED_LIMIT_PER_TYPE);
      if (postsPrimary.error) {
        if (isMissingColumnError(postsPrimary.error.message)) {
          const postsFallback = await supabase
            .from("posts")
            .select("*")
            .limit(FEED_LIMIT_PER_TYPE);
          if (postsFallback.error) {
            throw new Error(postsFallback.error.message);
          }
          postRowsRaw = (postsFallback.data as FlexibleRow[] | null) || [];
        } else {
          throw new Error(postsPrimary.error.message);
        }
      } else {
        postRowsRaw = (postsPrimary.data as FlexibleRow[] | null) || [];
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
        let profileRowsRaw: FlexibleRow[] = [];
        const profilesPrimary = await supabase
          .from("profiles")
          .select("id,name,avatar_url,role,bio,location,availability,services,email,phone,website")
          .in("id", uniqueProfileIds);

        if (profilesPrimary.error) {
          if (isMissingColumnError(profilesPrimary.error.message)) {
            const profilesFallback = await supabase
              .from("profiles")
              .select("*")
              .in("id", uniqueProfileIds);
            if (profilesFallback.error) {
              throw new Error(profilesFallback.error.message);
            }
            profileRowsRaw = (profilesFallback.data as FlexibleRow[] | null) || [];
          } else {
            throw new Error(profilesPrimary.error.message);
          }
        } else {
          profileRowsRaw = (profilesPrimary.data as FlexibleRow[] | null) || [];
        }

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
            };
          })
          .filter((row) => !!row.id);

        profileMap = new Map(normalizedProfiles.map((row) => [row.id, row]));

        const reviewsResult = await supabase
          .from("reviews")
          .select("provider_id,rating")
          .in("provider_id", uniqueProfileIds);
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

      const formattedPosts: Listing[] = postRows.map((post) => {
        const rawText = post.text || post.content || post.description || post.title || "Local post";
        const parsed = parsePostText(rawText);
        const ownerId = post.user_id || post.provider_id || post.created_by || "";
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

      const liveFeed = [...formattedPosts, ...formattedServices, ...formattedProducts];
      if (liveFeed.length === 0) {
        setFeed(demoFeed);
        setUsingDemoFeed(true);
        setFeedError("No live listings yet. Showing demo marketplace cards.");
      } else {
        setFeed(liveFeed);
        setUsingDemoFeed(false);
      }
    } catch (error) {
      console.error("Failed to load marketplace feed:", error);
      setFeed(demoFeed);
      setUsingDemoFeed(true);
      setFeedError(error instanceof Error ? `${error.message}. Showing demo feed.` : "Showing demo feed.");
    } finally {
      setIsFeedLoading(false);
    }
  }, [demoFeed]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    const mapTimer = window.setTimeout(() => {
      setMapReady(true);
    }, 900);
    return () => window.clearTimeout(mapTimer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
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

/* ================= FILTER + SORT ================= */

const filtered = feed
.filter((item) => {
const matchesSearch = item.title
.toLowerCase()
.includes(search.toLowerCase());


  const matchesCategory =
    category === "all" ||
    item.category.toLowerCase() === category.toLowerCase() ||
    item.type === category.toLowerCase();

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

return ( <div className="min-h-screen bg-transparent text-slate-900">


  {/* HERO */}
  <div className="max-w-[2200px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl sm:rounded-3xl p-5 sm:p-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-white">
        Discover Local Services & Products
      </h1>
      <p className="text-white/90 mt-2 text-sm sm:text-base">
        Book trusted providers near you in real-time.
      </p>
      <div className="mt-4 flex flex-wrap gap-2 sm:gap-3">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
          520+ Active Providers
        </span>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
          4.8 Average Rating
        </span>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
          Fast Local Matching
        </span>
      </div>
    </div>
  </div>

  <div className="max-w-[2200px] mx-auto px-4 sm:px-6 mt-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <button
        type="button"
        onClick={() => router.push("/dashboard/profile")}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:border-indigo-400 transition-colors"
      >
        Complete Profile
      </button>
      <button
        type="button"
        onClick={() => router.push("/dashboard/create_post")}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:border-indigo-400 transition-colors"
      >
        Post New Need
      </button>
      <button
        type="button"
        onClick={() => router.push("/dashboard/provider/add-service")}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:border-indigo-400 transition-colors"
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
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:border-indigo-400 transition-colors"
      >
        Load Demo Seed
      </button>
    </div>
  </div>

  {/* SEARCH + SORT */}
  <div className="max-w-[2200px] mx-auto px-4 sm:px-6 mt-6">

    <div className="flex flex-col md:flex-row gap-3 mb-6">

      <div className="flex items-center gap-2 bg-white p-3 rounded-xl flex-1 border border-slate-200">
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
        className="bg-white border border-slate-200 px-4 py-3 rounded-xl text-sm w-full md:w-auto"
      >
        <option value="best">Sort: Best Match</option>
        <option value="distance">Sort: Distance</option>
        <option value="price">Sort: Price</option>
      </select>

      <button
        onClick={() =>
          setShowTrendingOnly(!showTrendingOnly)
        }
        className="bg-white border border-slate-200 px-4 py-3 rounded-xl flex items-center justify-center gap-2 text-sm w-full md:w-auto"
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
          className="px-4 py-2 bg-slate-100 rounded-xl text-sm text-slate-700 whitespace-nowrap hover:bg-indigo-600 hover:text-white transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  </div>

  {/* MAIN GRID */}
  <div className="max-w-[2200px] mx-auto px-4 sm:px-6 grid lg:grid-cols-3 gap-6 pb-20">

    {/* FEED */}
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
                    onClick={() => void fetchFeed()}
                    className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                  >
                    Refresh Live Data
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

          {feed.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-semibold text-slate-900">No listings available yet</h3>
              <p className="mt-2 text-sm text-slate-600">
                Create your first post or listing to populate the dashboard.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/create_post")}
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
          {/* TRENDING */}
          <div>
            <h2 className="flex items-center gap-2 text-indigo-600 mb-3">
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
                    className="bg-white p-4 rounded-xl border border-slate-200"
                  >
                    <div className="text-sm text-slate-500">
                      {item.distance} km away
                    </div>
                    <div className="font-semibold">
                      {item.title}
                    </div>
                    <div className="text-indigo-600 font-bold">
                      ₹ {item.price}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* LIST */}
          {filtered.map((item) => (
            <div
              key={item.id}
              ref={(el) => {
                cardRefs.current[item.id] = el;
              }}
              className={`p-4 sm:p-6 bg-white border rounded-2xl transition-all duration-500 hover:scale-[1.01] ${
                highlightedId === item.id
                  ? "border-indigo-400 shadow-[0_0_0_2px_rgba(99,102,241,0.35)]"
                  : "border-slate-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <ProviderPopup userId={item.provider_id}>
                  <Image
                    src={item.avatar}
                    alt={`${item.title} avatar`}
                    width={48}
                    height={48}
                    onClick={() => setSelectedProvider(item.provider_id)}
                    className="w-12 h-12 rounded-full cursor-pointer hover:scale-110 transition object-cover"
                  />
                </ProviderPopup>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-1">
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

                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                      Recently Posted
                    </span>
                  </div>

                  <h3 className="font-semibold text-lg">
                    {item.title}
                  </h3>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>by {item.creatorName || "Local Provider"}</span>
                    {!!item.businessSlug && (
                      <button
                        onClick={() => router.push(`/business/${item.businessSlug}`)}
                        className="text-indigo-600 hover:text-indigo-500"
                      >
                        View business profile
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-slate-500 mt-1">
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
                              className="w-full max-h-64 rounded-xl border border-slate-200 object-cover"
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
                              className="w-full max-h-72 rounded-xl border border-slate-200"
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
                      {item.media.length > 3 && (
                        <p className="text-xs text-slate-500">
                          +{item.media.length - 3} more attachment(s)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-sm mt-3 text-slate-500">
                    <MapPin size={14} />
                    {item.distance} km
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs mt-2 text-slate-500">
                    <span>~{item.responseMinutes} min response</span>
                    <span>•</span>
                    <span>{item.profileCompletion}% profile</span>
                    <span>•</span>
                    <span className="text-indigo-600">Match {item.rankScore}</span>
                  </div>

                  {item.price > 0 && (
                    <div className="text-indigo-600 font-bold mt-2">
                      ₹ {item.price}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 sm:gap-3 mt-4">
                    <button
                      onClick={() => bookNow(item)}
                      disabled={!item.provider_id}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
                    >
                      {item.type === "demand" ? "Accept Job" : "Book Now"}
                    </button>

                    <button
                      onClick={() => messageProvider(item.provider_id)}
                      disabled={!item.provider_id}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition-colors"
                    >
                      {messageLoadingId === item.provider_id ? "..." : <MessageCircle size={16} />}
                    </button>

                    {!!item.businessSlug && (
                      <button
                        onClick={() => router.push(`/business/${item.businessSlug}`)}
                        className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 transition-colors"
                      >
                        Business Page
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!filtered.length && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <h3 className="text-xl font-semibold">No live listings yet</h3>
              <p className="text-slate-500 mt-2">
                Start the local economy by posting a need or adding your first service/product listing.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
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

    {/* SIDEBAR */}
    <div className="space-y-6">

      {/* MAP */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
        <h2 className="flex items-center gap-2 mb-3">
          <MapPin size={18} />
          Nearby Map
        </h2>

        <div className="h-[15rem] sm:h-60 rounded-xl">
          {mapReady ? (
            <MarketplaceMap
              items={feed.map((item) => ({
                id: item.id,
                title: item.title,
                lat: item.lat,
                lng: item.lng,
              }))}
            />
          ) : (
            <div className="h-full rounded-xl border border-slate-200 bg-slate-100 animate-pulse grid place-items-center text-xs text-slate-500">
              Loading map...
            </div>
          )}
        </div>
      </div>

      {/* CREATE POST */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200">
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

        <button
          type="button"
          onClick={() => setOpenPostModal(true)}
          className="w-full mt-4 bg-indigo-600 text-white font-semibold py-2 rounded-xl hover:bg-indigo-500 transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  </div>

  {/* FLOATING CTA */}
  <button
    type="button"
    onClick={() => setOpenPostModal(true)}
    className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-indigo-600 to-pink-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full text-xl sm:text-2xl shadow-2xl hover:scale-110 transition"
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
      onPublished={() => void fetchFeed()}
    />
  )}
</div>


);
}
