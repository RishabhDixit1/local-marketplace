import type {
  LaunchpadAnswers,
  LaunchpadBrandTone,
  LaunchpadDraftStatus,
  LaunchpadFaqItem,
  LaunchpadGeneratedProfile,
  LaunchpadInputSource,
  LaunchpadOfferingType,
  LaunchpadProductDraft,
  LaunchpadServiceDraft,
} from "@/lib/api/launchpad";
import { isUsableLocationLabel } from "@/lib/geo";
import { normalizeAvailability, normalizePhone, normalizeTopics, normalizeWebsite } from "@/lib/profile/utils";

const INPUT_SOURCES = new Set<LaunchpadInputSource>(["manual", "catalog", "whatsapp", "website"]);
const DRAFT_STATUSES = new Set<LaunchpadDraftStatus>(["draft", "generated", "published"]);
const OFFERING_TYPES = new Set<LaunchpadOfferingType>(["services", "products", "hybrid"]);
const BRAND_TONES = new Set<LaunchpadBrandTone>(["professional", "friendly", "premium", "fast", "community"]);

const trim = (value: string | null | undefined) => value?.trim() ?? "";

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const toStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const DEFAULT_LAUNCHPAD_ANSWERS: LaunchpadAnswers = {
  businessName: "",
  businessType: "",
  offeringType: "services",
  primaryCategory: "",
  location: "",
  latitude: null,
  longitude: null,
  serviceArea: "",
  serviceRadiusKm: 12,
  shortDescription: "",
  coreOfferings: "",
  catalogText: "",
  pricingNotes: "",
  hours: "",
  phone: "",
  website: "",
  brandTone: "professional",
};

export const normalizeLaunchpadInputSource = (value: string | null | undefined): LaunchpadInputSource => {
  const normalized = trim(value).toLowerCase();
  return INPUT_SOURCES.has(normalized as LaunchpadInputSource) ? (normalized as LaunchpadInputSource) : "manual";
};

export const normalizeLaunchpadDraftStatus = (value: string | null | undefined): LaunchpadDraftStatus => {
  const normalized = trim(value).toLowerCase();
  return DRAFT_STATUSES.has(normalized as LaunchpadDraftStatus) ? (normalized as LaunchpadDraftStatus) : "draft";
};

export const normalizeLaunchpadAnswers = (value: Partial<LaunchpadAnswers> | null | undefined): LaunchpadAnswers => {
  const source = value || {};
  const rawRadius = toFiniteNumber(source.serviceRadiusKm);
  const serviceRadiusKm = rawRadius ? Math.max(1, Math.min(100, Math.round(rawRadius))) : DEFAULT_LAUNCHPAD_ANSWERS.serviceRadiusKm;
  const offeringType = OFFERING_TYPES.has(source.offeringType as LaunchpadOfferingType)
    ? (source.offeringType as LaunchpadOfferingType)
    : DEFAULT_LAUNCHPAD_ANSWERS.offeringType;
  const brandTone = BRAND_TONES.has(source.brandTone as LaunchpadBrandTone)
    ? (source.brandTone as LaunchpadBrandTone)
    : DEFAULT_LAUNCHPAD_ANSWERS.brandTone;
  const latitude = toFiniteNumber(source.latitude);
  const longitude = toFiniteNumber(source.longitude);

  return {
    businessName: trim(source.businessName),
    businessType: trim(source.businessType),
    offeringType,
    primaryCategory: trim(source.primaryCategory),
    location: trim(source.location),
    latitude,
    longitude,
    serviceArea: trim(source.serviceArea),
    serviceRadiusKm,
    shortDescription: trim(source.shortDescription),
    coreOfferings: trim(source.coreOfferings),
    catalogText: trim(source.catalogText),
    pricingNotes: trim(source.pricingNotes),
    hours: trim(source.hours),
    phone: normalizePhone(source.phone),
    website: normalizeWebsite(source.website),
    brandTone,
  };
};

