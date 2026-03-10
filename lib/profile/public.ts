import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { calculateVerificationStatus, estimateResponseMinutes, type VerificationStatus } from "@/lib/business";
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

export type PublicProfileData = {
  profile: ProfileRecord;
  displayName: string;
  roleFamily: ProfileRoleFamily;
  topics: string[];
  services: PublicProfileListing[];
  products: PublicProfileListing[];
  offerings: PublicProfileListing[];
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
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
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
