import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { calculateVerificationStatus, estimateResponseMinutes, type VerificationStatus } from "@/lib/business";
import { isMissingConnectionSchemaError } from "@/lib/connectionErrors";
import { isRelistedHelpRequest } from "@/lib/helpRequestProgress";
import { readMarketplaceComposerMetadata } from "@/lib/marketplaceMetadata";
import { resolvePostMediaUrl, resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { isFinalOrderStatus } from "@/lib/orderWorkflow";
import type { ProfileRecord, ProfileRoleFamily } from "@/lib/profile/types";
import {
  buildPublicProfilePath,
  extractProfileIdFromSlug,
  getProfileDisplayName,
  getProfileRoleFamily,
  normalizeProfileRecord,
  normalizeTopics,
  slugifyProfileName,
} from "@/lib/profile/utils";
import { getServerSupabase } from "@/lib/supabaseServer";

const normalizeString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

type ServiceRow = {
  id: string | null;
  title: string | null;
  category: string | null;
  price: number | null;
  availability: string | null;
};

type ProductRow = {
  id: string | null;
  title: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
};

type ReviewRow = {
  rating: number | null;
  comment: string | null;
  created_at: string | null;
};

type OrderRow = {
  status: string | null;
};

type HelpRequestRow = {
  id: string | null;
  accepted_provider_id: string | null;
  title: string | null;
  details: string | null;
  category: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location_label: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type PostRow = {
  id: string | null;
  title: string | null;
  name: string | null;
  text: string | null;
  content: string | null;
  description: string | null;
  category: string | null;
  type: string | null;
  post_type: string | null;
  status: string | null;
  state: string | null;
  user_id: string | null;
  author_id: string | null;
  created_by: string | null;
  requester_id: string | null;
  owner_id: string | null;
  provider_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type ConnectionRow = {
  requester_id: string | null;
  recipient_id: string | null;
};

type PublicProfileListing = {
  id: string;
  type: "service" | "product";
  title: string;
  category: string;
  price: number | null;
  status: string;
};

export type PublicProfileReview = {
  rating: number;
  comment: string | null;
  createdAt: string | null;
};

export type PublicProfilePost = {
  id: string;
  source: "post" | "help_request";
  type: "service" | "product" | "demand";
  title: string;
  description: string;
  category: string;
  price: number;
  status: string;
  locationLabel: string;
  urgent: boolean;
  media: PublicProfilePostMedia[];
  helpRequestId: string | null;
  acceptedProviderId: string | null;
  createdAt: string | null;
};

export type PublicProfilePostMedia = {
  mimeType: string;
  url: string;
};

export type PublicProfileConnection = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  location: string | null;
  publicPath: string;
};

export type PublicProfileManualOffering = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  price: number | null;
};

export type PublicProfilePaymentMethod = {
  id: string;
  method_type: string;
  provider_name: string | null;
  account_handle: string | null;
  is_verified: boolean;
};

export type PublicProfileWorkHistory = {
  id: string;
  role_title: string;
  company_name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

export type PublicProfileData = {
  profile: ProfileRecord;
  displayName: string;
  roleFamily: ProfileRoleFamily;
  acceptedConnectionCount: number;
  acceptedConnections: PublicProfileConnection[];
  topics: string[];
  manualOfferings: PublicProfileManualOffering[];
  services: PublicProfileListing[];
  products: PublicProfileListing[];
  offerings: PublicProfileListing[];
  posts: PublicProfilePost[];
  reviews: PublicProfileReview[];
  averageRating: number;
  reviewCount: number;
  serviceCount: number;
  productCount: number;
  postsCount: number;
  activeOrders: number;
  responseMinutes: number;
  verificationStatus: VerificationStatus;
  canonicalSlug: string;
  publicPath: string;
  paymentMethods: PublicProfilePaymentMethod[];
  workHistory: PublicProfileWorkHistory[];
};

const toListingPrice = (value: number | null) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const normalizeServiceListing = (row: ServiceRow): PublicProfileListing | null => {
  if (!row.id) return null;

  return {
    id: row.id,
    type: "service",
    title: row.title?.trim() || "Untitled service",
    category: row.category?.trim() || "Service",
    price: toListingPrice(row.price),
    status: row.availability?.trim().toLowerCase() || "available",
  };
};

const normalizeProductListing = (row: ProductRow): PublicProfileListing | null => {
  if (!row.id) return null;

  return {
    id: row.id,
    type: "product",
    title: row.title?.trim() || "Untitled product",
    category: row.category?.trim() || "Product",
    price: toListingPrice(row.price),
    status: (row.stock || 0) > 0 ? "in stock" : "out of stock",
  };
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

const parseDateMs = (value?: string | null) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeComparable = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeMarketplacePostKind = (value?: string | null): "service" | "product" | "demand" => {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "service" || normalized === "product") return normalized;
  return "demand";
};

const POST_OWNER_FIELDS = ["user_id", "author_id", "created_by", "requester_id", "owner_id", "provider_id"] as const;

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|could not find the table '.*' in the schema cache/i.test(message);

const buildPostOwnerFilter = (profileId: string, fields: readonly string[]) =>
  fields.map((field) => `${field}.eq.${profileId}`).join(",");

const postOwnerFieldVariants: ReadonlyArray<ReadonlyArray<string>> = [
  POST_OWNER_FIELDS,
  ["user_id", "author_id", "created_by", "requester_id", "owner_id"],
  ["user_id", "author_id", "created_by", "requester_id"],
  ["user_id", "author_id", "created_by"],
  ["user_id", "author_id"],
  ["user_id"],
  ["author_id"],
  ["created_by"],
  ["requester_id"],
  ["owner_id"],
  ["provider_id"],
];

type PostQueryResult = {
  data: PostRow[];
  count: number;
};

const loadProfilePosts = async (
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  profileId: string
): Promise<PostQueryResult> => {
  for (const ownerFields of postOwnerFieldVariants) {
    const result = await supabase
      .from("posts")
      .select("*", { count: "exact" })
      .or(buildPostOwnerFilter(profileId, ownerFields))
      .order("created_at", { ascending: false })
      .limit(6);

    if (!result.error) {
      return {
        data: ((result.data as PostRow[] | null) || []).filter((row) => {
          const ownerId =
            row.user_id || row.author_id || row.created_by || row.requester_id || row.owner_id || row.provider_id || "";
          return ownerId === profileId;
        }),
        count: result.count || 0,
      };
    }

    const errorMessage = result.error.message || "";
    if (isMissingColumnError(errorMessage)) {
      continue;
    }

    if (isMissingRelationError(errorMessage)) {
      return { data: [], count: 0 };
    }

    return { data: [], count: 0 };
  }

  return { data: [], count: 0 };
};

const mediaRegex = /\[([^\]]+)\]\s(https?:\/\/[^\s,]+)/g;

const parsePostText = (rawText: string) => {
  const fallback = {
    title: rawText || "Local post",
    description: rawText || "Local post",
    budget: 0,
    category: "Need",
    location: "",
    kind: "demand" as const,
    media: [] as PublicProfilePostMedia[],
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

  const media: PublicProfilePostMedia[] = [];
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

const mediaFromComposerMetadata = (value: unknown): PublicProfilePostMedia[] => {
  const metadata = readMarketplaceComposerMetadata(value);
  if (!metadata) return [];

  return metadata.media
    .map((entry) => {
      const resolvedUrl = resolvePostMediaUrl(entry.url);
      if (!resolvedUrl) return null;

      return {
        mimeType: entry.type,
        url: resolvedUrl,
      } satisfies PublicProfilePostMedia;
    })
    .filter((entry): entry is PublicProfilePostMedia => !!entry);
};

const matchHelpRequestForPost = (params: {
  postRow: PostRow;
  title: string;
  description: string;
  category: string;
  helpRequests: HelpRequestRow[];
  usedHelpRequestIds: Set<string>;
}): HelpRequestRow | null => {
  const { postRow, title, description, category, helpRequests, usedHelpRequestIds } = params;
  const postTitle = normalizeComparable(title);
  const postDescription = normalizeComparable(description);
  const postCategory = normalizeComparable(category);
  const postCreatedAt = parseDateMs(postRow.created_at);

  let bestMatch: HelpRequestRow | null = null;
  let bestScore = -1;

  for (const candidate of helpRequests) {
    const candidateId = candidate.id?.trim() || "";
    if (!candidateId || usedHelpRequestIds.has(candidateId)) continue;

    const candidateTitle = normalizeComparable(candidate.title);
    const candidateDetails = normalizeComparable(candidate.details);
    const candidateCategory = normalizeComparable(candidate.category);
    const candidateCreatedAt = parseDateMs(candidate.created_at);
    let score = 0;

    if (postTitle && candidateTitle && postTitle === candidateTitle) {
      score += 5;
    } else if (
      postTitle &&
      candidateTitle &&
      (postTitle.includes(candidateTitle) || candidateTitle.includes(postTitle))
    ) {
      score += 3;
    }

    if (postCategory && candidateCategory && postCategory === candidateCategory) {
      score += 2;
    }

    if (
      postDescription &&
      candidateDetails &&
      (postDescription === candidateDetails ||
        postDescription.includes(candidateDetails) ||
        candidateDetails.includes(postDescription))
    ) {
      score += 1;
    }

    if (postCreatedAt && candidateCreatedAt) {
      const diffMs = Math.abs(postCreatedAt - candidateCreatedAt);
      if (diffMs <= 2 * 60 * 1000) score += 4;
      else if (diffMs <= 10 * 60 * 1000) score += 2;
      else if (diffMs <= 60 * 60 * 1000) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) return null;
  if (bestScore < 5) return null;

  const matchedId = bestMatch.id?.trim() || "";
  if (matchedId) {
    usedHelpRequestIds.add(matchedId);
  }

  return bestMatch;
};

const normalizePublicPost = (params: {
  row: PostRow;
  helpRequests: HelpRequestRow[];
  usedHelpRequestIds: Set<string>;
}): PublicProfilePost | null => {
  const { row, helpRequests, usedHelpRequestIds } = params;
  if (!row.id) return null;

  const composerMetadata = readMarketplaceComposerMetadata(row.metadata);
  const parsedFromText = parsePostText(row.text?.trim() || row.content?.trim() || row.description?.trim() || row.title?.trim() || "");
  const type = normalizeMarketplacePostKind(row.type || row.post_type || composerMetadata?.postType || parsedFromText.kind);
  const title = composerMetadata?.title?.trim() || row.title?.trim() || parsedFromText.title || (type === "demand" ? "Need local support" : "Marketplace update");
  const description =
    composerMetadata?.details?.trim() ||
    parsedFromText.description ||
    row.description?.trim() ||
    row.content?.trim() ||
    row.text?.trim() ||
    title;
  const matchingHelpRequest = type === "demand"
    ? matchHelpRequestForPost({
        postRow: row,
        title,
        description,
        category:
          composerMetadata?.category?.trim() ||
          row.category?.trim() ||
          parsedFromText.category ||
          "Need",
        helpRequests,
        usedHelpRequestIds,
      })
    : null;
  const rawHelpRequestStatus = matchingHelpRequest?.status?.trim() || "";
  const status =
    rawHelpRequestStatus && ["cancelled", "canceled"].includes(rawHelpRequestStatus.toLowerCase()) && isRelistedHelpRequest(matchingHelpRequest?.metadata)
      ? "open"
      : rawHelpRequestStatus || row.status?.trim() || row.state?.trim() || "open";
  if (isClosedStatus(status)) return null;

  const category =
    composerMetadata?.category?.trim() ||
    matchingHelpRequest?.category?.trim() ||
    row.category?.trim() ||
    parsedFromText.category ||
    (type === "demand" ? "Need" : type === "service" ? "Service" : "Product");
  const price =
    (matchingHelpRequest?.budget_max && matchingHelpRequest.budget_max > 0 ? matchingHelpRequest.budget_max : null) ??
    (matchingHelpRequest?.budget_min && matchingHelpRequest.budget_min > 0 ? matchingHelpRequest.budget_min : null) ??
    (composerMetadata?.budget && composerMetadata.budget > 0 ? composerMetadata.budget : null) ??
    (parsedFromText.budget > 0 ? parsedFromText.budget : 0);
  const locationLabel =
    matchingHelpRequest?.location_label?.trim() ||
    composerMetadata?.locationLabel?.trim() ||
    parsedFromText.location ||
    "Nearby";
  const urgent =
    type === "demand" &&
    /urgent|asap|immediate|today|quick|critical|emergency/i.test(`${title} ${description} ${status}`);
  const metadataMedia = mediaFromComposerMetadata(row.metadata);

  return {
    id: row.id,
    source: matchingHelpRequest ? "help_request" : "post",
    type,
    title,
    description,
    category,
    price,
    status,
    locationLabel,
    urgent,
    media: metadataMedia.length ? metadataMedia : parsedFromText.media,
    helpRequestId: matchingHelpRequest?.id?.trim() || null,
    acceptedProviderId: matchingHelpRequest?.accepted_provider_id?.trim() || null,
    createdAt: row.created_at || null,
  };
};
export async function loadPublicProfileBySlug(slug: string): Promise<PublicProfileData | null> {
  noStore();
  const trimmedSlug = slug.trim();
  const profileId = extractProfileIdFromSlug(trimmedSlug);

  const supabase = getServerSupabase();
  if (!supabase) return null;

  const selectClause =
    "id,full_name,name,location,role,bio,interests,services,email,phone,website,avatar_url,availability,profile_completion_percent,metadata,created_at,updated_at";
  const slugCandidates = Array.from(new Set([trimmedSlug, slugifyProfileName(trimmedSlug)])).filter(Boolean);
  const lookupCandidates: Array<{ column: "id" | "username"; value: string }> = [];

  if (profileId) {
    lookupCandidates.push({ column: "id", value: profileId });
  }

  for (const candidate of slugCandidates) {
    lookupCandidates.push({ column: "username", value: candidate });
  }

  let profileRow: Record<string, unknown> | null = null;

  for (const candidate of lookupCandidates) {
    const { data, error } = await supabase.from("profiles").select(selectClause).eq(candidate.column, candidate.value).maybeSingle();

    if (error) {
      if (isMissingRelationError(error.message || "")) {
        return null;
      }
      throw error;
    }

    if (data) {
      profileRow = data as Record<string, unknown>;
      break;
    }
  }

  if (!profileRow) {
    return null;
  }

  const profile = normalizeProfileRecord(profileRow, {
    id: normalizeString(profileRow.id) || profileId || trimmedSlug,
    email: typeof profileRow.email === "string" ? profileRow.email : "",
  });

  if (!profile) return null;

  const roleFamily = getProfileRoleFamily(profile.role);

  const [
    servicesResult,
    productsResult,
    reviewsResult,
    postsResult,
    helpRequestsResult,
    ordersResult,
    connectionsResult,
    acceptedConnectionsResult,
    paymentMethodsResult,
    workHistoryResult,
  ] = await Promise.all([
    supabase
      .from("service_listings")
      .select("id,title,category,price,availability", { count: "exact" })
      .eq("provider_id", profile.id)
      .limit(6),
    supabase
      .from("product_catalog")
      .select("id,title,category,price,stock", { count: "exact" })
      .eq("provider_id", profile.id)
      .limit(6),
    supabase
      .from("reviews")
      .select("rating,comment,created_at", { count: "exact" })
      .eq("provider_id", profile.id)
      .limit(6),
    loadProfilePosts(supabase, profile.id),
    supabase
      .from("help_requests")
      .select("id,accepted_provider_id,title,details,category,budget_min,budget_max,location_label,status,metadata,created_at")
      .eq("requester_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("orders")
      .select("status")
      .eq(roleFamily === "provider" ? "provider_id" : "consumer_id", profile.id),
    supabase
      .from("connection_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`),
    supabase
      .from("connection_requests")
      .select("requester_id,recipient_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`),
    supabase
      .from("payment_methods")
      .select("id,method_type,provider_name,account_handle,is_verified")
      .eq("profile_id", profile.id)
      .order("is_default", { ascending: false })
      .limit(10),
    supabase
      .from("work_history")
      .select("id,role_title,company_name,start_date,end_date,is_current")
      .eq("profile_id", profile.id)
      .order("is_current", { ascending: false })
      .order("start_date", { ascending: false })
      .limit(10),
  ]);

  const services = ((servicesResult.data as ServiceRow[] | null) || [])
    .map((row) => normalizeServiceListing(row))
    .filter((row): row is PublicProfileListing => !!row);
  const products = ((productsResult.data as ProductRow[] | null) || [])
    .map((row) => normalizeProductListing(row))
    .filter((row): row is PublicProfileListing => !!row);
  const reviewRows = ((reviewsResult.data as ReviewRow[] | null) || []).map((row) => ({
    rating: typeof row.rating === "number" && Number.isFinite(row.rating) ? row.rating : 0,
    comment: row.comment?.trim() || null,
    createdAt: row.created_at || null,
  }));
  const helpRequestRows = (helpRequestsResult.data as HelpRequestRow[] | null) || [];
  const usedHelpRequestIds = new Set<string>();
  const postRows = (postsResult.data || [])
    .map((row) => normalizePublicPost({ row, helpRequests: helpRequestRows, usedHelpRequestIds }))
    .filter((row): row is PublicProfilePost => !!row);
  const ratingValues = reviewRows.map((row) => row.rating).filter((rating) => rating > 0);
  const averageRating = ratingValues.length
    ? Number((ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1))
    : 0;
  const activeOrders = ((ordersResult.data as OrderRow[] | null) || []).filter((row) => !isFinalOrderStatus(row.status)).length;
  const serviceCount = servicesResult.count || 0;
  const productCount = productsResult.count || 0;
  const reviewCount = reviewsResult.count || reviewRows.length;
  const postsCount = postsResult.count || 0;
  const topics = normalizeTopics([...(profile.interests || []), ...(profile.services || [])]);

  // Try dedicated manual_offerings table first; fall back to metadata JSONB for older deployments
  let manualOfferings: PublicProfileManualOffering[] = [];
  const offeringsTableResult = await supabase
    .from("manual_offerings")
    .select("id,title,description,thumbnail_url,price")
    .eq("profile_id", profile.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(18);

  if (!offeringsTableResult.error && Array.isArray(offeringsTableResult.data) && offeringsTableResult.data.length > 0) {
    type OfferingRow = { id: string; title: string; description: string | null; thumbnail_url: string | null; price: number | null };
    manualOfferings = (offeringsTableResult.data as OfferingRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      thumbnailUrl: row.thumbnail_url,
      price: row.price,
    }));
  } else {
    // Fallback: read from profiles.metadata.offerings JSONB
    const raw = (profile.metadata || ({} as Record<string, unknown>)).offerings;
    if (Array.isArray(raw)) {
      manualOfferings = raw
        .map((entry, index) => {
          if (!entry || typeof entry !== "object") return null;
          const row = entry as Record<string, unknown>;
          const title = typeof row.title === "string" ? row.title.trim() : "";
          if (!title) return null;
          const description = typeof row.description === "string" ? row.description.trim() : "";
          const thumbnailUrl = typeof row.thumbnailUrl === "string" && row.thumbnailUrl.trim().length > 0 ? row.thumbnailUrl.trim() : null;
          const id = typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim() : `offering-${index}`;
          return {
            id,
            title,
            description,
            thumbnailUrl,
            price: typeof row.price === "number" && Number.isFinite(row.price) ? row.price : null,
          } satisfies PublicProfileManualOffering;
        })
        .filter((value): value is PublicProfileManualOffering => !!value)
        .slice(0, 18);
    }
  }
  const responseMinutes = estimateResponseMinutes({
    availability: profile.availability,
    providerId: profile.id,
  });
  const acceptedConnectionCount =
    connectionsResult.error && !isMissingConnectionSchemaError(connectionsResult.error.message || "")
      ? 0
      : connectionsResult.count || 0;
  const acceptedConnectionIds = Array.from(
    new Set(
      ((acceptedConnectionsResult.data as ConnectionRow[] | null) || [])
        .flatMap((row) => [row.requester_id, row.recipient_id])
        .filter((id): id is string => typeof id === "string" && id.length > 0 && id !== profile.id)
    )
  );
  const acceptedProfilesResult =
    acceptedConnectionIds.length > 0
      ? await supabase.from("profiles").select("id,full_name,name,avatar_url,location").in("id", acceptedConnectionIds)
      : { data: [], error: null };
  const acceptedConnections = (((acceptedProfilesResult.data as Record<string, unknown>[] | null) || [])
    .map((row) => normalizeProfileRecord(row, null))
    .filter((row): row is ProfileRecord => !!row)
    .map((row) => ({
      id: row.id,
      displayName: getProfileDisplayName(row) || "Local member",
      avatarUrl: resolveProfileAvatarUrl(row.avatar_url),
      location: row.location,
      publicPath: buildPublicProfilePath(row),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName)));
  const verificationStatus = calculateVerificationStatus({
    role: profile.role,
    profileCompletion: profile.profile_completion_percent,
    listingsCount: serviceCount + productCount,
    averageRating,
    reviewCount,
  });
  const displayName = getProfileDisplayName(profile) || "Local member";
  const publicPath = buildPublicProfilePath(profile);

  const paymentMethods: PublicProfilePaymentMethod[] = ((paymentMethodsResult.data as Array<{ id: string; method_type: string; provider_name: string | null; account_handle: string | null; is_verified: boolean }> | null) || []).map((pm) => ({
    id: pm.id,
    method_type: pm.method_type,
    provider_name: pm.provider_name ?? null,
    account_handle: pm.account_handle ?? null,
    is_verified: Boolean(pm.is_verified),
  }));
  const workHistory: PublicProfileWorkHistory[] = ((workHistoryResult.data as Array<{ id: string; role_title: string; company_name: string; start_date: string | null; end_date: string | null; is_current: boolean }> | null) || []).map((wh) => ({
    id: wh.id,
    role_title: wh.role_title,
    company_name: wh.company_name,
    start_date: wh.start_date ?? null,
    end_date: wh.end_date ?? null,
    is_current: Boolean(wh.is_current),
  }));

  return {
    profile,
    displayName,
    roleFamily,
    acceptedConnectionCount,
    acceptedConnections,
    topics,
    manualOfferings,
    services,
    products,
    offerings: [...services, ...products],
    posts: postRows,
    reviews: reviewRows,
    averageRating,
    reviewCount,
    serviceCount,
    productCount,
    postsCount,
    activeOrders,
    responseMinutes,
    verificationStatus,
    canonicalSlug: publicPath.split("/").pop() || slug,
    publicPath,
    paymentMethods,
    workHistory,
  };
}
