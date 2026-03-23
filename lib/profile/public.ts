import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { calculateVerificationStatus, estimateResponseMinutes, type VerificationStatus } from "@/lib/business";
import { readMarketplaceComposerMetadata } from "@/lib/marketplaceMetadata";
import { resolvePostMediaUrl } from "@/lib/mediaUrl";
import { isFinalOrderStatus } from "@/lib/orderWorkflow";
import type { ProfileRecord, ProfileRoleFamily } from "@/lib/profile/types";
import {
  buildPublicProfilePath,
  extractProfileIdFromSlug,
  getProfileDisplayName,
  getProfileRoleFamily,
  normalizeProfileRecord,
  normalizeTopics,
} from "@/lib/profile/utils";
import { getServerSupabase } from "@/lib/supabaseServer";

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
  visibility: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  user_id: string | null;
  author_id: string | null;
  created_by: string | null;
  requester_id: string | null;
  owner_id: string | null;
  provider_id: string | null;
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
  title: string;
  details: string;
  category: string;
  type: "need" | "service" | "product";
  status: string;
  createdAt: string | null;
  locationLabel: string | null;
  budget: number | null;
  mode: "urgent" | "schedule" | null;
  neededWithin: string | null;
  scheduleDate: string | null;
  scheduleTime: string | null;
  flexibleTiming: boolean;
  imageUrl: string | null;
  attachmentCount: number;
};

export type PublicProfileData = {
  profile: ProfileRecord;
  displayName: string;
  roleFamily: ProfileRoleFamily;
  topics: string[];
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
};

const toListingPrice = (value: number | null) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const trim = (value: string | null | undefined) => value?.trim() ?? "";

const normalizePostType = (value: string | null | undefined): PublicProfilePost["type"] => {
  const normalized = trim(value).toLowerCase();
  if (normalized === "service") return "service";
  if (normalized === "product") return "product";
  return "need";
};

const readPostOwnerId = (row: PostRow) =>
  trim(row.user_id || row.author_id || row.created_by || row.requester_id || row.owner_id || row.provider_id);

const readComposedPostParts = (row: PostRow) => {
  const raw = trim(row.text) || trim(row.content) || trim(row.description);
  if (!raw) return [];
  return raw.split(" | ").map((part) => part.trim()).filter(Boolean);
};

const readComposedValue = (parts: string[], prefix: string) => {
  const match = parts.find((part) => part.toLowerCase().startsWith(prefix.toLowerCase()));
  return match ? match.slice(prefix.length).trim() : "";
};

const isComposedMetaPart = (value: string) =>
  /^(type|mode|needed|budget|category|location|timing|media):/i.test(value.trim());

const readBudgetFromText = (value: string) => {
  const match = value.match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const readPostImageUrl = (metadata: Record<string, unknown> | null | undefined) => {
  const composerMetadata = readMarketplaceComposerMetadata(metadata);
  if (composerMetadata?.media?.length) {
    return resolvePostMediaUrl(composerMetadata.media[0]?.url || null);
  }

  const gallery = Array.isArray(metadata?.media)
    ? metadata.media
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const record = entry as Record<string, unknown>;
          return typeof record.url === "string" ? record.url : null;
        })
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return (
    resolvePostMediaUrl(typeof metadata?.image === "string" ? metadata.image : null) ||
    resolvePostMediaUrl(typeof metadata?.image_url === "string" ? metadata.image_url : null) ||
    resolvePostMediaUrl(gallery[0] || null)
  );
};

const isPublicPostVisible = (row: PostRow, profileId: string) => {
  if (readPostOwnerId(row) !== profileId) return false;

  const visibility = trim(row.visibility).toLowerCase();
  if (["private", "connections", "network", "contacts"].includes(visibility)) return false;

  const status = trim(row.status || row.state).toLowerCase();
  if (["draft", "hidden", "deleted", "archived"].includes(status)) return false;

  return true;
};

