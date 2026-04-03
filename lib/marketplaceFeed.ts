import { createAvatarFallback } from "@/lib/avatarFallback";
import { looksLikePlaceholderText, toDisplayText as cleanDisplayText } from "@/lib/contentQuality";
import { readMarketplaceComposerMetadata } from "@/lib/marketplaceMetadata";
import { resolvePostMediaUrl } from "@/lib/mediaUrl";
import { slugifyProfileName } from "@/lib/profile/utils";

export type MarketplaceFeedItemType = "service" | "product" | "demand";
export type MarketplaceFeedItemSource = "service_listing" | "product_listing" | "post" | "help_request";

export type MarketplaceFeedMedia = {
  mimeType: string;
  url: string;
};

export type MarketplaceFeedItem = {
  id: string;
  source: MarketplaceFeedItemSource;
  helpRequestId: string | null;
  canonicalKey?: string;
  linkedPostId?: string | null;
  linkedListingId?: string | null;
  linkedHelpRequestId?: string | null;
  metadata?: Record<string, unknown> | null;
  providerId: string;
  type: MarketplaceFeedItemType;
  title: string;
  description: string;
  category: string;
  price: number;
  avatarUrl: string;
  creatorName: string;
  creatorUsername: string;
  locationLabel: string;
  distanceKm: number;
  lat: number;
  lng: number;
  coordinateAccuracy: "precise" | "approximate";
  media: MarketplaceFeedMedia[];
  createdAt: string;
  urgent: boolean;
  rankScore: number;
  profileCompletion: number;
  responseMinutes: number;
  verificationStatus: "verified" | "pending" | "unclaimed";
  averageRating?: number | null;
  reviewCount?: number | null;
  listingCount?: number | null;
  publicProfilePath: string;
  status: string;
  acceptedProviderId: string | null;
};

export type MarketplaceDisplayFeedItem = MarketplaceFeedItem & {
  displayTitle: string;
  displayDescription: string;
  displayCreator: string;
  timeLabel: string;
  priceLabel: string;
  distanceLabel: string;
};

export type MarketplaceFeedItemTypeFilter = "all" | MarketplaceFeedItemType;

export type MarketplaceFeedFilterState = {
  query: string;
  type: MarketplaceFeedItemTypeFilter;
  category: string;
  maxDistanceKm: number;
  urgentOnly: boolean;
  mediaOnly: boolean;
  verifiedOnly: boolean;
  freshOnly: boolean;
};

export type MarketplaceFeedStats = {
  total: number;
  urgent: number;
  demand: number;
  service: number;
  product: number;
};

export type MarketplaceMapCenter = {
  lat: number;
  lng: number;
};

export type MarketplaceRealtimeHealth = "connecting" | "connected" | "reconnecting" | "error" | "idle";

type MarketplaceComposerMediaMetadata = {
  name: string;
  type: string;
  url: string;
};

const FALLBACK_AVATAR = createAvatarFallback({ label: "ServiQ", seed: "serviq-marketplace-feed" });
const MARKETPLACE_FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
const mediaRegex = /\[([^\]]+)\]\s(https?:\/\/[^\s,]+)/g;

const sourcePriority: Record<MarketplaceFeedItemSource, number> = {
  help_request: 5,
  post: 4,
  service_listing: 3,
  product_listing: 3,
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

export const DEFAULT_MARKETPLACE_FEED_FILTER_STATE: MarketplaceFeedFilterState = {
  query: "",
  type: "all",
  category: "all",
  maxDistanceKm: 0,
  urgentOnly: false,
  mediaOnly: false,
  verifiedOnly: false,
  freshOnly: false,
};

export const MARKETPLACE_REALTIME_HEALTH_STYLES: Record<
  MarketplaceRealtimeHealth,
  {
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  connected: {
    label: "Live",
    className: "border-emerald-400/35 bg-emerald-500/16 text-emerald-100",
    dotClassName: "bg-emerald-500",
  },
  connecting: {
    label: "Connecting",
    className: "border-cyan-400/30 bg-cyan-500/14 text-cyan-100",
    dotClassName: "bg-amber-500",
  },
  reconnecting: {
    label: "Reconnecting",
    className: "border-sky-400/30 bg-sky-500/14 text-sky-100",
    dotClassName: "bg-orange-500",
  },
  error: {
    label: "Error",
    className: "border-rose-400/35 bg-rose-500/16 text-rose-100",
    dotClassName: "bg-rose-500",
  },
  idle: {
    label: "Idle",
    className: "border-slate-400/25 bg-slate-500/12 text-slate-200",
    dotClassName: "bg-slate-300",
  },
};

export const parseMarketplaceDateMs = (value?: string) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMarketplaceFingerprintPart = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);

