"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import RouteObservability from "@/app/components/RouteObservability";
import ProfileToastViewport, { type ProfileToast } from "@/app/components/profile/ProfileToastViewport";
import { supabase } from "@/lib/supabase";
import type { CommunityFeedResponse } from "@/lib/api/community";
import { fetchAuthedJson } from "@/lib/clientApi";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
} from "@/lib/business";
import { defaultMarketCoordinates, distanceBetweenCoordinatesKm, getBrowserCoordinates, resolveCoordinates } from "@/lib/geo";
import { resolvePostMediaUrl, resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";

const ProviderTrustPanel = dynamic(
  () => import("@/app/components/ProviderTrustPanel").then((mod) => mod.default),
  { ssr: false }
);

const CreatePostModal = dynamic(
  () => import("@/app/components/CreatePostModal").then((mod) => mod.default),
  { ssr: false }
);

const MarketplaceMap = dynamic(() => import("@/app/components/MarketplaceMap").then((mod) => mod.default), {
  ssr: false,
});

const MAX_PROFILE_LOOKUP = 240;
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const GEO_LOOKUP_TIMEOUT_MS = 1200;
const FEED_POLL_INTERVAL_MS = 120000;
const MIN_SOFT_REFRESH_GAP_MS = 5000;
const FILTER_STORAGE_KEY = "serviq-posts-filters-v2";

type ListingType = "service" | "product" | "demand";
type ListingSource = "service_listing" | "product_listing" | "post" | "help_request" | "demo";

type FeedMedia = {
  mimeType: string;
  url: string;
};

type Listing = {
  id: string;
  source: ListingSource;
  helpRequestId: string | null;
  providerId: string;
  type: ListingType;
  title: string;
  description: string;
  category: string;
  price: number;
  avatarUrl: string;
  creatorName: string;
  locationLabel: string;
  distanceKm: number;
  lat: number;
  lng: number;
  media: FeedMedia[];
  createdAt: string;
  urgent: boolean;
  rankScore: number;
  profileCompletion: number;
  responseMinutes: number;
  verificationStatus: "verified" | "pending" | "unclaimed";
  businessSlug?: string;
  status: string;
  acceptedProviderId: string | null;
  isDemo?: boolean;
};

type DisplayListing = Listing & {
  displayTitle: string;
  displayDescription: string;
  displayCreator: string;
  timeLabel: string;
  priceLabel: string;
  distanceLabel: string;
};

type FlexibleRow = Record<string, unknown>;

type RealtimeHealth = "connecting" | "connected" | "reconnecting" | "error" | "idle";

type FeedFilterState = {
  query: string;
  category: string;
  maxDistanceKm: number;
  urgentOnly: boolean;
  mediaOnly: boolean;
  verifiedOnly: boolean;
  freshOnly: boolean;
};

type ServiceRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  created_at: string;
};

type ProductRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  provider_id: string;
  created_at: string;
};

type PostRow = {
  id: string;
  text: string;
  content: string;
  description: string;
  title: string;
  user_id: string;
  provider_id: string;
  created_by: string;
  type: string;
  post_type: string;
  category: string;
  status: string;
  state: string;
  created_at: string;
};

type HelpRequestRow = {
  id: string;
  requester_id: string;
  accepted_provider_id: string;
  title: string;
  details: string;
  category: string;
  urgency: string;
  budget_min: number;
  budget_max: number;
  location_label: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  created_at: string;
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

type ProviderPresenceRow = {
  provider_id: string;
  is_online: boolean | null;
  availability: string | null;
  rolling_response_minutes: number | null;
};

const stringFromRow = (row: FlexibleRow, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
};

const numberFromRow = (row: FlexibleRow, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const parseDateMs = (value?: string) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMarketplacePostKind = (value?: string | null): ListingType => {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "service" || normalized === "product") return normalized;
  return "demand";
};

const mediaRegex = /\[([^\]]+)\]\s(https?:\/\/[^\s,]+)/g;

