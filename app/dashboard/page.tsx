"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import RouteObservability from "@/app/components/RouteObservability";
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
} from "@/lib/geo";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";

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
RotateCcw,
RefreshCw,
Bookmark,
BookmarkCheck,
} from "lucide-react";

const FEED_LIMIT_PER_TYPE = 24;
const MAX_PROFILE_LOOKUP = 120;
const MARKETPLACE_FILTERS_STORAGE_KEY = "local-marketplace-dashboard-feed-filters-v1";
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const GEO_LOOKUP_TIMEOUT_MS = 1200;
const FEED_POLL_INTERVAL_MS = 120000;
const MIN_SOFT_REFRESH_GAP_MS = 5000;
const MIN_EXPLORE_FEED_ITEMS = 18;
const TEMP_HIDDEN_LISTING_PATTERNS = [
  /\bneed ac shifting from one flat to another\b/i,
];

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

type DisplayListing = Listing & {
  displayTitle: string;
  displayDescription: string;
  displayCreator: string;
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

type RealtimeHealth = "connecting" | "connected" | "reconnecting" | "error" | "idle";
type FeedFilterState = {
  query: string;
  category: string;
  maxDistanceKm: number;
  verifiedOnly: boolean;
  urgentOnly: boolean;
  mediaOnly: boolean;
  freshOnly: boolean;
};

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
  const now = Date.now();
  const unsplash = (id: string, width = 1280) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=80`;

  const rows: Array<Omit<Listing, "id" | "lat" | "lng" | "rankScore">> = [
    {
      title: "Need urgent electrician nearby",
      description: "Power issue in 2BHK apartment. Need support within 30 minutes.",
      price: 2500,
      category: "Need",
      provider_id: "demo-provider-amit",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=amit",
      distance: 1.4,
      urgent: true,
      creatorName: "Amit P",
      businessSlug: createBusinessSlug("Amit P", "demo-provider-amit"),
      profileCompletion: 78,
      responseMinutes: 7,
      verificationStatus: "pending",
      media: [{ mimeType: "image/jpeg", url: unsplash("1504384308090-c894fdcc538d") }],
      createdAt: new Date(now - 34 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Laptop Repair near me",
      description: "Macbook M1 stops charging intermittently. Looking for same-day specialist.",
      price: 900,
      category: "Need",
      provider_id: "demo-provider-anuj",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=anuj",
      distance: 3.2,
      urgent: true,
      creatorName: "Anuj K",
      businessSlug: createBusinessSlug("Anuj K", "demo-provider-anuj"),
      profileCompletion: 72,
      responseMinutes: 11,
      verificationStatus: "unclaimed",
      media: [{ mimeType: "image/jpeg", url: unsplash("1498050108023-c5249f4df085") }],
      createdAt: new Date(now - 78 * 60 * 1000).toISOString(),
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
      media: [{ mimeType: "image/jpeg", url: unsplash("1519710164239-da123dc03ef4") }],
      createdAt: new Date(now - 112 * 60 * 1000).toISOString(),
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
      media: [{ mimeType: "image/jpeg", url: unsplash("1522202176988-66273c2fd55f") }],
      createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
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
      media: [{ mimeType: "image/jpeg", url: unsplash("1473968512647-3e447244af8f") }],
      createdAt: new Date(now - 26 * 60 * 1000).toISOString(),
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
      media: [{ mimeType: "image/jpeg", url: unsplash("1484154218962-a197022b5858") }],
      createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Fresh farm vegetables bundle",
      description: "Chemical-free weekly produce basket with next-morning delivery.",
      price: 399,
      category: "Product",
      provider_id: "demo-provider-farmcart",
      type: "product",
      avatar: "https://i.pravatar.cc/150?u=farmcart",
      distance: 4.9,
      creatorName: "FarmCart Local",
      businessSlug: createBusinessSlug("FarmCart Local", "demo-provider-farmcart"),
      profileCompletion: 84,
      responseMinutes: 20,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1469474968028-56623f02e42e") }],
      createdAt: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Need wedding photography + reels team",
      description: "Need a candid + reels team for one-day function near Indiranagar.",
      price: 12000,
      category: "Need",
      provider_id: "demo-provider-megha",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=megha",
      distance: 6.1,
      urgent: false,
      creatorName: "Megha S",
      businessSlug: createBusinessSlug("Megha S", "demo-provider-megha"),
      profileCompletion: 77,
      responseMinutes: 16,
      verificationStatus: "pending",
      media: [
        { mimeType: "video/mp4", url: "/hero/market-live-loop.mp4" },
        { mimeType: "image/jpeg", url: unsplash("1492724441997-5dc865305da7") },
      ],
      createdAt: new Date(now - 11 * 60 * 60 * 1000).toISOString(),
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
      media: [{ mimeType: "image/jpeg", url: unsplash("1517248135467-4c7edcad34c4") }],
      createdAt: new Date(now - 13 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Moving support: one bedroom apartment shift",
      description: "Need labour + mini-truck for 3-hour move this evening.",
      price: 3200,
      category: "Need",
      provider_id: "demo-provider-sarthak",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=sarthak",
      distance: 2.4,
      urgent: true,
      creatorName: "Sarthak J",
      businessSlug: createBusinessSlug("Sarthak J", "demo-provider-sarthak"),
      profileCompletion: 65,
      responseMinutes: 9,
      verificationStatus: "unclaimed",
      media: [{ mimeType: "image/jpeg", url: unsplash("1500048993953-d23a436266cf") }],
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Verified AC servicing package",
      description: "Filter cleaning + gas top-up + 30-day performance support.",
      price: 1499,
      category: "Service",
      provider_id: "demo-provider-chilltech",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=chilltech",
      distance: 2.1,
      creatorName: "ChillTech Services",
      businessSlug: createBusinessSlug("ChillTech Services", "demo-provider-chilltech"),
      profileCompletion: 89,
      responseMinutes: 10,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1497366811353-6870744d04b2") }],
      createdAt: new Date(now - 14 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Premium power tools kit",
      description: "Heavy-duty drill, cutters, safety set. Pickup or same-day delivery.",
      price: 2799,
      category: "Product",
      provider_id: "demo-provider-toolhub",
      type: "product",
      avatar: "https://i.pravatar.cc/150?u=toolhub",
      distance: 7.3,
      creatorName: "ToolHub Local",
      businessSlug: createBusinessSlug("ToolHub Local", "demo-provider-toolhub"),
      profileCompletion: 88,
      responseMinutes: 22,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1515378791036-0648a3ef77b2") }],
      createdAt: new Date(now - 18 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Need plumber for kitchen sink leak",
      description: "Water leak under sink cabinet. Looking for immediate visit.",
      price: 1300,
      category: "Need",
      provider_id: "demo-provider-ria",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=ria",
      distance: 1.9,
      urgent: true,
      creatorName: "Ria M",
      businessSlug: createBusinessSlug("Ria M", "demo-provider-ria"),
      profileCompletion: 76,
      responseMinutes: 8,
      verificationStatus: "pending",
      media: [{ mimeType: "image/jpeg", url: unsplash("1521791136064-7986c2920216") }],
      createdAt: new Date(now - 52 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Doorstep Car Wash Express",
      description: "Interior + exterior wash at your parking spot in under 45 mins.",
      price: 699,
      category: "Car Care",
      provider_id: "demo-provider-sparklewash",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=sparklewash",
      distance: 4.1,
      creatorName: "SparkleWash",
      businessSlug: createBusinessSlug("SparkleWash", "demo-provider-sparklewash"),
      profileCompletion: 83,
      responseMinutes: 13,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1505693416388-ac5ce068fe85") }],
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Weekend babysitter required",
      description: "Need trusted sitter for Saturday evening, 4 hours.",
      price: 1500,
      category: "Need",
      provider_id: "demo-provider-ishita",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=ishita",
      distance: 2.6,
      urgent: false,
      creatorName: "Ishita N",
      businessSlug: createBusinessSlug("Ishita N", "demo-provider-ishita"),
      profileCompletion: 68,
      responseMinutes: 17,
      verificationStatus: "unclaimed",
      media: [{ mimeType: "image/jpeg", url: unsplash("1518773553398-650c184e0bb3") }],
      createdAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Pet grooming at home",
      description: "Bath, nail trim, and coat care with pickup and drop option.",
      price: 999,
      category: "Pet Care",
      provider_id: "demo-provider-pawspark",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=pawspark",
      distance: 5.2,
      creatorName: "PawSpark Grooming",
      businessSlug: createBusinessSlug("PawSpark Grooming", "demo-provider-pawspark"),
      profileCompletion: 87,
      responseMinutes: 19,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1473186578172-c141e6798cf4") }],
      createdAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Home tuition for class 8-10",
      description: "Math + science tutor available for weekday evening sessions.",
      price: 1800,
      category: "Education",
      provider_id: "demo-provider-mentorplus",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=mentorplus",
      distance: 3.6,
      creatorName: "Mentor Plus Academy",
      businessSlug: createBusinessSlug("Mentor Plus Academy", "demo-provider-mentorplus"),
      profileCompletion: 79,
      responseMinutes: 21,
      verificationStatus: "pending",
      media: [{ mimeType: "image/jpeg", url: unsplash("1504674900247-0877df9cc836") }],
      createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Need photographer for cafe launch",
      description: "Looking for event + social reels coverage for opening weekend.",
      price: 9500,
      category: "Need",
      provider_id: "demo-provider-cafebloom",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=cafebloom",
      distance: 2.2,
      urgent: true,
      creatorName: "Cafe Bloom",
      businessSlug: createBusinessSlug("Cafe Bloom", "demo-provider-cafebloom"),
      profileCompletion: 81,
      responseMinutes: 12,
      verificationStatus: "pending",
      media: [{ mimeType: "image/jpeg", url: unsplash("1493666438817-866a91353ca9") }],
      createdAt: new Date(now - 95 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Organic milk subscription",
      description: "Daily fresh A2 milk delivery with monthly plan discounts.",
      price: 149,
      category: "Product",
      provider_id: "demo-provider-freshmoo",
      type: "product",
      avatar: "https://i.pravatar.cc/150?u=freshmoo",
      distance: 6.8,
      creatorName: "FreshMoo Dairy",
      businessSlug: createBusinessSlug("FreshMoo Dairy", "demo-provider-freshmoo"),
      profileCompletion: 73,
      responseMinutes: 26,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1489515217757-5fd1be406fef") }],
      createdAt: new Date(now - 10 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Ergonomic office chairs clearance",
      description: "Refurbished premium chairs, delivery and setup included.",
      price: 4200,
      category: "Product",
      provider_id: "demo-provider-worknest",
      type: "product",
      avatar: "https://i.pravatar.cc/150?u=worknest",
      distance: 7.4,
      creatorName: "WorkNest Furnish",
      businessSlug: createBusinessSlug("WorkNest Furnish", "demo-provider-worknest"),
      profileCompletion: 86,
      responseMinutes: 27,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1516914943479-89db7d9ae7f2") }],
      createdAt: new Date(now - 16 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Need packers for office move",
      description: "Small office shifting within 4km. Need packing help tomorrow morning.",
      price: 5200,
      category: "Need",
      provider_id: "demo-provider-devansh",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=devansh",
      distance: 3.1,
      urgent: true,
      creatorName: "Devansh T",
      businessSlug: createBusinessSlug("Devansh T", "demo-provider-devansh"),
      profileCompletion: 71,
      responseMinutes: 9,
      verificationStatus: "unclaimed",
      media: [{ mimeType: "image/jpeg", url: unsplash("1515378791036-0648a3ef77b2") }],
      createdAt: new Date(now - 68 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Mobile screen replacement at home",
      description: "Doorstep iPhone and Android display replacement with warranty.",
      price: 1800,
      category: "Repair",
      provider_id: "demo-provider-fixstreet",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=fixstreet",
      distance: 2.7,
      creatorName: "FixStreet",
      businessSlug: createBusinessSlug("FixStreet", "demo-provider-fixstreet"),
      profileCompletion: 90,
      responseMinutes: 11,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1498050108023-c5249f4df085") }],
      createdAt: new Date(now - 150 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Community yoga trainer",
      description: "Morning batch in society garden. Beginner-friendly weekend plan.",
      price: 999,
      category: "Fitness",
      provider_id: "demo-provider-namasteflow",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=namasteflow",
      distance: 4.3,
      creatorName: "Namaste Flow",
      businessSlug: createBusinessSlug("Namaste Flow", "demo-provider-namasteflow"),
      profileCompletion: 75,
      responseMinutes: 23,
      verificationStatus: "pending",
      media: [{ mimeType: "image/jpeg", url: unsplash("1473186578172-c141e6798cf4") }],
      createdAt: new Date(now - 19 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Event flower decoration package",
      description: "Custom stage and entrance decor for birthdays and family functions.",
      price: 6800,
      category: "Service",
      provider_id: "demo-provider-bloomcraft",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=bloomcraft",
      distance: 5.9,
      creatorName: "BloomCraft Studio",
      businessSlug: createBusinessSlug("BloomCraft Studio", "demo-provider-bloomcraft"),
      profileCompletion: 88,
      responseMinutes: 18,
      verificationStatus: "verified",
      media: [{ mimeType: "image/jpeg", url: unsplash("1489515217757-5fd1be406fef") }],
      createdAt: new Date(now - 22 * 60 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Need same-day medicine delivery",
      description: "Prescription meds pickup and delivery needed within one hour.",
      price: 350,
      category: "Need",
      provider_id: "demo-provider-karan",
      type: "demand",
      avatar: "https://i.pravatar.cc/150?u=karan",
      distance: 1.2,
      urgent: true,
      creatorName: "Karan V",
      businessSlug: createBusinessSlug("Karan V", "demo-provider-karan"),
      profileCompletion: 67,
      responseMinutes: 6,
      verificationStatus: "unclaimed",
      media: [{ mimeType: "image/jpeg", url: unsplash("1519710164239-da123dc03ef4") }],
      createdAt: new Date(now - 41 * 60 * 1000).toISOString(),
      isDemo: true,
    },
    {
      title: "Handyman for curtain rod installation",
      description: "Need drilling and mounting support for 5 windows this evening.",
      price: 1250,
      category: "Service",
      provider_id: "demo-provider-handihelp",
      type: "service",
      avatar: "https://i.pravatar.cc/150?u=handihelp",
      distance: 3.9,
      creatorName: "HandiHelp Team",
      businessSlug: createBusinessSlug("HandiHelp Team", "demo-provider-handihelp"),
      profileCompletion: 82,
      responseMinutes: 15,
      verificationStatus: "pending",
      media: [{ mimeType: "image/jpeg", url: unsplash("1521791136064-7986c2920216") }],
      createdAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
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

const normalizeForFingerprint = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const listingFingerprint = (item: Listing) => {
  const normalizedTitle = normalizeForFingerprint(item.title).slice(0, 56);
  const normalizedDescription = normalizeForFingerprint(item.description).slice(0, 96);
  const normalizedCategory = normalizeForFingerprint(item.category);
  const normalizedOwner = (item.provider_id || "community").trim().toLowerCase();
  const roundedPrice = item.price > 0 ? Math.round(item.price) : 0;

  return [
    item.type,
    normalizedOwner,
    normalizedCategory,
    normalizedTitle,
    normalizedDescription,
    roundedPrice,
  ].join("|");
};

const pickPreferredListing = (current: Listing, incoming: Listing) => {
  const incomingDate = parseDateMs(incoming.createdAt);
  const currentDate = parseDateMs(current.createdAt);
  if (incomingDate !== currentDate) {
    return incomingDate > currentDate ? incoming : current;
  }
  if (incoming.rankScore !== current.rankScore) {
    return incoming.rankScore > current.rankScore ? incoming : current;
  }
  return incoming.responseMinutes < current.responseMinutes ? incoming : current;
};

const dedupeListings = (items: Listing[]) => {
  const byId = new Map<string, Listing>();
  for (const item of items) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? pickPreferredListing(existing, item) : item);
  }

  const byFingerprint = new Map<string, Listing>();
  for (const item of byId.values()) {
    const fingerprint = listingFingerprint(item);
    const existing = byFingerprint.get(fingerprint);
    byFingerprint.set(fingerprint, existing ? pickPreferredListing(existing, item) : item);
  }

  return Array.from(byFingerprint.values());
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

const looksLikeNoisyText = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return true;
  if (normalized.length < 3) return true;
  if (/^[a-z0-9]{10,}$/i.test(normalized)) return true;
  if (/^(.)\1{4,}$/i.test(normalized)) return true;
  return false;
};

const toDisplayText = (value: string | undefined, fallback: string) => {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (looksLikeNoisyText(normalized)) return fallback;
  return normalized;
};

const isTemporarilyHiddenListing = (item: Listing) => {
  const title = item.title || "";
  const description = item.description || "";
  return TEMP_HIDDEN_LISTING_PATTERNS.some(
    (pattern) => pattern.test(title) || pattern.test(description)
  );
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

const getMediaKinds = (media?: FeedMedia[]) => {
  if (!media?.length) return [] as string[];

  const kinds = new Set<string>();
  media.forEach((mediaItem) => {
    const mime = mediaItem.mimeType.toLowerCase();
    if (mime.startsWith("image/svg") || mime.includes("pdf") || mime.includes("illustration")) {
      kinds.add("Graphics");
      return;
    }
    if (mime.startsWith("image/")) {
      kinds.add("Image");
      return;
    }
    if (mime.startsWith("video/")) {
      kinds.add("Video");
      return;
    }
    if (mime.startsWith("audio/")) {
      kinds.add("Voice");
      return;
    }
    kinds.add("Graphics");
  });

  const orderedKinds = ["Image", "Video", "Graphics", "Voice"];
  return orderedKinds.filter((kind) => kinds.has(kind));
};

const matchesFeedFilters = (item: Listing, state: FeedFilterState) => {
  const haystack = `${item.title} ${item.description} ${item.category} ${item.creatorName || ""}`.toLowerCase();
  const matchesSearch = !state.query || haystack.includes(state.query);

  const normalizedCategory = state.category.toLowerCase();
  const matchesCategory =
    state.category === "all" ||
    item.category.toLowerCase().includes(normalizedCategory) ||
    item.type === normalizedCategory;

  const matchesDistance = state.maxDistanceKm > 0 ? item.distance <= state.maxDistanceKm : true;
  const matchesVerified = state.verifiedOnly ? item.verificationStatus === "verified" : true;
  const matchesUrgent = state.urgentOnly ? !!item.urgent : true;
  const matchesMedia = state.mediaOnly ? (item.media?.length || 0) > 0 : true;
  const matchesFresh = state.freshOnly ? isFreshListing(item.createdAt) : true;

  return (
    matchesSearch &&
    matchesCategory &&
    matchesDistance &&
    matchesVerified &&
    matchesUrgent &&
    matchesMedia &&
    matchesFresh
  );
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
  const [feedError, setFeedError] = useState("");
  const [usingDemoFeed, setUsingDemoFeed] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"best" | "distance" | "price" | "latest">("best");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [mediaOnly, setMediaOnly] = useState(false);
  const [freshOnly, setFreshOnly] = useState(false);
  const [savedListingIds, setSavedListingIds] = useState<Set<string>>(new Set());
  const [hiddenListingIds, setHiddenListingIds] = useState<Set<string>>(new Set());
  const [messageLoadingId, setMessageLoadingId] = useState<string | null>(null);
  const [feedChannelHealth, setFeedChannelHealth] = useState<RealtimeHealth>("connecting");
  const [openPostModal, setOpenPostModal] = useState(false);
  const reloadTimerRef = useRef<number | null>(null);
  const fetchInFlightRef = useRef(false);
  const lastSoftFetchStartedAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(MARKETPLACE_FILTERS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        category?: string;
        sortBy?: "best" | "distance" | "price" | "latest";
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
    const payload = {
      category,
      sortBy,
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
    sortBy,
    urgentOnly,
    verifiedOnly,
  ]);

  /* ================= FETCH ================= */
  const fetchFeed = useCallback(async (soft = false) => {
    if (fetchInFlightRef.current) return;
    if (soft) {
      const now = Date.now();
      if (now - lastSoftFetchStartedAtRef.current < MIN_SOFT_REFRESH_GAP_MS) return;
      lastSoftFetchStartedAtRef.current = now;
    }
    fetchInFlightRef.current = true;

    if (soft) {
      setSyncing(true);
    } else {
      setIsFeedLoading(true);
    }
    setFeedError("");

    try {
      void getBrowserCoordinates(GEO_LOOKUP_TIMEOUT_MS).catch(() => null);

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
      const currentUserId = sessionData.session?.user?.id || "";

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
      const resolvedViewerCoordinates = fallbackViewerCoordinates;

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

      const rawLiveFeed = [...formattedPosts, ...formattedServices, ...formattedProducts];
      const liveFeed = dedupeListings(rawLiveFeed);
      if (liveFeed.length === 0) {
        setFeed(demoFeed);
        setUsingDemoFeed(true);
        setFeedError("No live listings yet. Showing demo marketplace cards.");
      } else {
        setFeed(liveFeed);
        setUsingDemoFeed(false);
      }
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
    const scheduleReload = () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }
      reloadTimerRef.current = window.setTimeout(() => {
        void fetchFeed(true);
      }, 700);
    };

    const channel = supabase
      .channel("dashboard-feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
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
      if (document.visibilityState !== "visible") return;
      void fetchFeed(true);
    }, FEED_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchFeed]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const composeParam = params.get("compose");
    if (composeParam === "1" || composeParam === "true") {
      setOpenPostModal(true);
    }

    const categoryParam = params.get("category");
    if (categoryParam && ["all", "demand", "service", "product"].includes(categoryParam)) {
      setCategory(categoryParam);
    }

    const groupParam = params.get("group") || params.get("q");
    if (groupParam) {
      setSearch(groupParam);
    }

    const type = params.get("type");

    if (type && ["demand", "service", "product"].includes(type)) {
      setCategory(type);
    }
  }, []);

/* ================= FILTER + SORT ================= */

const filterState = useMemo<FeedFilterState>(
  () => ({
    query: search.toLowerCase().trim(),
    category,
    maxDistanceKm,
    verifiedOnly,
    urgentOnly,
    mediaOnly,
    freshOnly,
  }),
  [category, freshOnly, maxDistanceKm, mediaOnly, search, urgentOnly, verifiedOnly]
);

const filtered = useMemo(() => {
  return [...feed]
    .filter((item) => !isTemporarilyHiddenListing(item))
    .filter((item) => matchesFeedFilters(item, filterState))
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
}, [feed, filterState, sortBy]);

const visibleFeed = useMemo(
  () => filtered.filter((item) => !hiddenListingIds.has(item.id)),
  [filtered, hiddenListingIds]
);

const blendedVisibleFeed = useMemo(() => {
  if (visibleFeed.length >= MIN_EXPLORE_FEED_ITEMS) return visibleFeed;

  const existingFingerprints = new Set(visibleFeed.map((item) => listingFingerprint(item)));
  const fallbackSeeds = demoFeed
    .filter((item) => matchesFeedFilters(item, filterState))
    .filter((item) => !existingFingerprints.has(listingFingerprint(item)))
    .slice(0, MIN_EXPLORE_FEED_ITEMS - visibleFeed.length)
    .map((item, index) => ({
      ...item,
      id: `seed-${item.id}-${index}`,
      isDemo: true,
    }));

  return [...visibleFeed, ...fallbackSeeds];
}, [demoFeed, filterState, visibleFeed]);

const activeFilterCount =
  Number(maxDistanceKm > 0) +
  Number(verifiedOnly) +
  Number(urgentOnly) +
  Number(mediaOnly) +
  Number(freshOnly);

const filteredStats = useMemo(() => {
  const verified = blendedVisibleFeed.filter((item) => item.verificationStatus === "verified").length;
  const urgent = blendedVisibleFeed.filter((item) => item.urgent).length;
  const withMedia = blendedVisibleFeed.filter((item) => (item.media?.length || 0) > 0).length;
  const avgMatch = blendedVisibleFeed.length
    ? Math.round(blendedVisibleFeed.reduce((sum, item) => sum + item.rankScore, 0) / blendedVisibleFeed.length)
    : 0;
  return {
    total: blendedVisibleFeed.length,
    verified,
    urgent,
    withMedia,
    avgMatch,
  };
}, [blendedVisibleFeed]);

const displayFeed = useMemo<DisplayListing[]>(
  () =>
    blendedVisibleFeed.map((item, index) => {
      const defaultTitle =
        item.type === "demand"
          ? "Need local support"
          : item.type === "service"
          ? `${item.category || "Local"} service available`
          : `${item.category || "Local"} product available`;
      const defaultDescription =
        item.type === "demand"
          ? "Looking for fast verified responses from nearby providers."
          : "Trusted local listing with clear pricing and quick response.";

      return {
        ...item,
        displayTitle: toDisplayText(item.title, defaultTitle),
        displayDescription: toDisplayText(item.description, defaultDescription),
        displayCreator: toDisplayText(item.creatorName, `Local ${item.type === "demand" ? "requester" : "provider"}`),
        createdAt: item.createdAt || new Date(Date.now() - (index + 1) * 18 * 60 * 1000).toISOString(),
      };
    }),
  [blendedVisibleFeed]
);

const featuredListing = useMemo(
  () => displayFeed.find((item) => (item.media?.length || 0) > 0) || displayFeed[0] || null,
  [displayFeed]
);
const secondaryListings = useMemo(
  () => (featuredListing ? displayFeed.filter((item) => item.id !== featuredListing.id) : []),
  [displayFeed, featuredListing]
);

const trendingOpportunities = useMemo(
  () =>
    [...displayFeed]
      .sort((a, b) => b.rankScore - a.rankScore)
      .slice(0, 4),
  [displayFeed]
);

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

const realtimeStyle = REALTIME_HEALTH_STYLES[feedChannelHealth];

/* ================= UI ================= */

return (
  <div className="relative min-h-screen bg-slate-50 text-slate-900">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_15%_18%,rgba(99,102,241,0.16),transparent_44%),radial-gradient(circle_at_88%_0%,rgba(14,165,233,0.11),transparent_36%)]" />
    <RouteObservability route="dashboard" />
    <div className="relative mx-auto max-w-[1720px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <section className="space-y-4">
          <div className="market-hero-surface rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-white via-slate-50/95 to-indigo-50/60 p-4 shadow-[0_20px_55px_-36px_rgba(30,64,175,0.45)] sm:p-5">
            <div className="mx-auto w-full max-w-6xl">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">Explorer Feed</p>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
                    Find nearby opportunities in real time
                  </h2>
                </div>
                <p className="text-xs text-slate-500">Curated from live listings with smart demo backfill for discovery.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
                  <Search size={16} className="text-slate-500" />
                  <input
                    placeholder="Search posts, services, or help nearby"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters((current) => !current)}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  <Filter size={15} />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[11px] font-semibold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void fetchFeed(true)}
                  disabled={syncing}
                  className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                  {syncing ? "Syncing..." : "Refresh"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeed(demoFeed);
                    setUsingDemoFeed(true);
                    setFeedError("Startup demo stream loaded.");
                    setHiddenListingIds(new Set());
                  }}
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-100"
                >
                  Load Demo Stream
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setOpenPostModal(true)}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
                >
                  Create Post
                </button>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">
                  {filteredStats.total} posts
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">
                  {filteredStats.withMedia} with media
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">
                  {filteredStats.urgent} urgent
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">
                  Avg match {filteredStats.avgMatch}
                </span>
                {hiddenListingIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setHiddenListingIds(new Set())}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                  >
                    Restore hidden ({hiddenListingIds.size})
                  </button>
                )}
              </div>
              {trendingOpportunities.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Explore opportunities now
                  </p>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {trendingOpportunities.map((item) => (
                      <button
                        key={`explore-chip-${item.id}`}
                        type="button"
                        onClick={() => {
                          setSearch(item.displayTitle);
                          setCategory(item.type);
                          setSortBy("best");
                        }}
                        className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        {item.displayTitle}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="rounded-2xl border border-indigo-100 bg-white/95 p-3 shadow-sm sm:p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs text-slate-600">
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(
                        event.target.value === "best"
                          ? "best"
                          : event.target.value === "price"
                          ? "price"
                          : event.target.value === "latest"
                          ? "latest"
                          : "distance"
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="best">Best match</option>
                    <option value="distance">Nearest first</option>
                    <option value="price">Price low to high</option>
                    <option value="latest">Latest first</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Listing type
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="all">All posts</option>
                    <option value="demand">Demand</option>
                    <option value="service">Services</option>
                    <option value="product">Products</option>
                  </select>
                </label>
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
                <label className="text-xs text-slate-600">
                  Verification
                  <select
                    value={verifiedOnly ? "verified" : "all"}
                    onChange={(event) => setVerifiedOnly(event.target.value === "verified")}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="all">All providers</option>
                    <option value="verified">Verified only</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Urgency
                  <select
                    value={urgentOnly ? "urgent" : "all"}
                    onChange={(event) => setUrgentOnly(event.target.value === "urgent")}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="all">All urgency</option>
                    <option value="urgent">Urgent only</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Media
                  <select
                    value={mediaOnly ? "media" : "all"}
                    onChange={(event) => setMediaOnly(event.target.value === "media")}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="all">Any media</option>
                    <option value="media">With media only</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Freshness
                  <select
                    value={freshOnly ? "recent" : "all"}
                    onChange={(event) => setFreshOnly(event.target.value === "recent")}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value="all">All time</option>
                    <option value="recent">Last 24h</option>
                  </select>
                </label>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="mt-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <RotateCcw size={12} />
                  Reset filters
                </button>
              )}
            </div>
          )}

          {(usingDemoFeed || !!feedError) && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 px-3 py-2 text-xs text-indigo-700 shadow-sm">
              {feedError || "Demo seed feed is active while live listings are syncing."}
            </div>
          )}

          {isFeedLoading && feed.length === 0 ? (
            <div className="space-y-4">
              {[0, 1].map((index) => (
                <div
                  key={`feed-skeleton-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 animate-pulse"
                >
                  <div className="h-4 w-24 rounded bg-slate-200" />
                  <div className="mt-4 h-6 w-2/3 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-full rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-5/6 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          ) : !featuredListing ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <h3 className="text-xl font-semibold text-slate-900">No posts match current filters</h3>
              <p className="mt-2 text-sm text-slate-600">
                Try widening filters or create a new post to activate this lane.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                    setSortBy("best");
                    clearAdvancedFilters();
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300"
                >
                  Reset filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-[28px] border border-indigo-200/70 bg-gradient-to-br from-indigo-100 via-white to-cyan-100 p-4 shadow-[0_22px_48px_-34px_rgba(30,64,175,0.46)] sm:p-6">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(99,102,241,0.18),transparent_35%),radial-gradient(circle_at_85%_85%,rgba(56,189,248,0.12),transparent_30%)]" />
                <article className="relative rounded-[22px] border border-white/70 bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:p-6">
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">LIVE</span>
                        <span className="text-slate-500">{formatRelativeAge(featuredListing.createdAt)}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${realtimeStyle.className}`}>
                          <span className={`h-2 w-2 rounded-full ${realtimeStyle.dotClassName}`} />
                          {realtimeStyle.label}
                        </span>
                      </div>

                      <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl">
                        {featuredListing.displayTitle}
                      </h2>

                      <div className="mt-3 flex items-center gap-3">
                        <Image
                          src={featuredListing.avatar}
                          alt={featuredListing.displayCreator}
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded-full border border-slate-200 object-cover"
                        />
                        <div>
                          <p className="text-base font-medium text-slate-800">{featuredListing.displayCreator}</p>
                          <p className="text-sm text-slate-500">{featuredListing.distance} km away</p>
                        </div>
                      </div>

                      <p className="mt-3 text-lg text-slate-700">{featuredListing.displayDescription}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        {featuredListing.price > 0 && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-800">
                            ₹ {featuredListing.price}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                          Respond within {featuredListing.responseMinutes} mins
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                          Match {featuredListing.rankScore}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                          {featuredListing.profileCompletion}% profile
                        </span>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            featuredListing.type === "demand"
                              ? void messageProvider(featuredListing.provider_id)
                              : void bookNow(featuredListing)
                          }
                          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
                        >
                          {featuredListing.type === "demand" ? (
                            messageLoadingId === featuredListing.provider_id ? (
                              "Starting..."
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <MessageCircle size={14} />
                                Respond
                              </span>
                            )
                          ) : (
                            "Book Now"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedProvider(featuredListing.provider_id)}
                          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                        >
                          View Profile
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            featuredListing.businessSlug
                              ? router.push(`/business/${featuredListing.businessSlug}`)
                              : setSelectedProvider(featuredListing.provider_id)
                          }
                          className="text-sm font-medium text-indigo-700 hover:text-indigo-600"
                        >
                          View Details
                        </button>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-inner">
                      {featuredListing.media?.[0] ? (
                        <>
                          {featuredListing.media[0].mimeType.startsWith("image/") &&
                          !featuredListing.media[0].mimeType.startsWith("image/svg") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={featuredListing.media[0].url}
                              alt={featuredListing.displayTitle}
                              className="h-full min-h-[340px] w-full object-cover"
                            />
                          ) : featuredListing.media[0].mimeType.startsWith("video/") ? (
                            <video
                              src={featuredListing.media[0].url}
                              controls
                              preload="metadata"
                              className="h-full min-h-[340px] w-full object-cover"
                            />
                          ) : featuredListing.media[0].mimeType.startsWith("audio/") ? (
                            <div className="grid min-h-[340px] place-items-center p-4">
                              <div className="w-full">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Voice Attachment</p>
                                <audio src={featuredListing.media[0].url} controls className="w-full" preload="metadata" />
                              </div>
                            </div>
                          ) : (
                            <div className="grid min-h-[340px] place-items-center bg-gradient-to-br from-indigo-50 via-sky-50 to-slate-100 p-4 text-center">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">Graphics Attachment</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="grid min-h-[340px] place-items-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 p-4 text-center">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">Graphic Preview</p>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </div>

              {secondaryListings.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {secondaryListings.map((item, index) => {
                    const saved = savedListingIds.has(item.id);
                    const mediaKinds = getMediaKinds(item.media);
                    const listingSignals = getListingSignals(item);
                    const primaryMedia = item.media?.[0] || null;
                    const enterDelay = Math.min(index * 55, 260);

                    return (
                      <article
                        key={item.id}
                        style={{ "--enter-delay": `${enterDelay}ms` } as CSSProperties}
                        className="group post-card-enter overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_16px_30px_-24px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_26px_38px_-24px_rgba(37,99,235,0.4)]"
                      >
                        <div className="relative">
                          {primaryMedia ? (
                            <>
                              {primaryMedia.mimeType.startsWith("image/") && !primaryMedia.mimeType.startsWith("image/svg") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={primaryMedia.url}
                                  alt={item.displayTitle}
                                  className="h-52 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                />
                              ) : primaryMedia.mimeType.startsWith("video/") ? (
                                <video
                                  src={primaryMedia.url}
                                  controls
                                  preload="metadata"
                                  className="h-52 w-full object-cover"
                                />
                              ) : primaryMedia.mimeType.startsWith("audio/") ? (
                                <div className="grid h-52 place-items-center bg-slate-100 p-4">
                                  <audio src={primaryMedia.url} controls className="w-full" preload="metadata" />
                                </div>
                              ) : (
                                <div className="grid h-52 place-items-center bg-gradient-to-br from-indigo-50 via-sky-50 to-slate-100 p-4 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
                                  Graphics
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="grid h-52 place-items-center bg-gradient-to-br from-slate-100 via-white to-indigo-50 p-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                              Visual Preview
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleSaveListing(item.id)}
                            className="absolute right-2 top-2 rounded-full border border-white/70 bg-white/90 p-1.5 text-slate-600 shadow-sm transition-colors hover:text-indigo-700"
                            title="Save post"
                          >
                            {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                          </button>
                        </div>

                        <div className="p-4">
                          <div className="mb-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">{item.type}</span>
                            {mediaKinds.map((kind) => (
                              <span key={`${item.id}-${kind}`} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                {kind}
                              </span>
                            ))}
                          </div>

                          <h3 className="line-clamp-1 text-xl font-semibold tracking-tight text-slate-900">{item.displayTitle}</h3>
                          <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-relaxed text-slate-600">{item.displayDescription}</p>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {item.price > 0 && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                ₹ {item.price}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={12} />
                              {item.distance} km
                            </span>
                            <span>{formatRelativeAge(item.createdAt)}</span>
                            <span className="text-indigo-600">Match {item.rankScore}</span>
                          </div>

                          {listingSignals.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {listingSignals.slice(0, 2).map((signal) => (
                                <span
                                  key={`${item.id}-signal-${signal}`}
                                  className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700"
                                >
                                  {signal}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                item.type === "demand" ? void messageProvider(item.provider_id) : void bookNow(item)
                              }
                              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
                            >
                              {item.type === "demand"
                                ? messageLoadingId === item.provider_id
                                  ? "Starting..."
                                  : "Respond"
                                : "Book Now"}
                            </button>
                            <button
                              type="button"
                              onClick={() => item.provider_id && setSelectedProvider(item.provider_id)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-700"
                            >
                              Profile
                            </button>
                            <button
                              type="button"
                              onClick={() => hideListing(item.id)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                            >
                              Hide
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
      </section>
    </div>
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
        onPublished={() => {
          void fetchFeed(true);
        }}
      />
    )}
  </div>
);
}
