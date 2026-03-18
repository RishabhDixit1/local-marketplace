import type { PostMode, PostType, PublishPayloadBase, UploadedMediaPayload } from "@/lib/api/publish";

export type MarketplaceComposerMetadata = {
  source: "serviq_compose";
  postType: PostType;
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

const isFlexibleRow = (value: unknown): value is FlexibleRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const toNumberOrNull = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? Number(parsed) : null;
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
): MarketplaceComposerMetadata => ({
  source: "serviq_compose",
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
});

export const readMarketplaceComposerMetadata = (value: unknown): MarketplaceComposerMetadata | null => {
  if (!isFlexibleRow(value)) return null;

  const source = trim(value.source);
  const postType = trim(value.postType);
  const mode = trim(value.mode);
  if (source !== "serviq_compose") return null;
  if (!["need", "service", "product"].includes(postType)) return null;
  if (!["urgent", "schedule"].includes(mode)) return null;

  return {
    source: "serviq_compose",
    postType: postType as PostType,
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
