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
  buildMarketplaceFeedCardId,
  buildMarketplaceFeedStats,
  dedupeMarketplaceFeedItems,
  hasMarketplaceViewerInterest,
  isClosedMarketplaceStatus,
  isWeakMarketplaceContent,
  mediaFromMarketplaceComposerMetadata,
  normalizeMarketplaceNeedMatchStatus,
  normalizeMarketplacePersonLabel,
  normalizeMarketplacePostKind,
  parseMarketplaceDateMs,
  parseMarketplacePostText,
  toMarketplaceCreatorUsername,
  type MarketplaceFeedItem,
  type MarketplaceMapCenter,
  type MarketplaceNeedMatchStatus,
} from "@/lib/marketplaceFeed";
import {
  buildMarketplaceComposerSignature,
  readMarketplaceComposerMetadata,
} from "@/lib/marketplaceMetadata";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import {
  normalizeServicePricingType,
  resolveListingImageUrl,
} from "@/lib/provider/listings";
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
  viewerRoleFamily?: "seeker" | "provider";
  connectionGraph?: Map<string, Set<string>>;
  savedCardIds?: Set<string>;
  hiddenCardIds?: Set<string>;
  hiddenFocusIds?: Set<string>;
  services: CommunityServiceRecord[];
  products: CommunityProductRecord[];
  posts: CommunityPostRecord[];
  helpRequests: CommunityHelpRequestRecord[];
  profiles: CommunityProfileRecord[];
  reviews: CommunityReviewRecord[];
  presence: CommunityPresenceRecord[];
  orderStats: CommunityOrderStatsRecord[];
  viewerMatchStatusByHelpRequestId?: Record<string, MarketplaceNeedMatchStatus>;
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
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const getListingOwnerIdFromPost = (row: FlexibleRow) =>
  stringFromRow(
    row,
    [
      "user_id",
      "provider_id",
      "created_by",
      "author_id",
      "requester_id",
      "owner_id",
    ],
    "",
  );

const isUrgentDemand = (value: string) =>
  /urgent|asap|immediate|today|quick|critical|emergency|high/i.test(value);
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
    ? stringFromRow(
        value as FlexibleRow,
        ["publishGroupKey", "publish_group_key"],
        "",
      )
    : "";

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

const resolveViewerPoint = (
  profile: CommunityProfileRecord | null,
): MarketplaceMapCenter => {
  const explicit = getCoordinates(profile?.latitude, profile?.longitude);
  if (explicit) {
    return { lat: explicit.latitude, lng: explicit.longitude };
  }

  const fallback = defaultMarketCoordinates();
  return { lat: fallback.latitude, lng: fallback.longitude };
};

const getCommunityFeedActivityRank = (item: MarketplaceFeedItem) => {
  const normalizedStatus = (item.status || "").trim().toLowerCase();

  if (normalizedStatus === "accepted" || normalizedStatus === "in_progress") {
    return 1;
  }

  if (isClosedMarketplaceStatus(normalizedStatus)) {
    return 2;
  }

  return 0;
};

const countMutualConnections = (
  viewerConnections: Set<string>,
  ownerConnections: Set<string>,
  currentUserId: string,
  ownerId: string,
) => {
  let count = 0;
  viewerConnections.forEach((peerId) => {
    if (!peerId || peerId === currentUserId || peerId === ownerId) return;
    if (ownerConnections.has(peerId)) {
      count += 1;
    }
  });
  return count;
};

const buildResponseEta = (responseMinutes: number, activeNow: boolean) => {
  if (activeNow && responseMinutes <= 0) {
    return "Active now";
  }
  if (responseMinutes > 0) {
    return `${responseMinutes} min`;
  }
  return "Building";
};

const buildLastActiveLabel = (params: {
  activeNow: boolean;
  responseMinutes: number;
  lastSeen: string | null | undefined;
}) => {
  if (params.activeNow) {
    return "Active now";
  }
  if (params.lastSeen) {
    const parsed = Date.parse(params.lastSeen);
    if (Number.isFinite(parsed)) {
      const diffMs = Math.max(0, Date.now() - parsed);
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 60) {
        return `${Math.max(1, diffMinutes)}m ago`;
      }
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
        return `${diffHours}h ago`;
      }
      return `${Math.floor(diffHours / 24)}d ago`;
    }
  }
  if (params.responseMinutes > 0) {
    return `Usually replies in ${params.responseMinutes} min`;
  }
  return "Recently active";
};

