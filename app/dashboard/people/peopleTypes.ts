import type { CommunityPeopleResponse, CommunityProfileRecord } from "@/lib/api/community";
import type { ConnectionState } from "@/lib/connectionState";
import { calculateLocalRankScore, calculateProfileCompletion, calculateVerificationStatus, createBusinessSlug, estimateResponseMinutes } from "@/lib/business";
import { distanceBetweenCoordinatesKm, resolveCoordinatesWithAccuracy, type Coordinates } from "@/lib/geo";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { buildPublicProfilePath, getProfileDisplayName } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";
import type { ProviderCard as ProviderCardModel, ProviderMedia, ProviderOffering } from "./types";

export type ProfileRow = CommunityProfileRecord;

export type ServiceRow = {
  provider_id: string;
  category?: string | null;
  price?: number | null;
};

export type ProductRow = {
  provider_id: string;
  category?: string | null;
  price?: number | null;
};

export type PostRow = {
  user_id?: string | null;
  author_id?: string | null;
  created_by?: string | null;
  provider_id?: string | null;
  category?: string | null;
  status?: string | null;
  state?: string | null;
};

export type HelpRequestRow = {
  requester_id?: string | null;
  category?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  status?: string | null;
};

export type ReviewRow = {
  provider_id: string;
  rating: number | null;
};

export type ProviderPresenceRow = {
  provider_id: string;
  is_online?: boolean | null;
  availability?: string | null;
  response_sla_minutes?: number | null;
  rolling_response_minutes?: number | null;
  last_seen?: string | null;
};

export type ProviderOrderStatsRow = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

export type RealtimeConnectionRow = {
  requester_id?: string | null;
  recipient_id?: string | null;
  status?: string | null;
};

export type ServiceDetailRow = {
  id?: string | null;
  provider_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  price?: number | string | null;
  image_url?: string | null;
  availability?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type ProductDetailRow = {
  id?: string | null;
  provider_id?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  price?: number | string | null;
  delivery_method?: string | null;
  image_url?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type SavedCardRow = {
  card_id: string;
};

export type FlexibleRow = Record<string, unknown>;

export type CommunityPeopleSuccessPayload = Extract<CommunityPeopleResponse, { ok: true }>;

export const PAGE_SIZE = 12;
export const GEO_LOOKUP_TIMEOUT_MS = 1200;
export const MAX_DISCOVERABLE_PROFILES = 140;
export const AUTO_SYNC_INTERVAL_MS = 30000;
export const NEW_PROVIDER_WINDOW_DAYS = 21;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PRICE_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const EMPTY_CONNECTION_STATE: ConnectionState = {
  kind: "none",
  requestId: null,
  updatedAt: null,
  row: null,
};

export const normalizeText = (value: string | null | undefined) => value?.trim() || "";

export const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export const isFlexibleRow = (value: unknown): value is FlexibleRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toFlexibleRows = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is FlexibleRow => isFlexibleRow(item)) : [];

export const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|function .* does not exist|could not find the table '.*' in the schema cache/i.test(message);

export const formatCurrency = (value: number | null) => {
  if (!Number.isFinite(value)) return null;
  return PRICE_FORMATTER.format(Number(value));
};

export const buildProfileCardId = (providerId: string) => `people:${providerId}`;

export const pushTag = (map: Map<string, Set<string>>, providerId: string, tag: string | null | undefined) => {
  const normalized = normalizeText(tag);
  if (!normalized) return;
  if (!map.has(providerId)) {
    map.set(providerId, new Set());
  }
  map.get(providerId)?.add(normalized);
};

export const pushPrice = (map: Map<string, number[]>, providerId: string, value: number | null | undefined) => {
  if (!Number.isFinite(value)) return;
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) return;
  const current = map.get(providerId) || [];
  map.set(providerId, [...current, Math.round(nextValue)]);
};

export const isNewProvider = (joinedAt: string | null) => {
  if (!joinedAt) return false;
  const timestamp = new Date(joinedAt).getTime();
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= NEW_PROVIDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

export const isUuid = (value: string) => UUID_PATTERN.test(value);

export const formatRelativeTimestamp = (value: string | null) => {
  if (!value) return "recently";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "recently";
  const diffMinutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 24 * 60) return `${Math.floor(diffMinutes / 60)}h ago`;
  if (diffMinutes < 24 * 60 * 7) return `${Math.floor(diffMinutes / (60 * 24))}d ago`;
  return `${Math.floor(diffMinutes / (60 * 24 * 7))}w ago`;
};

