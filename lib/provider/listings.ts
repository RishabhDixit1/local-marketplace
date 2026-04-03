import type { ProfileAvailability } from "@/lib/profile/types";
import { normalizeAvailability } from "@/lib/profile/utils";
import { resolveSupabasePublicUrl } from "@/lib/mediaUrl";

export const PROVIDER_SERVICE_CATEGORIES = [
  "Electrician",
  "Plumber",
  "Cleaning",
  "Delivery",
  "Tutor",
  "Repair",
] as const;

export const SERVICE_PRICING_TYPES = ["fixed", "hourly", "negotiable"] as const;
export const PRODUCT_DELIVERY_METHODS = ["pickup", "delivery", "both"] as const;

export type ServicePricingType = (typeof SERVICE_PRICING_TYPES)[number];
export type ProductDeliveryMethod = (typeof PRODUCT_DELIVERY_METHODS)[number];

export type ProviderServiceDraft = {
  title: string;
  description: string;
  category: string;
  price: number;
  availability: ProfileAvailability;
  pricingType: ServicePricingType;
};

export type ProviderProductDraft = {
  title: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  deliveryMethod: ProductDeliveryMethod;
  imageUrl: string;
};

export type ProviderServiceListing = ProviderServiceDraft & {
  id: string;
  providerId: string;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
};

export type ProviderProductListing = ProviderProductDraft & {
  id: string;
  providerId: string;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
};

export type ProviderListingsStats = {
  totalServices: number;
  activeServices: number;
  totalProducts: number;
  activeProducts: number;
};

export type ServiceDraftValidationErrors = Partial<
  Record<"title" | "description" | "category" | "price" | "availability" | "pricingType", string>
>;

export type ProductDraftValidationErrors = Partial<
  Record<"title" | "description" | "category" | "price" | "stock" | "deliveryMethod" | "imageUrl", string>
>;

type FlexibleRow = Record<string, unknown>;

const TITLE_MAX_LENGTH = 90;
const DESCRIPTION_MAX_LENGTH = 1200;
const CATEGORY_MAX_LENGTH = 48;
const LISTING_IMAGES_PUBLIC_MARKER = "/storage/v1/object/public/listing-images/";
const LISTING_IMAGES_STORAGE_PREFIX = "storage/v1/object/public/listing-images/";
const LISTING_IMAGE_PATH_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.(?:avif|gif|jpe?g|png|webp|svg)$/i;

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toRoundedInt = (value: unknown, fallback = 0) => {
  const parsed = Math.round(toFiniteNumber(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown, max: number) => trim(value).slice(0, max);
const normalizeOptionalText = (value: unknown, max: number) => normalizeText(value, max);
const normalizeCategory = (value: unknown, fallback: string) => normalizeText(value, CATEGORY_MAX_LENGTH) || fallback;

const normalizeHttpUrl = (value: unknown) => {
  const raw = trim(value);
  if (!raw) return "";

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || !parsed.hostname.includes(".")) return "";
    return parsed.toString();
  } catch {
    return "";
  }
};

export const normalizeListingImagePath = (value: unknown) => {
  const raw = trim(value);
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const markerIndex = parsed.pathname.indexOf(LISTING_IMAGES_PUBLIC_MARKER);
      if (markerIndex >= 0) {
        const extracted = parsed.pathname.slice(markerIndex + LISTING_IMAGES_PUBLIC_MARKER.length).replace(/^\/+/, "");
        return LISTING_IMAGE_PATH_PATTERN.test(extracted) ? extracted : "";
      }
    } catch {
      return "";
    }

    return "";
  }

  const cleaned = raw.replace(/^\/+/, "");
  if (cleaned.startsWith(LISTING_IMAGES_STORAGE_PREFIX)) {
    const extracted = cleaned.slice(LISTING_IMAGES_STORAGE_PREFIX.length).replace(/^\/+/, "");
    return LISTING_IMAGE_PATH_PATTERN.test(extracted) ? extracted : "";
  }

  if (cleaned.startsWith("listing-images/")) {
    const extracted = cleaned.slice("listing-images/".length);
    return LISTING_IMAGE_PATH_PATTERN.test(extracted) ? extracted : "";
  }

  return LISTING_IMAGE_PATH_PATTERN.test(cleaned) ? cleaned : "";
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const normalizeServicePricingType = (value: unknown): ServicePricingType => {
  const normalized = trim(value).toLowerCase();
  return (SERVICE_PRICING_TYPES as readonly string[]).includes(normalized)
    ? (normalized as ServicePricingType)
    : "fixed";
};

export const normalizeProductDeliveryMethod = (value: unknown): ProductDeliveryMethod => {
  const normalized = trim(value).toLowerCase();
  return (PRODUCT_DELIVERY_METHODS as readonly string[]).includes(normalized)
    ? (normalized as ProductDeliveryMethod)
    : "pickup";
};