const parsePostText = (rawText: string) => {
  const fallback = {
    title: rawText || "Local post",
    description: rawText || "Local post",
    budget: 0,
    category: "Need",
    location: "",
    kind: "demand" as ListingType,
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
  const typePart = parts.find((item) => item.startsWith("Type:"));
  const mediaPart = parts.find((item) => item.startsWith("Media:"));

  const budgetMatch = budgetPart?.match(/(\d+(\.\d+)?)/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : 0;
  const kind = normalizeMarketplacePostKind(typePart?.replace("Type:", "").trim());
  const category =
    categoryPart?.replace("Category:", "").trim() ||
    (kind === "demand" ? "Need" : kind === "service" ? "Service" : "Product");
  const location = locationPart?.replace("Location:", "").trim() || "";

  const media: FeedMedia[] = [];
  if (mediaPart && !mediaPart.includes("None")) {
    const payload = mediaPart.replace("Media:", "").trim();
    for (const match of payload.matchAll(mediaRegex)) {
      const mediaUrl = resolvePostMediaUrl(match[2].trim());
      if (!mediaUrl) continue;
      media.push({
        mimeType: match[1].trim(),
        url: mediaUrl,
      });
    }
  }

  return { title, description, budget, category, location, kind, media };
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

const toDisplayText = (value: string | undefined, fallback: string) => {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  if (/^[a-z0-9]{10,}$/i.test(normalized)) return fallback;
  if (/^(.)\1{4,}$/i.test(normalized)) return fallback;
  return normalized;
};

const listingFingerprint = (item: Listing) => {
  const normalizedTitle = (item.title || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 56);
  const normalizedDescription = (item.description || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 96);
  const normalizedCategory = (item.category || "").toLowerCase().trim();
  const normalizedOwner = (item.providerId || "community").toLowerCase().trim();
  const roundedPrice = item.price > 0 ? Math.round(item.price) : 0;

  return [item.type, normalizedOwner, normalizedCategory, normalizedTitle, normalizedDescription, roundedPrice].join("|");
};

const sourcePriority: Record<ListingSource, number> = {
  help_request: 5,
  post: 4,
  service_listing: 3,
  product_listing: 3,
  demo: 1,
};

const pickPreferredListing = (current: Listing, incoming: Listing) => {
  if (sourcePriority[incoming.source] !== sourcePriority[current.source]) {
    return sourcePriority[incoming.source] > sourcePriority[current.source] ? incoming : current;
  }

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

const normalizeSearchTokens = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const matchesFeedFilters = (item: Listing, state: FeedFilterState) => {
  const queryTokens = normalizeSearchTokens(state.query);
  const haystack = `${item.title} ${item.description} ${item.category} ${item.creatorName} ${item.locationLabel} ${item.type}`.toLowerCase();
  const matchesSearch = queryTokens.every((token) => haystack.includes(token));

  const normalizedCategory = state.category.toLowerCase();
  const matchesCategory =
    state.category === "all" ||
    item.type === normalizedCategory ||
    item.category.toLowerCase().includes(normalizedCategory);

  const matchesDistance = state.maxDistanceKm > 0 ? item.distanceKm <= state.maxDistanceKm : true;
  const matchesUrgent = state.urgentOnly ? item.urgent : true;
  const matchesMedia = state.mediaOnly ? item.media.length > 0 : true;
  const matchesVerified = state.verifiedOnly ? item.verificationStatus === "verified" : true;
  const matchesFresh = state.freshOnly ? isFreshListing(item.createdAt) : true;

  return matchesSearch && matchesCategory && matchesDistance && matchesUrgent && matchesMedia && matchesVerified && matchesFresh;
};

const formatPriceLabel = (item: Pick<Listing, "price" | "type">) => {
  if (item.price > 0) return `INR ${Math.round(item.price).toLocaleString("en-IN")}`;
  if (item.type === "demand") return "Budget shared in chat";
  return "Price on request";
};

const buildDemoFeed = (): Listing[] => {
  const now = Date.now();
  const baseLat = 28.6139;
  const baseLng = 77.209;
  const demoRows: Array<Omit<Listing, "id" | "lat" | "lng" | "rankScore">> = [
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-requester-1",
      type: "demand",
      title: "Need urgent electrician for switchboard issue",
      description: "Frequent sparks in kitchen switchboard. Need support today.",
      category: "Electrical",
      price: 1800,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-requester-1",
      creatorName: "Amit P",
      locationLabel: "Indiranagar",
      distanceKm: 1.8,
      media: [{ mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=1200&q=80" }],
      createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
      urgent: true,
      profileCompletion: 78,
      responseMinutes: 8,
      verificationStatus: "pending",
      businessSlug: createBusinessSlug("Amit P", "demo-requester-1"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-requester-2",
      type: "demand",
      title: "Looking for same-day laptop repair",
      description: "Laptop charging port stopped working. Need doorstep repair.",
      category: "Repair",
      price: 2400,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-requester-2",
      creatorName: "Ria M",
      locationLabel: "Koramangala",
      distanceKm: 2.9,
      media: [{ mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&q=80" }],
      createdAt: new Date(now - 70 * 60 * 1000).toISOString(),
      urgent: true,
      profileCompletion: 82,
      responseMinutes: 11,
      verificationStatus: "pending",
      businessSlug: createBusinessSlug("Ria M", "demo-requester-2"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-provider-1",
      type: "service",
      title: "Verified AC servicing package",
      description: "Filter cleaning, gas top-up, and coil care with 30-day support.",
      category: "HVAC",
      price: 1499,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-provider-1",
      creatorName: "ChillTech Services",
      locationLabel: "HSR Layout",
      distanceKm: 3.3,
      media: [{ mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80" }],
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      urgent: false,
      profileCompletion: 91,
      responseMinutes: 14,
      verificationStatus: "verified",
      businessSlug: createBusinessSlug("ChillTech Services", "demo-provider-1"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-seller-1",
      type: "product",
      title: "Power tools combo set",
      description: "Drill, precision bits, safety gloves, and carrying case.",
      category: "Tools",
      price: 3299,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-seller-1",
      creatorName: "ToolHub Local",
      locationLabel: "Whitefield",
      distanceKm: 6.4,
      media: [{ mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1200&q=80" }],
      createdAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
      urgent: false,
      profileCompletion: 88,
      responseMinutes: 20,
      verificationStatus: "verified",
      businessSlug: createBusinessSlug("ToolHub Local", "demo-seller-1"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-requester-3",
      type: "demand",
      title: "Need quick home deep-clean support",
      description: "1BHK deep clean before guests arrive this evening.",
      category: "Cleaning",
      price: 2200,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-requester-3",
      creatorName: "Megha S",
      locationLabel: "BTM Layout",
      distanceKm: 4.1,
      media: [{ mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&q=80" }],
      createdAt: new Date(now - 110 * 60 * 1000).toISOString(),
      urgent: true,
      profileCompletion: 72,
      responseMinutes: 10,
      verificationStatus: "unclaimed",
      businessSlug: createBusinessSlug("Megha S", "demo-requester-3"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-provider-2",
      type: "service",
      title: "Doorstep car wash express",
      description: "Interior and exterior wash within 45 minutes.",
      category: "Car Care",
      price: 799,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-provider-2",
      creatorName: "SparkleWash",
      locationLabel: "Jayanagar",
      distanceKm: 5.2,
      media: [{ mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80" }],
      createdAt: new Date(now - 8 * 60 * 60 * 1000).toISOString(),
      urgent: false,
      profileCompletion: 85,
      responseMinutes: 16,
      verificationStatus: "verified",
      businessSlug: createBusinessSlug("SparkleWash", "demo-provider-2"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-requester-4",
      type: "demand",
      title: "Need photographer for cafe launch",
      description: "Candid plus short-form reels coverage for opening day.",
      category: "Photography",
      price: 12000,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-requester-4",
      creatorName: "Cafe Bloom",
      locationLabel: "MG Road",
      distanceKm: 2.3,
      media: [
        { mimeType: "video/mp4", url: "/hero/market-live-loop.mp4" },
        { mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1493666438817-866a91353ca9?w=1200&q=80" },
      ],
      createdAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      urgent: true,
      profileCompletion: 81,
      responseMinutes: 13,
      verificationStatus: "pending",
      businessSlug: createBusinessSlug("Cafe Bloom", "demo-requester-4"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
    {
      source: "demo",
      helpRequestId: null,
      providerId: "demo-seller-2",
      type: "product",
      title: "Fresh farm produce bundle",
      description: "Weekly produce basket with early-morning delivery.",
      category: "Groceries",
      price: 499,
      avatarUrl: "https://i.pravatar.cc/150?u=demo-seller-2",
      creatorName: "FarmCart Local",
      locationLabel: "Sarjapur",
      distanceKm: 7.1,
      media: [{ mimeType: "image/jpeg", url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&q=80" }],
      createdAt: new Date(now - 14 * 60 * 60 * 1000).toISOString(),
      urgent: false,
      profileCompletion: 84,
      responseMinutes: 24,
      verificationStatus: "verified",
      businessSlug: createBusinessSlug("FarmCart Local", "demo-seller-2"),
      status: "open",
      acceptedProviderId: null,
      isDemo: true,
    },
  ];

  return demoRows.map((row, index) => ({
    ...row,
    id: `demo-${index + 1}`,
    lat: baseLat + index * 0.013,
    lng: baseLng + index * 0.011,
    rankScore: calculateLocalRankScore({
      distanceKm: row.distanceKm,
      responseMinutes: row.responseMinutes,
      rating: row.verificationStatus === "verified" ? 4.8 : 4.4,
      profileCompletion: row.profileCompletion,
    }),
  }));
};

const buildFeedCardId = (item: Listing | DisplayListing) => `dashboard:${item.source}:${item.type}:${item.id}`;

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

function MediaCarousel({ media, title }: { media: FeedMedia[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media.length) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-center">
        <div>
          <p className="text-xs font-semibold text-slate-600">No media yet</p>
          <p className="mt-1 text-[11px] text-slate-500">This post does not include image or video attachments.</p>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(activeIndex, media.length - 1);
  const current = media[safeIndex];
  const canNavigate = media.length > 1;

  const goNext = () => {
    setActiveIndex((currentIndex) => {
      const normalized = Math.min(currentIndex, media.length - 1);
      return (normalized + 1) % media.length;
    });
  };

  const goPrev = () => {
    setActiveIndex((currentIndex) => {
      const normalized = Math.min(currentIndex, media.length - 1);
      return (normalized - 1 + media.length) % media.length;
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="aspect-[16/9]">
        {current.mimeType.startsWith("image/") && !current.mimeType.startsWith("image/svg") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={title} className="h-full w-full object-cover" />
        ) : current.mimeType.startsWith("video/") ? (
          <video src={current.url} controls preload="metadata" className="h-full w-full object-cover" />
        ) : current.mimeType.startsWith("audio/") ? (
          <div className="grid h-full place-items-center bg-slate-900 p-4 text-center">
            <div className="w-full max-w-xs space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Audio Attachment</p>
              <audio src={current.url} controls className="w-full" preload="metadata" />
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Media Preview</p>
          </div>
        )}
      </div>

      {canNavigate && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Previous media"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Next media"
          >
            <ChevronRight size={14} />
          </button>
        </>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-white">
        {Math.min(safeIndex + 1, media.length)} / {media.length}
      </div>
    </div>
  );
}

type AcceptConfirmDialogProps = {
  open: boolean;
  listing: DisplayListing | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function AcceptConfirmDialog({ open, listing, busy, onCancel, onConfirm }: AcceptConfirmDialogProps) {
  if (!open || !listing) return null;

  return (
    <div className="fixed inset-0 z-[1400] grid place-items-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Confirm Task Acceptance</p>
            <p className="mt-1 text-sm text-slate-600">Are you sure you want to accept this task?</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="line-clamp-1 text-sm font-semibold text-slate-900">{listing.displayTitle}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{listing.displayDescription}</p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {busy ? "Accepting..." : "Yes, Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_FILTER_STATE: FeedFilterState = {
  query: "",
  category: "all",
  maxDistanceKm: 0,
  urgentOnly: false,
  mediaOnly: false,
  verifiedOnly: false,
  freshOnly: false,
};

const CLOSED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "closed",
  "completed",
  "fulfilled",
  "archived",
  "deleted",
  "hidden",
]);

const isClosedStatus = (status?: string | null) => CLOSED_STATUSES.has((status || "").trim().toLowerCase());

const FALLBACK_AVATAR = "https://i.pravatar.cc/150?u=serviq-default";

const getListingOwnerIdFromPost = (row: FlexibleRow) =>
  stringFromRow(row, ["user_id", "provider_id", "created_by", "author_id", "requester_id", "owner_id"], "");

const normalizeStatusLabel = (status?: string | null) => {
  const normalized = (status || "open").trim().toLowerCase();
  if (!normalized) return "Open";
  return normalized
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const isUUIDLike = (value?: string | null) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export default function MarketplacePage() {
  const router = useRouter();

  const [feed, setFeed] = useState<Listing[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [viewerCoordinates, setViewerCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);

  const [filters, setFilters] = useState<FeedFilterState>(DEFAULT_FILTER_STATE);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [savedListingIds, setSavedListingIds] = useState<Set<string>>(new Set());
  const [savingListingIds, setSavingListingIds] = useState<Set<string>>(new Set());
  const [sharingListingIds, setSharingListingIds] = useState<Set<string>>(new Set());
  const [acceptingListingIds, setAcceptingListingIds] = useState<Set<string>>(new Set());
  const [chatOpeningProviderId, setChatOpeningProviderId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedChannelHealth, setFeedChannelHealth] = useState<RealtimeHealth>("connecting");

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [openPostModal, setOpenPostModal] = useState(false);
  const [activeMapItemId, setActiveMapItemId] = useState<string | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<DisplayListing | null>(null);

  const [toasts, setToasts] = useState<ProfileToast[]>([]);

  const cardRefs = useRef<Map<string, HTMLElement | null>>(new Map());
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const fetchAbortRef = useRef<AbortController | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const lastSoftRefreshAtRef = useRef(0);

  const pushToast = useCallback((kind: ProfileToast["kind"], message: string) => {
    const toastId =
      typeof window !== "undefined" && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => [...current, { id: toastId, kind, message }]);

    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
      toastTimersRef.current.delete(toastId);
    }, 4600);

    toastTimersRef.current.set(toastId, timeoutId);
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;

    return () => {
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      fetchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const rawFilters = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters) as Partial<FeedFilterState>;
        setFilters((current) => ({
          ...current,
          ...parsed,
          query: typeof parsed.query === "string" ? parsed.query : current.query,
          category: typeof parsed.category === "string" ? parsed.category : current.category,
          maxDistanceKm:
            typeof parsed.maxDistanceKm === "number" && Number.isFinite(parsed.maxDistanceKm)
              ? Math.max(0, parsed.maxDistanceKm)
              : current.maxDistanceKm,
          urgentOnly: typeof parsed.urgentOnly === "boolean" ? parsed.urgentOnly : current.urgentOnly,
          mediaOnly: typeof parsed.mediaOnly === "boolean" ? parsed.mediaOnly : current.mediaOnly,
          verifiedOnly: typeof parsed.verifiedOnly === "boolean" ? parsed.verifiedOnly : current.verifiedOnly,
          freshOnly: typeof parsed.freshOnly === "boolean" ? parsed.freshOnly : current.freshOnly,
        }));
      }

      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get("q") || "";
      const focusParam = params.get("focus") || "";
      if (queryParam.trim()) {
        setFilters((current) => ({ ...current, query: queryParam.trim() }));
      }
      if (focusParam.trim()) {
        setActiveMapItemId(focusParam.trim());
      }
    } catch {
      // Local storage hydration is best effort.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

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

  const buildFeedContextPath = useCallback((item: DisplayListing) => {
    const params = new URLSearchParams({
      source: "posts_feed",
      focus: item.id,
      q: filters.query || "",
    });
    return `/dashboard?${params.toString()}`;
  }, [filters.query]);

  const buildSaveMetadata = useCallback((item: DisplayListing) => {
    const gallery = item.media.map((entry) => entry.url).filter(Boolean).slice(0, 3);
    return {
      subtitle: item.displayDescription,
      ownerName: item.displayCreator,
      category: item.category,
      status: item.status,
      priceLabel: item.priceLabel,
      etaLabel: `Responds in ~${item.responseMinutes} mins`,
      locationLabel: item.locationLabel,
      mediaGallery: gallery,
      image: gallery[0] || item.avatarUrl || null,
      tags: [item.type, item.category, item.verificationStatus],
    };
  }, []);

  const loadSavedListings = useCallback(async () => {
    if (!viewerId) {
      setSavedListingIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("feed_card_saves")
      .select("card_id")
      .eq("user_id", viewerId)
      .limit(300);

    if (error) {
      if (/relation .* does not exist|table .* does not exist/i.test(error.message || "")) {
        return;
      }
      console.warn("Unable to load saved cards:", error.message);
      return;
    }

    const nextSavedIds = new Set(
      (((data as Array<{ card_id?: string }> | null) || [])
        .map((row) => row.card_id)
        .filter((cardId): cardId is string => typeof cardId === "string" && cardId.length > 0))
    );
    setSavedListingIds(nextSavedIds);
  }, [viewerId]);

  useEffect(() => {
    let active = true;

    const boot = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      setViewerId(user?.id || null);
    };

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setViewerId(session?.user?.id || null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const resolveViewerCoords = async () => {
      const browserCoordinates = await getBrowserCoordinates(GEO_LOOKUP_TIMEOUT_MS);
      if (!active || !browserCoordinates) return;
      setViewerCoordinates({ latitude: browserCoordinates.latitude, longitude: browserCoordinates.longitude });
    };

    void resolveViewerCoords();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void loadSavedListings();
  }, [loadSavedListings]);

  useEffect(() => {
    if (!viewerId) return;

    const channel = supabase
      .channel(`posts-feed-saves-${viewerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_saves",
          filter: `user_id=eq.${viewerId}`,
        },
        (payload) => {
          const previous = (payload.old as { card_id?: string } | null)?.card_id || "";
          const next = (payload.new as { card_id?: string } | null)?.card_id || "";
          const cardId = next || previous;
          if (!cardId) return;

          setSavedListingIds((current) => {
            const updated = new Set(current);
            if (payload.eventType === "DELETE") {
              updated.delete(cardId);
            } else {
              updated.add(cardId);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [viewerId]);

  const buildListingsFromSnapshot = useCallback(
    (payload: Extract<CommunityFeedResponse, { ok: true }>) => {
      const profileRows = (payload.profiles || []) as ProfileRow[];
      const serviceRows = (payload.services || []) as ServiceRow[];
      const productRows = (payload.products || []) as ProductRow[];
      const postRows = (payload.posts || []) as PostRow[];
      const helpRows = (payload.helpRequests || []) as HelpRequestRow[];
      const reviewRows = (payload.reviews || []) as ReviewRow[];
      const presenceRows = (payload.presence || []) as ProviderPresenceRow[];

      const profileMap = new Map<string, ProfileRow>();
      profileRows.slice(0, MAX_PROFILE_LOOKUP).forEach((profile) => {
        if (profile.id) {
          profileMap.set(profile.id, profile);
        }
      });

      const reviewStats = new Map<string, { total: number; count: number }>();
      reviewRows.forEach((row) => {
        if (!row.provider_id || typeof row.rating !== "number" || !Number.isFinite(row.rating)) return;
        const current = reviewStats.get(row.provider_id) || { total: 0, count: 0 };
        reviewStats.set(row.provider_id, {
          total: current.total + row.rating,
          count: current.count + 1,
        });
      });

      const presenceMap = new Map<string, ProviderPresenceRow>();
      presenceRows.forEach((row) => {
        if (row.provider_id) {
          presenceMap.set(row.provider_id, row);
        }
      });

      const listingVolumeByProvider = new Map<string, number>();
      const bumpVolume = (providerId: string) => {
        if (!providerId) return;
        listingVolumeByProvider.set(providerId, (listingVolumeByProvider.get(providerId) || 0) + 1);
      };

      serviceRows.forEach((row) => bumpVolume(row.provider_id));
      productRows.forEach((row) => bumpVolume(row.provider_id));
      postRows.forEach((row) => {
        const ownerId = getListingOwnerIdFromPost(row as unknown as FlexibleRow);
        bumpVolume(ownerId);
      });
      helpRows.forEach((row) => bumpVolume(row.requester_id));

      const viewerPoint = viewerCoordinates || defaultMarketCoordinates();

      const resolveProfileMeta = (providerId: string) => {
        const profile = profileMap.get(providerId);
        const presence = presenceMap.get(providerId);
        const review = reviewStats.get(providerId);

        const profileCompletion = calculateProfileCompletion(profile || {});
        const averageRating = review?.count ? review.total / review.count : 4.2;
        const reviewCount = review?.count || 0;
        const listingsCount = listingVolumeByProvider.get(providerId) || 0;
        const responseMinutes = estimateResponseMinutes({
          availability: presence?.availability || profile?.availability,
          providerId,
          baseResponseMinutes: presence?.rolling_response_minutes || null,
        });

        const verificationStatus = calculateVerificationStatus({
          role: profile?.role,
          profileCompletion,
          listingsCount,
          averageRating,
          reviewCount,
        });

        return {
          profile,
          profileCompletion,
          averageRating,
          reviewCount,
          responseMinutes,
          verificationStatus,
          name: stringFromRow(profile || {}, ["name", "full_name", "display_name"], "Local member"),
          avatarUrl: resolveProfileAvatarUrl(stringFromRow(profile || {}, ["avatar_url", "avatar", "image_url"], "")) || FALLBACK_AVATAR,
          locationLabel: stringFromRow(profile || {}, ["location", "city"], "Nearby"),
          businessSlug: createBusinessSlug(stringFromRow(profile || {}, ["name", "full_name", "display_name"], "Local member"), providerId),
        };
      };

      const nextListings: Listing[] = [];

      serviceRows.forEach((serviceRow) => {
        const row = serviceRow as unknown as FlexibleRow;
        const providerId = stringFromRow(row, ["provider_id", "user_id", "created_by"], "");
        if (!providerId) return;

        const profileMeta = resolveProfileMeta(providerId);
        const locationLabel = stringFromRow(row, ["location_label", "location"], profileMeta.locationLabel);
        const coordinates = resolveCoordinates({
          row,
          location: locationLabel,
          seed: `${providerId}:service:${serviceRow.id}`,
        });

        const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);
        const title = stringFromRow(row, ["title", "name"], "Local service");
        const description = stringFromRow(row, ["description", "details", "text"], "Service listing");
        const category = stringFromRow(row, ["category", "service_category", "type"], "Service");
        const createdAt = stringFromRow(row, ["created_at"], new Date().toISOString());
        const price = numberFromRow(row, ["price", "amount", "rate"], 0);

        nextListings.push({
          id: serviceRow.id,
          source: "service_listing",
          helpRequestId: null,
          providerId,
          type: "service",
          title,
          description,
          category,
          price,
          avatarUrl: profileMeta.avatarUrl,
          creatorName: profileMeta.name,
          locationLabel,
          distanceKm,
          lat: coordinates.latitude,
          lng: coordinates.longitude,
          media: [],
          createdAt,
          urgent: false,
          rankScore: calculateLocalRankScore({
            distanceKm,
            responseMinutes: profileMeta.responseMinutes,
            rating: profileMeta.averageRating,
            profileCompletion: profileMeta.profileCompletion,
          }),
          profileCompletion: profileMeta.profileCompletion,
          responseMinutes: profileMeta.responseMinutes,
          verificationStatus: profileMeta.verificationStatus,
          businessSlug: profileMeta.businessSlug,
          status: stringFromRow(row, ["status", "state"], "open"),
          acceptedProviderId: null,
        });
      });

      productRows.forEach((productRow) => {
        const row = productRow as unknown as FlexibleRow;
        const providerId = stringFromRow(row, ["provider_id", "user_id", "created_by"], "");
        if (!providerId) return;

        const profileMeta = resolveProfileMeta(providerId);
        const locationLabel = stringFromRow(row, ["location_label", "location"], profileMeta.locationLabel);
        const coordinates = resolveCoordinates({
          row,
          location: locationLabel,
          seed: `${providerId}:product:${productRow.id}`,
        });

        const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);
        const title = stringFromRow(row, ["title", "name"], "Local product");
        const description = stringFromRow(row, ["description", "details", "text"], "Product listing");
        const category = stringFromRow(row, ["category", "product_category", "type"], "Product");
        const createdAt = stringFromRow(row, ["created_at"], new Date().toISOString());
        const price = numberFromRow(row, ["price", "amount", "mrp"], 0);

        nextListings.push({
          id: productRow.id,
          source: "product_listing",
          helpRequestId: null,
          providerId,
          type: "product",
          title,
          description,
          category,
          price,
          avatarUrl: profileMeta.avatarUrl,
          creatorName: profileMeta.name,
          locationLabel,
          distanceKm,
          lat: coordinates.latitude,
          lng: coordinates.longitude,
          media: [],
          createdAt,
          urgent: false,
          rankScore: calculateLocalRankScore({
            distanceKm,
            responseMinutes: profileMeta.responseMinutes,
            rating: profileMeta.averageRating,
            profileCompletion: profileMeta.profileCompletion,
          }),
          profileCompletion: profileMeta.profileCompletion,
          responseMinutes: profileMeta.responseMinutes,
          verificationStatus: profileMeta.verificationStatus,
          businessSlug: profileMeta.businessSlug,
          status: stringFromRow(row, ["status", "state"], "open"),
          acceptedProviderId: null,
        });
      });

      postRows.forEach((postRow) => {
        const row = postRow as unknown as FlexibleRow;
        const providerId = getListingOwnerIdFromPost(row);
        if (!providerId) return;

        const profileMeta = resolveProfileMeta(providerId);
        const parsedFromText = parsePostText(stringFromRow(row, ["text", "content", "description", "title"], ""));
        const type = normalizeMarketplacePostKind(stringFromRow(row, ["type", "post_type"], parsedFromText.kind));

        const locationLabel =
          parsedFromText.location ||
          stringFromRow(row, ["location_label", "location"], profileMeta.locationLabel);

        const coordinates = resolveCoordinates({
          row,
          location: locationLabel,
          seed: `${providerId}:post:${postRow.id}`,
        });

        const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);
        const title =
          stringFromRow(row, ["title"], "") ||
          parsedFromText.title ||
          (type === "demand" ? "Need local support" : "Marketplace update");
        const description =
          stringFromRow(row, ["description", "content", "text"], "") ||
          parsedFromText.description ||
          title;
        const category =
          stringFromRow(row, ["category"], "") ||
          parsedFromText.category ||
          (type === "demand" ? "Need" : type === "service" ? "Service" : "Product");
        const createdAt = stringFromRow(row, ["created_at"], new Date().toISOString());
        const status = stringFromRow(row, ["status", "state"], "open");
        if (isClosedStatus(status)) return;

        const urgent =
          type === "demand" &&
          /urgent|asap|immediate|today|quick|critical|emergency/i.test(`${title} ${description} ${status}`);

        const parsedBudget = parsedFromText.budget > 0 ? parsedFromText.budget : 0;

        nextListings.push({
          id: postRow.id,
          source: "post",
          helpRequestId: null,
          providerId,
          type,
          title,
          description,
          category,
          price: parsedBudget,
          avatarUrl: profileMeta.avatarUrl,
          creatorName: profileMeta.name,
          locationLabel,
          distanceKm,
          lat: coordinates.latitude,
          lng: coordinates.longitude,
          media: parsedFromText.media,
          createdAt,
          urgent,
          rankScore: calculateLocalRankScore({
            distanceKm,
            responseMinutes: profileMeta.responseMinutes,
            rating: profileMeta.averageRating,
            profileCompletion: profileMeta.profileCompletion,
          }),
          profileCompletion: profileMeta.profileCompletion,
          responseMinutes: profileMeta.responseMinutes,
          verificationStatus: profileMeta.verificationStatus,
          businessSlug: profileMeta.businessSlug,
          status,
          acceptedProviderId: null,
        });
      });

      helpRows.forEach((helpRow) => {
        const row = helpRow as unknown as FlexibleRow;
        const providerId = stringFromRow(row, ["requester_id", "user_id", "created_by"], "");
        if (!providerId) return;

        const profileMeta = resolveProfileMeta(providerId);
        const title = stringFromRow(row, ["title", "name"], "Need local support");
        const description = stringFromRow(row, ["details", "description", "text"], "Need details shared by requester");
        const category = stringFromRow(row, ["category"], "Need");
        const budgetMax = numberFromRow(row, ["budget_max"], 0);
        const budgetMin = numberFromRow(row, ["budget_min", "budget"], 0);
        const createdAt = stringFromRow(row, ["created_at"], new Date().toISOString());
        const status = stringFromRow(row, ["status"], "open");

        if (isClosedStatus(status)) return;

        const locationLabel =
          stringFromRow(row, ["location_label", "location"], "") ||
          profileMeta.locationLabel ||
          "Nearby";

        const coordinates = resolveCoordinates({
          row,
          location: locationLabel,
          seed: `${providerId}:help:${helpRow.id}`,
        });

        const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);
        const urgency = stringFromRow(row, ["urgency"], "");
        const urgent = /urgent|asap|immediate|critical|high|emergency/i.test(urgency || `${title} ${description}`);
        const acceptedProviderId = stringFromRow(row, ["accepted_provider_id"], "") || null;

        nextListings.push({
          id: helpRow.id,
          source: "help_request",
          helpRequestId: helpRow.id,
          providerId,
          type: "demand",
          title,
          description,
          category,
          price: budgetMax > 0 ? budgetMax : budgetMin,
          avatarUrl: profileMeta.avatarUrl,
          creatorName: profileMeta.name,
          locationLabel,
          distanceKm,
          lat: coordinates.latitude,
          lng: coordinates.longitude,
          media: [],
          createdAt,
          urgent,
          rankScore: calculateLocalRankScore({
            distanceKm,
            responseMinutes: profileMeta.responseMinutes,
            rating: profileMeta.averageRating,
            profileCompletion: profileMeta.profileCompletion,
          }),
          profileCompletion: profileMeta.profileCompletion,
          responseMinutes: profileMeta.responseMinutes,
          verificationStatus: profileMeta.verificationStatus,
          businessSlug: profileMeta.businessSlug,
          status,
          acceptedProviderId,
        });
      });

      const deduped = dedupeListings(nextListings);
      const sorted = deduped.sort((left, right) => {
        const leftTaken = Boolean(left.acceptedProviderId);
        const rightTaken = Boolean(right.acceptedProviderId);
        if (leftTaken !== rightTaken) {
          return leftTaken ? 1 : -1;
        }

        if (left.urgent !== right.urgent) {
          return left.urgent ? -1 : 1;
        }

        if (left.rankScore !== right.rankScore) {
          return right.rankScore - left.rankScore;
        }

        return parseDateMs(right.createdAt) - parseDateMs(left.createdAt);
      });

      return sorted;
    },
    [viewerCoordinates]
  );

  const fetchFeed = useCallback(
    async (hardRefresh = false) => {
      const now = Date.now();
      if (!hardRefresh && now - lastSoftRefreshAtRef.current < MIN_SOFT_REFRESH_GAP_MS) {
        return;
      }

      lastSoftRefreshAtRef.current = now;
      setFeedError(null);

      if (hardRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const controller = new AbortController();
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = controller;

      try {
        const payload = await fetchAuthedJson<CommunityFeedResponse>(supabase, "/api/community/feed", {
          method: "GET",
          signal: controller.signal,
        });

        if (!payload.ok) {
          throw new Error(payload.message || "Unable to load posts feed.");
        }

        setViewerId(payload.currentUserId || null);

        const nextFeed = buildListingsFromSnapshot(payload);
        setFeed(nextFeed.length ? nextFeed : buildDemoFeed());
      } catch (error) {
        if (isAbortLikeError(error)) return;

        const message = toErrorMessage(error, "Unable to load posts feed.");
        setFeedError(message);

        if (isFailedFetchError(error)) {
          pushToast("error", "Network issue detected. Showing the latest available posts.");
        }

        setFeed((current) => (current.length ? current : buildDemoFeed()));
      } finally {
        if (fetchAbortRef.current === controller) {
          fetchAbortRef.current = null;
        }

        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildListingsFromSnapshot, pushToast]
  );

  useEffect(() => {
    void fetchFeed(true);
  }, [fetchFeed]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchFeed(false);
    }, FEED_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchFeed]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = window.setTimeout(() => {
        void fetchFeed(false);
      }, 360);
    };

    const channel = supabase
      .channel("posts-feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "help_requests" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleRefresh)
      .subscribe((status) => {
        setFeedChannelHealth(mapRealtimeHealth(status));
      });

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchFeed]);

  const isSavedListing = useCallback(
    (item: Listing | DisplayListing) => {
      const cardId = buildFeedCardId(item);
      return savedListingIds.has(cardId) || savedListingIds.has(item.id);
    },
    [savedListingIds]
  );

  const isListingBusy = useCallback((item: Listing | DisplayListing, busyIds: Set<string>) => {
    const cardId = buildFeedCardId(item);
    return busyIds.has(cardId) || busyIds.has(item.id);
  }, []);

  const persistListingShare = useCallback(
    async (item: DisplayListing, channel: "native" | "clipboard", activeViewerId: string | null) => {
      if (!activeViewerId) return;

      const { error } = await supabase.from("feed_card_shares").insert({
        user_id: activeViewerId,
        card_id: buildFeedCardId(item),
        focus_id: item.id,
        card_type: item.type,
        title: item.displayTitle,
        channel,
        metadata: {
          ...buildSaveMetadata(item),
          actionPath: buildFeedContextPath(item),
        },
      });

      if (error) {
        if (/relation .* does not exist|table .* does not exist/i.test(error.message || "")) return;
        console.warn("Unable to persist share analytics:", error.message);
      }
    },
    [buildFeedContextPath, buildSaveMetadata]
  );

  const toggleSaveListing = useCallback(
    async (item: DisplayListing) => {
      const cardId = buildFeedCardId(item);
      const wasSaved = isSavedListing(item);
      const shouldSave = !wasSaved;

      setSavingListingIds((current) => new Set(current).add(cardId));
      setSavedListingIds((current) => {
        const next = new Set(current);
        if (shouldSave) {
          next.add(cardId);
        } else {
          next.delete(cardId);
          next.delete(item.id);
        }
        return next;
      });

      try {
        const activeViewerId = await ensureViewerId();

        if (shouldSave) {
          const { error } = await supabase.from("feed_card_saves").upsert(
            {
              user_id: activeViewerId,
              card_id: cardId,
              focus_id: item.id,
              card_type: item.type,
              title: item.displayTitle,
              subtitle: item.displayDescription,
              action_path: buildFeedContextPath(item),
              metadata: buildSaveMetadata(item),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,card_id" }
          );

          if (error) {
            throw new Error(error.message);
          }

          pushToast("success", "Post saved.");
          return;
        }

        const { error } = await supabase
          .from("feed_card_saves")
          .delete()
          .eq("user_id", activeViewerId)
          .eq("card_id", cardId);

        if (error) {
          throw new Error(error.message);
        }

        pushToast("success", "Removed from saved.");
      } catch (error) {
        setSavedListingIds((current) => {
          const next = new Set(current);
          if (wasSaved) {
            next.add(cardId);
          } else {
            next.delete(cardId);
          }
          return next;
        });

        pushToast("error", toErrorMessage(error, "Unable to update save state."));
      } finally {
        setSavingListingIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          next.delete(item.id);
          return next;
        });
      }
    },
    [buildFeedContextPath, buildSaveMetadata, ensureViewerId, isSavedListing, pushToast]
  );

  const handleShareListing = useCallback(
    async (item: DisplayListing) => {
      const cardId = buildFeedCardId(item);
      const sharePath = buildFeedContextPath(item);
      const shareUrl = `${window.location.origin}${sharePath}`;
      const shareText = `${item.displayTitle} • ${item.displayCreator} • ${item.priceLabel}`;

      setSharingListingIds((current) => new Set(current).add(cardId));

      try {
        let activeViewerId: string | null = null;
        try {
          activeViewerId = await ensureViewerId();
        } catch {
          activeViewerId = null;
        }

        if (navigator.share) {
          await navigator.share({
            title: item.displayTitle,
            text: shareText,
            url: shareUrl,
          });
          await persistListingShare(item, "native", activeViewerId);
          pushToast("success", "Share sent.");
          return;
        }

        if (!navigator.clipboard?.writeText) {
          throw new Error("This browser does not support clipboard sharing.");
        }

        await navigator.clipboard.writeText(`${item.displayTitle}\n${shareText}\n${shareUrl}`);
        await persistListingShare(item, "clipboard", activeViewerId);
        pushToast("success", "Share link copied.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        pushToast("error", toErrorMessage(error, "Unable to share this post."));
      } finally {
        setSharingListingIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          next.delete(item.id);
          return next;
        });
      }
    },
    [buildFeedContextPath, ensureViewerId, persistListingShare, pushToast]
  );

  const openChatThread = useCallback(
    async (item: DisplayListing) => {
      const ownerId = item.providerId?.trim() || "";
      if (!ownerId || ownerId.startsWith("demo-") || !isUUIDLike(ownerId)) {
        pushToast("info", "Chat is available only for live accounts.");
        return;
      }

      setChatOpeningProviderId(ownerId);

      try {
        const activeViewerId = await ensureViewerId();
        if (activeViewerId === ownerId) {
          pushToast("info", "This is your own post.");
          return;
        }

        const conversationId = await getOrCreateDirectConversationId(supabase, activeViewerId, ownerId);
        router.push(`/dashboard/chat?open=${conversationId}`);
      } catch (error) {
        pushToast("error", toErrorMessage(error, "Unable to open chat."));
      } finally {
        setChatOpeningProviderId((current) => (current === ownerId ? null : current));
      }
    },
    [ensureViewerId, pushToast, router]
  );

  const openAcceptDialog = useCallback(
    (item: DisplayListing) => {
      if (!item.helpRequestId) {
        pushToast("info", "Accept is available for active task requests.");
        return;
      }

      if (viewerId && item.providerId === viewerId) {
        pushToast("info", "You cannot accept your own task.");
        return;
      }

      if (item.acceptedProviderId && viewerId && item.acceptedProviderId !== viewerId) {
        pushToast("info", "This task is already accepted.");
        return;
      }

      if (isClosedStatus(item.status)) {
        pushToast("info", "This task is no longer open.");
        return;
      }

      setAcceptTarget(item);
    },
    [pushToast, viewerId]
  );

  const confirmAccept = useCallback(async () => {
    if (!acceptTarget?.helpRequestId) {
      setAcceptTarget(null);
      return;
    }

    const cardId = buildFeedCardId(acceptTarget);
    setAcceptingListingIds((current) => new Set(current).add(cardId));

    try {
      const activeViewerId = await ensureViewerId();

      if (acceptTarget.providerId === activeViewerId) {
        throw new Error("You cannot accept your own task.");
      }

      const payload = await fetchAuthedJson<
        { ok: true; helpRequestId: string; status: string } | { ok: false; message?: string }
      >(supabase, "/api/needs/accept", {
        method: "POST",
        body: JSON.stringify({
          helpRequestId: acceptTarget.helpRequestId,
        }),
      });

      if (!payload.ok) {
        throw new Error(payload.message || "Unable to accept task.");
      }

      setFeed((current) =>
        current.map((item) =>
          item.helpRequestId === acceptTarget.helpRequestId
            ? {
                ...item,
                acceptedProviderId: activeViewerId,
                status: payload.status || "accepted",
              }
            : item
        )
      );

      pushToast("success", "Task accepted successfully.");
      setAcceptTarget(null);
      void fetchFeed(false);
    } catch (error) {
      pushToast("error", toErrorMessage(error, "Unable to accept this task right now."));
    } finally {
      setAcceptingListingIds((current) => {
        const next = new Set(current);
        next.delete(cardId);
        return next;
      });
    }
  }, [acceptTarget, ensureViewerId, fetchFeed, pushToast]);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER_STATE);
    setShowAdvancedFilters(false);
  }, []);

  const postsPromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: "Search by title, details, category, creator, or location",
      value: filters.query,
      onValueChange: (nextValue: string) => {
        setFilters((current) => ({ ...current, query: nextValue }));
      },
      onSubmit: () => {
        // Search is live as user types.
      },
      actions: [
        {
          id: "create-post",
          label: "Create Post",
          icon: Zap,
          onClick: () => {
            setOpenPostModal(true);
          },
          variant: "primary",
        },
        {
          id: "refresh-posts",
          label: refreshing ? "Refreshing..." : "Refresh",
          icon: RefreshCw,
          onClick: () => {
            void fetchFeed(true);
          },
          busy: refreshing,
          disabled: refreshing,
          variant: "secondary",
        },
      ],
    }),
    [fetchFeed, filters.query, refreshing]
  );

  useDashboardPrompt(postsPromptConfig);

  const filteredFeed = useMemo(() => feed.filter((item) => matchesFeedFilters(item, filters)), [feed, filters]);

  const displayFeed = useMemo<DisplayListing[]>(() => {
    return filteredFeed.map((item) => {
      const defaultTitle =
        item.type === "demand"
          ? "Need local support"
          : item.type === "service"
          ? `${item.category || "Local"} service`
          : `${item.category || "Local"} product`;

      const defaultDescription =
        item.type === "demand"
          ? "Looking for quick nearby support."
          : "Trusted listing from your local marketplace.";

      const title = toDisplayText(item.title, defaultTitle);
      const description = toDisplayText(item.description, defaultDescription);
      const creatorName = toDisplayText(item.creatorName, "Local member");

      const distanceLabel =
        item.distanceKm > 0
          ? `${item.distanceKm.toFixed(1)} km away`
          : item.locationLabel || "Nearby";

      return {
        ...item,
        displayTitle: title,
        displayDescription: description,
        displayCreator: creatorName,
        timeLabel: formatRelativeAge(item.createdAt),
        priceLabel: formatPriceLabel(item),
        distanceLabel,
      };
    });
  }, [filteredFeed]);

  useEffect(() => {
    if (!displayFeed.length) {
      setActiveMapItemId(null);
      return;
    }

    setActiveMapItemId((current) => {
      if (current && displayFeed.some((item) => item.id === current)) {
        return current;
      }
      return displayFeed[0].id;
    });
  }, [displayFeed]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(["all"]);
    feed.forEach((item) => {
      const normalized = item.category.trim().toLowerCase();
      if (normalized) set.add(normalized);
      set.add(item.type);
    });
    return Array.from(set).slice(0, 12);
  }, [feed]);

  const mapItems = useMemo(
    () =>
      displayFeed.slice(0, 60).map((item) => ({
        id: item.id,
        title: item.displayTitle,
        lat: item.lat,
        lng: item.lng,
        creatorName: item.displayCreator,
        locationLabel: item.locationLabel || item.distanceLabel,
        category: item.category,
        timeLabel: item.timeLabel,
        priceLabel: item.priceLabel,
      })),
    [displayFeed]
  );

  const mapCenter = useMemo(() => {
    if (viewerCoordinates) {
      return { lat: viewerCoordinates.latitude, lng: viewerCoordinates.longitude };
    }

    const defaults = defaultMarketCoordinates();
    return { lat: defaults.latitude, lng: defaults.longitude };
  }, [viewerCoordinates]);

  const handleMapSelect = useCallback((itemId: string) => {
    setActiveMapItemId(itemId);
    const cardNode = cardRefs.current.get(itemId);
    if (cardNode) {
      cardNode.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const realtimeStyle = REALTIME_HEALTH_STYLES[feedChannelHealth];

  const feedStats = useMemo(() => {
    const total = displayFeed.length;
    const urgent = displayFeed.filter((item) => item.urgent).length;
    const demand = displayFeed.filter((item) => item.type === "demand").length;
    const service = displayFeed.filter((item) => item.type === "service").length;
    const product = displayFeed.filter((item) => item.type === "product").length;

    return { total, urgent, demand, service, product };
  }, [displayFeed]);

  const skeletonCards = useMemo(() => Array.from({ length: 6 }, (_, index) => `skeleton-${index}`), []);

  return (
    <div className="min-h-screen bg-[var(--surface-app)] pb-24 pt-5 text-slate-900 sm:pt-6">
      <RouteObservability route="dashboard" />

      <div className="mx-auto w-full max-w-[1360px] space-y-4 px-3 sm:space-y-5 sm:px-6">
        <section className="rounded-3xl border border-slate-200/90 bg-white p-3 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Live Nearby Activity</p>
              <p className="mt-0.5 text-xs text-slate-500">Visual snapshot of posts and providers around you.</p>
            </div>
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${realtimeStyle.className}`}
              title="Realtime feed status"
            >
              <span className={`h-2 w-2 rounded-full ${realtimeStyle.dotClassName}`} />
              {realtimeStyle.label}
            </div>
          </div>

          <div className="mt-3 h-[15.8rem] overflow-hidden rounded-2xl sm:h-[17rem]">
            <MarketplaceMap
              items={mapItems}
              center={mapCenter}
              activeItemId={activeMapItemId}
              onSelectItem={handleMapSelect}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Total</p>
              <p className="text-sm font-semibold text-slate-900">{feedStats.total}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Urgent</p>
              <p className="text-sm font-semibold text-slate-900">{feedStats.urgent}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Needs</p>
              <p className="text-sm font-semibold text-slate-900">{feedStats.demand}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-500">Supply</p>
              <p className="text-sm font-semibold text-slate-900">{feedStats.service + feedStats.product}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/90 bg-white p-3 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.38)] sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Filter size={15} />
              Feed Filters
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((current) => !current)}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <SlidersHorizontal size={13} />
                {showAdvancedFilters ? "Hide" : "Show"} filters
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                <RotateCcw size={13} />
                Reset
              </button>
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map((category) => {
                  const active = filters.category === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setFilters((current) => ({ ...current, category }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      }`}
                    >
                      {category === "all" ? "All" : category}
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold text-slate-800">Max distance</span>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={filters.maxDistanceKm}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, maxDistanceKm: Number(event.target.value) || 0 }))
                    }
                    className="mt-1.5 w-full"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {filters.maxDistanceKm > 0 ? `${filters.maxDistanceKm} km` : "No distance cap"}
                  </p>
                </label>

                {[
                  { key: "urgentOnly", label: "Urgent only" },
                  { key: "verifiedOnly", label: "Verified only" },
                  { key: "mediaOnly", label: "With media" },
                  { key: "freshOnly", label: "Fresh (24h)" },
                ].map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    {option.label}
                    <input
                      type="checkbox"
                      checked={Boolean(filters[option.key as keyof FeedFilterState])}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          [option.key]: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {feedError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">Could not fully refresh the live feed.</p>
            <p className="mt-1 text-xs">{feedError}</p>
          </div>
        )}

        <section className="space-y-3">
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {skeletonCards.map((key) => (
                <div key={key} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-slate-100" />
                    </div>
                  </div>
                  <div className="mt-3 h-44 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-100" />
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="h-9 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-9 animate-pulse rounded-xl bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : !displayFeed.length ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-lg font-semibold text-slate-900">No posts match your current filters</p>
              <p className="mt-1 text-sm text-slate-500">Try a broader search or publish a new need for your area.</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <RotateCcw size={14} />
                  Reset filters
                </button>
                <button
                  type="button"
                  onClick={() => setOpenPostModal(true)}
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Zap size={14} />
                  Create Post
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {displayFeed.map((item, index) => {
                const saved = isSavedListing(item);
                const savingBusy = isListingBusy(item, savingListingIds);
                const sharingBusy = isListingBusy(item, sharingListingIds);
                const acceptingBusy = isListingBusy(item, acceptingListingIds);
                const isOwnListing = !!viewerId && item.providerId === viewerId;
                const acceptedByMe = !!viewerId && item.acceptedProviderId === viewerId;
                const acceptedByOther = !!item.acceptedProviderId && item.acceptedProviderId !== viewerId;
                const acceptDisabled =
                  acceptingBusy ||
                  isOwnListing ||
                  !item.helpRequestId ||
                  acceptedByOther ||
                  acceptedByMe ||
                  isClosedStatus(item.status);

                const acceptLabel = isOwnListing
                  ? "Own"
                  : acceptedByMe
                  ? "Accepted"
                  : acceptedByOther
                  ? "Taken"
                  : !item.helpRequestId
                  ? "N/A"
                  : isClosedStatus(item.status)
                  ? "Closed"
                  : "Accept";

                const chatBusy = chatOpeningProviderId === item.providerId;
                const statusLabel = normalizeStatusLabel(item.status);

                return (
                  <motion.article
                    key={item.id}
                    ref={(node) => {
                      cardRefs.current.set(item.id, node);
                    }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.18) }}
                    className={`overflow-hidden rounded-3xl border bg-white p-3 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.45)] transition-all sm:p-3 ${
                      activeMapItemId === item.id
                        ? "border-[var(--brand-500)]/45 shadow-[0_28px_42px_-28px_rgba(14,165,164,0.48)]"
                        : "border-slate-200"
                    }`}
                  >
                    <header className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedProvider(item.providerId)}
                        className="relative shrink-0 rounded-full"
                        aria-label={`Open ${item.displayCreator} profile panel`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.avatarUrl || FALLBACK_AVATAR}
                          alt={`${item.displayCreator} avatar`}
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-slate-900">{item.displayCreator}</p>
                          {item.verificationStatus === "verified" && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Verified
                            </span>
                          )}
                          {item.urgent && (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              Urgent
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={11} />
                            {item.timeLabel}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} />
                            {item.distanceLabel}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {statusLabel}
                          </span>
                        </div>
                      </div>
                    </header>

                    <div className="mt-2.5">
                      <MediaCarousel media={item.media} title={item.displayTitle} />
                    </div>

                    <div className="mt-2.5">
                      <h3 className="line-clamp-2 text-base font-semibold leading-tight text-slate-900">{item.displayTitle}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{item.displayDescription}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
                          {item.category}
                        </span>
                        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">
                          {item.priceLabel}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-500">
                          ~{item.responseMinutes} mins response
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => openAcceptDialog(item)}
                        disabled={acceptDisabled}
                        className={`inline-flex min-h-8 items-center justify-center gap-1 truncate rounded-xl border px-2 text-[11px] font-semibold transition ${
                          acceptDisabled
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        {acceptingBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        {acceptLabel}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleShareListing(item)}
                        disabled={sharingBusy}
                        className="inline-flex min-h-8 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-60"
                      >
                        {sharingBusy ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                        {sharingBusy ? "Sharing" : "Share"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void toggleSaveListing(item)}
                        disabled={savingBusy}
                        className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-xl border px-2 text-[11px] font-semibold transition ${
                          saved
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                        } disabled:opacity-60`}
                      >
                        {savingBusy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : saved ? (
                          <BookmarkCheck size={12} />
                        ) : (
                          <Bookmark size={12} />
                        )}
                        {savingBusy ? "Saving" : saved ? "Saved" : "Save"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void openChatThread(item)}
                        disabled={chatBusy || isOwnListing}
                        className="inline-flex min-h-8 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                      >
                        {chatBusy ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
                        {isOwnListing ? "Own" : chatBusy ? "Opening" : "Chat"}
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AcceptConfirmDialog
        open={!!acceptTarget}
        listing={acceptTarget}
        busy={!!(acceptTarget && isListingBusy(acceptTarget, acceptingListingIds))}
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => {
          void confirmAccept();
        }}
      />

      {selectedProvider && (
        <ProviderTrustPanel
          userId={selectedProvider}
          open
          onClose={() => {
            setSelectedProvider(null);
          }}
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

      <ProfileToastViewport
        toasts={toasts}
        onDismiss={(toastId) => {
          setToasts((current) => current.filter((toast) => toast.id !== toastId));
          const timeoutId = toastTimersRef.current.get(toastId);
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            toastTimersRef.current.delete(toastId);
          }
        }}
      />
    </div>
  );
}

