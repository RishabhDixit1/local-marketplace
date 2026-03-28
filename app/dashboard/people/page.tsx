"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Bell, ChevronDown, Compass, Loader2, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import type { CommunityPeopleResponse, CommunityProfileRecord } from "@/lib/api/community";
import { fetchAuthedJson } from "@/lib/clientApi";
import { ensureClientProfile } from "@/lib/clientProfile";
import {
  clearPendingFeedCardSave,
  getPendingFeedCardIds,
  persistFeedCardSave,
  prunePendingFeedCardSaves,
  removeFeedCardSave,
  stagePendingFeedCardSave,
  syncPendingFeedCardSaves,
} from "@/lib/feedCardSavesClient";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
} from "@/lib/business";
import type { ConnectionDecision, ConnectionState } from "@/lib/connectionState";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import {
  defaultMarketCoordinates,
  distanceBetweenCoordinatesKm,
  getBrowserCoordinates,
  resolveCoordinates,
  type Coordinates,
} from "@/lib/geo";
import { useConnectionRequests } from "@/lib/hooks/useConnectionRequests";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { buildPublicProfilePath } from "@/lib/profile/utils";
import { extractPresenceUserIds, GLOBAL_PRESENCE_CHANNEL } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import ConnectionsPanel from "./components/ConnectionsPanel";
import PeopleLiveHeader from "./components/PeopleLiveHeader";
import PeopleMapPanel from "./components/PeopleMapPanel";
import ProviderCard from "./components/ProviderCard";
import ProviderCardSkeleton from "./components/ProviderCardSkeleton";
import type {
  PeopleBanner,
  PresenceTone,
  ProviderCard as ProviderCardModel,
  ProviderMedia,
  ProviderOffering,
  ProviderPreview,
  RealtimeToast,
} from "./types";

const ProviderTrustPanel = dynamic(
  () => import("@/app/components/ProviderTrustPanel").then((mod) => mod.default),
  { ssr: false }
);

type ProfileRow = CommunityProfileRecord;

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

type PostRow = {
  user_id?: string | null;
  author_id?: string | null;
  created_by?: string | null;
  provider_id?: string | null;
  category?: string | null;
  status?: string | null;
  state?: string | null;
};

type HelpRequestRow = {
  requester_id?: string | null;
  category?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  status?: string | null;
};

type ReviewRow = {
  provider_id: string;
  rating: number | null;
};

type ProviderPresenceRow = {
  provider_id: string;
  is_online?: boolean | null;
  availability?: string | null;
  response_sla_minutes?: number | null;
  rolling_response_minutes?: number | null;
  last_seen?: string | null;
};

type ProviderOrderStatsRow = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

type RealtimeConnectionRow = {
  requester_id?: string | null;
  recipient_id?: string | null;
  status?: string | null;
};

type ServiceDetailRow = {
  id?: string | null;
  provider_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  price?: number | string | null;
  availability?: string | null;
  created_at?: string | null;
};

type ProductDetailRow = {
  id?: string | null;
  provider_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  price?: number | string | null;
  delivery_method?: string | null;
  image_url?: string | null;
  created_at?: string | null;
};

type SavedCardRow = {
  card_id: string;
};

type FlexibleRow = Record<string, unknown>;

type CommunityPeopleSuccessPayload = Extract<CommunityPeopleResponse, { ok: true }>;

const PAGE_SIZE = 12;
const GEO_LOOKUP_TIMEOUT_MS = 1200;
const MAX_DISCOVERABLE_PROFILES = 140;
const AUTO_SYNC_INTERVAL_MS = 30000;
const NEW_PROVIDER_WINDOW_DAYS = 21;
const MAP_ITEM_LIMIT = 18;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRICE_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const EMPTY_CONNECTION_STATE: ConnectionState = {
  kind: "none",
  requestId: null,
  updatedAt: null,
  row: null,
};

const normalizeText = (value: string | null | undefined) => value?.trim() || "";

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const isFlexibleRow = (value: unknown): value is FlexibleRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toFlexibleRows = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is FlexibleRow => isFlexibleRow(item)) : [];

const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|function .* does not exist|could not find the table '.*' in the schema cache/i.test(
    message
  );

const formatCurrency = (value: number | null) => {
  if (!Number.isFinite(value)) return null;
  return PRICE_FORMATTER.format(Number(value));
};

const buildProfileCardId = (providerId: string) => `people:${providerId}`;

const pushTag = (map: Map<string, Set<string>>, providerId: string, tag: string | null | undefined) => {
  const normalized = normalizeText(tag);
  if (!normalized) return;
  if (!map.has(providerId)) {
    map.set(providerId, new Set());
  }
  map.get(providerId)?.add(normalized);
};

const pushPrice = (map: Map<string, number[]>, providerId: string, value: number | null | undefined) => {
  if (!Number.isFinite(value)) return;
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) return;
  const current = map.get(providerId) || [];
  map.set(providerId, [...current, Math.round(nextValue)]);
};