export const normalizeMarketplacePostKind = (value?: string | null): MarketplaceFeedItemType => {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "service" || normalized === "product") return normalized;
  return "demand";
};

export const normalizeMarketplacePersonLabel = (value: string | undefined) =>
  (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

export const humanizeMarketplaceHandle = (value: string) =>
  value
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const fallbackMarketplaceCreatorLabel = (type: MarketplaceFeedItemType) =>
  type === "demand" ? "Nearby requester" : type === "product" ? "Local seller" : "Local provider";

export const resolveMarketplaceCreatorDisplayName = (value: string | undefined, type: MarketplaceFeedItemType) =>
  normalizeMarketplacePersonLabel(value) || fallbackMarketplaceCreatorLabel(type);

export const toMarketplaceCreatorUsername = (value: string | undefined) => {
  const normalized = normalizeMarketplacePersonLabel(value);
  if (!normalized) return "";
  return slugifyProfileName(normalized) || "";
};

export const isGeneratedMarketplaceAvatar = (value: string | undefined) =>
  (value || "").startsWith("data:image/svg+xml");

export const toMarketplaceDisplayText = (value: string | undefined, fallback: string) =>
  cleanDisplayText(value, fallback);

export const formatMarketplaceRelativeAge = (value?: string) => {
  const createdAtMs = parseMarketplaceDateMs(value);
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

export const formatMarketplacePriceLabel = (item: Pick<MarketplaceFeedItem, "price" | "type">) => {
  if (item.price > 0) return `INR ${Math.round(item.price).toLocaleString("en-IN")}`;
  if (item.type === "demand") return "Budget shared in chat";
  return "Price on request";
};

export const buildMarketplaceDistanceLabel = (item: Pick<MarketplaceFeedItem, "distanceKm" | "locationLabel">) =>
  item.distanceKm > 0 ? `${item.distanceKm.toFixed(1)} km away` : item.locationLabel || "Nearby";

export const buildMarketplaceFeedCardId = (item: Pick<MarketplaceFeedItem, "id" | "source" | "type">) =>
  `dashboard:${item.source}:${item.type}:${item.id}`;

export const mapMarketplaceRealtimeHealth = (status: string): MarketplaceRealtimeHealth => {
  if (status === "SUBSCRIBED") return "connected";
  if (status === "TIMED_OUT") return "reconnecting";
  if (status === "CHANNEL_ERROR") return "error";
  if (status === "CLOSED") return "idle";
  return "connecting";
};

export const isClosedMarketplaceStatus = (status?: string | null) =>
  CLOSED_STATUSES.has((status || "").trim().toLowerCase());

export const normalizeMarketplaceStatusLabel = (status?: string | null) => {
  const normalized = (status || "open").trim().toLowerCase();
  if (!normalized) return "Open";
  return normalized
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const isUUIDLike = (value?: string | null) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const isWeakMarketplaceContent = (title: string | undefined, description: string | undefined) =>
  looksLikePlaceholderText(title) && (!description || looksLikePlaceholderText(description));

export const parseMarketplacePostText = (rawText: string) => {
  const fallback = {
    title: rawText || "Local post",
    description: rawText || "Local post",
    budget: 0,
    category: "Need",
    location: "",
    kind: "demand" as MarketplaceFeedItemType,
    media: [] as MarketplaceFeedMedia[],
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

  const media: MarketplaceFeedMedia[] = [];
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

export const mediaFromMarketplaceComposerMetadata = (value: unknown): MarketplaceFeedMedia[] => {
  const metadata = readMarketplaceComposerMetadata(value);
  if (!metadata) return [];

  return metadata.media
    .map((entry: MarketplaceComposerMediaMetadata) => {
      const resolvedUrl = resolvePostMediaUrl(entry.url);
      if (!resolvedUrl) return null;

      return {
        mimeType: entry.type,
        url: resolvedUrl,
      } satisfies MarketplaceFeedMedia;
    })
    .filter((entry): entry is MarketplaceFeedMedia => !!entry);
};

export const buildMarketplaceDisplayItem = (item: MarketplaceFeedItem): MarketplaceDisplayFeedItem => {
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

  const displayCreator = resolveMarketplaceCreatorDisplayName(item.creatorName || item.creatorUsername, item.type);
  const avatarUrl =
    item.avatarUrl && !isGeneratedMarketplaceAvatar(item.avatarUrl)
      ? item.avatarUrl
      : createAvatarFallback({
          label: displayCreator,
          seed: `${item.providerId || item.id}:${item.type}`,
        });

  return {
    ...item,
    avatarUrl: avatarUrl || FALLBACK_AVATAR,
    displayTitle: toMarketplaceDisplayText(item.title, defaultTitle),
    displayDescription: toMarketplaceDisplayText(item.description, defaultDescription),
    displayCreator,
    timeLabel: formatMarketplaceRelativeAge(item.createdAt),
    priceLabel: formatMarketplacePriceLabel(item),
    distanceLabel: buildMarketplaceDistanceLabel(item),
  };
};

export const buildMarketplaceFeedStats = (items: MarketplaceFeedItem[]): MarketplaceFeedStats => ({
  total: items.length,
  urgent: items.filter((item) => item.urgent).length,
  demand: items.filter((item) => item.type === "demand").length,
  service: items.filter((item) => item.type === "service").length,
  product: items.filter((item) => item.type === "product").length,
});

export const listingFingerprint = (item: MarketplaceFeedItem) => {
  return [
    normalizeMarketplaceFingerprintPart(item.providerId || "community"),
    normalizeMarketplaceFingerprintPart(item.type),
    normalizeMarketplaceFingerprintPart(item.category),
    normalizeMarketplaceFingerprintPart(item.title),
  ].join("|");
};

export const pickPreferredMarketplaceFeedItem = (current: MarketplaceFeedItem, incoming: MarketplaceFeedItem) => {
  if (sourcePriority[incoming.source] !== sourcePriority[current.source]) {
    return sourcePriority[incoming.source] > sourcePriority[current.source] ? incoming : current;
  }

  const incomingDate = parseMarketplaceDateMs(incoming.createdAt);
  const currentDate = parseMarketplaceDateMs(current.createdAt);
  if (incomingDate !== currentDate) {
    return incomingDate > currentDate ? incoming : current;
  }

  if (incoming.rankScore !== current.rankScore) {
    return incoming.rankScore > current.rankScore ? incoming : current;
  }

  return incoming.responseMinutes < current.responseMinutes ? incoming : current;
};

export const dedupeMarketplaceFeedItems = (items: MarketplaceFeedItem[]) => {
  const byId = new Map<string, MarketplaceFeedItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? pickPreferredMarketplaceFeedItem(existing, item) : item);
  }

  const byFingerprint = new Map<string, MarketplaceFeedItem>();
  for (const item of byId.values()) {
    const fingerprint = item.canonicalKey || listingFingerprint(item);
    const existing = byFingerprint.get(fingerprint);
    byFingerprint.set(fingerprint, existing ? pickPreferredMarketplaceFeedItem(existing, item) : item);
  }

  return Array.from(byFingerprint.values());
};

export const normalizeMarketplaceSearchTokens = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export const isFreshMarketplaceItem = (value?: string) => {
  const createdAtMs = parseMarketplaceDateMs(value);
  if (!createdAtMs) return false;
  return Date.now() - createdAtMs <= MARKETPLACE_FRESH_WINDOW_MS;
};

export const matchesMarketplaceFeedFilters = (item: MarketplaceFeedItem, state: MarketplaceFeedFilterState) => {
  const queryTokens = normalizeMarketplaceSearchTokens(state.query);
  const haystack = `${item.title} ${item.description} ${item.category} ${item.creatorName} ${item.locationLabel} ${item.type}`.toLowerCase();
  const matchesSearch = queryTokens.every((token) => haystack.includes(token));

  const normalizedCategory = state.category.toLowerCase();
  const matchesType = state.type === "all" || item.type === state.type;

  const matchesCategory =
    state.category === "all" ||
    item.type === normalizedCategory ||
    item.category.toLowerCase().includes(normalizedCategory);

  const matchesDistance = state.maxDistanceKm > 0 ? item.distanceKm <= state.maxDistanceKm : true;
  const matchesUrgent = state.urgentOnly ? item.urgent : true;
  const matchesMedia = state.mediaOnly ? item.media.length > 0 : true;
  const matchesVerified = state.verifiedOnly ? item.verificationStatus === "verified" : true;
  const matchesFresh = state.freshOnly ? isFreshMarketplaceItem(item.createdAt) : true;

  return matchesSearch && matchesType && matchesCategory && matchesDistance && matchesUrgent && matchesMedia && matchesVerified && matchesFresh;
};