const buildResponseReliability = (params: {
  responseMinutes: number;
  activeNow: boolean;
  reviewCount: number;
  completedJobs: number;
}) => {
  if (
    params.activeNow &&
    params.responseMinutes > 0 &&
    params.responseMinutes <= 20 &&
    params.reviewCount >= 3
  ) {
    return "High reliability";
  }
  if (params.responseMinutes > 0 && params.responseMinutes <= 35) {
    return "Reliable";
  }
  if (params.completedJobs >= 5 || params.reviewCount >= 5) {
    return "Established";
  }
  return "Building trust";
};

const buildViewerRoleFit = (
  viewerRoleFamily: "seeker" | "provider",
  itemType: MarketplaceFeedItem["type"],
): MarketplaceFeedItem["viewerRoleFit"] => {
  if (viewerRoleFamily === "provider") {
    return itemType === "demand" ? "earn" : "benchmark";
  }
  return itemType === "demand" ? "discover" : "hire";
};

const classifySourceType = (params: {
  acceptedConnectionIds: Set<string>;
  providerId: string;
  mutualConnectionsCount: number;
  itemType: MarketplaceFeedItem["type"];
  profileCompletion: number;
  reviewCount: number;
}) => {
  if (params.acceptedConnectionIds.has(params.providerId)) {
    return "accepted_connection" as const;
  }
  if (
    params.mutualConnectionsCount > 0 ||
    params.itemType !== "demand" ||
    params.profileCompletion >= 80 ||
    params.reviewCount >= 3
  ) {
    return "recommended" as const;
  }
  return "nearby_public" as const;
};

const buildFeedReason = (params: {
  sourceType: MarketplaceFeedItem["sourceType"];
  urgent: boolean;
  mutualConnectionsCount: number;
  itemType: MarketplaceFeedItem["type"];
  viewerRoleFit: MarketplaceFeedItem["viewerRoleFit"];
  category: string;
  responseMinutes: number;
  activeNow: boolean;
}) => {
  if (params.sourceType === "accepted_connection") {
    return "Accepted connection post with stronger trust and social context.";
  }
  if (params.urgent) {
    return "Urgent nearby post ranked higher for speed and actionability.";
  }
  if (params.mutualConnectionsCount > 0) {
    return `${params.mutualConnectionsCount} mutual connection${
      params.mutualConnectionsCount === 1 ? "" : "s"
    } increase trust here.`;
  }
  if (params.viewerRoleFit === "earn") {
    return params.responseMinutes > 0
      ? `Good fit for earning nearby with an estimated ${params.responseMinutes} min reply cycle.`
      : "Good fit for earning nearby.";
  }
  if (params.viewerRoleFit === "hire") {
    return `Recommended provider-style listing in ${params.category}.`;
  }
  if (params.activeNow) {
    return "Active now, so follow-up should be faster.";
  }
  return "Relevant local post ranked by trust, distance, and recency.";
};

const calculatePriorityScore = (params: {
  baseRankScore: number;
  sourceType: MarketplaceFeedItem["sourceType"];
  urgent: boolean;
  mutualConnectionsCount: number;
  responseMinutes: number;
  viewerRoleFit: MarketplaceFeedItem["viewerRoleFit"];
}) => {
  let score = params.baseRankScore;
  if (params.sourceType === "accepted_connection") score += 18;
  if (params.sourceType === "recommended") score += 12;
  if (params.urgent) score += 28;
  score += params.mutualConnectionsCount * 8;
  if (params.responseMinutes > 0) {
    score += Math.max(0, 30 - Math.min(params.responseMinutes, 30));
  }
  if (params.viewerRoleFit === "earn") score += 12;
  if (params.viewerRoleFit === "hire") score += 8;
  return Math.round(score);
};

export const buildCommunityFeedView = (
  snapshot: CommunityFeedSnapshotInput,
  viewerOverride?: MarketplaceMapCenter | null,
): Pick<
  Extract<CommunityFeedResponse, { ok: true }>,
  "feedItems" | "feedStats" | "mapCenter"
