import type {
  CommunityFeedResponse,
  CommunityHelpRequestRecord,
  CommunityPostRecord,
  CommunityPresenceRecord,
  CommunityProductRecord,
  CommunityProfileRecord,
  CommunityReviewRecord,
  CommunityServiceRecord,
} from "@/lib/api/community";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  estimateResponseMinutes,
} from "@/lib/business";
import {
  buildMarketplaceFeedStats,
  dedupeMarketplaceFeedItems,
  isClosedMarketplaceStatus,
  isWeakMarketplaceContent,
  mediaFromMarketplaceComposerMetadata,
  normalizeMarketplacePersonLabel,
  normalizeMarketplacePostKind,
  parseMarketplaceDateMs,
  parseMarketplacePostText,
  toMarketplaceCreatorUsername,
  type MarketplaceFeedItem,
  type MarketplaceMapCenter,
} from "@/lib/marketplaceFeed";
import { readMarketplaceComposerMetadata } from "@/lib/marketplaceMetadata";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { buildPublicProfilePath } from "@/lib/profile/utils";
import {
  defaultMarketCoordinates,
  distanceBetweenCoordinatesKm,
  getCoordinates,
  resolveCoordinates,
} from "@/lib/geo";

type CommunityFeedSnapshotInput = {
  currentUserId: string;
  acceptedConnectionIds: string[];
  currentUserProfile: CommunityProfileRecord | null;
  services: CommunityServiceRecord[];
  products: CommunityProductRecord[];
  posts: CommunityPostRecord[];
  helpRequests: CommunityHelpRequestRecord[];
  profiles: CommunityProfileRecord[];
  reviews: CommunityReviewRecord[];
  presence: CommunityPresenceRecord[];
};

type FlexibleRow = Record<string, unknown>;

const stringFromRow = (row: FlexibleRow, keys: string[], fallback = "") => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return fallback;
};

