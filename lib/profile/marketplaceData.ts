import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getServerSupabase } from "@/lib/supabaseServer";
import type { ProfileRecord } from "@/lib/profile/types";
import {
  buildPublicProfilePath,
  extractProfileIdFromSlug,
  getProfileDisplayName,
  getProfileRoleFamily,
  normalizeProfileRecord,
  slugifyProfileName,
} from "@/lib/profile/utils";
import {
  calculateMarketplaceProfileCompletion,
  calculateMarketplaceTrustScore,
  createDefaultProfileSections,
  mergeProfileSections,
  sortProfileSections,
  type MarketplaceAvailabilityRecord,
  type MarketplacePaymentMethodRecord,
  type MarketplacePortfolioRecord,
  type MarketplaceProfileBundle,
  type MarketplaceReviewRecord,
  type MarketplaceServiceRecord,
  type MarketplaceTrustScoreRecord,
  type MarketplaceWorkHistoryRecord,
  type ProfileSectionRecord,
} from "@/lib/profile/marketplace";

type ProfileRow = Record<string, unknown>;
type GenericRow = Record<string, unknown>;

type ServiceLikeRow = {
  id: string | null;
  profile_id?: string | null;
  provider_id?: string | null;
  title?: string | null;
  name?: string | null;
  service_name?: string | null;
  description?: string | null;
  price?: number | string | null;
  service_type?: string | null;
  area?: string | null;
  payment_methods?: string[] | null;
  availability?: string | null;
  rating?: number | string | null;
  review_count?: number | string | null;
  is_featured?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ProductLikeRow = {
  id: string | null;
  profile_id?: string | null;
  provider_id?: string | null;
  title?: string | null;
  name?: string | null;
  product_name?: string | null;
  description?: string | null;
  price?: number | string | null;
  stock?: number | string | null;
  category?: string | null;
  delivery_mode?: string | null;
  area?: string | null;
  payment_methods?: string[] | null;
  availability?: string | null;
  rating?: number | string | null;
  review_count?: number | string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ReviewRow = {
  rating: number | string | null;
  comment: string | null;
  created_at: string | null;
};

type TrustScoreRow = {
  id: string | null;
  profile_id: string | null;
  rating_score: number | string | null;
  completion_rate: number | string | null;
  on_time_rate: number | string | null;
  repeat_clients_score: number | string | null;
  verification_score: number | string | null;
  response_time_score: number | string | null;
  trust_score: number | string | null;
  updated_at: string | null;
};

const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|could not find the table '.*' in the schema cache/i.test(message);

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeTextArray = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
};

const textFromRow = (row: GenericRow, key: string, fallback = "") => {
  const value = row[key];
  return typeof value === "string" ? value.trim() : fallback;
};

const nullableTextFromRow = (row: GenericRow, key: string) => {
  const value = textFromRow(row, key);
  return value ? value : null;
};

const booleanFromRow = (row: GenericRow, key: string, fallback = false) => {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
};

const jsonObjectFromRow = (row: GenericRow, key: string) => {
  const value = row[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
};

const selectRows = async <T extends GenericRow>(params: {
  db: NonNullable<ReturnType<typeof getServerSupabase>>;
  table: string;
  select: string;
  filters?: Array<{ column: string; value: string }>;
  orderBy?: string;
  ascending?: boolean;
}): Promise<T[] | null> => {
  let query = params.db.from(params.table).select(params.select);

  for (const filter of params.filters || []) {
    query = query.eq(filter.column, filter.value);
  }

  if (params.orderBy) {
    query = query.order(params.orderBy, { ascending: params.ascending ?? false });
  }

  const { data, error } = await query;
  if (!error) {
    return (data as unknown as T[] | null) || [];
  }

  if (isMissingRelationError(error.message || "")) {
    return null;
  }

  throw error;
};

const toServiceRecord = (row: ServiceLikeRow, profileId: string): MarketplaceServiceRecord | null => {
  const id = normalizeString(row.id);
  if (!id) return null;

  const title = normalizeString(row.title || row.service_name || row.name) || "Untitled service";
  const serviceTypeRaw = normalizeString(row.service_type).toLowerCase();
  const serviceType: MarketplaceServiceRecord["service_type"] =
    serviceTypeRaw === "remote" || serviceTypeRaw === "hybrid" ? serviceTypeRaw : "onsite";

  return {
    id,
    profile_id: normalizeString(row.profile_id || row.provider_id) || profileId,
    title,
    description: normalizeString(row.description),
    price: toNumber(row.price),
    service_type: serviceType,
    area: normalizeString(row.area) || null,
    payment_methods: normalizeTextArray(row.payment_methods),
    availability: normalizeString(row.availability) || "available",
    rating: clamp(toNumber(row.rating), 0, 100),
    review_count: Math.max(0, Math.round(toNumber(row.review_count))),
    is_featured: Boolean(row.is_featured),
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
};

const toProductRecord = (row: ProductLikeRow, profileId: string) => {
  const id = normalizeString(row.id);
  if (!id) return null;

  return {
    id,
    profile_id: normalizeString(row.profile_id || row.provider_id) || profileId,
    title: normalizeString(row.title || row.product_name || row.name) || "Untitled product",
    description: normalizeString(row.description) || null,
    price: toNumber(row.price),
    stock: Math.max(0, Math.round(toNumber(row.stock))),
    category: normalizeString(row.category) || null,
    delivery_mode: (normalizeString(row.delivery_mode).toLowerCase() as MarketplaceProfileBundle["products"][number]["delivery_mode"]) || "both",
    area: normalizeString(row.area) || null,
    payment_methods: normalizeTextArray(row.payment_methods),
    availability: normalizeString(row.availability) || "available",
    rating: clamp(toNumber(row.rating), 0, 100),
    review_count: Math.max(0, Math.round(toNumber(row.review_count))),
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
};

const toPortfolioRecord = (row: GenericRow, profileId: string): MarketplacePortfolioRecord | null => {
  const id = normalizeString(row.id);
  if (!id) return null;

  return {
    id,
    profile_id: normalizeString(row.profile_id) || profileId,
    title: textFromRow(row, "title") || "Untitled project",
    description: nullableTextFromRow(row, "description"),
    media_url: nullableTextFromRow(row, "media_url"),
    media_type: nullableTextFromRow(row, "media_type"),
    link_url: nullableTextFromRow(row, "link_url"),
    category: nullableTextFromRow(row, "category"),
    is_featured: booleanFromRow(row, "is_featured"),
    metadata: jsonObjectFromRow(row, "metadata"),
    created_at: nullableTextFromRow(row, "created_at"),
    updated_at: nullableTextFromRow(row, "updated_at"),
  };
};

const toWorkHistoryRecord = (row: GenericRow, profileId: string): MarketplaceWorkHistoryRecord | null => {
  const id = normalizeString(row.id);
  if (!id) return null;

  return {
    id,
    profile_id: normalizeString(row.profile_id) || profileId,
    role_title: textFromRow(row, "role_title") || textFromRow(row, "title") || "Untitled role",
    company_name: textFromRow(row, "company_name") || textFromRow(row, "company") || "Independent",
    description: nullableTextFromRow(row, "description"),
    location: nullableTextFromRow(row, "location"),
    start_date: nullableTextFromRow(row, "start_date"),
    end_date: nullableTextFromRow(row, "end_date"),
    is_current: booleanFromRow(row, "is_current"),
    verification_status: nullableTextFromRow(row, "verification_status"),
    metadata: jsonObjectFromRow(row, "metadata"),
    created_at: nullableTextFromRow(row, "created_at"),
    updated_at: nullableTextFromRow(row, "updated_at"),
  };
};

const toAvailabilityRecord = (row: GenericRow, profileId: string): MarketplaceAvailabilityRecord | null => {
  const id = normalizeString(row.id);
  if (!id) return null;

  return {
    id,
    profile_id: normalizeString(row.profile_id) || profileId,
    label: textFromRow(row, "label") || "Availability",
    availability: textFromRow(row, "availability") || "available",
    days_of_week: normalizeTextArray(row.days_of_week),
    start_time: nullableTextFromRow(row, "start_time"),
    end_time: nullableTextFromRow(row, "end_time"),
    timezone: nullableTextFromRow(row, "timezone"),
    notes: nullableTextFromRow(row, "notes"),
    is_active: row.is_active === false ? false : true,
    metadata: jsonObjectFromRow(row, "metadata"),
    created_at: nullableTextFromRow(row, "created_at"),
    updated_at: nullableTextFromRow(row, "updated_at"),
  };
};

const toPaymentMethodRecord = (row: GenericRow, profileId: string): MarketplacePaymentMethodRecord | null => {
  const id = normalizeString(row.id);
  if (!id) return null;

  return {
    id,
    profile_id: normalizeString(row.profile_id) || profileId,
    method_type: textFromRow(row, "method_type") || "bank_transfer",
    provider_name: nullableTextFromRow(row, "provider_name"),
    account_label: nullableTextFromRow(row, "account_label"),
    account_last4: nullableTextFromRow(row, "account_last4"),
    account_handle: nullableTextFromRow(row, "account_handle"),
    is_default: booleanFromRow(row, "is_default"),
    is_verified: row.is_verified !== false,
    metadata: jsonObjectFromRow(row, "metadata"),
    created_at: nullableTextFromRow(row, "created_at"),
    updated_at: nullableTextFromRow(row, "updated_at"),
  };
};

const toTrustScoreRecord = (row: TrustScoreRow | null, profileId: string, computed: ReturnType<typeof calculateMarketplaceTrustScore>): MarketplaceTrustScoreRecord => ({
  id: row?.id || `${profileId}-trust`,
  profile_id: row?.profile_id || profileId,
  rating_score: clamp(toNumber(row?.rating_score || computed.ratingScore)),
  completion_rate: clamp(toNumber(row?.completion_rate || computed.completionRate)),
  on_time_rate: clamp(toNumber(row?.on_time_rate || computed.onTimeRate)),
  repeat_clients_score: clamp(toNumber(row?.repeat_clients_score || computed.repeatClientsScore)),
  verification_score: clamp(toNumber(row?.verification_score || computed.verificationScore)),
  response_time_score: clamp(toNumber(row?.response_time_score || computed.responseTimeScore)),
  trust_score: clamp(toNumber(row?.trust_score || computed.trustScore)),
  updated_at: row?.updated_at || null,
});

const loadProfileByLookup = async (db: NonNullable<ReturnType<typeof getServerSupabase>>, lookup: string) => {
  const trimmed = lookup.trim();
  const profileId = extractProfileIdFromSlug(trimmed);
  const slugified = slugifyProfileName(trimmed);

  const candidates = [
    { column: "username", value: trimmed },
    { column: "username", value: slugified },
  ];

  if (profileId) {
    candidates.push({ column: "id", value: profileId });
  }

  for (const candidate of candidates) {
    const { data, error } = await db
      .from("profiles")
      .select(
        "id,full_name,name,username,headline,location,role,bio,interests,services,email,phone,website,avatar_url,availability,verification_level,on_time_rate,response_time_minutes,repeat_clients_count,trust_score,onboarding_completed,profile_completion_percent,latitude,longitude,metadata,created_at,updated_at"
      )
      .eq(candidate.column, candidate.value)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error.message || "")) return null;
      throw error;
    }

    if (data) {
      return normalizeProfileRecord(data as ProfileRow, {
        id: normalizeString((data as ProfileRow).id) || profileId || trimmed,
        email: typeof (data as ProfileRow).email === "string" ? (data as { email: string }).email : "",
      });
    }
  }

  return null;
};

const loadServices = async (db: NonNullable<ReturnType<typeof getServerSupabase>>, profileId: string) => {
  const newRows = await selectRows<ServiceLikeRow>({
    db,
    table: "services",
    select: "*",
    filters: [{ column: "profile_id", value: profileId }],
    orderBy: "created_at",
  });

  const sourceRows =
    newRows && newRows.length > 0
      ? newRows
      : (await selectRows<ServiceLikeRow>({
          db,
          table: "service_listings",
          select: "id,provider_id,title,description,price,category,availability,metadata,created_at,updated_at",
          filters: [{ column: "provider_id", value: profileId }],
          orderBy: "created_at",
        })) || [];

  return sourceRows.map((row) => toServiceRecord(row, profileId)).filter((row): row is MarketplaceServiceRecord => Boolean(row));
};

const loadProducts = async (db: NonNullable<ReturnType<typeof getServerSupabase>>, profileId: string) => {
  const newRows = await selectRows<ProductLikeRow>({
    db,
    table: "products",
    select: "*",
    filters: [{ column: "profile_id", value: profileId }],
    orderBy: "created_at",
  });

  const sourceRows =
    newRows && newRows.length > 0
      ? newRows
      : (await selectRows<ProductLikeRow>({
          db,
          table: "product_catalog",
          select: "id,provider_id,title,description,price,stock,category,metadata,created_at,updated_at",
          filters: [{ column: "provider_id", value: profileId }],
          orderBy: "created_at",
        })) || [];

  return sourceRows.map((row) => toProductRecord(row, profileId)).filter((row): row is NonNullable<ReturnType<typeof toProductRecord>> => Boolean(row));
};

const loadRows = async <T extends GenericRow, R>(
  db: NonNullable<ReturnType<typeof getServerSupabase>>,
  table: string,
  select: string,
  profileId: string,
  normalizer: (row: T, profileId: string) => R | null
): Promise<R[]> => {
  const rows = await selectRows<T>({
    db,
    table,
    select,
    filters: [{ column: "profile_id", value: profileId }],
    orderBy: "updated_at",
  });

  return (rows || [])
    .map((row) => normalizer(row, profileId))
    .filter((row): row is R => row !== null);
};

const loadReviews = async (db: NonNullable<ReturnType<typeof getServerSupabase>>, profileId: string): Promise<MarketplaceReviewRecord[]> => {
  const { data, error } = await db
    .from("reviews")
    .select("id,provider_id,reviewer_id,rating,comment,created_at")
    .eq("provider_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingRelationError(error.message || "")) return [];
    throw error;
  }

  return (((data as ReviewRow[] | null) || []) as ReviewRow[])
    .map((row, index) => ({
      id: `${profileId}-review-${index}`,
      provider_id: profileId,
      reviewer_id: profileId,
      rating: clamp(toNumber(row.rating), 0, 5),
      comment: row.comment?.trim() || null,
      created_at: row.created_at || null,
    }))
    .filter((row): row is MarketplaceReviewRecord => Boolean(row));
};

const loadTrustScores = async (
  db: NonNullable<ReturnType<typeof getServerSupabase>>,
  profile: ProfileRecord,
  completionPercent: number,
  averageRating: number
) => {
  const calculated = calculateMarketplaceTrustScore({
    averageRating,
    completionRate: completionPercent,
    onTimeRate: profile.on_time_rate || 0,
    repeatClients: profile.repeat_clients_count || 0,
    verificationLevel: profile.verification_level,
    responseTimeMinutes: profile.response_time_minutes,
  });

  const { data, error } = await db
    .from("trust_scores")
    .select("id,profile_id,rating_score,completion_rate,on_time_rate,repeat_clients_score,verification_score,response_time_score,trust_score,updated_at")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (error && !isMissingRelationError(error.message || "")) {
    throw error;
  }

  const trustScore = toTrustScoreRecord((data as TrustScoreRow | null) || null, profile.id, calculated);

  return trustScore;
};

const loadSections = async (db: NonNullable<ReturnType<typeof getServerSupabase>>, profileId: string) => {
  const rows = await selectRows<ProfileSectionRecord>({
    db,
    table: "profile_sections",
    select: "id,profile_id,section_type,section_order,is_visible,created_at",
    filters: [{ column: "profile_id", value: profileId }],
    orderBy: "section_order",
  });

  if (!rows || rows.length === 0) {
    return createDefaultProfileSections(profileId);
  }

  return sortProfileSections(mergeProfileSections(rows as ProfileSectionRecord[], profileId));
};

export async function loadMarketplaceProfileBundleByUsername(identifier: string): Promise<
  (MarketplaceProfileBundle & {
    displayName: string;
    publicPath: string;
    canonicalUsername: string;
  }) | null
> {
  noStore();
  const db = getServerSupabase();
  if (!db) return null;

  const profile = await loadProfileByLookup(db, identifier);
  if (!profile) return null;

  const roleFamily = getProfileRoleFamily(profile.role);
  const [services, products, portfolio, workHistory, availability, paymentMethods, reviews, sections] = await Promise.all([
    loadServices(db, profile.id),
    loadProducts(db, profile.id),
    loadRows<GenericRow, MarketplacePortfolioRecord>(
      db,
      "portfolio",
      "id,profile_id,title,description,media_url,media_type,link_url,category,is_featured,metadata,created_at,updated_at",
      profile.id,
      toPortfolioRecord
    ),
    loadRows<GenericRow, MarketplaceWorkHistoryRecord>(
      db,
      "work_history",
      "*",
      profile.id,
      toWorkHistoryRecord
    ),
    loadRows<GenericRow, MarketplaceAvailabilityRecord>(
      db,
      "availability",
      "id,profile_id,label,availability,days_of_week,start_time,end_time,timezone,notes,is_active,metadata,created_at,updated_at",
      profile.id,
      toAvailabilityRecord
    ),
    loadRows<GenericRow, MarketplacePaymentMethodRecord>(
      db,
      "payment_methods",
      "id,profile_id,method_type,provider_name,account_label,account_last4,account_handle,is_default,is_verified,metadata,created_at,updated_at",
      profile.id,
      toPaymentMethodRecord
    ),
    loadReviews(db, profile.id),
    loadSections(db, profile.id),
  ]);

  const ratingValues = reviews.map((row) => row.rating).filter((rating) => Number.isFinite(rating) && rating > 0);
  const averageRating = ratingValues.length
    ? Number((ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1))
    : 0;

  const completion = calculateMarketplaceProfileCompletion({
    profile,
    services,
    products,
    portfolio,
    availability,
    paymentMethods,
  });

  const trustScore = await loadTrustScores(db, profile, completion.total, averageRating);
  const publicPath = buildPublicProfilePath(profile);

  return {
    profile,
    displayName: getProfileDisplayName(profile) || slugifyProfileName(profile.username || profile.full_name || profile.name || profile.id),
    roleFamily,
    sections,
    services,
    products,
    portfolio,
    workHistory,
    availability,
    paymentMethods,
    trustScore,
    reviews,
    averageRating,
    reviewCount: reviews.length,
    serviceCount: services.length,
    productCount: products.length,
    portfolioCount: portfolio.length,
    workHistoryCount: workHistory.length,
    availabilityCount: availability.length,
    paymentMethodCount: paymentMethods.length,
    completion,
    completionPercent: completion.total,
    canonicalUsername: profile.username || slugifyProfileName(getProfileDisplayName(profile) || profile.id),
    publicPath,
  };
}

export async function loadMarketplaceProfileBundleByProfileId(profileId: string) {
  return loadMarketplaceProfileBundleByUsername(profileId);
}