export const validateLaunchpadAnswers = (answers: LaunchpadAnswers) => {
  const errors: Partial<Record<keyof LaunchpadAnswers, string>> = {};

  if (!answers.businessName) errors.businessName = "Business name is required.";
  if (!answers.businessType) errors.businessType = "Business type is required.";
  if (!answers.primaryCategory) errors.primaryCategory = "Primary category is required.";
  if (!answers.location) {
    errors.location = "Location is required.";
  } else if (!isUsableLocationLabel(answers.location)) {
    errors.location = "Enter a readable area or city name, not raw GPS coordinates.";
  }
  if (!answers.serviceArea) errors.serviceArea = "Service area is required.";
  if (!answers.shortDescription || answers.shortDescription.length < 24) {
    errors.shortDescription = "Write a short description with at least 24 characters.";
  }
  if (!answers.coreOfferings) errors.coreOfferings = "Add at least one core offering.";
  if (answers.serviceRadiusKm < 1 || answers.serviceRadiusKm > 100) {
    errors.serviceRadiusKm = "Service radius should be between 1 and 100 km.";
  }

  return errors;
};

export const inferLaunchpadInputSource = (answers: LaunchpadAnswers, preferred?: LaunchpadInputSource): LaunchpadInputSource => {
  if (preferred && INPUT_SOURCES.has(preferred)) return preferred;
  if (answers.catalogText) return "catalog";
  if (/whatsapp/i.test(answers.shortDescription) || /whatsapp/i.test(answers.coreOfferings)) return "whatsapp";
  if (answers.website) return "website";
  return "manual";
};

export const normalizeLaunchpadGeneratedProfile = (value: unknown): LaunchpadGeneratedProfile | null => {
  const record = toRecord(value);
  const fullName = trim(typeof record.fullName === "string" ? record.fullName : "");
  const location = trim(typeof record.location === "string" ? record.location : "");
  const bio = trim(typeof record.bio === "string" ? record.bio : "");

  if (!fullName && !bio && !location) return null;

  return {
    fullName,
    location,
    latitude: toFiniteNumber(record.latitude),
    longitude: toFiniteNumber(record.longitude),
    bio,
    interests: normalizeTopics(toStringArray(record.interests)),
    phone: normalizePhone(typeof record.phone === "string" ? record.phone : ""),
    website: normalizeWebsite(typeof record.website === "string" ? record.website : ""),
    availability: normalizeAvailability(typeof record.availability === "string" ? record.availability : "available"),
    metadata: toRecord(record.metadata),
  };
};

export const normalizeLaunchpadServiceDraft = (value: unknown): LaunchpadServiceDraft | null => {
  const record = toRecord(value);
  const title = trim(typeof record.title === "string" ? record.title : "");
  if (!title) return null;

  const price = toFiniteNumber(record.price);
  return {
    title,
    description: trim(typeof record.description === "string" ? record.description : ""),
    category: trim(typeof record.category === "string" ? record.category : "") || "Service",
    price: price && price > 0 ? Math.round(price) : null,
    availability: normalizeAvailability(typeof record.availability === "string" ? record.availability : "available"),
    metadata: toRecord(record.metadata),
  };
};

export const normalizeLaunchpadProductDraft = (value: unknown): LaunchpadProductDraft | null => {
  const record = toRecord(value);
  const title = trim(typeof record.title === "string" ? record.title : "");
  if (!title) return null;

  const price = toFiniteNumber(record.price);
  const stock = toFiniteNumber(record.stock);
  return {
    title,
    description: trim(typeof record.description === "string" ? record.description : ""),
    category: trim(typeof record.category === "string" ? record.category : "") || "Product",
    price: price && price > 0 ? Math.round(price) : null,
    stock: stock && stock > 0 ? Math.round(stock) : 1,
    metadata: toRecord(record.metadata),
  };
};

export const normalizeLaunchpadFaq = (value: unknown): LaunchpadFaqItem | null => {
  const record = toRecord(value);
  const question = trim(typeof record.question === "string" ? record.question : "");
  const answer = trim(typeof record.answer === "string" ? record.answer : "");

  if (!question || !answer) return null;
  return { question, answer };
};

export const normalizeLaunchpadFaqList = (value: unknown) =>
  (Array.isArray(value) ? value : [])
    .map((item) => normalizeLaunchpadFaq(item))
    .filter((item): item is LaunchpadFaqItem => !!item)
    .slice(0, 6);

export const normalizeLaunchpadServiceAreas = (value: unknown) => normalizeTopics(toStringArray(value)).slice(0, 8);
