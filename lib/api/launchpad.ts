import type { ProfileAvailability } from "@/lib/profile/types";

export type LaunchpadApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_PAYLOAD"
  | "CONFIG"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "DB"
  | "UNKNOWN";

export type LaunchpadApiError = {
  ok: false;
  code: LaunchpadApiErrorCode;
  message: string;
  details?: string;
};

export type LaunchpadInputSource = "manual" | "catalog" | "whatsapp" | "website";
export type LaunchpadDraftStatus = "draft" | "generated" | "published";
export type LaunchpadOfferingType = "services" | "products" | "hybrid";
export type LaunchpadBrandTone = "professional" | "friendly" | "premium" | "fast" | "community";

export type LaunchpadAnswers = {
  businessName: string;
  businessType: string;
  offeringType: LaunchpadOfferingType;
  primaryCategory: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  serviceArea: string;
  serviceRadiusKm: number;
  shortDescription: string;
  coreOfferings: string;
  catalogText: string;
  pricingNotes: string;
  hours: string;
  phone: string;
  website: string;
  brandTone: LaunchpadBrandTone;
};

export type LaunchpadGeneratedProfile = {
  fullName: string;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  bio: string;
  interests: string[];
  phone: string;
  website: string;
  availability: ProfileAvailability;
  metadata: Record<string, unknown>;
};

export type LaunchpadServiceDraft = {
  title: string;
  description: string;
  category: string;
  price: number | null;
  availability: ProfileAvailability;
  metadata: Record<string, unknown>;
};

export type LaunchpadProductDraft = {
  title: string;
  description: string;
  category: string;
  price: number | null;
  stock: number;
  metadata: Record<string, unknown>;
};

export type LaunchpadFaqItem = {
  question: string;
  answer: string;
};

export type LaunchpadWorkspaceSummary = {
  profileExists: boolean;
  profilePath: string | null;
  businessPath: string | null;
  totalServices: number;
  totalProducts: number;
  launchpadServices: number;
  launchpadProducts: number;
  faqCount: number;
  serviceAreaCount: number;
  lastPublishedAt: string | null;
  liveCategories: string[];
  liveOfferings: string[];
  liveCatalogLines: string[];
  liveServiceAreas: string[];
};

export type LaunchpadDraftRecord = {
  id: string;
  ownerId: string;
  status: LaunchpadDraftStatus;
  inputSource: LaunchpadInputSource;
  answers: LaunchpadAnswers;
  importPayload: Record<string, unknown>;
  generatedProfile: LaunchpadGeneratedProfile | null;
  generatedServices: LaunchpadServiceDraft[];
  generatedProducts: LaunchpadProductDraft[];
  generatedFaq: LaunchpadFaqItem[];
  generatedServiceAreas: string[];
  approvedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type GetLaunchpadDraftResponse =
  | {
      ok: true;
      draft: LaunchpadDraftRecord | null;
      summary: LaunchpadWorkspaceSummary;
    }
  | LaunchpadApiError;

export type SaveLaunchpadDraftRequest = {
  answers: LaunchpadAnswers;
  inputSource?: LaunchpadInputSource;
};

export type SaveLaunchpadDraftResponse =
  | {
      ok: true;
      draft: LaunchpadDraftRecord;
    }
  | LaunchpadApiError;

export type PublishLaunchpadDraftRequest = {
  draftId?: string;
};

export type PublishLaunchpadDraftResponse =
  | {
      ok: true;
      draft: LaunchpadDraftRecord;
      publishedServices: number;
      publishedProducts: number;
      profilePath: string;
      businessPath: string;
    }
  | LaunchpadApiError;
