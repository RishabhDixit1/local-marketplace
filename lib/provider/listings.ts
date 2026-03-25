import type { ProfileAvailability } from "@/lib/profile/types";
import { normalizeAvailability } from "@/lib/profile/utils";

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

  if (trim(draft.imageUrl) && !normalizeHttpUrl(draft.imageUrl)) {
    errors.imageUrl = "Image URL must be a valid public URL.";
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
    imageUrl: row.image_url,
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
  image_url: normalizeHttpUrl(draft.imageUrl) || null,
});

export const calculateProviderListingsStats = (
  services: ProviderServiceListing[],
  products: ProviderProductListing[]
): ProviderListingsStats => ({
  totalServices: services.length,
  activeServices: services.filter((service) => service.availability !== "offline").length,
  totalProducts: products.length,
  activeProducts: products.filter((product) => product.stock > 0).length,
});