export const PLACEHOLDER_TEXT_PATTERN = /\b(demo|sample|seed(?:ed)?|placeholder|dummy|fake|mock|test|temp|lorem|ipsum)\b/i;
export const KEYBOARD_MASH_PATTERN = /(asdf|qwer|zxcv|hjkl|sdfg|dsaf|sdfs|xcad|tmynr|hbtgr|fvcg|gaewg|sdga)/i;

const countVowels = (value: string) => (value.match(/[aeiou]/gi) || []).length;

const looksLikeGarbageToken = (value: string) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  if (PLACEHOLDER_TEXT_PATTERN.test(normalized) || KEYBOARD_MASH_PATTERN.test(normalized)) return true;
  if (normalized.length < 5 || normalized.includes(" ")) return false;
  const vowelRatio = countVowels(normalized) / normalized.length;
  return vowelRatio < 0.2;
};

export const looksLikePlaceholderText = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (PLACEHOLDER_TEXT_PATTERN.test(normalized) || KEYBOARD_MASH_PATTERN.test(normalized)) return true;
  const tokens = normalized.toLowerCase().match(/[a-z]+/g) || [];
  if (!tokens.length) return false;
  const suspiciousTokens = tokens.filter(looksLikeGarbageToken).length;
  return suspiciousTokens >= Math.max(2, Math.ceil(tokens.length * 0.6));
};

export const sanitizeProfileServices = (services: string[] | null | undefined) =>
  (services || []).map((service) => normalizeText(service)).filter((service) => service.length > 0 && !looksLikePlaceholderText(service));

export const isProviderFacingRole = (value: string | null | undefined) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return ["provider", "business", "vendor", "seller", "merchant", "professional", "partner", "agency", "studio", "team", "service"].some((keyword) =>
    normalized.includes(keyword),
  );
};