const normalizePublicProfilePost = (row: PostRow): PublicProfilePost | null => {
  if (!row.id) return null;

  const parts = readComposedPostParts(row);
  const composerMetadata = readMarketplaceComposerMetadata(row.metadata);
  const title =
    trim(row.title) ||
    trim(row.name) ||
    trim(composerMetadata?.title) ||
    parts[0] ||
    "Marketplace post";
  const detailsFromParts = parts.length > 1 && !isComposedMetaPart(parts[1]) ? parts[1] : "";
  const details =
    trim(composerMetadata?.details) ||
    detailsFromParts ||
    (parts.length === 1 ? parts[0] : "") ||
    "This member shared a public marketplace update.";
  const type = normalizePostType(composerMetadata?.postType || row.post_type || row.type);
  const category =
    trim(composerMetadata?.category) ||
    trim(row.category) ||
    readComposedValue(parts, "Category:") ||
    (type === "need" ? "Need" : type === "service" ? "Service" : "Product");
  const budget = composerMetadata?.budget ?? readBudgetFromText(readComposedValue(parts, "Budget:"));
  const locationLabel = trim(composerMetadata?.locationLabel) || readComposedValue(parts, "Location:") || null;
  const rawMode = trim(readComposedValue(parts, "Mode:")).toLowerCase();
  const mode = composerMetadata?.mode || (rawMode === "urgent" || rawMode === "schedule" ? rawMode : null);
  const neededWithin = trim(composerMetadata?.neededWithin) || readComposedValue(parts, "Needed:") || null;
  const imageUrl = readPostImageUrl(row.metadata);

  return {
    id: row.id,
    title,
    details,
    category,
    type,
    status: trim(row.status || row.state).toLowerCase() || "open",
    createdAt: row.created_at || null,
    locationLabel,
    budget,
    mode,
    neededWithin,
    scheduleDate: trim(composerMetadata?.scheduleDate) || null,
    scheduleTime: trim(composerMetadata?.scheduleTime) || null,
    flexibleTiming: Boolean(composerMetadata?.flexibleTiming),
    imageUrl,
    attachmentCount: Number.isFinite(Number(composerMetadata?.attachmentCount))
      ? Number(composerMetadata?.attachmentCount)
      : composerMetadata?.media?.length || 0,
  };
};

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

export async function loadPublicProfileBySlug(slug: string): Promise<PublicProfileData | null> {
  noStore();
  const profileId = extractProfileIdFromSlug(slug);
  if (!profileId) return null;

  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: profileRow, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id,full_name,name,location,role,bio,interests,services,email,phone,website,avatar_url,availability,profile_completion_percent,metadata,created_at,updated_at"
    )
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profileRow) {
    return null;
  }

  const profile = normalizeProfileRecord(profileRow as Record<string, unknown>, {
    id: profileId,
    email: typeof (profileRow as { email?: unknown }).email === "string" ? (profileRow as { email: string }).email : "",
  });

  if (!profile) return null;

  const roleFamily = getProfileRoleFamily(profile.role);

  const [
    servicesResult,
    productsResult,
    reviewsResult,
    postsResult,
    ordersResult,
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
    supabase
      .from("posts")
      .select(
        "id,title,name,text,content,description,category,type,post_type,status,state,visibility,metadata,created_at,user_id,author_id,created_by,requester_id,owner_id,provider_id",
        { count: "exact" }
      )
      .or(
        `user_id.eq.${profile.id},author_id.eq.${profile.id},created_by.eq.${profile.id},requester_id.eq.${profile.id},owner_id.eq.${profile.id},provider_id.eq.${profile.id}`
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("status")
      .eq(roleFamily === "provider" ? "provider_id" : "consumer_id", profile.id),
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
  const posts = (((postsResult.data as PostRow[] | null) || []) as PostRow[])
    .filter((row) => isPublicPostVisible(row, profile.id))
    .map((row) => normalizePublicProfilePost(row))
    .filter((row): row is PublicProfilePost => !!row);
  const ratingValues = reviewRows.map((row) => row.rating).filter((rating) => rating > 0);
  const averageRating = ratingValues.length
    ? Number((ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1))
    : 0;
  const activeOrders = ((ordersResult.data as OrderRow[] | null) || []).filter((row) => !isFinalOrderStatus(row.status)).length;
  const serviceCount = servicesResult.count || 0;
  const productCount = productsResult.count || 0;
  const reviewCount = reviewsResult.count || reviewRows.length;
  const postsCount = posts.length;
  const topics = normalizeTopics([...(profile.interests || []), ...(profile.services || [])]);
  const responseMinutes = estimateResponseMinutes({
    availability: profile.availability,
    providerId: profile.id,
  });
  const verificationStatus = calculateVerificationStatus({
    role: profile.role,
    profileCompletion: profile.profile_completion_percent,
    listingsCount: serviceCount + productCount,
    averageRating,
    reviewCount,
  });
  const displayName = getProfileDisplayName(profile) || "Local member";
  const publicPath = buildPublicProfilePath(profile);

  return {
    profile,
    displayName,
    roleFamily,
    topics,
    services,
    products,
    offerings: [...services, ...products],
    posts,
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
  };
}