> => {
  const viewerRoleFamily = snapshot.viewerRoleFamily || "seeker";
  const connectionGraph =
    snapshot.connectionGraph || new Map<string, Set<string>>();
  const viewerConnections = new Set(snapshot.acceptedConnectionIds || []);
  const hiddenCardIds = snapshot.hiddenCardIds || new Set<string>();
  const hiddenFocusIds = snapshot.hiddenFocusIds || new Set<string>();
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
    if (
      !row.provider_id ||
      typeof row.rating !== "number" ||
      !Number.isFinite(row.rating)
    )
      return;
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

  const orderStatsMap = new Map<
    string,
    { completedJobs: number; openLeads: number }
  >();
  snapshot.orderStats.forEach((row) => {
    if (!row.provider_id) return;
    orderStatsMap.set(row.provider_id, {
      completedJobs: Number.isFinite(Number(row.completed_jobs))
        ? Number(row.completed_jobs)
        : 0,
      openLeads: Number.isFinite(Number(row.open_leads))
        ? Number(row.open_leads)
        : 0,
    });
  });

  const listingVolumeByProvider = new Map<string, number>();
  const bumpVolume = (providerId: string) => {
    if (!providerId) return;
    listingVolumeByProvider.set(
      providerId,
      (listingVolumeByProvider.get(providerId) || 0) + 1,
    );
  };

  snapshot.services.forEach((row) => bumpVolume(row.provider_id));
  snapshot.products.forEach((row) => bumpVolume(row.provider_id));
  snapshot.posts.forEach((row) =>
    bumpVolume(getListingOwnerIdFromPost(row as unknown as FlexibleRow)),
  );
  snapshot.helpRequests.forEach((row) => bumpVolume(row.requester_id || ""));

  const mapCenter =
    viewerOverride || resolveViewerPoint(snapshot.currentUserProfile);

  const resolveProfileMeta = (providerId: string) => {
    const profile = profileMap.get(providerId);
    const profileRow = (profile || {}) as FlexibleRow;
    const presence = presenceMap.get(providerId);
    const review = reviewStats.get(providerId);
    const orderStats = orderStatsMap.get(providerId);

    const profileCompletion =
      typeof profile?.profile_completion_percent === "number" &&
      Number.isFinite(profile.profile_completion_percent)
        ? profile.profile_completion_percent
        : calculateProfileCompletion(profile || {});
    const averageRating = review?.count
      ? Number((review.total / review.count).toFixed(1))
      : null;
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
      stringFromRow(
        profileRow,
        ["name", "full_name", "display_name", "business_name"],
        "",
      ),
    );
    const explicitHandle = normalizeMarketplacePersonLabel(
      stringFromRow(profileRow, ["username", "handle"], ""),
    );
    const emailPrefix = normalizeMarketplacePersonLabel(
      (
        (typeof profile?.email === "string" ? profile.email : "").split(
          "@",
        )[0] || ""
      ).trim(),
    );
    const resolvedProfileName =
      explicitProfileName || explicitHandle || emailPrefix;
    const usernameSeed =
      explicitHandle || resolvedProfileName || "local-member";

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
      locationLabel:
        (typeof profile?.location === "string" && profile.location.trim()) ||
        "Nearby",
      activeNow: presence?.is_online === true,
      lastSeen: presence?.last_seen || null,
      phone:
        (typeof profile?.phone === "string" && profile.phone.trim()) || null,
      publicProfilePath:
        buildPublicProfilePath({
          id: providerId,
          full_name: resolvedProfileName,
          name: resolvedProfileName,
        }) ||
        `/profile/${toMarketplaceCreatorUsername(usernameSeed) || "local-member"}-${providerId}`,
    };
  };

  const viewerPoint = { latitude: mapCenter.lat, longitude: mapCenter.lng };
  const nextItems: MarketplaceFeedItem[] = [];

  snapshot.services.forEach((serviceRow) => {
    const row = serviceRow as unknown as FlexibleRow;
    const providerId = stringFromRow(
      row,
      ["provider_id", "user_id", "created_by"],
      "",
    );
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const locationLabel = stringFromRow(
      row,
      ["location_label", "location"],
      profileMeta.locationLabel,
    );
    const coordinateMeta = resolveCoordinatesWithAccuracy({
      row,
      location: locationLabel,
      seed: `${providerId}:service:${serviceRow.id}`,
    });
    const coordinates = coordinateMeta.coordinates;
    const title = stringFromRow(row, ["title", "name"], "Local service");
    const description = stringFromRow(
      row,
      ["description", "details", "text"],
      "Service listing",
    );
    const metadataSource = readMetadataSource(row.metadata);
    const isComposerSyncedListing = metadataSource === "composer_listing_sync";
    const category = stringFromRow(
      row,
      ["category", "service_category", "type"],
      "Service",
    );
    const metadataMedia = mediaFromMarketplaceComposerMetadata(row.metadata);

    if (
      !isComposerSyncedListing &&
      isWeakMarketplaceContent(title, description)
    )
      return;

    nextItems.push({
      id: serviceRow.id,
      source: "service_listing",
      helpRequestId: null,
      linkedPostId:
        readMetadataString(row.metadata, ["linked_post_id", "linkedPostId"]) ||
        null,
      metadata:
        row.metadata &&
        typeof row.metadata === "object" &&
        !Array.isArray(row.metadata)
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
      media: metadataMedia.length
        ? metadataMedia
        : fallbackListingImageMedia(
            stringFromRow(row, ["image_url", "image"], ""),
          ),
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
      activeNow: profileMeta.activeNow,
      lastActiveLabel: buildLastActiveLabel({
        activeNow: profileMeta.activeNow,
        responseMinutes: profileMeta.responseMinutes,
        lastSeen: profileMeta.lastSeen,
      }),
      responseEta: buildResponseEta(
        profileMeta.responseMinutes,
        profileMeta.activeNow,
      ),
      responseReliability: buildResponseReliability({
        responseMinutes: profileMeta.responseMinutes,
        activeNow: profileMeta.activeNow,
        reviewCount: profileMeta.reviewCount,
        completedJobs: profileMeta.completedJobs,
      }),
      contactPhone: profileMeta.phone,
      canCall: !!profileMeta.phone,
      status: stringFromRow(row, ["status", "state"], "open"),
      acceptedProviderId: null,
      pricingType: normalizeServicePricingType(
        stringFromRow(
          row,
          ["pricing_type"],
          readMetadataString(row.metadata, ["pricingType", "pricing_type"]),
        ),
      ),
    });
  });

  snapshot.products.forEach((productRow) => {
    const row = productRow as unknown as FlexibleRow;
    const providerId = stringFromRow(
      row,
      ["provider_id", "user_id", "created_by"],
      "",
    );
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const locationLabel = stringFromRow(
      row,
      ["location_label", "location"],
      profileMeta.locationLabel,
    );
    const coordinateMeta = resolveCoordinatesWithAccuracy({
      row,
      location: locationLabel,
      seed: `${providerId}:product:${productRow.id}`,
    });
    const coordinates = coordinateMeta.coordinates;
    const title = stringFromRow(row, ["title", "name"], "Local product");
    const description = stringFromRow(
      row,
      ["description", "details", "text"],
      "Product listing",
    );
    const metadataSource = readMetadataSource(row.metadata);
    const isComposerSyncedListing = metadataSource === "composer_listing_sync";
    const category = stringFromRow(
      row,
      ["category", "product_category", "type"],
      "Product",
    );
    const metadataMedia = mediaFromMarketplaceComposerMetadata(row.metadata);

    if (
      !isComposerSyncedListing &&
      isWeakMarketplaceContent(title, description)
    )
      return;

    nextItems.push({
      id: productRow.id,
      source: "product_listing",
      helpRequestId: null,
      linkedPostId:
        readMetadataString(row.metadata, ["linked_post_id", "linkedPostId"]) ||
        null,
      metadata:
        row.metadata &&
        typeof row.metadata === "object" &&
        !Array.isArray(row.metadata)
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
      media: metadataMedia.length
        ? metadataMedia
        : fallbackListingImageMedia(
            stringFromRow(row, ["image_path", "image_url", "image"], ""),
          ),
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
      activeNow: profileMeta.activeNow,
      lastActiveLabel: buildLastActiveLabel({
        activeNow: profileMeta.activeNow,
        responseMinutes: profileMeta.responseMinutes,
        lastSeen: profileMeta.lastSeen,
      }),
      responseEta: buildResponseEta(
        profileMeta.responseMinutes,
        profileMeta.activeNow,
      ),
      responseReliability: buildResponseReliability({
        responseMinutes: profileMeta.responseMinutes,
        activeNow: profileMeta.activeNow,
        reviewCount: profileMeta.reviewCount,
        completedJobs: profileMeta.completedJobs,
      }),
      contactPhone: profileMeta.phone,
      canCall: !!profileMeta.phone,
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
      stringFromRow(row, ["text", "content", "description", "title"], ""),
    );
    const type = normalizeMarketplacePostKind(
      stringFromRow(
        row,
        ["type", "post_type"],
        composerMetadata?.postType || parsedFromText.kind,
      ),
    );
    const locationLabel =
      composerMetadata?.locationLabel ||
      parsedFromText.location ||
      stringFromRow(
        row,
        ["location_label", "location"],
        profileMeta.locationLabel,
      );
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
    if (!composerMetadata && isWeakMarketplaceContent(title, description))
      return;

    const metadataMedia = mediaFromMarketplaceComposerMetadata(
      postRow.metadata,
    );
    const distanceKm = distanceBetweenCoordinatesKm(viewerPoint, coordinates);

    nextItems.push({
      id: postRow.id,
      source: "post",
      helpRequestId: null,
      linkedListingId:
        readMetadataString(row.metadata, [
          "linked_listing_id",
          "linkedListingId",
        ]) || null,
      linkedHelpRequestId:
        readMetadataString(row.metadata, [
          "linked_help_request_id",
          "linkedHelpRequestId",
        ]) || null,
      metadata:
        row.metadata &&
        typeof row.metadata === "object" &&
        !Array.isArray(row.metadata)
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
          (type === "demand"
            ? "Need"
            : type === "service"
              ? "Service"
              : "Product"),
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
        (type === "demand"
          ? "Need"
          : type === "service"
            ? "Service"
            : "Product"),
      price:
        (composerMetadata?.budget && composerMetadata.budget > 0
          ? composerMetadata.budget
          : null) ?? (parsedFromText.budget > 0 ? parsedFromText.budget : 0),
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
      urgent:
        type === "demand" &&
        isUrgentDemand(`${title} ${description} ${status}`),
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
      activeNow: profileMeta.activeNow,
      lastActiveLabel: buildLastActiveLabel({
        activeNow: profileMeta.activeNow,
        responseMinutes: profileMeta.responseMinutes,
        lastSeen: profileMeta.lastSeen,
      }),
      responseEta: buildResponseEta(
        profileMeta.responseMinutes,
        profileMeta.activeNow,
      ),
      responseReliability: buildResponseReliability({
        responseMinutes: profileMeta.responseMinutes,
        activeNow: profileMeta.activeNow,
        reviewCount: profileMeta.reviewCount,
        completedJobs: profileMeta.completedJobs,
      }),
      contactPhone: profileMeta.phone,
      canCall: !!profileMeta.phone,
      status,
      acceptedProviderId: null,
      pricingType:
        type === "service"
          ? normalizeServicePricingType(
              readMetadataString(row.metadata, [
                "pricingType",
                "pricing_type",
              ]) ||
                readMetadataString(postRow.metadata, [
                  "pricingType",
                  "pricing_type",
                ]),
            )
          : null,
    });
  });

  snapshot.helpRequests.forEach((helpRow) => {
    const row = helpRow as unknown as FlexibleRow;
    const providerId = stringFromRow(
      row,
      ["requester_id", "user_id", "created_by"],
      "",
    );
    if (!providerId) return;

    const profileMeta = resolveProfileMeta(providerId);
    const composerMetadata = readMarketplaceComposerMetadata(helpRow.metadata);
    const title =
      stringFromRow(row, ["title", "name"], "") ||
      composerMetadata?.title ||
      "Need local support";
    const description =
      stringFromRow(row, ["details", "description", "text"], "") ||
      composerMetadata?.details ||
      "Need details shared by requester";
    const status = stringFromRow(row, ["status"], "open");
    const acceptedProviderId =
      stringFromRow(row, ["accepted_provider_id"], "") || null;
    const category =
      composerMetadata?.category || stringFromRow(row, ["category"], "Need");

    if (isClosedMarketplaceStatus(status)) return;
    if (!composerMetadata && isWeakMarketplaceContent(title, description))
      return;

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
    const metadataMedia = mediaFromMarketplaceComposerMetadata(
      helpRow.metadata,
    );
    const budgetMax = numberFromRow(row, ["budget_max"], 0);
    const budgetMin = numberFromRow(row, ["budget_min", "budget"], 0);
    const viewerMatchStatus = normalizeMarketplaceNeedMatchStatus(
      snapshot.viewerMatchStatusByHelpRequestId?.[helpRow.id],
    );

    nextItems.push({
      id: helpRow.id,
      source: "help_request",
      helpRequestId: helpRow.id,
      linkedPostId:
        readMetadataString(row.metadata, ["linked_post_id", "linkedPostId"]) ||
        null,
      metadata:
        row.metadata &&
        typeof row.metadata === "object" &&
        !Array.isArray(row.metadata)
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
      activeNow: profileMeta.activeNow,
      lastActiveLabel: buildLastActiveLabel({
        activeNow: profileMeta.activeNow,
        responseMinutes: profileMeta.responseMinutes,
        lastSeen: profileMeta.lastSeen,
      }),
      responseEta: buildResponseEta(
        profileMeta.responseMinutes,
        profileMeta.activeNow,
      ),
      responseReliability: buildResponseReliability({
        responseMinutes: profileMeta.responseMinutes,
        activeNow: profileMeta.activeNow,
        reviewCount: profileMeta.reviewCount,
        completedJobs: profileMeta.completedJobs,
      }),
      contactPhone: profileMeta.phone,
      canCall: !!profileMeta.phone,
      status,
      acceptedProviderId,
      viewerMatchStatus,
      viewerHasExpressedInterest:
        hasMarketplaceViewerInterest(viewerMatchStatus),
    });
  });

  const feedItems = dedupeMarketplaceFeedItems(nextItems)
    .map((item) => {
      const providerConnections =
        connectionGraph.get(item.providerId) || new Set<string>();
      const mutualConnectionsCount = countMutualConnections(
        viewerConnections,
        providerConnections,
        snapshot.currentUserId,
        item.providerId,
      );
      const sourceType = classifySourceType({
        acceptedConnectionIds: viewerConnections,
        providerId: item.providerId,
        mutualConnectionsCount,
        itemType: item.type,
        profileCompletion: item.profileCompletion,
        reviewCount: item.reviewCount || 0,
      });
      const viewerRoleFit = buildViewerRoleFit(viewerRoleFamily, item.type);
      const priorityScore = calculatePriorityScore({
        baseRankScore: item.rankScore,
        sourceType,
        urgent: item.urgent,
        mutualConnectionsCount,
        responseMinutes: item.responseMinutes,
        viewerRoleFit,
      });
      const feedReason = buildFeedReason({
        sourceType,
        urgent: item.urgent,
        mutualConnectionsCount,
        itemType: item.type,
        viewerRoleFit,
        category: item.category,
        responseMinutes: item.responseMinutes,
        activeNow: item.activeNow === true,
      });

      return {
        ...item,
        cardId: item.cardId || buildMarketplaceFeedCardId(item),
        thumbnailUrl: item.thumbnailUrl ?? item.media[0]?.url ?? null,
        sourceType,
        mutualConnectionsCount,
        viewerRoleFit,
        priorityScore,
        feedReason,
        whyThisCard: item.whyThisCard || feedReason,
      };
    })
    .filter(
      (item) =>
        !hiddenFocusIds.has(item.id) && !hiddenCardIds.has(item.cardId || ""),
    )
    .sort((left, right) => {
      const activityRankDelta =
        getCommunityFeedActivityRank(left) -
        getCommunityFeedActivityRank(right);
      if (activityRankDelta !== 0) {
        return activityRankDelta;
      }

      const priorityDelta =
        (right.priorityScore || 0) - (left.priorityScore || 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const createdAtDelta =
        parseMarketplaceDateMs(right.createdAt) -
        parseMarketplaceDateMs(left.createdAt);
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