export const normalizeServiceDraft = (value: Partial<ProviderServiceDraft> | null | undefined): ProviderServiceDraft => {
  const source = value || {};

  return {
    title: normalizeText(source.title, TITLE_MAX_LENGTH),
    description: normalizeOptionalText(source.description, DESCRIPTION_MAX_LENGTH),
    category: normalizeCategory(source.category, "Service"),
    price: toFiniteNumber(source.price, 0),
    availability: normalizeAvailability(source.availability),
    pricingType: normalizeServicePricingType(source.pricingType),
  };
};

export const normalizeProductDraft = (value: Partial<ProviderProductDraft> | null | undefined): ProviderProductDraft => {
  const source = value || {};

  return {
    title: normalizeText(source.title, TITLE_MAX_LENGTH),
    description: normalizeOptionalText(source.description, DESCRIPTION_MAX_LENGTH),
    category: normalizeCategory(source.category, "Product"),
    price: toFiniteNumber(source.price, 0),
    stock: toRoundedInt(source.stock, 0),
    deliveryMethod: normalizeProductDeliveryMethod(source.deliveryMethod),
    imageUrl: normalizeOptionalText(source.imageUrl, 500),
  };
};

export const validateServiceDraft = (draft: ProviderServiceDraft): ServiceDraftValidationErrors => {
  const errors: ServiceDraftValidationErrors = {};

  if (!draft.title || draft.title.length < 2) {
    errors.title = "Service title must be at least 2 characters.";
  }

  if (!draft.category) {
    errors.category = "Service category is required.";
  }

  if (!Number.isFinite(draft.price) || draft.price < 0) {
    errors.price = "Price must be a valid non-negative number.";
  }

  if (!(SERVICE_PRICING_TYPES as readonly string[]).includes(draft.pricingType)) {
    errors.pricingType = "Invalid pricing type.";
  }

  return errors;
};

export const validateProductDraft = (draft: ProviderProductDraft): ProductDraftValidationErrors => {
  const errors: ProductDraftValidationErrors = {};

  if (!draft.title || draft.title.length < 2) {
    errors.title = "Product title must be at least 2 characters.";
  }

  if (!draft.category) {
    errors.category = "Product category is required.";
  }

  if (!Number.isFinite(draft.price) || draft.price < 0) {
    errors.price = "Price must be a valid non-negative number.";
  }

  if (!Number.isFinite(draft.stock) || draft.stock < 0) {
    errors.stock = "Stock must be a valid non-negative number.";
  }

  if (!(PRODUCT_DELIVERY_METHODS as readonly string[]).includes(draft.deliveryMethod)) {
    errors.deliveryMethod = "Invalid delivery method.";
  }

  if (trim(draft.imageUrl) && !normalizeListingImagePath(draft.imageUrl)) {
    errors.imageUrl = "Image is invalid. Upload a file or use a valid public listing-images URL/path.";
  }

  return errors;
};

export const normalizeServiceListingRow = (row: FlexibleRow): ProviderServiceListing | null => {
  const id = trim(row.id);
  if (!id) return null;

  const draft = normalizeServiceDraft({
    title: row.title,
    description: row.description,
    category: row.category,
    price: row.price,
    availability: row.availability,
    pricingType: row.pricing_type,
  } as Partial<ProviderServiceDraft>);

  return {
    ...draft,
    id,
    providerId: trim(row.provider_id),
    createdAt: trim(row.created_at) || null,
    updatedAt: trim(row.updated_at) || null,
    metadata: asRecord(row.metadata),
  };
};

export const normalizeProductListingRow = (row: FlexibleRow): ProviderProductListing | null => {
  const id = trim(row.id);
  if (!id) return null;

  const draft = normalizeProductDraft({
    title: row.title,
    description: row.description,
    category: row.category,
    price: row.price,
    stock: row.stock,
    deliveryMethod: row.delivery_method,
    imageUrl: row.image_path || row.image_url,
  } as Partial<ProviderProductDraft>);

  return {
    ...draft,
    id,
    providerId: trim(row.provider_id),
    createdAt: trim(row.created_at) || null,
    updatedAt: trim(row.updated_at) || null,
    metadata: asRecord(row.metadata),
  };
};

export const buildServiceWritePayload = (providerId: string, draft: ProviderServiceDraft) => ({
  provider_id: providerId,
  title: draft.title,
  description: draft.description || null,
  category: draft.category || "Service",
  price: draft.price,
  availability: draft.availability,
  pricing_type: draft.pricingType,
});

export const buildProductWritePayload = (providerId: string, draft: ProviderProductDraft) => ({
  provider_id: providerId,
  title: draft.title,
  description: draft.description || null,
  category: draft.category || "Product",
  price: draft.price,
  stock: draft.stock,
  delivery_method: draft.deliveryMethod,
  image_path: normalizeListingImagePath(draft.imageUrl) || null,
});

export const resolveListingImageUrl = (value: string | null | undefined) =>
  resolveSupabasePublicUrl(value, { bucket: "listing-images" });

export const calculateProviderListingsStats = (
  services: ProviderServiceListing[],
  products: ProviderProductListing[]
): ProviderListingsStats => ({
  totalServices: services.length,
  activeServices: services.filter((service) => service.availability !== "offline").length,
  totalProducts: products.length,
  activeProducts: products.filter((product) => product.stock > 0).length,
});
