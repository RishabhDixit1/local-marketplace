import { calculateProfileCompletionPercent, normalizeStoredProfileRole } from "@/lib/profile/utils";

type NullableString = string | null | undefined;

export type NormalizedRole = "seeker" | "provider" | "business";
export type VerificationStatus = "unclaimed" | "pending" | "verified";

const providerRoleSet = new Set(["provider", "seller", "service_provider", "business"]);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashNumber = (seed: string, min: number, max: number) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 10000;
  }
  return min + (hash % (max - min + 1));
};

export const slugifyBusinessName = (name: NullableString) => {
  const raw = (name || "local-business").trim().toLowerCase();
  return raw
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "local-business";
};

export const createBusinessSlug = (name: NullableString, id: NullableString) => {
  const safeName = slugifyBusinessName(name);
  const safeId = (id || "").trim();
  if (!safeId) return safeName;
  return `${safeName}-${safeId}`;
};

export const extractBusinessIdFromSlug = (slug: string) => {
  const uuidMatch = slug.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  if (uuidMatch) return uuidMatch[0];
  return null;
};

export const isProviderRole = (role: NullableString) => providerRoleSet.has((role || "").toLowerCase());

export const normalizeRole = (role: NullableString): NormalizedRole => {
  return normalizeStoredProfileRole(role);
};

export const isClaimedBusiness = (role: NullableString) => (role || "").toLowerCase() === "business";

export const calculateProfileCompletion = (profile: {
  name?: NullableString;
  full_name?: NullableString;
  location?: NullableString;
  bio?: NullableString;
  interests?: string[] | null;
  services?: string[] | null;
  email?: NullableString;
  phone?: NullableString;
  website?: NullableString;
  avatar_url?: NullableString;
  role?: NullableString;
}) => {
  return clamp(calculateProfileCompletionPercent(profile), 0, 100);
};

export const estimateResponseMinutes = (params: {
  availability?: NullableString;
  providerId: string;
  baseResponseMinutes?: number | null;
}) => {
  if (Number.isFinite(params.baseResponseMinutes || NaN) && (params.baseResponseMinutes || 0) > 0) {
    return Math.round(params.baseResponseMinutes as number);
  }

  const availability = (params.availability || "").toLowerCase();
  if (availability === "offline") return 90;

  const jitter = hashNumber(params.providerId, 0, 9);
  if (availability === "busy") return 22 + jitter;
  return 7 + jitter;
};

export const calculateVerificationStatus = (params: {
  role?: NullableString;
  profileCompletion: number;
  listingsCount: number;
  averageRating: number;
  reviewCount: number;
}): VerificationStatus => {
  if (!isClaimedBusiness(params.role)) return "unclaimed";

  const profileReady = params.profileCompletion >= 70;
  const listingsReady = params.listingsCount >= 2;
  const trustReady = params.reviewCount >= 3 ? params.averageRating >= 4 : params.reviewCount >= 1;

  if (profileReady && listingsReady && trustReady) return "verified";
  return "pending";
};

export const verificationLabel = (status: VerificationStatus) => {
  if (status === "verified") return "Verified Business";
  if (status === "pending") return "Verification Pending";
  return "Unclaimed Business";
};

export const calculateLocalRankScore = (params: {
  distanceKm: number;
  responseMinutes: number;
  rating: number;
  profileCompletion: number;
}) => {
  const distanceScore = (1 - clamp(params.distanceKm, 0, 25) / 25) * 100;
  const responseScore = (1 - clamp(params.responseMinutes, 0, 90) / 90) * 100;
  const ratingScore = (clamp(params.rating, 0, 5) / 5) * 100;
  const profileScore = clamp(params.profileCompletion, 0, 100);

  return Math.round(distanceScore * 0.35 + responseScore * 0.2 + ratingScore * 0.25 + profileScore * 0.2);
};
