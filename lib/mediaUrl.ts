import { PROFILE_AVATAR_BUCKET } from "@/lib/profile/types";

const STORAGE_PUBLIC_PREFIX = "storage/v1/object/public/";
const httpUrlPattern = /^https?:\/\//i;
const protocolRelativePattern = /^\/\//;
const inlineImagePattern = /^data:image\//i;
const blobUrlPattern = /^blob:/i;

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const trimLeadingSlashes = (value: string) => value.replace(/^\/+/, "");

const getSupabaseOrigin = () => {
  const value = trim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!value) return "";

  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
};

export const resolveSupabasePublicUrl = (
  value: string | null | undefined,
  options: { bucket?: string } = {}
): string | null => {
  const candidate = trim(value);
  if (!candidate) return null;

  if (httpUrlPattern.test(candidate) || inlineImagePattern.test(candidate) || blobUrlPattern.test(candidate)) {
    return candidate;
  }

  if (protocolRelativePattern.test(candidate)) {
    return `https:${candidate}`;
  }

  const normalized = trimLeadingSlashes(candidate);
  if (normalized.startsWith(STORAGE_PUBLIC_PREFIX)) {
    const supabaseOrigin = getSupabaseOrigin();
    return supabaseOrigin ? `${supabaseOrigin}/${normalized}` : `/${normalized}`;
  }

  const bucket = trim(options.bucket);
  const supabaseOrigin = getSupabaseOrigin();
  if (bucket && supabaseOrigin) {
    if (normalized.startsWith(`${bucket}/`)) {
      return `${supabaseOrigin}/${STORAGE_PUBLIC_PREFIX}${normalized}`;
    }

    if (bucket === PROFILE_AVATAR_BUCKET && normalized.startsWith("avatars/")) {
      return `${supabaseOrigin}/${STORAGE_PUBLIC_PREFIX}${bucket}/${normalized}`;
    }

    if (!candidate.startsWith("/") && normalized.includes("/")) {
      return `${supabaseOrigin}/${STORAGE_PUBLIC_PREFIX}${bucket}/${normalized}`;
    }
  }

  if (candidate.startsWith("/")) {
    return candidate;
  }

  return null;
};

export const resolveProfileAvatarUrl = (value: string | null | undefined) =>
  resolveSupabasePublicUrl(value, { bucket: PROFILE_AVATAR_BUCKET });

export const resolvePostMediaUrl = (value: string | null | undefined) =>
  resolveSupabasePublicUrl(value, { bucket: "post-media" });
