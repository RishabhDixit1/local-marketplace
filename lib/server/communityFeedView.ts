import type {
  CommunityFeedResponse,
  CommunityHelpRequestRecord,
  CommunityOrderStatsRecord,
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
import { buildMarketplaceComposerSignature, readMarketplaceComposerMetadata } from "@/lib/marketplaceMetadata";
import { resolvePostMediaUrl, resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { normalizeServicePricingType, resolveListingImageUrl } from "@/lib/provider/listings";
import { buildPublicProfilePath } from "@/lib/profile/utils";
import {
  defaultMarketCoordinates,
  distanceBetweenCoordinatesKm,
  getCoordinates,
  resolveCoordinatesWithAccuracy,
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
  orderStats: CommunityOrderStatsRecord[];
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

const readMetadataString = (value: unknown, keys: string[]) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";

  for (const key of keys) {
    const candidate = (value as FlexibleRow)[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
};

const readPublishGroupKey = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? stringFromRow(value as FlexibleRow, ["publishGroupKey", "publish_group_key"], "")
    : "";

const fallbackImageMedia = (value: string) => {
  const resolvedUrl = resolvePostMediaUrl(value);
  if (!resolvedUrl) return [];

  return [{ mimeType: "image/*", url: resolvedUrl }];
};

const fallbackListingImageMedia = (value: string) => {
  const resolvedUrl = resolveListingImageUrl(value);
  if (!resolvedUrl) return [];

  return [{ mimeType: "image/*", url: resolvedUrl }];
};

const normalizeCanonicalPart = (value: string | null | undefined) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 96);

const buildMarketplaceCanonicalKey = (params: {
  kind: string;
  ownerId: string;
  title: string;
  category: string;
  metadata?: unknown;
}) => {
  const publishGroupKey = readPublishGroupKey(params.metadata);
  if (publishGroupKey) {
    return `${normalizeCanonicalPart(params.kind)}:${normalizeCanonicalPart(params.ownerId)}:${publishGroupKey}`;
  }

  const metadataSignature = buildMarketplaceComposerSignature(params.metadata);
  const prefix = `${normalizeCanonicalPart(params.kind)}:${normalizeCanonicalPart(params.ownerId)}`;

  if (metadataSignature) {
    return `${prefix}:${metadataSignature}`;
  }

  return `${prefix}:${normalizeCanonicalPart(params.title)}:${normalizeCanonicalPart(params.category)}`;
};

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

  const orderStatsMap = new Map<string, { completedJobs: number; openLeads: number }>();
  snapshot.orderStats.forEach((row) => {
    if (!row.provider_id) return;
    orderStatsMap.set(row.provider_id, {
      completedJobs: Number.isFinite(Number(row.completed_jobs)) ? Number(row.completed_jobs) : 0,
      openLeads: Number.isFinite(Number(row.open_leads)) ? Number(row.open_leads) : 0,
    });
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
    const orderStats = orderStatsMap.get(providerId);

    const profileCompletion =
      typeof profile?.profile_completion_percent === "number" && Number.isFinite(profile.profile_completion_percent)
        ? profile.profile_completion_percent
        : calculateProfileCompletion(profile || {});
    const averageRating = review?.count ? Number((review.total / review.count).toFixed(1)) : null;
    const reviewCount = review?.count || 0;
    const listingsCount = listingVolumeByProvider.get(providerId) || 0;
    const completedJobs = orderStats?.completedJobs || 0;
    const responseMinutes = estimateResponseMinutes({
      availability: presence?.availability || profile?.availability,
      providerId,
      baseResponseMinutes: presence?.rolling_response_minutes || null,
    });
    const rankRating = averageRating ?? (completedJobs > 0 ? 4 : 3.6);

    const verificationStatus = calculateVerificationStatus({
      role: profile?.role,
      verificationLevel: profile?.verification_level,
      profileCompletion,
      listingsCount,
      averageRating: averageRating ?? 0,
      reviewCount,
      completedJobs,
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
      reviewCount,
      completedJobs,
      listingsCount,
      rankRating,
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
    const coordinateMeta = resolveCoordinatesWithAccuracy({
      row,
      location: locationLabel,
      seed: `${providerId}:service:${serviceRow.id}`,
    });
    const coordinates = coordinateMeta.coordinates;
    const title = stringFromRow(row, ["title", "name"], "Local service");
    const description = stringFromRow(row, ["description", "details", "text"], "Service listing");
    const metadataSource = readMetadataSource(row.metadata);
    const isComposerSyncedListing = metadataSource === "composer_listing_sync";
    const category = stringFromRow(row, ["category", "service_category", "type"], "Service");
    const metadataMedia = mediaFromMarketplaceComposerMetadata(row.metadata);

    if (!isComposerSyncedListing && isWeakMarketplaceContent(title, description)) return;

    nextItems.push({
      id: serviceRow.id,
      source: "service_listing",
      helpRequestId: null,
      linkedPostId: readMetadataString(row.metadata, ["linked_post_id", "linkedPostId"]) || null,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      canonicalKey: buildMarketplaceCanonicalKey({
        kind: "service",
        ownerId: providerId,
        title,
        category,
        metadata: row.metadata,
      }),
      providerId,
      type: "service",
      title,
      description,
      category,
      price: numberFromRow(row, ["price", "amount", "rate"], 0),
      avatarUrl: profileMeta.avatarUrl,
      creatorName: profileMeta.name,
      creatorUsername: profileMeta.username,
      locationLabel,
      distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      coordinateAccuracy: coordinateMeta.accuracy,
      media: metadataMedia.length ? metadataMedia : fallbackListingImageMedia(stringFromRow(row, ["image_url", "image"], "")),
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: false,
      rankScore: calculateLocalRankScore({
        distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.rankRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      averageRating: profileMeta.averageRating,
      reviewCount: profileMeta.reviewCount,
      completedJobs: profileMeta.completedJobs,
      listingCount: profileMeta.listingsCount,
      publicProfilePath: profileMeta.publicProfilePath,
      status: stringFromRow(row, ["status", "state"], "open"),
      acceptedProviderId: null,
      pricingType: normalizeServicePricingType(
        stringFromRow(row, ["pricing_type"], readMetadataString(row.metadata, ["pricingType", "pricing_type"]))
      ),
    });
  });

  snapshot.products.forEach((productRow) => {
    const row = productRow as unknown as FlexibleRow;
    const providerId = stringFromRow(row, ["provider_id", "user_id", "created_by"], "");
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const locationLabel = stringFromRow(row, ["location_label", "location"], profileMeta.locationLabel);
    const coordinateMeta = resolveCoordinatesWithAccuracy({
      row,
      location: locationLabel,
      seed: `${providerId}:product:${productRow.id}`,
    });
    const coordinates = coordinateMeta.coordinates;
    const title = stringFromRow(row, ["title", "name"], "Local product");
    const description = stringFromRow(row, ["description", "details", "text"], "Product listing");
    const metadataSource = readMetadataSource(row.metadata);
    const isComposerSyncedListing = metadataSource === "composer_listing_sync";
    const category = stringFromRow(row, ["category", "product_category", "type"], "Product");
    const metadataMedia = mediaFromMarketplaceComposerMetadata(row.metadata);

    if (!isComposerSyncedListing && isWeakMarketplaceContent(title, description)) return;

    nextItems.push({
      id: productRow.id,
      source: "product_listing",
      helpRequestId: null,
      linkedPostId: readMetadataString(row.metadata, ["linked_post_id", "linkedPostId"]) || null,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      canonicalKey: buildMarketplaceCanonicalKey({
        kind: "product",
        ownerId: providerId,
        title,
        category,
        metadata: row.metadata,
      }),
      providerId,
      type: "product",
      title,
      description,
      category,
      price: numberFromRow(row, ["price", "amount", "mrp"], 0),
      avatarUrl: profileMeta.avatarUrl,
      creatorName: profileMeta.name,
      creatorUsername: profileMeta.username,
      locationLabel,
      distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      coordinateAccuracy: coordinateMeta.accuracy,
      media: metadataMedia.length ? metadataMedia : fallbackListingImageMedia(stringFromRow(row, ["image_path", "image_url", "image"], "")),
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: false,
      rankScore: calculateLocalRankScore({
        distanceKm: distanceBetweenCoordinatesKm(viewerPoint, coordinates),
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.rankRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      averageRating: profileMeta.averageRating,
      reviewCount: profileMeta.reviewCount,
      completedJobs: profileMeta.completedJobs,
      listingCount: profileMeta.listingsCount,
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
    const coordinateMeta = resolveCoordinatesWithAccuracy({
      row,
      location: locationLabel,
      seed: `${providerId}:post:${postRow.id}`,
    });
    const coordinates = coordinateMeta.coordinates;
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
      linkedListingId: readMetadataString(row.metadata, ["linked_listing_id", "linkedListingId"]) || null,
      linkedHelpRequestId: readMetadataString(row.metadata, ["linked_help_request_id", "linkedHelpRequestId"]) || null,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      canonicalKey: buildMarketplaceCanonicalKey({
        kind: type,
        ownerId: providerId,
        title,
        category:
          composerMetadata?.category ||
          stringFromRow(row, ["category"], "") ||
          parsedFromText.category ||
          (type === "demand" ? "Need" : type === "service" ? "Service" : "Product"),
        metadata: row.metadata,
      }),
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
      coordinateAccuracy: coordinateMeta.accuracy,
      media: metadataMedia.length ? metadataMedia : parsedFromText.media,
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: type === "demand" && isUrgentDemand(`${title} ${description} ${status}`),
      rankScore: calculateLocalRankScore({
        distanceKm,
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.rankRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      averageRating: profileMeta.averageRating,
      reviewCount: profileMeta.reviewCount,
      completedJobs: profileMeta.completedJobs,
      listingCount: profileMeta.listingsCount,
      publicProfilePath: profileMeta.publicProfilePath,
      status,
      acceptedProviderId: null,
      pricingType:
        type === "service"
          ? normalizeServicePricingType(
              readMetadataString(row.metadata, ["pricingType", "pricing_type"]) ||
                readMetadataString(postRow.metadata, ["pricingType", "pricing_type"])
            )
          : null,
    });
  });

  snapshot.helpRequests.forEach((helpRow) => {
    const row = helpRow as unknown as FlexibleRow;
    const providerId = stringFromRow(row, ["requester_id", "user_id", "created_by"], "");
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const composerMetadata = readMarketplaceComposerMetadata(helpRow.metadata);
    const title = stringFromRow(row, ["title", "name"], "") || composerMetadata?.title || "Need local support";
    const description =
      stringFromRow(row, ["details", "description", "text"], "") ||
      composerMetadata?.details ||
      "Need details shared by requester";
    const status = stringFromRow(row, ["status"], "open");
    const acceptedProviderId = stringFromRow(row, ["accepted_provider_id"], "") || null;
    const category = composerMetadata?.category || stringFromRow(row, ["category"], "Need");

    if (isClosedMarketplaceStatus(status)) return;
    if (acceptedProviderId) return;
    if (!composerMetadata && isWeakMarketplaceContent(title, description)) return;

    const locationLabel =
      stringFromRow(row, ["location_label", "location"], "") ||
      composerMetadata?.locationLabel ||
      profileMeta.locationLabel ||
      "Nearby";
    const coordinateMeta = resolveCoordinatesWithAccuracy({
      row,
      location: locationLabel,
      seed: `${providerId}:help:${helpRow.id}`,
    });
    const coordinates = coordinateMeta.coordinates;
    const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);
    const urgency = stringFromRow(row, ["urgency"], "");
    const metadataMedia = mediaFromMarketplaceComposerMetadata(helpRow.metadata);
    const budgetMax = numberFromRow(row, ["budget_max"], 0);
    const budgetMin = numberFromRow(row, ["budget_min", "budget"], 0);

    nextItems.push({
      id: helpRow.id,
      source: "help_request",
      helpRequestId: helpRow.id,
      linkedPostId: readMetadataString(row.metadata, ["linked_post_id", "linkedPostId"]) || null,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      canonicalKey: buildMarketplaceCanonicalKey({
        kind: "demand",
        ownerId: providerId,
        title,
        category,
        metadata: row.metadata,
      }),
      providerId,
      type: "demand",
      title,
      description,
      category,
      price: budgetMax > 0 ? budgetMax : budgetMin,
      avatarUrl: profileMeta.avatarUrl,
      creatorName: profileMeta.name,
      creatorUsername: profileMeta.username,
      locationLabel,
      distanceKm,
      lat: coordinates.latitude,
      lng: coordinates.longitude,
      coordinateAccuracy: coordinateMeta.accuracy,
      media: metadataMedia,
      createdAt: stringFromRow(row, ["created_at"], new Date().toISOString()),
      urgent: isUrgentDemand(urgency || `${title} ${description}`),
      rankScore: calculateLocalRankScore({
        distanceKm,
        responseMinutes: profileMeta.responseMinutes,
        rating: profileMeta.rankRating,
        profileCompletion: profileMeta.profileCompletion,
      }),
      profileCompletion: profileMeta.profileCompletion,
      responseMinutes: profileMeta.responseMinutes,
      verificationStatus: profileMeta.verificationStatus,
      averageRating: profileMeta.averageRating,
      reviewCount: profileMeta.reviewCount,
      completedJobs: profileMeta.completedJobs,
      listingCount: profileMeta.listingsCount,
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