export const selectOptionalRows = async <TRow extends FlexibleRow>(
  table: string,
  options: { limit?: number; inFilter?: { column: string; values: string[] } } = {},
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

export const loadPeopleSnapshotDirect = async (viewerId: string): Promise<CommunityPeopleSuccessPayload> => {
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
                    : null,
          ),
        ),
        ...helpRequests.map((row) => normalizeText(typeof row.requester_id === "string" ? row.requester_id : null)),
      ].filter(Boolean),
    ),
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
        title: normalizeText(typeof row.title === "string" ? row.title : null),
        category: normalizeText(typeof row.category === "string" ? row.category : null) || "Service",
        price: toFiniteNumber(row.price) ?? 0,
        image_url: normalizeText(typeof row.image_url === "string" ? row.image_url : null) || null,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
        created_at: normalizeText(typeof row.created_at === "string" ? row.created_at : null) || null,
      })),
    products: products
      .filter((row) => typeof row.provider_id === "string" && row.provider_id.length > 0)
      .map((row) => ({
        provider_id: String(row.provider_id),
        title: normalizeText(typeof row.title === "string" ? row.title : null),
        category: normalizeText(typeof row.category === "string" ? row.category : null) || "Product",
        price: toFiniteNumber(row.price) ?? 0,
        image_url: normalizeText(typeof row.image_url === "string" ? row.image_url : null) || null,
        metadata:
          row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : null,
        created_at: normalizeText(typeof row.created_at === "string" ? row.created_at : null) || null,
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

export const loadProviderDetails = async (providerIds: string[]) => {
  if (!providerIds.length) {
    return { serviceDetails: [] as ServiceDetailRow[], productDetails: [] as ProductDetailRow[] };
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

export const createProviderCards = (params: {
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
    ratingMap.set(row.provider_id, { sum: previous.sum + row.rating, count: previous.count + 1 });
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
      mediaMap.set(providerId, [...existingMedia, { id: `media-${providerId}-${index}`, url: imageUrl, title, origin: "product" }]);
    }
    pushPrice(providerPriceMap, providerId, price);
    pushTag(combinedTagMap, providerId, offering.category);
  });

  const profileRows = (payload.profiles || [])
    .slice(0, MAX_DISCOVERABLE_PROFILES)
    .filter((profile) => !!profile.id) as ProfileRow[];

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
        Boolean(normalizeText(profile.avatar_url)) ||
        Boolean(normalizeText(profile.email)) ||
        Boolean(normalizeText(profile.phone));
      const hasDiscoverableOnboarding = hasCompletedOnboarding || (profile.profile_completion_percent || 0) >= 60 || hasProfilePresence;
      const hasCommunityIdentity = Boolean(getProfileDisplayName(profile)) || Boolean(normalizeText(profile.email)) || Boolean(normalizeText(profile.role));

      if (hasPlaceholderName || (!hasProviderSignals && !hasProviderRole && !hasDiscoverableOnboarding && !hasCommunityIdentity)) {
        return null;
      }

      const ratingAgg = ratingMap.get(profile.id);
      const reviewsCount = ratingAgg?.count || 0;
      const rating = reviewsCount > 0 ? Number((ratingAgg!.sum / reviewsCount).toFixed(1)) : null;
      const presence = presenceMap.get(profile.id) || null;
      const availability = normalizeText(presence?.availability || profile.availability || "available").toLowerCase();
      const responseMinutesFromPresence = Number(
        presence?.rolling_response_minutes ?? presence?.response_sla_minutes ?? Number.NaN,
      );
      const responseMinutes = Number.isFinite(responseMinutesFromPresence)
        ? Math.max(1, Math.round(responseMinutesFromPresence))
        : estimateResponseMinutes({ availability, providerId: profile.id });

      const computedProfileCompletion = calculateProfileCompletion({
        name: profile.name,
        location: profile.location,
        bio: profile.bio,
        services: sanitizedServices,
        email: profile.email,
        phone: profile.phone,
        website: profile.website,
      });
      const profileCompletion =
        typeof profile.profile_completion_percent === "number" && Number.isFinite(profile.profile_completion_percent)
          ? profile.profile_completion_percent
          : computedProfileCompletion;

      const verificationStatus = calculateVerificationStatus({
        role: profile.role,
        verificationLevel: profile.verification_level,
        profileCompletion,
        listingsCount: servicesCount + productsCount,
        averageRating: rating ?? 0,
        reviewCount: reviewsCount,
        completedJobs: completedJobsMap.get(profile.id) ?? 0,
      });

      const coordinateMeta = resolveCoordinatesWithAccuracy({
        row: profile as unknown as Record<string, unknown>,
        location: profile.location || "",
        seed: profile.id,
      });
      const providerCoordinates = coordinateMeta.coordinates;
      const distanceKm = distanceBetweenCoordinatesKm(viewerCoordinates, providerCoordinates);

      const online = typeof presence?.is_online === "boolean" ? presence.is_online : availability !== "offline";

      const rankBase = calculateLocalRankScore({ distanceKm, responseMinutes, rating: rating ?? 0, profileCompletion });
      const rankScore = Math.max(1, Math.min(100, Math.round(rankBase + (online ? 4 : 0))));

      const rawRoleLabel = normalizeText(profile.role);
      const roleLabel =
        (rawRoleLabel && !looksLikePlaceholderText(rawRoleLabel) ? rawRoleLabel : "") ||
        (servicesCount + productsCount > 0 ? "Service provider" : "Community member");
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
        ]),
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

      const offerings = [...(serviceOfferingMap.get(profile.id) || []), ...(productOfferingMap.get(profile.id) || [])]
        .map((offering) => {
          const title = normalizeText(offering.title);
          const category = normalizeText(offering.category);
          if (!title || !category || looksLikePlaceholderText(`${title} ${category}`)) return null;
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
          if (left.kind !== right.kind) return left.kind === "service" ? -1 : 1;
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

      const displayName =
        getProfileDisplayName(profile) || normalizeText(profile.email)?.split("@")[0] || roleLabel || "Community member";
      const media = (mediaMap.get(profile.id) || []).slice(0, 6);
      const searchDocument = [
        displayName,
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
        name: displayName,
        businessSlug: createBusinessSlug(displayName, profile.id),
        fullProfilePath: `/business/${createBusinessSlug(displayName, profile.id)}`,
        publicProfilePath: buildPublicProfilePath(profile) || "",
        avatar: resolveProfileAvatarUrl(profile.avatar_url) || createAvatarFallback({ label: displayName, seed: profile.id }),
        role: roleLabel,
        bio,
        location: normalizeText(profile.location) && !looksLikePlaceholderText(profile.location) ? normalizeText(profile.location) : "Nearby",
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
        completedJobs: completedJobsMap.has(profile.id) ? (completedJobsMap.get(profile.id) ?? 0) : null,
        openLeads: openLeadsMap.has(profile.id) ? (openLeadsMap.get(profile.id) ?? 0) : null,
        profileCompletion,
        rankScore,
        joinedAt: profile.created_at || null,
        latitude: providerCoordinates.latitude,
        longitude: providerCoordinates.longitude,
        coordinateAccuracy: coordinateMeta.accuracy,
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