const isNewProvider = (joinedAt: string | null) => {
  if (!joinedAt) return false;
  const timestamp = new Date(joinedAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= NEW_PROVIDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

const isUuid = (value: string) => UUID_PATTERN.test(value);

const formatRelativeTimestamp = (value: string | null) => {
  if (!value) return "recently";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "recently";

  const diffMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)}h ago`;
  if (diffMinutes < 24 * 60 * 7) return `${Math.floor(diffMinutes / (60 * 24))}d ago`;
  return `${Math.floor(diffMinutes / (60 * 24 * 7))}w ago`;
};

const PLACEHOLDER_TEXT_PATTERN =
  /\b(demo|sample|seed(?:ed)?|placeholder|dummy|fake|mock|test|temp|lorem|ipsum)\b/i;

const KEYBOARD_MASH_PATTERN = /(asdf|qwer|zxcv|hjkl|sdfg|dsaf|sdfs|xcad|tmynr|hbtgr|fvcg|gaewg|sdga)/i;

const countVowels = (value: string) => (value.match(/[aeiou]/gi) || []).length;

const looksLikeGarbageToken = (value: string) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  if (PLACEHOLDER_TEXT_PATTERN.test(normalized) || KEYBOARD_MASH_PATTERN.test(normalized)) return true;
  if (normalized.length < 5 || normalized.includes(" ")) return false;

  const vowelRatio = countVowels(normalized) / normalized.length;
  return vowelRatio < 0.2;
};

const looksLikePlaceholderText = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (PLACEHOLDER_TEXT_PATTERN.test(normalized) || KEYBOARD_MASH_PATTERN.test(normalized)) return true;

  const tokens = normalized.toLowerCase().match(/[a-z]+/g) || [];
  if (!tokens.length) return false;

  const suspiciousTokens = tokens.filter(looksLikeGarbageToken).length;
  return suspiciousTokens >= Math.max(2, Math.ceil(tokens.length * 0.6));
};

const sanitizeProfileServices = (services: string[] | null | undefined) =>
  (services || [])
    .map((service) => normalizeText(service))
    .filter((service) => service.length > 0 && !looksLikePlaceholderText(service));

const isProviderFacingRole = (value: string | null | undefined) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;

  return [
    "provider",
    "business",
    "vendor",
    "seller",
    "merchant",
    "professional",
    "partner",
    "agency",
    "studio",
    "team",
    "service",
  ].some((keyword) => normalized.includes(keyword));
};

const selectOptionalRows = async <TRow extends FlexibleRow>(
  table: string,
  options: {
    limit?: number;
    inFilter?: { column: string; values: string[] };
  } = {}
): Promise<TRow[]> => {
  let query = supabase.from(table).select("*");

  if (options.inFilter?.values.length) {
    query = query.in(options.inFilter.column, options.inFilter.values);
  }

  if (typeof options.limit === "number" && options.limit > 0) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingRelationError(error.message || "")) {
      return [];
    }
    throw new Error(error.message);
  }

  return toFlexibleRows(data) as TRow[];
};

const loadPeopleSnapshotDirect = async (viewerId: string): Promise<CommunityPeopleSuccessPayload> => {
  const [profiles, services, products, posts, helpRequests, reviews, presence] = await Promise.all([
    selectOptionalRows<ProfileRow>("profiles", { limit: MAX_DISCOVERABLE_PROFILES }),
    selectOptionalRows<ServiceDetailRow>("service_listings", { limit: MAX_DISCOVERABLE_PROFILES * 6 }),
    selectOptionalRows<ProductDetailRow>("product_catalog", { limit: MAX_DISCOVERABLE_PROFILES * 6 }),
    selectOptionalRows<PostRow>("posts", { limit: MAX_DISCOVERABLE_PROFILES * 6 }),
    selectOptionalRows<HelpRequestRow>("help_requests", { limit: MAX_DISCOVERABLE_PROFILES * 6 }),
    selectOptionalRows<ReviewRow>("reviews", { limit: MAX_DISCOVERABLE_PROFILES * 10 }),
    selectOptionalRows<ProviderPresenceRow>("provider_presence", { limit: MAX_DISCOVERABLE_PROFILES * 2 }),
  ]);

  const activeProviderIds = Array.from(
    new Set(
      [
        ...services.map((row) => normalizeText(typeof row.provider_id === "string" ? row.provider_id : null)),
        ...products.map((row) => normalizeText(typeof row.provider_id === "string" ? row.provider_id : null)),
        ...posts.map((row) =>
          normalizeText(
            typeof row.user_id === "string"
              ? row.user_id
              : typeof row.author_id === "string"
              ? row.author_id
              : typeof row.created_by === "string"
              ? row.created_by
              : typeof row.provider_id === "string"
              ? row.provider_id
              : null
          )
        ),
        ...helpRequests.map((row) => normalizeText(typeof row.requester_id === "string" ? row.requester_id : null)),
      ].filter(Boolean)
    )
  );

  let orderStats: ProviderOrderStatsRow[] = [];
  if (activeProviderIds.length > 0) {
    const { data, error } = await supabase.rpc("get_provider_order_stats", {
      provider_ids: activeProviderIds,
    });

    if (error) {
      if (!isMissingRelationError(error.message || "")) {
        throw new Error(error.message);
      }
    } else {
      orderStats = ((data as ProviderOrderStatsRow[] | null) || []).filter((row) => !!row.provider_id);
    }
  }

  return {
    ok: true,
    currentUserId: viewerId,
    profiles: profiles.filter((profile) => typeof profile.id === "string" && profile.id.length > 0),
    services: services
      .filter((row) => typeof row.provider_id === "string" && row.provider_id.length > 0)
      .map((row) => ({
        provider_id: String(row.provider_id),
        category: normalizeText(typeof row.category === "string" ? row.category : null) || "Service",
        price: toFiniteNumber(row.price) ?? 0,
      })),
    products: products
      .filter((row) => typeof row.provider_id === "string" && row.provider_id.length > 0)
      .map((row) => ({
        provider_id: String(row.provider_id),
        category: normalizeText(typeof row.category === "string" ? row.category : null) || "Product",
        price: toFiniteNumber(row.price) ?? 0,
      })),
    posts: posts.map((row) => ({
      user_id: normalizeText(typeof row.user_id === "string" ? row.user_id : null) || null,
      author_id: normalizeText(typeof row.author_id === "string" ? row.author_id : null) || null,
      created_by: normalizeText(typeof row.created_by === "string" ? row.created_by : null) || null,
      provider_id: normalizeText(typeof row.provider_id === "string" ? row.provider_id : null) || null,
      category: normalizeText(typeof row.category === "string" ? row.category : null) || null,
      status: normalizeText(typeof row.status === "string" ? row.status : null) || null,
      state: normalizeText(typeof row.state === "string" ? row.state : null) || null,
    })),
    helpRequests: helpRequests.map((row) => ({
      requester_id: normalizeText(typeof row.requester_id === "string" ? row.requester_id : null) || null,
      category: normalizeText(typeof row.category === "string" ? row.category : null) || null,
      budget_min: toFiniteNumber(row.budget_min),
      budget_max: toFiniteNumber(row.budget_max),
      status: normalizeText(typeof row.status === "string" ? row.status : null) || null,
    })),
    reviews: reviews
      .filter((row) => typeof row.provider_id === "string" && row.provider_id.length > 0)
      .map((row) => ({
        provider_id: String(row.provider_id),
        rating: toFiniteNumber(row.rating),
      })),
    presence: presence
      .filter((row) => typeof row.provider_id === "string" && row.provider_id.length > 0)
      .map((row) => ({
        provider_id: String(row.provider_id),
        is_online: typeof row.is_online === "boolean" ? row.is_online : null,
        availability: normalizeText(typeof row.availability === "string" ? row.availability : null) || null,
        response_sla_minutes: toFiniteNumber(row.response_sla_minutes),
        rolling_response_minutes: toFiniteNumber(row.rolling_response_minutes),
        last_seen: normalizeText(typeof row.last_seen === "string" ? row.last_seen : null) || null,
      })),
    orderStats,
  };
};

const loadProviderDetails = async (providerIds: string[]) => {
  if (!providerIds.length) {
    return {
      serviceDetails: [] as ServiceDetailRow[],
      productDetails: [] as ProductDetailRow[],
    };
  }

  const limitedIds = providerIds.slice(0, MAX_DISCOVERABLE_PROFILES);
  const [serviceDetails, productDetails] = await Promise.all([
    selectOptionalRows<ServiceDetailRow>("service_listings", {
      limit: limitedIds.length * 6,
      inFilter: { column: "provider_id", values: limitedIds },
    }),
    selectOptionalRows<ProductDetailRow>("product_catalog", {
      limit: limitedIds.length * 6,
      inFilter: { column: "provider_id", values: limitedIds },
    }),
  ]);

  return { serviceDetails, productDetails };
};
const createProviderCards = (params: {
  payload: CommunityPeopleSuccessPayload;
  viewerId: string;
  viewerCoordinates: Coordinates;
  serviceDetails: ServiceDetailRow[];
  productDetails: ProductDetailRow[];
}) => {
  const { payload, viewerId, viewerCoordinates, serviceDetails, productDetails } = params;
  const serviceRows = (payload.services || []) as ServiceRow[];
  const productRows = (payload.products || []) as ProductRow[];
  const postRows = (payload.posts || []) as PostRow[];
  const helpRequestRows = (payload.helpRequests || []) as HelpRequestRow[];
  const reviewRows = (payload.reviews || []) as ReviewRow[];
  const presenceRows = (payload.presence || []) as ProviderPresenceRow[];
  const orderStatsRows = (payload.orderStats || []) as ProviderOrderStatsRow[];

  const serviceCountMap = new Map<string, number>();
  const productCountMap = new Map<string, number>();
  const demandCountMap = new Map<string, number>();
  const serviceTagMap = new Map<string, Set<string>>();
  const productTagMap = new Map<string, Set<string>>();
  const demandTagMap = new Map<string, Set<string>>();
  const combinedTagMap = new Map<string, Set<string>>();
  const providerPriceMap = new Map<string, number[]>();
  const ratingMap = new Map<string, { sum: number; count: number }>();
  const serviceOfferingMap = new Map<string, ProviderOffering[]>();
  const productOfferingMap = new Map<string, ProviderOffering[]>();
  const mediaMap = new Map<string, ProviderMedia[]>();

  serviceRows.forEach((row) => {
    const providerId = normalizeText(row.provider_id);
    if (!providerId) return;
    serviceCountMap.set(providerId, (serviceCountMap.get(providerId) || 0) + 1);
    pushTag(serviceTagMap, providerId, row.category);
    pushTag(combinedTagMap, providerId, row.category);
    pushPrice(providerPriceMap, providerId, row.price ?? null);
  });

  productRows.forEach((row) => {
    const providerId = normalizeText(row.provider_id);
    if (!providerId) return;
    productCountMap.set(providerId, (productCountMap.get(providerId) || 0) + 1);
    pushTag(productTagMap, providerId, row.category);
    pushTag(combinedTagMap, providerId, row.category);
    pushPrice(providerPriceMap, providerId, row.price ?? null);
  });

  postRows.forEach((row) => {
    const status = normalizeText(row.status || row.state).toLowerCase();
    if (status && status !== "open") return;
    const userId = normalizeText(row.user_id || row.author_id || row.created_by || row.provider_id);
    if (!userId) return;
    demandCountMap.set(userId, (demandCountMap.get(userId) || 0) + 1);
    pushTag(demandTagMap, userId, row.category);
    pushTag(combinedTagMap, userId, row.category);
  });

  helpRequestRows.forEach((row) => {
    const status = normalizeText(row.status).toLowerCase();
    if (["completed", "fulfilled", "closed", "cancelled", "canceled"].includes(status)) return;
    const requesterId = normalizeText(row.requester_id);
    if (!requesterId) return;
    demandCountMap.set(requesterId, (demandCountMap.get(requesterId) || 0) + 1);
    pushTag(demandTagMap, requesterId, row.category);
    pushTag(combinedTagMap, requesterId, row.category);
    const maxBudget = Number(row.budget_max || 0);
    const minBudget = Number(row.budget_min || 0);
    pushPrice(providerPriceMap, requesterId, Math.max(maxBudget, minBudget));
  });

  reviewRows.forEach((row) => {
    if (!row.provider_id || typeof row.rating !== "number" || !Number.isFinite(row.rating)) return;
    const previous = ratingMap.get(row.provider_id) || { sum: 0, count: 0 };
    ratingMap.set(row.provider_id, {
      sum: previous.sum + row.rating,
      count: previous.count + 1,
    });
  });

  serviceDetails.forEach((row, index) => {
    const providerId = normalizeText(typeof row.provider_id === "string" ? row.provider_id : null);
    if (!providerId) return;
    const title = normalizeText(typeof row.title === "string" ? row.title : null) || normalizeText(row.category) || "Local service";
    const description = normalizeText(typeof row.description === "string" ? row.description : null) || "Published service on ServiQ.";
    const price = toFiniteNumber(row.price);
    const offering: ProviderOffering = {
      id: normalizeText(typeof row.id === "string" ? row.id : null) || `service-offering-${providerId}-${index}`,
      kind: "service",
      title,
      description,
      category: normalizeText(typeof row.category === "string" ? row.category : null) || "Service",
      price,
      priceLabel: formatCurrency(price),
      availability: normalizeText(typeof row.availability === "string" ? row.availability : null) || null,
      imageUrl: null,
      deliveryMethod: null,
      createdAt: normalizeText(typeof row.created_at === "string" ? row.created_at : null) || null,
    };

    const current = serviceOfferingMap.get(providerId) || [];
    serviceOfferingMap.set(providerId, [...current, offering]);
    pushPrice(providerPriceMap, providerId, price);
    pushTag(combinedTagMap, providerId, offering.category);
  });

  productDetails.forEach((row, index) => {
    const providerId = normalizeText(typeof row.provider_id === "string" ? row.provider_id : null);
    if (!providerId) return;
    const title = normalizeText(typeof row.title === "string" ? row.title : null) || normalizeText(row.category) || "Local product";
    const description = normalizeText(typeof row.description === "string" ? row.description : null) || "Published product on ServiQ.";
    const price = toFiniteNumber(row.price);
    const imageUrl = normalizeText(typeof row.image_url === "string" ? row.image_url : null) || null;

    const offering: ProviderOffering = {
      id: normalizeText(typeof row.id === "string" ? row.id : null) || `product-offering-${providerId}-${index}`,
      kind: "product",
      title,
      description,
      category: normalizeText(typeof row.category === "string" ? row.category : null) || "Product",
      price,
      priceLabel: formatCurrency(price),
      availability: null,
      imageUrl,
      deliveryMethod: normalizeText(typeof row.delivery_method === "string" ? row.delivery_method : null) || null,
      createdAt: normalizeText(typeof row.created_at === "string" ? row.created_at : null) || null,
    };

    const current = productOfferingMap.get(providerId) || [];
    productOfferingMap.set(providerId, [...current, offering]);

    if (imageUrl) {
      const existingMedia = mediaMap.get(providerId) || [];
      mediaMap.set(providerId, [
        ...existingMedia,
        {
          id: `media-${providerId}-${index}`,
          url: imageUrl,
          title,
          origin: "product",
        },
      ]);
    }

    pushPrice(providerPriceMap, providerId, price);
    pushTag(combinedTagMap, providerId, offering.category);
  });

  const profileRows = ((payload.profiles || []).slice(0, MAX_DISCOVERABLE_PROFILES) as ProfileRow[]).filter(
    (profile) => !!profile.id
  );

  const presenceMap = new Map<string, ProviderPresenceRow>();
  presenceRows.forEach((row) => {
    if (!row.provider_id) return;
    presenceMap.set(row.provider_id, row);
  });

  const completedJobsMap = new Map<string, number>();
  const openLeadsMap = new Map<string, number>();
  orderStatsRows.forEach((row) => {
    if (!row.provider_id) return;
    completedJobsMap.set(row.provider_id, Number(row.completed_jobs || 0));
    openLeadsMap.set(row.provider_id, Number(row.open_leads || 0));
  });

  const cards = profileRows
    .filter((profile) => profile.id !== viewerId)
    .map((profile): ProviderCardModel | null => {
      const sanitizedServices = sanitizeProfileServices(profile.services);
      const servicesCount = serviceCountMap.get(profile.id) || 0;
      const productsCount = productCountMap.get(profile.id) || 0;
      const demandCount = demandCountMap.get(profile.id) || 0;
      const profileServiceCount = sanitizedServices.length;
      const hasProviderSignals = servicesCount + productsCount + profileServiceCount > 0;
      const hasProviderRole = isProviderFacingRole(profile.role);
      const hasPlaceholderName = looksLikePlaceholderText(profile.name);
      const hasCompletedOnboarding = Boolean(profile.onboarding_completed);
      const hasProfilePresence =
        Boolean(normalizeText(profile.bio)) ||
        Boolean(normalizeText(profile.location)) ||
        Boolean(normalizeText(profile.avatar_url));
      const hasDiscoverableOnboarding = hasCompletedOnboarding || (profile.profile_completion_percent || 0) >= 60 || hasProfilePresence;

      if (hasPlaceholderName || (!hasProviderSignals && !hasProviderRole && !hasDiscoverableOnboarding)) {
        return null;
      }

      const ratingAgg = ratingMap.get(profile.id);
      const reviewsCount = ratingAgg?.count || 0;
      const rating = reviewsCount > 0 ? Number((ratingAgg!.sum / reviewsCount).toFixed(1)) : null;
      const presence = presenceMap.get(profile.id) || null;
      const availability = normalizeText(presence?.availability || profile.availability || "available").toLowerCase();
      const responseMinutesFromPresence = Number(
        presence?.rolling_response_minutes ?? presence?.response_sla_minutes ?? Number.NaN
      );
      const responseMinutes = Number.isFinite(responseMinutesFromPresence)
        ? Math.max(1, Math.round(responseMinutesFromPresence))
        : estimateResponseMinutes({
            availability,
            providerId: profile.id,
          });

      const profileCompletion = calculateProfileCompletion({
        name: profile.name,
        location: profile.location,
        bio: profile.bio,
        services: sanitizedServices,
        email: profile.email,
        phone: profile.phone,
        website: profile.website,
      });

      const verificationStatus = calculateVerificationStatus({
        role: profile.role,
        profileCompletion,
        listingsCount: servicesCount + productsCount,
        averageRating: rating ?? 0,
        reviewCount: reviewsCount,
      });

      const providerCoordinates = resolveCoordinates({
        row: profile as unknown as Record<string, unknown>,
        location: profile.location || "",
        seed: profile.id,
      });
      const distanceKm = distanceBetweenCoordinatesKm(viewerCoordinates, providerCoordinates);

      const online = typeof presence?.is_online === "boolean" ? presence.is_online : availability !== "offline";

      const rankBase = calculateLocalRankScore({
        distanceKm,
        responseMinutes,
        rating: rating ?? 0,
        profileCompletion,
      });
      const rankScore = Math.max(1, Math.min(100, Math.round(rankBase + (online ? 4 : 0))));

      const rawRoleLabel = normalizeText(profile.role);
      const roleLabel =
        (rawRoleLabel && !looksLikePlaceholderText(rawRoleLabel) ? rawRoleLabel : "") ||
        (servicesCount + productsCount > 0
          ? "Service provider"
          : hasDiscoverableOnboarding || demandCount > 0
            ? "Community member"
            : "ServiQ member");
      const serviceTags = Array.from(serviceTagMap.get(profile.id) || []);
      const productTags = Array.from(productTagMap.get(profile.id) || []);
      const demandTags = Array.from(demandTagMap.get(profile.id) || []);
      const resolvedTags = Array.from(
        new Set([
          ...Array.from(combinedTagMap.get(profile.id) || []),
          ...sanitizedServices,
          ...serviceTags,
          ...productTags,
          ...demandTags,
          roleLabel,
        ])
      )
        .map((value) => normalizeText(value))
        .filter((value) => value.length > 0 && !looksLikePlaceholderText(value))
        .slice(0, 6);

      const primarySkill = resolvedTags[0] || roleLabel;
      const normalizedBio = normalizeText(profile.bio);
      const bio =
        (normalizedBio && !looksLikePlaceholderText(normalizedBio) ? normalizedBio : "") ||
        (servicesCount + productsCount > 0
          ? "Local provider profile with published marketplace activity."
          : "Published member profile on ServiQ.");

      const offerings = [
        ...(serviceOfferingMap.get(profile.id) || []),
        ...(productOfferingMap.get(profile.id) || []),
      ]
        .map((offering) => {
          const title = normalizeText(offering.title);
          const category = normalizeText(offering.category);
          if (!title || !category || looksLikePlaceholderText(`${title} ${category}`)) {
            return null;
          }

          const description = normalizeText(offering.description);
          return {
            ...offering,
            title,
            category,
            description:
              description && !looksLikePlaceholderText(description)
                ? description
                : offering.kind === "product"
                ? "Published product on ServiQ."
                : "Published service on ServiQ.",
          };
        })
        .filter((offering): offering is ProviderOffering => Boolean(offering))
        .sort((left, right) => {
          if (left.kind !== right.kind) {
            return left.kind === "service" ? -1 : 1;
          }
          return (right.createdAt || "").localeCompare(left.createdAt || "");
        })
        .slice(0, 6);
      const finalOfferings = offerings;

      const priceValues = providerPriceMap.get(profile.id) || [];
      const minPrice = priceValues.length ? Math.min(...priceValues) : null;
      const minPriceLabel = formatCurrency(minPrice);
      const lastSeenLabel = normalizeText(presence?.last_seen);
      const recentActivityLabel = online
        ? "Active in the network right now"
        : lastSeenLabel
        ? `Seen ${formatRelativeTimestamp(lastSeenLabel)}`
        : demandCount > 0
        ? `${demandCount} recent marketplace requests`
        : isNewProvider(profile.created_at || null)
        ? "New to ServiQ this month"
        : `${Math.max(1, servicesCount + productsCount)} live offers in the marketplace`;

      const trustBlurb =
        verificationStatus === "verified"
          ? "Verified profile with live marketplace signals, trust metadata, and local discovery strength."
          : reviewsCount >= 3 && rating !== null
          ? `${reviewsCount} real reviews with a ${rating.toFixed(1)} average and active nearby visibility.`
          : profileCompletion >= 80
          ? "Strong profile completeness and consistent local discovery signals."
          : servicesCount + productsCount > 0
          ? "Published profile with live marketplace listings and clear business identity."
          : "Published profile with enough identity to start a confident conversation.";

      const media = (mediaMap.get(profile.id) || []).slice(0, 6);
      const searchDocument = [
        normalizeText(profile.name),
        roleLabel,
        bio,
        normalizeText(profile.location),
        primarySkill,
        resolvedTags.join(" "),
        finalOfferings.map((offering) => `${offering.title} ${offering.category} ${offering.description}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return {
        id: profile.id,
        name: normalizeText(profile.name) || "ServiQ member",
        businessSlug: createBusinessSlug(profile.name, profile.id),
        fullProfilePath: `/business/${createBusinessSlug(profile.name, profile.id)}`,
        publicProfilePath: buildPublicProfilePath(profile) || "",
        avatar:
          resolveProfileAvatarUrl(profile.avatar_url) ||
          createAvatarFallback({
            label: normalizeText(profile.name) || roleLabel || "ServiQ member",
            seed: profile.id,
          }),
        role: roleLabel,
        bio,
        location:
          normalizeText(profile.location) && !looksLikePlaceholderText(profile.location)
            ? normalizeText(profile.location)
            : "Nearby",
        website: normalizeText(profile.website) || null,
        phone: normalizeText(profile.phone) || null,
        email: normalizeText(profile.email) || null,
        distanceKm: Number(Math.max(0, distanceKm).toFixed(1)),
        rating,
        reviews: reviewsCount,
        verified: verificationStatus === "verified",
        online,
        availability,
        responseMinutes,
        primarySkill,
        tags: resolvedTags,
        completedJobs: completedJobsMap.has(profile.id) ? completedJobsMap.get(profile.id) ?? 0 : null,
        openLeads: openLeadsMap.has(profile.id) ? openLeadsMap.get(profile.id) ?? 0 : null,
        profileCompletion,
        rankScore,
        joinedAt: profile.created_at || null,
        latitude: providerCoordinates.latitude,
        longitude: providerCoordinates.longitude,
        listingCount: servicesCount + productsCount,
        serviceCount: servicesCount,
        productCount: productsCount,
        demandCount,
        minPrice,
        minPriceLabel,
        offerings: finalOfferings,
        media,
        recentActivityLabel,
        trustBlurb,
        searchDocument,
      };
    })
    .filter((card): card is ProviderCardModel => Boolean(card));

  cards.sort((left, right) => right.rankScore - left.rankScore || left.distanceKm - right.distanceKm);
  return cards;
};
export default function PeoplePage() {
  const router = useRouter();
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTimerRef = useRef<number | null>(null);
  const providerPreviewRef = useRef<Map<string, ProviderPreview>>(new Map());
  const cardElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const deepLinkHandledRef = useRef(false);

  const [providers, setProviders] = useState<ProviderCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [viewerCenter, setViewerCenter] = useState<{ lat: number; lng: number } | null>(null);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [trustPanelProviderId, setTrustPanelProviderId] = useState<string | null>(null);
  const [chatBusyUserId, setChatBusyUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") || "";
  });
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [noticeBanner, setNoticeBanner] = useState<PeopleBanner | null>(null);
  const [realtimeToast, setRealtimeToast] = useState<RealtimeToast | null>(null);
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(new Set());
  const [savingCardIds, setSavingCardIds] = useState<Set<string>>(new Set());
  const [sharingCardIds, setSharingCardIds] = useState<Set<string>>(new Set());

  const [deepLinkContext] = useState<{ providerId: string | null }>(() => {
    if (typeof window === "undefined") {
      return { providerId: null };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      providerId: params.get("provider"),
    };
  });

  const {
    viewerId: connectionViewerId,
    busyTargetId: busyConnectionTargetId,
    busyRequestId: busyConnectionRequestId,
    busyActionKey,
    schemaReady: connectionSchemaReady,
    schemaMessage: connectionSchemaMessage,
    connectionBuckets,
    getConnectionState,
    sendRequest,
    respond,
  } = useConnectionRequests();

  useEffect(() => {
    if (!connectionViewerId) return;
    setCurrentUserId((previous) => previous || connectionViewerId);
  }, [connectionViewerId]);

  useEffect(() => {
    if (!noticeBanner) return;
    const timerId = window.setTimeout(() => setNoticeBanner(null), 3200);
    return () => window.clearTimeout(timerId);
  }, [noticeBanner]);

  useEffect(() => {
    if (!realtimeToast) return;
    const timerId = window.setTimeout(() => setRealtimeToast(null), 4200);
    return () => window.clearTimeout(timerId);
  }, [realtimeToast]);

  const loadProviders = useCallback(
    async (soft = false) => {
      if (soft) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      setErrorMessage("");

      try {
        const browserCoordinatesPromise = getBrowserCoordinates(GEO_LOOKUP_TIMEOUT_MS);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error(authError?.message || "Login required.");
        }

        setCurrentUserId(user.id);
        await ensureClientProfile(user).catch(() => false);

        let peoplePayload: CommunityPeopleSuccessPayload;
        try {
          const payload = await fetchAuthedJson<CommunityPeopleResponse>(supabase, "/api/community/people");
          if (!payload.ok) {
            throw new Error(payload.message || "Unable to load people directory.");
          }
          peoplePayload = payload;
        } catch (routeError) {
          peoplePayload = await loadPeopleSnapshotDirect(user.id).catch((fallbackError) => {
            const primaryMessage =
              routeError instanceof Error ? routeError.message : "Unable to load people directory.";
            const fallbackMessage =
              fallbackError instanceof Error ? fallbackError.message : "Fallback people load failed.";
            throw new Error(primaryMessage || fallbackMessage);
          });
        }

        const viewerId = peoplePayload.currentUserId || user.id;
        setCurrentUserId(viewerId);

        const viewerProfile = ((peoplePayload.profiles || []) as ProfileRow[]).find(
          (profile) => profile.id === viewerId
        );
        const browserCoordinates = await browserCoordinatesPromise;
        const viewerProfileCoordinates = viewerProfile
          ? resolveCoordinates({
              row: viewerProfile as unknown as Record<string, unknown>,
              location: viewerProfile.location || "",
              seed: viewerProfile.id,
            })
          : null;
        const effectiveViewerCoordinates = browserCoordinates || viewerProfileCoordinates || defaultMarketCoordinates();
        setViewerCenter({
          lat: effectiveViewerCoordinates.latitude,
          lng: effectiveViewerCoordinates.longitude,
        });

        const providerIdsForDetails = Array.from(
          new Set(
            [
              ...((peoplePayload.profiles || []) as ProfileRow[]).map((profile) => normalizeText(profile.id)),
              ...(peoplePayload.services || []).map((row) => normalizeText((row as ServiceRow).provider_id)),
              ...(peoplePayload.products || []).map((row) => normalizeText((row as ProductRow).provider_id)),
            ].filter((providerId) => providerId && providerId !== viewerId)
          )
        );

        const { serviceDetails, productDetails } = await loadProviderDetails(providerIdsForDetails).catch(() => ({
          serviceDetails: [] as ServiceDetailRow[],
          productDetails: [] as ProductDetailRow[],
        }));

        const cards = createProviderCards({
          payload: peoplePayload,
          viewerId,
          viewerCoordinates: effectiveViewerCoordinates,
          serviceDetails,
          productDetails,
        });

        setProviders(cards);
        setLastSyncedAt(new Date().toISOString());
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load people.";
        setProviders([]);
        setErrorMessage(message);
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadProviders(false);
  }, [loadProviders]);

  const ensureViewerId = useCallback(async () => {
    if (currentUserId) return currentUserId;
    if (connectionViewerId) {
      setCurrentUserId(connectionViewerId);
      return connectionViewerId;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error(error?.message || "Login required.");
    }

    setCurrentUserId(user.id);
    return user.id;
  }, [connectionViewerId, currentUserId]);

  const loadSavedProfiles = useCallback(
    async (viewerId: string, nextProviders: ProviderCardModel[]) => {
      if (!viewerId || nextProviders.length === 0) {
        setSavedCardIds(new Set());
        return;
      }

      const cardIds = nextProviders.map((provider) => buildProfileCardId(provider.id));
      const { data, error } = await supabase
        .from("feed_card_saves")
        .select("card_id")
        .eq("user_id", viewerId)
        .in("card_id", cardIds);

      if (error) {
        if (isMissingRelationError(error.message || "")) {
          const nextSavedIds = new Set(
            getPendingFeedCardIds(viewerId).filter((cardId) => cardIds.includes(cardId))
          );
          setSavedCardIds(nextSavedIds);
          return;
        }
        throw new Error(error.message);
      }

      const persistedCardIds = ((data as SavedCardRow[] | null) || []).map((row) => row.card_id);
      prunePendingFeedCardSaves(viewerId, persistedCardIds);
      const nextSavedIds = new Set([
        ...persistedCardIds,
        ...getPendingFeedCardIds(viewerId).filter((cardId) => cardIds.includes(cardId)),
      ]);
      setSavedCardIds(nextSavedIds);
      void syncPendingFeedCardSaves(supabase, viewerId, persistedCardIds);
    },
    []
  );

  useEffect(() => {
    if (!currentUserId || providers.length === 0) return;

    void loadSavedProfiles(currentUserId, providers).catch(() => {
      setSavedCardIds(new Set());
    });
  }, [currentUserId, loadSavedProfiles, providers]);

  const providerById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);

  const persistProfileShare = useCallback(
    async (provider: ProviderCardModel, channel: "native" | "clipboard", activeViewerId: string | null) => {
      if (!activeViewerId) return;

      const { error } = await supabase.from("feed_card_shares").insert({
        user_id: activeViewerId,
        card_id: buildProfileCardId(provider.id),
        focus_id: provider.id,
        card_type: "service",
        title: provider.name,
        channel,
        metadata: {
          kind: "people_profile",
          image: provider.media[0]?.url || provider.avatar,
          mediaGallery: provider.media.map((entry) => entry.url).slice(0, 3),
          priceLabel: provider.minPriceLabel ? `From ${provider.minPriceLabel}` : null,
          audienceName: provider.location,
          tags: provider.tags.slice(0, 3),
          actionPath: provider.fullProfilePath,
          role: provider.role,
        },
      });

      if (error && !isMissingRelationError(error.message || "")) {
        console.warn("Failed to persist profile share:", error.message);
      }
    },
    []
  );

  const handleConnect = useCallback(
    async (providerId: string) => {
      setNoticeBanner(null);
      try {
        if (!connectionSchemaReady) {
          throw new Error(connectionSchemaMessage || "Connections are not configured yet.");
        }

        if (!isUuid(providerId)) {
          throw new Error("This profile cannot accept live connections yet.");
        }

        const viewerId = await ensureViewerId();
        if (viewerId === providerId) {
          throw new Error("This is your own profile.");
        }

        const previousState = getConnectionState(providerId);
        await sendRequest(providerId);

        setNoticeBanner({
          kind: "success",
          message:
            previousState.kind === "incoming_pending"
              ? "Connection accepted instantly."
              : "Connection request sent.",
        });
      } catch (error) {
        setNoticeBanner({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to send connection request.",
        });
      }
    },
    [connectionSchemaMessage, connectionSchemaReady, ensureViewerId, getConnectionState, sendRequest]
  );

  const handleConnectionDecision = useCallback(
    async (requestId: string, decision: ConnectionDecision) => {
      setNoticeBanner(null);
      try {
        if (!connectionSchemaReady) {
          throw new Error(connectionSchemaMessage || "Connections are not configured yet.");
        }

        await respond(requestId, decision);
        setNoticeBanner({
          kind: "success",
          message:
            decision === "accepted"
              ? "Connection accepted."
              : decision === "rejected"
              ? "Connection request declined."
              : "Connection request cancelled.",
        });
      } catch (error) {
        setNoticeBanner({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to update connection request.",
        });
      }
    },
    [connectionSchemaMessage, connectionSchemaReady, respond]
  );
  const openChatThread = useCallback(
    async (providerId: string) => {
      setNoticeBanner(null);
      setChatBusyUserId(providerId);
      try {
        if (!isUuid(providerId)) {
          throw new Error("This profile does not support direct chat yet.");
        }

        const viewerId = await ensureViewerId();
        if (viewerId === providerId) {
          throw new Error("This is your own profile.");
        }

        const conversationId = await getOrCreateDirectConversationId(supabase, viewerId, providerId);
        router.push(`/dashboard/chat?open=${encodeURIComponent(conversationId)}`);
      } catch (error) {
        setNoticeBanner({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to open chat.",
        });
      } finally {
        setChatBusyUserId(null);
      }
    },
    [ensureViewerId, router]
  );

  const handleToggleSave = useCallback(
    async (providerId: string) => {
      const provider = providerById.get(providerId);
      if (!provider) return;

      const cardId = buildProfileCardId(providerId);
      const wasSaved = savedCardIds.has(cardId);
      const shouldSave = !wasSaved;

      setSavingCardIds((current) => new Set(current).add(cardId));
      setSavedCardIds((current) => {
        const next = new Set(current);
        if (shouldSave) {
          next.add(cardId);
        } else {
          next.delete(cardId);
        }
        return next;
      });

      try {
        const viewerId = await ensureViewerId();
        const savePayload = {
          card_id: cardId,
          focus_id: provider.id,
          card_type: "service" as const,
          title: provider.name,
          subtitle: provider.role,
          action_path: provider.fullProfilePath,
          metadata: {
            kind: "people_profile",
            image: provider.media[0]?.url || provider.avatar,
            mediaGallery: provider.media.map((entry) => entry.url).slice(0, 3),
            priceLabel: provider.minPriceLabel ? `From ${provider.minPriceLabel}` : null,
            audienceName: provider.location,
            tags: provider.tags.slice(0, 3),
            role: provider.role,
            actionPath: provider.fullProfilePath,
          },
        };

        if (shouldSave) {
          stagePendingFeedCardSave(viewerId, savePayload);
          await persistFeedCardSave(supabase, savePayload);

          setNoticeBanner({ kind: "success", message: "Profile saved." });
          return;
        }

        clearPendingFeedCardSave(viewerId, cardId);
        await removeFeedCardSave(supabase, cardId);

        setNoticeBanner({ kind: "info", message: "Removed from saved." });
      } catch (error) {
        try {
          const viewerId = await ensureViewerId();
          const rollbackPayload = {
            card_id: cardId,
            focus_id: provider.id,
            card_type: "service" as const,
            title: provider.name,
            subtitle: provider.role,
            action_path: provider.fullProfilePath,
            metadata: {
              kind: "people_profile",
              image: provider.media[0]?.url || provider.avatar,
              mediaGallery: provider.media.map((entry) => entry.url).slice(0, 3),
              priceLabel: provider.minPriceLabel ? `From ${provider.minPriceLabel}` : null,
              audienceName: provider.location,
              tags: provider.tags.slice(0, 3),
              role: provider.role,
              actionPath: provider.fullProfilePath,
            },
          };

          if (shouldSave) {
            clearPendingFeedCardSave(viewerId, cardId);
          } else {
            stagePendingFeedCardSave(viewerId, rollbackPayload);
          }
        } catch {
          // Ignore viewer lookup failures during rollback.
        }

        setSavedCardIds((current) => {
          const next = new Set(current);
          if (wasSaved) {
            next.add(cardId);
          } else {
            next.delete(cardId);
          }
          return next;
        });

        setNoticeBanner({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to update saved state.",
        });
      } finally {
        setSavingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          return next;
        });
      }
    },
    [ensureViewerId, providerById, savedCardIds]
  );

  const handleShareProvider = useCallback(
    async (providerId: string) => {
      const provider = providerById.get(providerId);
      if (!provider) return;

      const cardId = buildProfileCardId(providerId);
      const sharePath = provider.fullProfilePath;
      const shareUrl = `${window.location.origin}${sharePath}`;
      const shareText = `${provider.name} • ${provider.role} • ${provider.location}`;

      setSharingCardIds((current) => new Set(current).add(cardId));

      try {
        let activeViewerId: string | null = null;
        try {
          activeViewerId = await ensureViewerId();
        } catch {
          activeViewerId = null;
        }

        if (navigator.share) {
          await navigator.share({
            title: provider.name,
            text: shareText,
            url: shareUrl,
          });
          await persistProfileShare(provider, "native", activeViewerId);
          setNoticeBanner({ kind: "success", message: "Share sent." });
          return;
        }

        if (!navigator.clipboard?.writeText) {
          throw new Error("This browser does not support clipboard sharing.");
        }

        await navigator.clipboard.writeText(`${provider.name}\n${shareText}\n${shareUrl}`);
        await persistProfileShare(provider, "clipboard", activeViewerId);
        setNoticeBanner({ kind: "success", message: "Profile link copied." });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setNoticeBanner({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to share right now.",
        });
      } finally {
        setSharingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          return next;
        });
      }
    },
    [ensureViewerId, persistProfileShare, providerById]
  );

  const getPresenceTone = useCallback(
    (provider: ProviderCardModel): PresenceTone => {
      if (onlineUserIds.has(provider.id) || provider.online) return "online";
      const availability = normalizeText(provider.availability).toLowerCase();
      if (availability.includes("away") || availability.includes("busy") || availability.includes("idle")) {
        return "away";
      }
      return "offline";
    },
    [onlineUserIds]
  );

  const filteredProviders = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return providers;

    return providers.filter((provider) => provider.searchDocument.includes(query));
  }, [deferredSearchQuery, providers]);

  const discoveryProviders = useMemo(() => {
    const presenceWeight = (tone: PresenceTone) => (tone === "online" ? 2 : tone === "away" ? 1 : 0);

    return [...filteredProviders].sort((left, right) => {
      const leftPresence = presenceWeight(getPresenceTone(left));
      const rightPresence = presenceWeight(getPresenceTone(right));
      return right.rankScore - left.rankScore || rightPresence - leftPresence || left.distanceKm - right.distanceKm;
    });
  }, [filteredProviders, getPresenceTone]);

  const visibleProviders = useMemo(
    () => discoveryProviders.slice(0, Math.max(PAGE_SIZE, visibleCount)),
    [discoveryProviders, visibleCount]
  );
  const hasMoreProviders = visibleCount < discoveryProviders.length;

  useEffect(() => {
    if (loadMoreTimerRef.current) {
      window.clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = null;
    }
    setVisibleCount(Math.min(PAGE_SIZE, discoveryProviders.length));
    setLoadingMore(false);
  }, [discoveryProviders.length]);

  useEffect(() => {
    return () => {
      if (loadMoreTimerRef.current) {
        window.clearTimeout(loadMoreTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading || !hasMoreProviders || !infiniteSentinelRef.current) return;
    const sentinel = infiniteSentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loadingMore || !hasMoreProviders) return;

        setLoadingMore(true);
        if (loadMoreTimerRef.current) {
          window.clearTimeout(loadMoreTimerRef.current);
        }

        loadMoreTimerRef.current = window.setTimeout(() => {
          setVisibleCount((previous) => Math.min(previous + PAGE_SIZE, discoveryProviders.length));
          setLoadingMore(false);
          loadMoreTimerRef.current = null;
        }, 220);
      },
      { rootMargin: "240px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [discoveryProviders.length, hasMoreProviders, loading, loadingMore]);

  useEffect(() => {
    if (!visibleProviders.length) {
      setActiveProviderId(null);
      return;
    }

    if (activeProviderId && visibleProviders.some((provider) => provider.id === activeProviderId)) {
      return;
    }

    setActiveProviderId(visibleProviders[0].id);
  }, [activeProviderId, visibleProviders]);

  const setCardElement = useCallback((providerId: string, element: HTMLDivElement | null) => {
    if (element) {
      cardElementsRef.current.set(providerId, element);
      return;
    }
    cardElementsRef.current.delete(providerId);
  }, []);

  const jumpToProviderCard = useCallback((providerId: string) => {
    setActiveProviderId(providerId);
    const element = cardElementsRef.current.get(providerId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePeoplePromptSubmit = useCallback(() => {
    const firstMatch = discoveryProviders[0];

    if (firstMatch) {
      jumpToProviderCard(firstMatch.id);
      return;
    }

    if (searchQuery.trim()) {
      setNoticeBanner({
        kind: "info",
        message: `No people matched "${searchQuery.trim()}". Try a broader name, role, or location.`,
      });
    }
  }, [discoveryProviders, jumpToProviderCard, searchQuery]);

  const peoplePromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: "Search people by name, role, location, or expertise",
      value: searchQuery,
      onValueChange: setSearchQuery,
      onSubmit: handlePeoplePromptSubmit,
      actions: [
        {
          id: "refresh-people",
          label: syncing ? "Refreshing..." : "Refresh",
          icon: Loader2,
          onClick: () => {
            void loadProviders(true);
          },
          variant: "secondary",
          disabled: syncing,
          busy: syncing,
        },
      ],
    }),
    [handlePeoplePromptSubmit, loadProviders, searchQuery, syncing]
  );

  useDashboardPrompt(peoplePromptConfig);

  useEffect(() => {
    if (!visibleProviders.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisibleEntry = [...entries]
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        const providerId = mostVisibleEntry?.target.getAttribute("data-provider-id");
        if (!providerId) return;
        setActiveProviderId(providerId);
      },
      {
        threshold: [0.35, 0.55, 0.75],
        rootMargin: "-10% 0px -18% 0px",
      }
    );

    visibleProviders.forEach((provider) => {
      const element = cardElementsRef.current.get(provider.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [visibleProviders]);

  useEffect(() => {
    if (!deepLinkContext.providerId || deepLinkHandledRef.current) return;
    if (!visibleProviders.some((provider) => provider.id === deepLinkContext.providerId)) return;

    deepLinkHandledRef.current = true;
    jumpToProviderCard(deepLinkContext.providerId);
  }, [deepLinkContext.providerId, jumpToProviderCard, visibleProviders]);

  const providerPreviewMap = useMemo(() => {
    const map = new Map<string, ProviderPreview>();
    providers.forEach((provider) => {
      map.set(provider.id, {
        id: provider.id,
        name: provider.name,
        avatar: provider.avatar,
        role: provider.role,
        presenceTone: getPresenceTone(provider),
        distanceLabel: `${provider.distanceKm.toFixed(1)} km away`,
        ratingLabel:
          provider.rating !== null && provider.reviews > 0
            ? `${provider.rating.toFixed(1)} | ${provider.reviews} reviews`
            : "No reviews yet",
        tagline: provider.trustBlurb,
      });
    });
    return map;
  }, [getPresenceTone, providers]);

  useEffect(() => {
    providerPreviewRef.current = providerPreviewMap;
  }, [providerPreviewMap]);

  useEffect(() => {
    if (!currentUserId) return;

    let active = true;
    let reloadTimer: number | null = null;

    const scheduleReload = () => {
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }
      reloadTimer = window.setTimeout(() => {
        void loadProviders(true);
      }, 260);
    };

    const handleConnectionRealtimeEvent = (payload: RealtimePostgresChangesPayload<RealtimeConnectionRow>) => {
      const nextRow = (payload.new as RealtimeConnectionRow | null) || null;
      const previousRow = (payload.old as RealtimeConnectionRow | null) || null;
      const requesterId = normalizeText(nextRow?.requester_id || previousRow?.requester_id);
      const recipientId = normalizeText(nextRow?.recipient_id || previousRow?.recipient_id);
      const status = normalizeText(nextRow?.status || previousRow?.status).toLowerCase();
      const isRelevant = requesterId === currentUserId || recipientId === currentUserId;
      if (!isRelevant) return;

      scheduleReload();

      if (payload.eventType === "INSERT" && recipientId === currentUserId && status === "pending") {
        const requesterName = providerPreviewRef.current.get(requesterId)?.name || "A nearby member";
        setRealtimeToast({
          id: Date.now(),
          message: `${requesterName} just sent you a connection request.`,
        });
      }
    };

    const handleSavedRealtimeEvent = (payload: RealtimePostgresChangesPayload<{ card_id?: string | null }>) => {
      const nextRow = (payload.new as { card_id?: string | null } | null) || null;
      const previousRow = (payload.old as { card_id?: string | null } | null) || null;
      const cardId = normalizeText(nextRow?.card_id || previousRow?.card_id);
      if (!cardId.startsWith("people:")) return;

      setSavedCardIds((current) => {
        const next = new Set(current);
        if (payload.eventType === "DELETE") {
          clearPendingFeedCardSave(currentUserId, cardId);
          next.delete(cardId);
        } else {
          prunePendingFeedCardSaves(currentUserId, [cardId]);
          next.add(cardId);
        }
        return next;
      });
    };

    const presenceChannel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    const syncOnlineUsers = () => {
      if (!active) return;
      setOnlineUserIds(extractPresenceUserIds(presenceChannel.presenceState()));
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .on("presence", { event: "join" }, syncOnlineUsers)
      .on("presence", { event: "leave" }, syncOnlineUsers)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || !active) return;
        await presenceChannel.track({
          user_id: currentUserId,
          page: "people",
          last_seen_at: new Date().toISOString(),
        });
      });

    let realtimeChannel = supabase
      .channel(`people-live-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_presence" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "help_requests" }, scheduleReload)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_saves",
          filter: `user_id=eq.${currentUserId}`,
        },
        handleSavedRealtimeEvent
      );

    if (connectionSchemaReady) {
      realtimeChannel = realtimeChannel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        handleConnectionRealtimeEvent
      );
    }

    realtimeChannel = realtimeChannel.subscribe();

    const presenceHeartbeatTimer = window.setInterval(() => {
      void presenceChannel.track({
        user_id: currentUserId,
        page: "people",
        last_seen_at: new Date().toISOString(),
      });
    }, AUTO_SYNC_INTERVAL_MS);

    const autoSyncTimer = window.setInterval(() => {
      void loadProviders(true);
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }
      window.clearInterval(presenceHeartbeatTimer);
      window.clearInterval(autoSyncTimer);
      void presenceChannel.untrack();
      void supabase.removeChannel(presenceChannel);
      void supabase.removeChannel(realtimeChannel);
      setOnlineUserIds(new Set());
    };
  }, [connectionSchemaReady, currentUserId, loadProviders]);

  const activeNow = useMemo(
    () => providers.filter((provider) => getPresenceTone(provider) === "online").length,
    [getPresenceTone, providers]
  );
  const activeProvider =
    visibleProviders.find((provider) => provider.id === activeProviderId) || visibleProviders[0] || null;

  const mapItems = useMemo(
    () =>
      visibleProviders.slice(0, MAP_ITEM_LIMIT).map((provider) => ({
        id: provider.id,
        title: provider.name,
        lat: provider.latitude ?? defaultMarketCoordinates().latitude,
        lng: provider.longitude ?? defaultMarketCoordinates().longitude,
        creatorName: provider.role,
        locationLabel: provider.location,
        category: provider.primarySkill,
        timeLabel: `Replies ~${provider.responseMinutes} min`,
        priceLabel: provider.minPriceLabel ? `From ${provider.minPriceLabel}` : undefined,
      })),
    [visibleProviders]
  );
  const connectionsPanelProps = {
    incoming: connectionBuckets.incoming,
    outgoing: connectionBuckets.outgoing,
    accepted: connectionBuckets.accepted,
    providerPreviewMap,
    busyRequestId: busyConnectionRequestId,
    busyActionKey,
    onAccept: (requestId: string) => void handleConnectionDecision(requestId, "accepted"),
    onDecline: (requestId: string) => void handleConnectionDecision(requestId, "rejected"),
    onCancel: (requestId: string) => void handleConnectionDecision(requestId, "cancelled"),
    onChat: (userId: string) => void openChatThread(userId),
    chatBusyUserId,
  };
  return (
    <div
      className="mx-auto w-full max-w-[1540px] space-y-4 overflow-x-clip pb-2 sm:space-y-5"
      style={{
        backgroundImage:
          "radial-gradient(circle at 0% 0%, rgba(14,165,164,0.08), transparent 34%), radial-gradient(circle at 100% 8%, rgba(17,70,106,0.08), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.44), rgba(255,255,255,0))",
      }}
    >
      <PeopleLiveHeader
        activeNow={activeNow}
        connectionCount={connectionBuckets.accepted.length}
        syncing={syncing}
        lastSyncedAt={lastSyncedAt}
      />

      <ConnectionsPanel {...connectionsPanelProps} />

      {!connectionSchemaReady && !!connectionSchemaMessage && (
        <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm sm:px-5">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 leading-6 [overflow-wrap:anywhere]">{connectionSchemaMessage}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex min-w-0 items-start gap-2 font-medium">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="[overflow-wrap:anywhere]">{errorMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadProviders(false)}
              className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {noticeBanner && (
        <div
          className={`rounded-[1.6rem] border px-4 py-3 text-sm shadow-sm sm:px-5 ${
            noticeBanner.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : noticeBanner.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-cyan-200 bg-cyan-50 text-[var(--brand-700)]"
          }`}
        >
          <div className="flex items-start gap-3">
            {noticeBanner.kind === "success" ? (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            ) : noticeBanner.kind === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Bell className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="min-w-0 leading-6 [overflow-wrap:anywhere]">{noticeBanner.message}</p>
          </div>
        </div>
      )}

      <PeopleMapPanel
        items={mapItems}
        center={viewerCenter}
        activeProvider={activeProvider}
        onSelectProvider={setActiveProviderId}
      />

      <div className="min-w-0">
        <main className="space-y-6">
          {loading ? (
            <ProviderCardSkeleton count={8} />
          ) : !providers.length ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Users className="h-7 w-7" />
              </div>
              <p className="mt-4 text-xl font-semibold text-slate-900">No business profiles are visible yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                ServiQ will populate this discovery feed automatically as nearby people publish their business profiles,
                services, and trust details.
              </p>
              <button
                type="button"
                onClick={() => void loadProviders(false)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                Refresh discovery
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>
          ) : !discoveryProviders.length ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(14,165,164,0.12),rgba(103,232,249,0.18))] text-[var(--brand-700)]">
                <Compass className="h-7 w-7" />
              </div>
              <p className="mt-4 text-xl font-semibold text-slate-900">
                {searchQuery.trim() ? "No people match this search yet" : "No providers found yet"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {searchQuery.trim()
                  ? "Try a different name, role, location, or expertise keyword."
                  : "Published people and business profiles will appear here as they become available."}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (searchQuery.trim()) {
                    setSearchQuery("");
                    return;
                  }
                  void loadProviders(false);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                {searchQuery.trim() ? "Clear search" : "Refresh people"}
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>
          ) : (
            <>
              <motion.section
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: {
                      staggerChildren: 0.06,
                    },
                  },
                }}
                className="grid grid-cols-2 items-start gap-3 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {visibleProviders.map((provider) => {
                  const connectionState = getConnectionState(provider.id) || EMPTY_CONNECTION_STATE;
                  const connectionBusy =
                    busyConnectionTargetId === provider.id ||
                    (connectionState.requestId ? busyConnectionRequestId === connectionState.requestId : false);
                  const cardId = buildProfileCardId(provider.id);

                  return (
                    <motion.div
                      key={provider.id}
                      ref={(element) => setCardElement(provider.id, element)}
                      data-provider-id={provider.id}
                      className="scroll-mt-28"
                      variants={{
                        hidden: { opacity: 0, y: 18 },
                        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
                      }}
                    >
                      <ProviderCard
                        provider={provider}
                        presenceTone={getPresenceTone(provider)}
                        connectionState={connectionState}
                        busy={connectionBusy}
                        busyActionKey={busyActionKey}
                        chatBusy={chatBusyUserId === provider.id}
                        isActive={activeProviderId === provider.id}
                        saved={savedCardIds.has(cardId)}
                        saveBusy={savingCardIds.has(cardId)}
                        shareBusy={sharingCardIds.has(cardId)}
                        onActivate={setActiveProviderId}
                        onConnect={handleConnect}
                        onAccept={(requestId) => void handleConnectionDecision(requestId, "accepted")}
                        onDecline={(requestId) => void handleConnectionDecision(requestId, "rejected")}
                        onCancel={(requestId) => void handleConnectionDecision(requestId, "cancelled")}
                        onMessage={(providerId) => void openChatThread(providerId)}
                        onToggleSave={(providerId) => void handleToggleSave(providerId)}
                        onShare={(providerId) => void handleShareProvider(providerId)}
                        onViewProfile={(providerId) => {
                          const selectedProvider = providerById.get(providerId);
                          if (!selectedProvider) return;
                          router.push(selectedProvider.publicProfilePath || selectedProvider.fullProfilePath);
                        }}
                        onOpenTrust={setTrustPanelProviderId}
                      />
                    </motion.div>
                  );
                })}
              </motion.section>

              {hasMoreProviders && (
                <div ref={infiniteSentinelRef} className="flex justify-center py-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[var(--brand-700)]" />
                    )}
                    {loadingMore ? "Loading more profiles..." : "Scroll for the next business showcase"}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <AnimatePresence>
        {realtimeToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -8, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 top-[5rem] z-40 rounded-[1.4rem] border border-amber-200 bg-white px-4 py-3 shadow-lg sm:left-auto sm:right-4 sm:top-4 sm:max-w-sm"
          >
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Incoming request</p>
                <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">{realtimeToast.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProviderTrustPanel
        userId={trustPanelProviderId || ""}
        open={Boolean(trustPanelProviderId)}
        onClose={() => setTrustPanelProviderId(null)}
      />
    </div>
  );
}
