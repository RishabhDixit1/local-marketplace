import type { ProfileRecord, ProfileRoleFamily } from "@/lib/profile/types";

import type { ServicePricingType } from "@/lib/provider/listings";

export const PROFILE_SECTION_TYPES = [
  "header",
  "trust_stats",
  "services",
  "products",
  "portfolio",
  "reviews",
  "work_history",
  "availability",
  "payment_methods",
  "about",
] as const;

export type ProfileSectionType = (typeof PROFILE_SECTION_TYPES)[number];

export type ProfileSectionRecord = {
  id: string;
  profile_id: string;
  section_type: ProfileSectionType;
  section_order: number;
  is_visible: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketplaceServiceRecord = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  price: number | null;
  pricing_type: ServicePricingType;
  service_type: "onsite" | "remote" | "hybrid";
  area: string | null;
  payment_methods: string[];
  availability: string | null;
  rating: number;
  review_count: number;
  is_featured: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketplaceProductRecord = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  price: number | null;
  stock: number;
  category: string | null;
  delivery_mode: "pickup" | "delivery" | "both";
  area: string | null;
  payment_methods: string[];
  availability: string | null;
  rating: number;
  review_count: number;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketplacePortfolioRecord = {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  media_url: string | null;
  media_type: string | null;
  link_url: string | null;
  category: string | null;
  is_featured: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketplaceWorkHistoryRecord = {
  id: string;
  profile_id: string;
  role_title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  verification_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketplaceAvailabilityRecord = {
  id: string;
  profile_id: string;
  label: string;
  availability: string;
  days_of_week: string[];
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  notes: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketplacePaymentMethodRecord = {
  id: string;
  profile_id: string;
  method_type: string;
  provider_name: string | null;
  account_label: string | null;
  account_last4: string | null;
  account_handle: string | null;
  is_default: boolean;
  is_verified: boolean;
  metadata: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type MarketplaceTrustScoreRecord = {
  id: string;
  profile_id: string;
  rating_score: number;
  completion_rate: number;
  on_time_rate: number;
  repeat_clients_score: number;
  verification_score: number;
  response_time_score: number;
  trust_score: number;
  updated_at: string | null;
};

export type MarketplaceReviewRecord = {
  id: string;
  provider_id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string | null;
};

export type MarketplaceProfileBundle = {
  profile: ProfileRecord;
  roleFamily: ProfileRoleFamily;
  sections: ProfileSectionRecord[];
  services: MarketplaceServiceRecord[];
  products: MarketplaceProductRecord[];
  portfolio: MarketplacePortfolioRecord[];
  workHistory: MarketplaceWorkHistoryRecord[];
  availability: MarketplaceAvailabilityRecord[];
  paymentMethods: MarketplacePaymentMethodRecord[];
  trustScore: MarketplaceTrustScoreRecord | null;
  reviews: MarketplaceReviewRecord[];
  averageRating: number;
  reviewCount: number;
  serviceCount: number;
  productCount: number;
  portfolioCount: number;
  workHistoryCount: number;
  availabilityCount: number;
  paymentMethodCount: number;
  completion: ProfileCompletionBreakdown;
  completionPercent: number;
};

export type ProfileCompletionBreakdown = {
  basicInfo: number;
  avatar: number;
  serviceAdded: number;
  productAdded: number;
  portfolioAdded: number;
  availability: number;
  paymentMethod: number;
  verification: number;
  total: number;
};

export const PROFILE_SECTION_LABELS: Record<ProfileSectionType, string> = {
  header: "Header",
  trust_stats: "Trust Stats",
  services: "Services",
  products: "Products",
  portfolio: "Portfolio",
  reviews: "Reviews",
  work_history: "Work History",
  availability: "Availability",
  payment_methods: "Payment Methods",
  about: "About",
};

export const DEFAULT_PROFILE_SECTION_ORDER: ProfileSectionType[] = [...PROFILE_SECTION_TYPES];

export const createDefaultProfileSections = (profileId: string): ProfileSectionRecord[] =>
  DEFAULT_PROFILE_SECTION_ORDER.map((sectionType, index) => ({
    id: `${profileId}-${sectionType}`,
    profile_id: profileId,
    section_type: sectionType,
    section_order: index,
    is_visible: true,
    created_at: null,
    updated_at: null,
  }));

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalizeText = (value: string | null | undefined) => (typeof value === "string" ? value.trim() : "");

const countTruthy = (...values: Array<string | null | undefined>) =>
  values.reduce((count, value) => count + (normalizeText(value) ? 1 : 0), 0);

const verificationLevelScore = (level: string | null | undefined) => {
  const normalized = normalizeText(level).toLowerCase();
  if (!normalized) return 0;
  if (["business", "kyc", "verified_business"].includes(normalized)) return 100;
  if (["identity", "id_verified", "verified"].includes(normalized)) return 85;
  if (["phone", "phone_verified"].includes(normalized)) return 65;
  if (["email", "email_verified"].includes(normalized)) return 35;
  return 20;
};

const responseTimeScore = (responseTimeMinutes: number | null | undefined) => {
  const minutes = Number.isFinite(Number(responseTimeMinutes)) ? Number(responseTimeMinutes) : 0;
  if (minutes <= 0) return 0;
  return clamp(100 - Math.min(100, minutes * 2));
};

const repeatClientsScore = (repeatClients: number | null | undefined) => {
  const count = Number.isFinite(Number(repeatClients)) ? Number(repeatClients) : 0;
  return clamp(count * 12);
};

const averageRatingScore = (averageRating: number) => clamp((averageRating / 5) * 100);

export const sortProfileSections = (sections: ProfileSectionRecord[]) =>
  [...sections].sort((left, right) => left.section_order - right.section_order || left.section_type.localeCompare(right.section_type));

export const mergeProfileSections = (sections: ProfileSectionRecord[], profileId: string) => {
  const byType = new Map<ProfileSectionType, ProfileSectionRecord>();
  sections.forEach((section) => {
    byType.set(section.section_type, section);
  });

  return DEFAULT_PROFILE_SECTION_ORDER.map((sectionType, index) => {
    const existing = byType.get(sectionType);
    if (existing) {
      return {
        ...existing,
        section_order: Number.isFinite(existing.section_order) ? existing.section_order : index,
        is_visible: typeof existing.is_visible === "boolean" ? existing.is_visible : true,
      };
    }

    return {
      id: `${profileId}-${sectionType}`,
      profile_id: profileId,
      section_type: sectionType,
      section_order: index,
      is_visible: true,
      created_at: null,
      updated_at: null,
    } satisfies ProfileSectionRecord;
  });
};

export const calculateMarketplaceProfileCompletion = (params: {
  profile: ProfileRecord;
  services: Array<unknown>;
  products: Array<unknown>;
  portfolio: Array<unknown>;
  availability: Array<unknown>;
  paymentMethods: Array<unknown>;
}) => {
  const fullName = normalizeText(params.profile.full_name || params.profile.name);
  const username = normalizeText(params.profile.username);
  const headline = normalizeText(params.profile.headline);
  const location = normalizeText(params.profile.location);
  const bio = normalizeText(params.profile.bio);
  const avatarUrl = normalizeText(params.profile.avatar_url);
  const serviceAdded = params.services.length > 0 ? 20 : 0;
  const productAdded = params.products.length > 0 ? 10 : 0;
  const portfolioAdded = params.portfolio.length > 0 ? 10 : 0;
  const availabilityScore = params.availability.length > 0 || normalizeText(params.profile.availability) ? 10 : 0;
  const paymentMethodScore = params.paymentMethods.length > 0 ? 10 : 0;
  const verificationScore = params.profile.onboarding_completed ? 10 : countTruthy(params.profile.verification_level, avatarUrl) > 0 ? 8 : 0;

  const basicInfo =
    (fullName ? 5 : 0) +
    (username ? 5 : 0) +
    (headline ? 4 : 0) +
    (location ? 3 : 0) +
    (bio.length >= 40 ? 3 : 0);

  const avatar = avatarUrl ? 10 : 0;

  const total = clamp(
    basicInfo +
      avatar +
      serviceAdded +
      productAdded +
      portfolioAdded +
      availabilityScore +
      paymentMethodScore +
      verificationScore
  );

  return {
    basicInfo,
    avatar,
    serviceAdded,
    productAdded,
    portfolioAdded,
    availability: availabilityScore,
    paymentMethod: paymentMethodScore,
    verification: verificationScore,
    total,
  } satisfies ProfileCompletionBreakdown;
};

export const calculateProfileCompletion = calculateMarketplaceProfileCompletion;

export const calculateMarketplaceTrustScore = (params: {
  averageRating: number;
  completionRate: number;
  onTimeRate: number;
  repeatClients: number;
  verificationLevel: string | null | undefined;
  responseTimeMinutes: number | null | undefined;
}) => {
  const ratingScore = averageRatingScore(params.averageRating);
  const completionRate = clamp(params.completionRate);
  const onTimeRate = clamp(params.onTimeRate);
  const repeatClients = repeatClientsScore(params.repeatClients);
  const verification = verificationLevelScore(params.verificationLevel);
  const responseTime = responseTimeScore(params.responseTimeMinutes);

  return {
    ratingScore,
    completionRate,
    onTimeRate,
    repeatClientsScore: repeatClients,
    verificationScore: verification,
    responseTimeScore: responseTime,
    trustScore: Math.round(
      ratingScore * 0.35 +
        completionRate * 0.2 +
        onTimeRate * 0.15 +
        repeatClients * 0.15 +
        verification * 0.1 +
        responseTime * 0.05
    ),
  };
};

export const calculateTrustScore = calculateMarketplaceTrustScore;
