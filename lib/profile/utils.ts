import type { User } from "@supabase/supabase-js";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import {
  POST_LOGIN_REDIRECT_ROUTE,
  PROFILE_BIO_MIN_LENGTH,
  PROFILE_ROUTE,
  PROFILE_TOPIC_LIMIT,
  type ProfileAvailability,
  type ProfileCompletionItem,
  type ProfileFormValues,
  type ProfileRecord,
  type ProfileRoleFamily,
  type StoredProfileRole,
} from "@/lib/profile/types";

type FlexibleProfileShape = {
  id?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  preferred_name?: string | null;
  user_name?: string | null;
  location?: string | null;
  role?: string | null;
  bio?: string | null;
  interests?: string[] | null;
  services?: string[] | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  avatar_url?: string | null;
  availability?: string | null;
  onboarding_completed?: boolean | null;
  profile_completion_percent?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  metadata?: Record<string, unknown> | null;
};

const providerRoles = new Set(["provider", "service_provider", "seller", "business"]);
const availabilityValues = new Set<ProfileAvailability>(["available", "busy", "offline"]);
const profileIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const trim = (value: string | null | undefined) => value?.trim() ?? "";
const readProfileMetadataName = (profile: FlexibleProfileShape | null | undefined, key: string) => {
  const metadata = profile?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = metadata[key];
  return typeof value === "string" ? trim(value) : "";
};

export const normalizeStoredProfileRole = (value: string | null | undefined): StoredProfileRole => {
  const normalized = trim(value).toLowerCase();
  if (normalized === "business") return "business";
  if (providerRoles.has(normalized)) return "provider";
  return "seeker";
};

export const getProfileRoleFamily = (value: string | null | undefined): ProfileRoleFamily =>
  normalizeStoredProfileRole(value) === "seeker" ? "seeker" : "provider";

export const normalizeAvailability = (value: string | null | undefined): ProfileAvailability => {
  const normalized = trim(value).toLowerCase() as ProfileAvailability;
  return availabilityValues.has(normalized) ? normalized : "available";
};

export const getProfileDisplayName = (profile: FlexibleProfileShape | null | undefined) =>
  trim(profile?.full_name) ||
  trim(profile?.display_name) ||
  trim(profile?.name) ||
  trim(profile?.preferred_name) ||
  trim(profile?.user_name) ||
  readProfileMetadataName(profile, "full_name") ||
  readProfileMetadataName(profile, "display_name") ||
  readProfileMetadataName(profile, "preferred_name") ||
  readProfileMetadataName(profile, "name") ||
  readProfileMetadataName(profile, "user_name") ||
  "";

export const toNullableString = (value: string | null | undefined) => {
  const normalized = trim(value);
  return normalized ? normalized : null;
};

const normalizeTopic = (value: string) => value.replace(/\s+/g, " ").trim();

export const normalizeTopics = (values: string[] | null | undefined) => {
  const deduped = new Set<string>();
  const result: string[] = [];

  for (const value of values || []) {
    const normalized = normalizeTopic(value);
    if (!normalized) continue;
    const dedupeKey = normalized.toLowerCase();
    if (deduped.has(dedupeKey)) continue;
    deduped.add(dedupeKey);
    result.push(normalized);
    if (result.length >= PROFILE_TOPIC_LIMIT) break;
  }

  return result;
};

export const normalizePhone = (value: string | null | undefined) => {
  const raw = trim(value);
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
};

export const normalizeWebsite = (value: string | null | undefined) => {
  const raw = trim(value);
  if (!raw) return "";

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname || !/\./.test(url.hostname)) return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

export const slugifyProfileName = (value: string | null | undefined) => {
  const raw = trim(value).toLowerCase() || "local-member";
  return (
    raw
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "local-member"
  );
};

export const createPublicProfileSlug = (name: string | null | undefined, id: string | null | undefined) => {
  const safeName = slugifyProfileName(name);
  const safeId = trim(id);
  if (!safeId) return safeName;
  return `${safeName}-${safeId}`;
};

