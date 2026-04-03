import type { PostMode, PostType, PublishPayloadBase, UploadedMediaPayload } from "@/lib/api/publish";

export type MarketplaceComposerMetadata = {
  source: "serviq_compose";
  postType: PostType;
  publishGroupKey?: string;
  title: string;
  details: string;
  category: string;
  budget: number | null;
  locationLabel: string;
  radiusKm: number;
  mode: PostMode;
  neededWithin: string;
  scheduleDate: string;
  scheduleTime: string;
  flexibleTiming: boolean;
  attachmentCount: number;
  media: UploadedMediaPayload[];
};

type FlexibleRow = Record<string, unknown>;
const COMPOSER_METADATA_SOURCES = new Set(["serviq_compose", "api_needs_publish", "composer_listing_sync"]);

const isFlexibleRow = (value: unknown): value is FlexibleRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toNumberOrNull = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? Number(parsed) : null;
};

const normalizeSignaturePart = (value: unknown) =>
  (typeof value === "number"
    ? Number.isFinite(value)
      ? String(value)
      : ""
    : typeof value === "boolean"
      ? value ? "true" : "false"
      : trim(value))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 96);

export const buildMarketplacePublishGroupKey = (postType: PostType, value: unknown): string => {
  const signature = buildMarketplaceComposerSignature(value);
  if (!signature) return "";

  return `serviq:${normalizeSignaturePart(postType)}:${signature}`;
};

const normalizeMedia = (value: unknown): UploadedMediaPayload[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!isFlexibleRow(entry)) return null;

      const name = trim(entry.name);
      const url = trim(entry.url);
      const type = trim(entry.type);

      if (!url || !type) return null;

      return {
        name: name || "attachment",
        url,
        type,
      } satisfies UploadedMediaPayload;
    })
    .filter((entry): entry is UploadedMediaPayload => !!entry);
};

export const buildMarketplaceComposerMetadata = (
  payload: PublishPayloadBase,
  postType: PostType
): MarketplaceComposerMetadata => {
  const metadata = {
    source: "serviq_compose" as const,
    postType,
    title: payload.title.trim(),
    details: payload.details.trim(),
    category: payload.category.trim() || (postType === "need" ? "Need" : "General"),
    budget: Number.isFinite(Number(payload.budget)) && Number(payload.budget) > 0 ? Number(payload.budget) : null,
    locationLabel: payload.locationLabel.trim() || "Nearby",
    radiusKm: Number.isFinite(payload.radiusKm) ? Math.max(1, Math.round(payload.radiusKm)) : 8,
    mode: payload.mode,
    neededWithin: payload.neededWithin.trim(),
    scheduleDate: payload.scheduleDate.trim(),
    scheduleTime: payload.scheduleTime.trim(),
    flexibleTiming: Boolean(payload.flexibleTiming),
    attachmentCount: Array.isArray(payload.media) ? payload.media.length : 0,
    media: normalizeMedia(payload.media),
  } satisfies Omit<MarketplaceComposerMetadata, "publishGroupKey">;

  return {
    ...metadata,
    publishGroupKey: buildMarketplacePublishGroupKey(postType, metadata),
  };
};

export const readMarketplaceComposerMetadata = (value: unknown): MarketplaceComposerMetadata | null => {
  if (!isFlexibleRow(value)) return null;

  const source = trim(value.source);
  const postType = trim(value.postType);
  const mode = trim(value.mode);
  if (source && !COMPOSER_METADATA_SOURCES.has(source)) return null;
  if (!["need", "service", "product"].includes(postType)) return null;
  if (!["urgent", "schedule"].includes(mode)) return null;

  return {
    source: "serviq_compose",
    postType: postType as PostType,
    publishGroupKey: trim(value.publishGroupKey) || trim(value.publish_group_key) || undefined,
    title: trim(value.title),
    details: trim(value.details),
    category: trim(value.category),
    budget: toNumberOrNull(value.budget),
    locationLabel: trim(value.locationLabel),
    radiusKm: toNumberOrNull(value.radiusKm) ?? 8,
    mode: mode as PostMode,
    neededWithin: trim(value.neededWithin),
    scheduleDate: trim(value.scheduleDate),
    scheduleTime: trim(value.scheduleTime),
    flexibleTiming: Boolean(value.flexibleTiming),
    attachmentCount: Math.max(0, toNumberOrNull(value.attachmentCount) ?? 0),
    media: normalizeMedia(value.media),
  };
};

export const buildMarketplaceComposerSignature = (value: unknown): string => {
  if (!isFlexibleRow(value)) return "";

  const signatureParts = [
    normalizeSignaturePart(value.title),
    normalizeSignaturePart(value.details),
    normalizeSignaturePart(value.category),
    normalizeSignaturePart(value.budget),
    normalizeSignaturePart(value.locationLabel),
    normalizeSignaturePart(value.radiusKm),
    normalizeSignaturePart(value.mode),
    normalizeSignaturePart(value.neededWithin),
    normalizeSignaturePart(value.scheduleDate),
    normalizeSignaturePart(value.scheduleTime),
    normalizeSignaturePart(value.flexibleTiming),
    normalizeSignaturePart(value.attachmentCount),
  ];

  const signature = signatureParts.filter(Boolean).join("|");
  return signature || "";
};
