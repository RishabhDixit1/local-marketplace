import "server-only";

import type {
  CommunityFeedResponse,
  CommunityPeopleResponse,
  CommunityProfilePreview,
  CommunityProfileRecord,
} from "@/lib/api/community";
import type { MarketplaceFeedItem } from "@/lib/marketplaceFeed";
import { cleanSiteUrl } from "@/lib/siteUrl";

type ImageProxyOptions = {
  origin: string;
  width: number;
  quality: number;
};

const remoteImageUrlPattern = /^https?:\/\//i;
const supabaseStorageImagePathPattern = /^\/storage\/v1\/(?:object\/public|render\/image\/public)\//;
const proxyableImageExtensionPattern = /\.(?:avif|jpe?g|png|webp)$/i;

const isProxyableImageUrl = (value: string | null | undefined) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!remoteImageUrlPattern.test(candidate)) return false;

  try {
    const parsed = new URL(candidate);
    return (
      parsed.pathname !== "/_next/image" &&
      supabaseStorageImagePathPattern.test(parsed.pathname) &&
      proxyableImageExtensionPattern.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

export const buildNextImageProxyUrl = (
  value: string | null | undefined,
  options: ImageProxyOptions,
) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!isProxyableImageUrl(candidate)) return candidate;

  const origin = cleanSiteUrl(options.origin);
  if (!origin) return candidate;

  const params = new URLSearchParams({
    url: candidate,
    w: String(options.width),
    q: String(options.quality),
  });

  return `${origin}/_next/image?${params.toString()}`;
};

const proxyAvatarUrl = (value: string | null | undefined, origin: string) =>
  buildNextImageProxyUrl(value, { origin, width: 96, quality: 70 });

const proxyPreviewUrl = (value: string | null | undefined, origin: string) =>
  buildNextImageProxyUrl(value, { origin, width: 640, quality: 70 });

const proxyProfile = (
  profile: CommunityProfileRecord,
  origin: string,
): CommunityProfileRecord => ({
  ...profile,
  avatar_url: profile.avatar_url ? proxyAvatarUrl(profile.avatar_url, origin) : profile.avatar_url,
});

const proxyFeedItem = (
  item: MarketplaceFeedItem,
  origin: string,
): MarketplaceFeedItem => ({
  ...item,
  avatarUrl: item.avatarUrl ? proxyAvatarUrl(item.avatarUrl, origin) : item.avatarUrl,
  thumbnailUrl: item.thumbnailUrl ? proxyPreviewUrl(item.thumbnailUrl, origin) : item.thumbnailUrl,
});

const proxyProfilePreview = (
  preview: CommunityProfilePreview,
  origin: string,
): CommunityProfilePreview => ({
  ...preview,
  imageUrl: proxyPreviewUrl(preview.imageUrl, origin),
});

export const proxyCommunityFeedImages = (
  snapshot: CommunityFeedResponse,
  origin: string,
): CommunityFeedResponse => {
  if (snapshot.ok !== true) return snapshot;

  return {
    ...snapshot,
    currentUserProfile: snapshot.currentUserProfile
      ? proxyProfile(snapshot.currentUserProfile, origin)
      : snapshot.currentUserProfile,
    profiles: snapshot.profiles.map((profile) => proxyProfile(profile, origin)),
    feedItems: snapshot.feedItems.map((item) => proxyFeedItem(item, origin)),
  };
};

export const proxyCommunityPeopleImages = (
  snapshot: CommunityPeopleResponse,
  origin: string,
): CommunityPeopleResponse => {
  if (snapshot.ok !== true) return snapshot;

  const profilePreviewById = snapshot.profilePreviewById
    ? Object.fromEntries(
        Object.entries(snapshot.profilePreviewById).map(([profileId, preview]) => [
          profileId,
          proxyProfilePreview(preview, origin),
        ]),
      )
    : snapshot.profilePreviewById;

  return {
    ...snapshot,
    profiles: snapshot.profiles.map((profile) => proxyProfile(profile, origin)),
    profilePreviewById,
  };
};