const numberFromRow = (row: FlexibleRow, keys: string[], fallback = 0) => {
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const getListingOwnerIdFromPost = (row: FlexibleRow) =>
  stringFromRow(row, ["user_id", "provider_id", "created_by", "author_id", "requester_id", "owner_id"], "");

const isUrgentDemand = (value: string) => /urgent|asap|immediate|today|quick|critical|emergency|high/i.test(value);
const readMetadataSource = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? stringFromRow(value as FlexibleRow, ["source"], "").toLowerCase()
    : "";

const resolveViewerPoint = (profile: CommunityProfileRecord | null): MarketplaceMapCenter => {
  const explicit = getCoordinates(profile?.latitude, profile?.longitude);
  if (explicit) {
    return { lat: explicit.latitude, lng: explicit.longitude };
  }

  const fallback = defaultMarketCoordinates();
  return { lat: fallback.latitude, lng: fallback.longitude };
};

export const buildCommunityFeedView = (
  snapshot: CommunityFeedSnapshotInput,
  viewerOverride?: MarketplaceMapCenter | null
): Pick<Extract<CommunityFeedResponse, { ok: true }>, "feedItems" | "feedStats" | "mapCenter"> => {
  const profileMap = new Map<string, CommunityProfileRecord>();
  snapshot.profiles.forEach((profile) => {
    if (profile.id) {
      profileMap.set(profile.id, profile);
    }
  });
  if (snapshot.currentUserProfile?.id) {
    profileMap.set(snapshot.currentUserProfile.id, snapshot.currentUserProfile);
  }

  const reviewStats = new Map<string, { total: number; count: number }>();
  snapshot.reviews.forEach((row) => {
    if (!row.provider_id || typeof row.rating !== "number" || !Number.isFinite(row.rating)) return;
    const current = reviewStats.get(row.provider_id) || { total: 0, count: 0 };
    reviewStats.set(row.provider_id, {
      total: current.total + row.rating,
      count: current.count + 1,
    });
  });

  const presenceMap = new Map<string, CommunityPresenceRecord>();
  snapshot.presence.forEach((row) => {
    if (row.provider_id) {
      presenceMap.set(row.provider_id, row);
    }
  });

  const listingVolumeByProvider = new Map<string, number>();
  const bumpVolume = (providerId: string) => {
    if (!providerId) return;
    listingVolumeByProvider.set(providerId, (listingVolumeByProvider.get(providerId) || 0) + 1);
  };

  snapshot.services.forEach((row) => bumpVolume(row.provider_id));
  snapshot.products.forEach((row) => bumpVolume(row.provider_id));
  snapshot.posts.forEach((row) => bumpVolume(getListingOwnerIdFromPost(row as unknown as FlexibleRow)));
  snapshot.helpRequests.forEach((row) => bumpVolume(row.requester_id || ""));

  const mapCenter = viewerOverride || resolveViewerPoint(snapshot.currentUserProfile);

  const resolveProfileMeta = (providerId: string) => {
    const profile = profileMap.get(providerId);
    const profileRow = (profile || {}) as FlexibleRow;
    const presence = presenceMap.get(providerId);
    const review = reviewStats.get(providerId);

    const profileCompletion = calculateProfileCompletion(profile || {});
    const averageRating = review?.count ? review.total / review.count : 4.2;
    const reviewCount = review?.count || 0;
    const listingsCount = listingVolumeByProvider.get(providerId) || 0;
    const responseMinutes = estimateResponseMinutes({
      availability: presence?.availability || profile?.availability,
      providerId,
      baseResponseMinutes: presence?.rolling_response_minutes || null,
    });

    const verificationStatus = calculateVerificationStatus({
      role: profile?.role,
      profileCompletion,
      listingsCount,
      averageRating,
      reviewCount,
    });

    const explicitProfileName = normalizeMarketplacePersonLabel(
      stringFromRow(profileRow, ["name", "full_name", "display_name", "business_name"], "")
    );
    const explicitHandle = normalizeMarketplacePersonLabel(stringFromRow(profileRow, ["username", "handle"], ""));
    const emailPrefix = normalizeMarketplacePersonLabel(
      ((typeof profile?.email === "string" ? profile.email : "").split("@")[0] || "").trim()
    );
    const resolvedProfileName = explicitProfileName || explicitHandle || emailPrefix;
    const usernameSeed = explicitHandle || resolvedProfileName || "local-member";

    return {
      profileCompletion,
      averageRating,
      responseMinutes,
      verificationStatus,
      name: resolvedProfileName,
      username: toMarketplaceCreatorUsername(usernameSeed),
      avatarUrl: resolveProfileAvatarUrl(profile?.avatar_url || null) || "",
      locationLabel: (typeof profile?.location === "string" && profile.location.trim()) || "Nearby",
      publicProfilePath:
        buildPublicProfilePath({
          id: providerId,
          full_name: resolvedProfileName,
          name: resolvedProfileName,
        }) || `/profile/${toMarketplaceCreatorUsername(usernameSeed) || "local-member"}-${providerId}`,
    };
  };

  const viewerPoint = { latitude: mapCenter.lat, longitude: mapCenter.lng };
  const nextItems: MarketplaceFeedItem[] = [];

  snapshot.services.forEach((serviceRow) => {
    const row = serviceRow as unknown as FlexibleRow;
    const providerId = stringFromRow(row, ["provider_id", "user_id", "created_by"], "");
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const locationLabel = stringFromRow(row, ["location_label", "location"], profileMeta.locationLabel);
    const coordinates = resolveCoordinates({
      row,
      location: locationLabel,
      seed: `${providerId}:service:${serviceRow.id}`,
    });
    const title = stringFromRow(row, ["title", "name"], "Local service");
    const description = stringFromRow(row, ["description", "details", "text"], "Service listing");
    const metadataSource = readMetadataSource(row.metadata);
    const isComposerSyncedListing = metadataSource === "composer_listing_sync";

    if (!isComposerSyncedListing && isWeakMarketplaceContent(title, description)) return;

    nextItems.push({
      id: serviceRow.id,
      source: "service_listing",
      helpRequestId: null,
      providerId,
      type: "service",
      title,
      description,
      category: stringFromRow(row, ["category", "service_category", "type"], "Service"),
      price: numberFromRow(row, ["price", "amount", "rate"], 0),
      avatarUrl: profileMeta.avatarUrl,
      creatorName: profileMeta.name,
      creatorUsername: profileMeta.username,
      locationLabel,
      distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      media: [],
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: false,
      rankScore: calculateLocalRankScore({
        distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.averageRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      publicProfilePath: profileMeta.publicProfilePath,
      status: stringFromRow(row, ["status", "state"], "open"),
      acceptedProviderId: null,
    });
  });

  snapshot.products.forEach((productRow) => {
    const row = productRow as unknown as FlexibleRow;
    const providerId = stringFromRow(row, ["provider_id", "user_id", "created_by"], "");
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const locationLabel = stringFromRow(row, ["location_label", "location"], profileMeta.locationLabel);
    const coordinates = resolveCoordinates({
      row,
      location: locationLabel,
      seed: `${providerId}:product:${productRow.id}`,
    });
    const title = stringFromRow(row, ["title", "name"], "Local product");
    const description = stringFromRow(row, ["description", "details", "text"], "Product listing");
    const metadataSource = readMetadataSource(row.metadata);
    const isComposerSyncedListing = metadataSource === "composer_listing_sync";

    if (!isComposerSyncedListing && isWeakMarketplaceContent(title, description)) return;

    nextItems.push({
      id: productRow.id,
      source: "product_listing",
      helpRequestId: null,
      providerId,
      type: "product",
      title,
      description,
      category: stringFromRow(row, ["category", "product_category", "type"], "Product"),
      price: numberFromRow(row, ["price", "amount", "mrp"], 0),
      avatarUrl: profileMeta.avatarUrl,
      creatorName: profileMeta.name,
      creatorUsername: profileMeta.username,
      locationLabel,
      distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      media: [],
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: false,
      rankScore: calculateLocalRankScore({
        distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.averageRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      publicProfilePath: profileMeta.publicProfilePath,
      status: stringFromRow(row, ["status", "state"], "open"),
      acceptedProviderId: null,
    });
  });

  snapshot.posts.forEach((postRow) => {
    const row = postRow as unknown as FlexibleRow;
    const providerId = getListingOwnerIdFromPost(row);
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const composerMetadata = readMarketplaceComposerMetadata(postRow.metadata);
    const parsedFromText = parseMarketplacePostText(
      stringFromRow(row, ["text", "content", "description", "title"], "")
    );
    const type = normalizeMarketplacePostKind(
      stringFromRow(row, ["type", "post_type"], composerMetadata?.postType || parsedFromText.kind)
    );
    const locationLabel =
      composerMetadata?.locationLabel ||
      parsedFromText.location ||
      stringFromRow(row, ["location_label", "location"], profileMeta.locationLabel);
    const coordinates = resolveCoordinates({
      row,
      location: locationLabel,
      seed: `${providerId}:post:${postRow.id}`,
    });
    const title =
      composerMetadata?.title ||
      stringFromRow(row, ["title"], "") ||
      parsedFromText.title ||
      (type === "demand" ? "Need local support" : "Marketplace update");
    const description =
      composerMetadata?.details ||
      parsedFromText.description ||
      stringFromRow(row, ["description", "content"], "") ||
      title;
    const status = stringFromRow(row, ["status", "state"], "open");

    if (isClosedMarketplaceStatus(status)) return;
    if (!composerMetadata && isWeakMarketplaceContent(title, description)) return;

    const metadataMedia = mediaFromMarketplaceComposerMetadata(postRow.metadata);
    const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);

    nextItems.push({
      id: postRow.id,
      source: "post",
      helpRequestId: null,
      providerId,
      type,
      title,
      description,
      category:
        composerMetadata?.category ||
        stringFromRow(row, ["category"], "") ||
        parsedFromText.category ||
        (type === "demand" ? "Need" : type === "service" ? "Service" : "Product"),
      price:
        (composerMetadata?.budget && composerMetadata.budget > 0 ? composerMetadata.budget : null) ??
        (parsedFromText.budget > 0 ? parsedFromText.budget : 0),
      avatarUrl: profileMeta.avatarUrl,
      creatorName: profileMeta.name,
      creatorUsername: profileMeta.username,
      locationLabel,
      distanceKm,
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      media: metadataMedia.length ? metadataMedia : parsedFromText.media,
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: type === "demand" && isUrgentDemand(`${title} ${description} ${status}`),
      rankScore: calculateLocalRankScore({
        distanceKm,
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.averageRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      publicProfilePath: profileMeta.publicProfilePath,
      status,
      acceptedProviderId: null,
    });
  });

  snapshot.helpRequests.forEach((helpRow) => {
    const row = helpRow as unknown as FlexibleRow;
    const providerId = stringFromRow(row, ["requester_id", "user_id", "created_by"], "");
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const composerMetadata = readMarketplaceComposerMetadata(helpRow.metadata);
    const title = composerMetadata?.title || stringFromRow(row, ["title", "name"], "Need local support");
    const description =
      composerMetadata?.details ||
      stringFromRow(row, ["details", "description", "text"], "Need details shared by requester");
    const status = stringFromRow(row, ["status"], "open");
    const acceptedProviderId = stringFromRow(row, ["accepted_provider_id"], "") || null;

    if (isClosedMarketplaceStatus(status)) return;
    if (acceptedProviderId) return;
    if (!composerMetadata && isWeakMarketplaceContent(title, description)) return;

    const locationLabel =
      stringFromRow(row, ["location_label", "location"], "") ||
      composerMetadata?.locationLabel ||
      profileMeta.locationLabel ||
      "Nearby";
    const coordinates = resolveCoordinates({
      row,
      location: locationLabel,
      seed: `${providerId}:help:${helpRow.id}`,
    });
    const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);
    const urgency = stringFromRow(row, ["urgency"], "");
    const metadataMedia = mediaFromMarketplaceComposerMetadata(helpRow.metadata);
    const budgetMax = numberFromRow(row, ["budget_max"], 0);
    const budgetMin = numberFromRow(row, ["budget_min", "budget"], 0);

    nextItems.push({
      id: helpRow.id,
      source: "help_request",
      helpRequestId: helpRow.id,
      providerId,
      type: "demand",
      title,
      description,
      category: composerMetadata?.category || stringFromRow(row, ["category"], "Need"),
      price: budgetMax > 0 ? budgetMax : budgetMin,
      avatarUrl: profileMeta.avatarUrl,
      creatorName: profileMeta.name,
      creatorUsername: profileMeta.username,
      locationLabel,
      distanceKm,
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      media: metadataMedia,
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: isUrgentDemand(urgency || `${title} ${description}`),
      rankScore: calculateLocalRankScore({
        distanceKm,
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.averageRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      publicProfilePath: profileMeta.publicProfilePath,
      status,
      acceptedProviderId,
    });
  });

  const feedItems = dedupeMarketplaceFeedItems(nextItems).sort((left, right) => {
    const createdAtDelta = parseMarketplaceDateMs(right.createdAt) - parseMarketplaceDateMs(left.createdAt);
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    if (left.urgent !== right.urgent) {
      return left.urgent ? -1 : 1;
    }

    if (left.rankScore !== right.rankScore) {
      return right.rankScore - left.rankScore;
    }

    return left.responseMinutes - right.responseMinutes;
  });

  return {
    feedItems,
    feedStats: buildMarketplaceFeedStats(feedItems),
    mapCenter,
  };
};