export const extractProfileIdFromSlug = (slug: string) => {
  const match = slug.match(profileIdPattern);
  return match ? match[0] : null;
};

export const buildPublicProfilePath = (profile: FlexibleProfileShape | null | undefined) => {
  const id = trim(profile?.id);
  if (!id) return "";
  return `/profile/${createPublicProfileSlug(getProfileDisplayName(profile), id)}`;
};

export const inferProfileNameFromUser = (user: User) => {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const candidateKeys = ["full_name", "name", "display_name", "preferred_name", "user_name"];
  for (const key of candidateKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const emailPrefix = (user.email || "").split("@")[0]?.trim();
  return emailPrefix || "Local Member";
};

export const inferProfileAvatarFromUser = (user: User) => {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const candidateKeys = ["avatar_url", "picture", "photo_url"];
  for (const key of candidateKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
};

export const inferProfileLocationFromUser = (user: User) => {
  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const candidateKeys = ["location", "city"];
  for (const key of candidateKeys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
};

const parseNumber = (value: unknown) => {
  const normalized = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(normalized) ? normalized : null;
};

const parseStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return normalizeTopics(value.filter((item): item is string => typeof item === "string"));
};

export const calculateProfileCompletionPercent = (profile: FlexibleProfileShape | null | undefined) => {
  const fullName = getProfileDisplayName(profile);
  const bio = trim(profile?.bio);
  const location = trim(profile?.location);
  const role = trim(profile?.role);
  const topics = normalizeTopics([...(profile?.interests || []), ...(profile?.services || [])]);
  const email = trim(profile?.email);
  const phone = trim(profile?.phone);
  const website = trim(profile?.website);
  const avatarUrl = trim(profile?.avatar_url);

  const score =
    (fullName ? 18 : 0) +
    (location ? 18 : 0) +
    (role ? 10 : 0) +
    (bio.length >= PROFILE_BIO_MIN_LENGTH ? 20 : 0) +
    (topics.length > 0 ? 12 : 0) +
    (email ? 8 : 0) +
    (phone ? 6 : 0) +
    (website ? 4 : 0) +
    (avatarUrl ? 4 : 0);

  return Math.max(0, Math.min(100, Math.round(score)));
};

export const isProfileOnboardingComplete = (profile: FlexibleProfileShape | null | undefined) => {
  const fullName = getProfileDisplayName(profile);
  const location = trim(profile?.location);
  const phone = normalizePhone(profile?.phone);
  return Boolean(fullName && location && phone);
};

export const createProfileCompletionChecklist = (
  profile: FlexibleProfileShape | null | undefined
): ProfileCompletionItem[] => {
  const fullName = getProfileDisplayName(profile);
  const bio = trim(profile?.bio);
  const topics = normalizeTopics([...(profile?.interests || []), ...(profile?.services || [])]);
  const hasPhone = Boolean(normalizePhone(profile?.phone));

  return [
    {
      id: "fullName",
      label: "Add your full name",
      complete: Boolean(fullName),
      helper: "Use the name you want nearby buyers or providers to see.",
      requiredForOnboarding: true,
    },
    {
      id: "location",
      label: "Set your location",
      complete: Boolean(trim(profile?.location)),
      helper: "This helps local matching and nearby trust signals.",
      requiredForOnboarding: true,
    },
    {
      id: "role",
      label: "Choose a role",
      complete: Boolean(trim(profile?.role)),
      helper: "Switch between provider and seeker experiences anytime.",
    },
    {
      id: "bio",
      label: "Write a strong profile summary",
      complete: bio.length >= PROFILE_BIO_MIN_LENGTH,
      helper: `Aim for at least ${PROFILE_BIO_MIN_LENGTH} characters with specific context.`,
    },
    {
      id: "interests",
      label: "Add discoverability tags",
      complete: topics.length > 0,
      helper: "Services or interests make matching and ranking sharper.",
    },
    {
      id: "contact",
      label: "Add contact details",
      complete: hasPhone,
      helper: "A phone number keeps replies and coordination fast from day one.",
      requiredForOnboarding: true,
    },
    {
      id: "avatar",
      label: "Upload an avatar",
      complete: Boolean(trim(profile?.avatar_url)),
      helper: "Profiles with a face or brand mark feel more trustworthy.",
    },
  ];
};

export const toProfileFormValues = (profile: ProfileRecord | null | undefined): ProfileFormValues => ({
  fullName: getProfileDisplayName(profile),
  location: trim(profile?.location),
  role: getProfileRoleFamily(profile?.role),
  bio: trim(profile?.bio),
  interests: normalizeTopics(profile?.interests?.length ? profile.interests : profile?.services),
  email: trim(profile?.email),
  phone: normalizePhone(profile?.phone),
  website: trim(profile?.website),
  avatarUrl: trim(profile?.avatar_url),
  backgroundImageUrl:
    readProfileMetadataName(profile, "coverImageUrl") ||
    readProfileMetadataName(profile, "cover_image") ||
    readProfileMetadataName(profile, "backgroundImageUrl") ||
    readProfileMetadataName(profile, "background_image"),
  availability: normalizeAvailability(profile?.availability),
});

export const normalizeProfileRecord = (
  row: Record<string, unknown> | null | undefined,
  user?: Pick<User, "id" | "email"> | null
): ProfileRecord | null => {
  if (!row && !user?.id) return null;

  const role = normalizeStoredProfileRole(typeof row?.role === "string" ? row.role : null);
  const interests = parseStringArray(row?.interests);
  const services = parseStringArray(row?.services);
  const mergedTopics = normalizeTopics([...interests, ...services]);
  const rawAvatarUrl =
    typeof row?.avatar_url === "string" ? row.avatar_url : typeof row?.avatar === "string" ? row.avatar : "";
  const resolvedAvatarUrl = resolveProfileAvatarUrl(rawAvatarUrl) || "";

  const profile: ProfileRecord = {
    id: typeof row?.id === "string" ? row.id : user?.id || "",
    full_name: toNullableString(typeof row?.full_name === "string" ? row.full_name : typeof row?.name === "string" ? row.name : ""),
    name: toNullableString(typeof row?.name === "string" ? row.name : typeof row?.full_name === "string" ? row.full_name : ""),
    location: toNullableString(typeof row?.location === "string" ? row.location : ""),
    role,
    bio: toNullableString(typeof row?.bio === "string" ? row.bio : typeof row?.about === "string" ? row.about : ""),
    interests: mergedTopics,
    services: mergedTopics,
    email: toNullableString(typeof row?.email === "string" ? row.email : user?.email || ""),
    phone: toNullableString(typeof row?.phone === "string" ? row.phone : ""),
    website: toNullableString(typeof row?.website === "string" ? row.website : ""),
    avatar_url: toNullableString(resolvedAvatarUrl),
    availability: normalizeAvailability(typeof row?.availability === "string" ? row.availability : ""),
    onboarding_completed:
      typeof row?.onboarding_completed === "boolean"
        ? row.onboarding_completed
        : isProfileOnboardingComplete({
            full_name: typeof row?.full_name === "string" ? row.full_name : typeof row?.name === "string" ? row.name : "",
            location: typeof row?.location === "string" ? row.location : "",
            role,
            bio: typeof row?.bio === "string" ? row.bio : "",
          }),
    profile_completion_percent:
      typeof row?.profile_completion_percent === "number"
        ? row.profile_completion_percent
        : calculateProfileCompletionPercent({
            full_name: typeof row?.full_name === "string" ? row.full_name : typeof row?.name === "string" ? row.name : "",
            location: typeof row?.location === "string" ? row.location : "",
            role,
            bio: typeof row?.bio === "string" ? row.bio : "",
            interests: mergedTopics,
            services: mergedTopics,
            email: typeof row?.email === "string" ? row.email : user?.email || "",
            phone: typeof row?.phone === "string" ? row.phone : "",
            website: typeof row?.website === "string" ? row.website : "",
            avatar_url: resolvedAvatarUrl,
          }),
    latitude: parseNumber(row?.latitude),
    longitude: parseNumber(row?.longitude),
    metadata: row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? (row.metadata as Record<string, unknown>) : {},
    created_at: typeof row?.created_at === "string" ? row.created_at : null,
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : null,
  };

  return profile.id ? profile : null;
};

export const buildBootstrapProfilePatch = (
  user: User,
  existingProfile: ProfileRecord | null | undefined
): Record<string, unknown> => {
  const inferredName = inferProfileNameFromUser(user);
  const inferredAvatar = inferProfileAvatarFromUser(user);
  const inferredLocation = inferProfileLocationFromUser(user);
  const nextRole = normalizeStoredProfileRole(
    typeof user.user_metadata?.role === "string" ? user.user_metadata.role : existingProfile?.role || "seeker"
  );

  const patch: Record<string, unknown> = { id: user.id };

  if (!getProfileDisplayName(existingProfile)) {
    patch.full_name = inferredName;
    patch.name = inferredName;
  }
  if (!trim(existingProfile?.email) && trim(user.email)) patch.email = user.email;
  if (!trim(existingProfile?.avatar_url) && inferredAvatar) patch.avatar_url = inferredAvatar;
  if (!trim(existingProfile?.location) && inferredLocation) patch.location = inferredLocation;
  if (!trim(existingProfile?.role)) patch.role = nextRole;
  if (!trim(existingProfile?.availability)) patch.availability = "available";
  if (!existingProfile?.metadata || Object.keys(existingProfile.metadata).length === 0) patch.metadata = {};

  return patch;
};

export const createProfileSavePayload = (params: {
  user: Pick<User, "id" | "email">;
  values: ProfileFormValues;
  existingProfile: ProfileRecord | null;
}) => {
  const topics = normalizeTopics(params.values.interests);
  const storedRole =
    params.values.role === "provider"
      ? params.existingProfile?.role === "business"
        ? "business"
        : "provider"
      : "seeker";
  const normalizedPhone = normalizePhone(params.values.phone);
  const normalizedWebsite = normalizeWebsite(params.values.website);
  const nextMetadata = {
    ...(params.existingProfile?.metadata || {}),
  };
  const normalizedBackgroundImageUrl = trim(params.values.backgroundImageUrl);

  if (normalizedBackgroundImageUrl) {
    nextMetadata.coverImageUrl = normalizedBackgroundImageUrl;
  } else {
    delete nextMetadata.coverImageUrl;
  }

  const payload: Record<string, unknown> = {
    id: params.user.id,
    full_name: toNullableString(params.values.fullName),
    name: toNullableString(params.values.fullName),
    location: toNullableString(params.values.location),
    role: storedRole,
    bio: toNullableString(params.values.bio),
    interests: topics,
    services: topics,
    email: toNullableString(params.values.email || params.user.email || ""),
    phone: toNullableString(normalizedPhone),
    website: toNullableString(normalizedWebsite),
    avatar_url: toNullableString(params.values.avatarUrl),
    availability: normalizeAvailability(params.values.availability),
    metadata: nextMetadata,
  };

  return {
    ...payload,
    onboarding_completed: isProfileOnboardingComplete(payload as FlexibleProfileShape),
    profile_completion_percent: calculateProfileCompletionPercent(payload as FlexibleProfileShape),
  };
};

export const buildOnboardingProfileHref = () => `${PROFILE_ROUTE}?onboarding=1`;

export const resolveAuthenticatedProfilePath = (_profile: FlexibleProfileShape | null | undefined, nextPath?: string) =>
  nextPath || POST_LOGIN_REDIRECT_ROUTE;
