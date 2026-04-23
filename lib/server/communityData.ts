import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunityFeedResponse,
  CommunityHelpRequestRecord,
  CommunityOrderStatsRecord,
  CommunityPeopleResponse,
  CommunityPostRecord,
  CommunityPresenceRecord,
  CommunityProductRecord,
  CommunityProfileRecord,
  CommunityProfilePreview,
  CommunityReviewRecord,
  CommunityServiceRecord,
} from "@/lib/api/community";
import {
  mediaFromMarketplaceComposerMetadata,
  parseMarketplacePostText,
  normalizeMarketplaceNeedMatchStatus,
  type MarketplaceNeedMatchStatus,
} from "@/lib/marketplaceFeed";
import { buildCommunityFeedView } from "@/lib/server/communityFeedView";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { listAcceptedConnectionPeerIds } from "@/lib/server/chatGuards";
import { getProfileRoleFamily } from "@/lib/profile/utils";
import { resolveListingImageUrl } from "@/lib/provider/listings";

type FlexibleRow = Record<string, unknown>;

const isFlexibleRow = (value: unknown): value is FlexibleRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toFlexibleRow = (value: unknown): FlexibleRow | null =>
  isFlexibleRow(value) ? value : null;

const toFlexibleRows = (value: unknown): FlexibleRow[] =>
  Array.isArray(value)
    ? value
        .map((item) => toFlexibleRow(item))
        .filter((item): item is FlexibleRow => !!item)
    : [];

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|function .* does not exist|could not find the table '.*' in the schema cache|could not find the function '.*' in the schema cache/i.test(
    message,
  );

const trim = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

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

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter(
          (item): item is string => typeof item === "string" && !!item.trim(),
        )
        .map((item) => item.trim())
    : null;

const selectRowsWithFallback = async (
  db: SupabaseClient,
  table: string,
  primarySelect: string,
  options: {
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
    allowMissingRelation?: boolean;
    inFilter?: { column: string; values: string[] };
    orFilter?: string;
    eqFilters?: Array<{ column: string; value: string }>;
  } = {},
): Promise<FlexibleRow[]> => {
  let primaryQuery = db.from(table).select(primarySelect);

  if (options.eqFilters?.length) {
    for (const filter of options.eqFilters) {
      primaryQuery = primaryQuery.eq(filter.column, filter.value);
    }
  }

  if (options.inFilter?.column && options.inFilter.values.length > 0) {
    primaryQuery = primaryQuery.in(
      options.inFilter.column,
      options.inFilter.values,
    );
  }

  if (options.orFilter) {
    primaryQuery = primaryQuery.or(options.orFilter);
  }

  if (options.orderBy?.column) {
    primaryQuery = primaryQuery.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? false,
    });
  }

  if (typeof options.limit === "number" && options.limit > 0) {
    primaryQuery = primaryQuery.limit(options.limit);
  }

  const primaryResult = await primaryQuery;

  if (!primaryResult.error) {
    return toFlexibleRows(primaryResult.data);
  }

  if (
    options.allowMissingRelation &&
    isMissingRelationError(primaryResult.error.message || "")
  ) {
    return [];
  }

  if (!isMissingColumnError(primaryResult.error.message || "")) {
    throw new Error(primaryResult.error.message);
  }

  let fallbackQuery = db.from(table).select("*");

  if (options.eqFilters?.length) {
    for (const filter of options.eqFilters) {
      fallbackQuery = fallbackQuery.eq(filter.column, filter.value);
    }
  }

  if (options.inFilter?.column && options.inFilter.values.length > 0) {
    fallbackQuery = fallbackQuery.in(
      options.inFilter.column,
      options.inFilter.values,
    );
  }

  if (options.orFilter) {
    fallbackQuery = fallbackQuery.or(options.orFilter);
  }

  if (options.orderBy?.column) {
    fallbackQuery = fallbackQuery.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? false,
    });
  }

  if (typeof options.limit === "number" && options.limit > 0) {
    fallbackQuery = fallbackQuery.limit(options.limit);
  }

  const fallbackResult = await fallbackQuery;

  if (fallbackResult.error) {
    if (
      options.allowMissingRelation &&
      isMissingRelationError(fallbackResult.error.message || "")
    ) {
      return [];
    }
    throw new Error(fallbackResult.error.message);
  }

  return toFlexibleRows(fallbackResult.data);
};

const CONNECTED_FEED_LIMIT_PER_TYPE = 60;

const buildAcceptedConnectionGraph = async (
  db: SupabaseClient,
  userIds: string[],
) => {
  const normalizedIds = Array.from(new Set(userIds.filter(Boolean)));
  const graph = new Map<string, Set<string>>();

  if (normalizedIds.length === 0) {
    return graph;
  }

  const attach = (left: string, right: string) => {
    if (!left || !right || left === right) return;
    graph.set(
      left,
      new Set([...(graph.get(left) || new Set<string>()), right]),
    );
    graph.set(
      right,
      new Set([...(graph.get(right) || new Set<string>()), left]),
    );
  };

  const [requesterRows, recipientRows] = await Promise.all([
    selectRowsWithFallback(
      db,
      "connection_requests",
      "requester_id,recipient_id,status",
      {
        allowMissingRelation: true,
        eqFilters: [{ column: "status", value: "accepted" }],
        inFilter: { column: "requester_id", values: normalizedIds },
      },
    ),
    selectRowsWithFallback(
      db,
      "connection_requests",
      "requester_id,recipient_id,status",
      {
        allowMissingRelation: true,
        eqFilters: [{ column: "status", value: "accepted" }],
        inFilter: { column: "recipient_id", values: normalizedIds },
      },
    ),
  ]);

  const seenPairs = new Set<string>();
  [...requesterRows, ...recipientRows].forEach((row) => {
    const requesterId = stringFromRow(row, ["requester_id"], "");
    const recipientId = stringFromRow(row, ["recipient_id"], "");
    if (!requesterId || !recipientId) return;
    const key = [requesterId, recipientId].sort().join(":");
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    attach(requesterId, recipientId);
  });

  return graph;
};

const countMutualConnections = (
  viewerConnections: Set<string>,
  ownerConnections: Set<string>,
  options: { exclude?: string[] } = {},
) => {
  const exclude = new Set(options.exclude?.filter(Boolean) || []);
  let count = 0;
  viewerConnections.forEach((peerId) => {
    if (exclude.has(peerId)) return;
    if (ownerConnections.has(peerId)) {
      count += 1;
    }
  });
  return count;
};

const selectProfileById = async (db: SupabaseClient, userId: string) => {
  if (!userId) return null;

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error && !isMissingColumnError(error.message || "")) {
    throw new Error(error.message);
  }
  return toFlexibleRow(data);
};

const selectProfilesByIds = async (
  db: SupabaseClient,
  profileIds: string[],
) => {
  if (!profileIds.length) return [] as FlexibleRow[];

  const { data, error } = await db
    .from("profiles")
    .select("*")
    .in("id", profileIds);
  if (error && !isMissingColumnError(error.message || "")) {
    throw new Error(error.message);
  }

  return toFlexibleRows(data);
};

const normalizeProfile = (row: FlexibleRow): CommunityProfileRecord | null => {
  const id = stringFromRow(row, ["id", "user_id"], "");
  if (!id) return null;

  const profileCompletion = numberFromRow(
    row,
    ["profile_completion_percent"],
    Number.NaN,
  );
  const avatarUrl = resolveProfileAvatarUrl(
    stringFromRow(row, ["avatar_url", "avatar", "image_url"], ""),
  );
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const metadataDisplayName = metadata
    ? stringFromRow(
        metadata as FlexibleRow,
        [
          "full_name",
          "display_name",
          "preferred_name",
          "name",
          "username",
          "user_name",
        ],
        "",
      )
    : "";

  return {
    id,
    name:
      stringFromRow(
        row,
        [
          "full_name",
          "display_name",
          "preferred_name",
          "name",
          "username",
          "user_name",
        ],
        "",
      ) ||
      metadataDisplayName ||
      null,
    avatar_url: avatarUrl,
    role: stringFromRow(row, ["role", "account_type"], "") || null,
    bio: stringFromRow(row, ["bio", "about"], "") || null,
    location: stringFromRow(row, ["location", "city"], "") || null,
    availability: stringFromRow(row, ["availability", "status"], "") || null,
    services: normalizeStringArray(row.services),
    email: stringFromRow(row, ["email"], "") || null,
    phone: stringFromRow(row, ["phone", "phone_number"], "") || null,
    website: stringFromRow(row, ["website", "site_url"], "") || null,
    latitude: (() => {
      const value = numberFromRow(row, ["latitude", "lat"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    longitude: (() => {
      const value = numberFromRow(
        row,
        ["longitude", "lng", "long"],
        Number.NaN,
      );
      return Number.isFinite(value) ? value : null;
    })(),
    onboarding_completed:
      typeof row.onboarding_completed === "boolean"
        ? row.onboarding_completed
        : null,
    profile_completion_percent: Number.isFinite(profileCompletion)
      ? profileCompletion
      : null,
    verification_level: stringFromRow(row, ["verification_level"], "") || null,
    created_at: stringFromRow(row, ["created_at"], "") || null,
    updated_at: stringFromRow(row, ["updated_at"], "") || null,
  };
};

const normalizeService = (
  row: FlexibleRow,
  index: number,
): CommunityServiceRecord | null => {
  const providerId = stringFromRow(
    row,
    ["provider_id", "user_id", "created_by", "owner_id"],
    "",
  );
  if (!providerId) return null;
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;

  return {
    id: stringFromRow(row, ["id"], `service-${index}`),
    title: stringFromRow(
      row,
      ["title", "name", "service_title"],
      "Local service",
    ),
    description: stringFromRow(
      row,
      ["description", "details", "text"],
      "Service listing",
    ),
    price: numberFromRow(row, ["price", "amount", "rate"], 0),
    category: stringFromRow(
      row,
      ["category", "service_category", "type"],
      "Service",
    ),
    provider_id: providerId,
    image_url: stringFromRow(row, ["image_url"], "") || null,
    metadata,
    created_at: stringFromRow(row, ["created_at", "createdAt"], "") || null,
  };
};

const normalizeProduct = (
  row: FlexibleRow,
  index: number,
): CommunityProductRecord | null => {
  const providerId = stringFromRow(
    row,
    ["provider_id", "user_id", "created_by", "owner_id"],
    "",
  );
  if (!providerId) return null;

  return {
    id: stringFromRow(row, ["id"], `product-${index}`),
    title: stringFromRow(
      row,
      ["title", "name", "product_name"],
      "Local product",
    ),
    description: stringFromRow(
      row,
      ["description", "details", "text"],
      "Product listing",
    ),
    price: numberFromRow(row, ["price", "amount", "mrp"], 0),
    category: stringFromRow(
      row,
      ["category", "product_category", "type"],
      "Product",
    ),
    provider_id: providerId,
    image_url: stringFromRow(row, ["image_url"], "") || null,
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: stringFromRow(row, ["created_at", "createdAt"], "") || null,
  };
};

const normalizePost = (
  row: FlexibleRow,
  index: number,
): CommunityPostRecord | null => {
  const id = stringFromRow(row, ["id"], `post-${index}`);

  return {
    id,
    text: stringFromRow(row, ["text"], "") || null,
    content: stringFromRow(row, ["content"], "") || null,
    description: stringFromRow(row, ["description"], "") || null,
    title: stringFromRow(row, ["title", "name"], "") || null,
    user_id: stringFromRow(row, ["user_id"], "") || null,
    author_id: stringFromRow(row, ["author_id"], "") || null,
    created_by: stringFromRow(row, ["created_by"], "") || null,
    requester_id: stringFromRow(row, ["requester_id"], "") || null,
    owner_id: stringFromRow(row, ["owner_id"], "") || null,
    provider_id: stringFromRow(row, ["provider_id"], "") || null,
    type: stringFromRow(row, ["type"], "") || null,
    post_type: stringFromRow(row, ["post_type"], "") || null,
    category: stringFromRow(row, ["category"], "") || null,
    status: stringFromRow(row, ["status"], "") || null,
    state: stringFromRow(row, ["state"], "") || null,
    visibility: stringFromRow(row, ["visibility"], "") || null,
    metadata:
      row.metadata &&
      typeof row.metadata === "object" &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: stringFromRow(row, ["created_at", "createdAt"], "") || null,
  };
};

const normalizeHelpRequest = (
  row: FlexibleRow,
  index: number,
): CommunityHelpRequestRecord | null => {
  const requesterId = stringFromRow(
    row,
    ["requester_id", "user_id", "created_by"],
    "",
  );
  if (!requesterId) return null;
  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  const rawStatus = stringFromRow(row, ["status"], "") || null;
  const status =
    rawStatus &&
    ["cancelled", "canceled"].includes(rawStatus.toLowerCase()) &&
    isRelistedHelpRequest(metadata)
      ? "open"
      : rawStatus;

  return {
    id: stringFromRow(row, ["id"], `help-request-${index}`),
    requester_id: requesterId,
    accepted_provider_id:
      stringFromRow(row, ["accepted_provider_id"], "") || null,
    title: stringFromRow(row, ["title", "name"], "") || null,
    details: stringFromRow(row, ["details", "description", "text"], "") || null,
    category: stringFromRow(row, ["category"], "Need"),
    urgency: stringFromRow(row, ["urgency"], "") || null,
    budget_min: numberFromRow(row, ["budget_min", "budget"], 0),
    budget_max: numberFromRow(row, ["budget_max"], 0),
    location_label:
      stringFromRow(row, ["location_label", "location"], "") || null,
    latitude: (() => {
      const value = numberFromRow(row, ["latitude", "lat"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    longitude: (() => {
      const value = numberFromRow(
        row,
        ["longitude", "lng", "long"],
        Number.NaN,
      );
      return Number.isFinite(value) ? value : null;
    })(),
    status,
    metadata,
    created_at: stringFromRow(row, ["created_at", "createdAt"], "") || null,
  };
};

const normalizeReview = (row: FlexibleRow): CommunityReviewRecord | null => {
  const providerId = stringFromRow(row, ["provider_id"], "");
  if (!providerId) return null;

  const rating = numberFromRow(row, ["rating"], Number.NaN);

  return {
    provider_id: providerId,
    rating: Number.isFinite(rating) ? rating : null,
  };
};

const normalizePresence = (
  row: FlexibleRow,
): CommunityPresenceRecord | null => {
  const providerId = stringFromRow(row, ["provider_id"], "");
  if (!providerId) return null;

  return {
    provider_id: providerId,
    is_online: typeof row.is_online === "boolean" ? row.is_online : null,
    availability: stringFromRow(row, ["availability"], "") || null,
    response_sla_minutes: (() => {
      const value = numberFromRow(row, ["response_sla_minutes"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    rolling_response_minutes: (() => {
      const value = numberFromRow(
        row,
        ["rolling_response_minutes"],
        Number.NaN,
      );
      return Number.isFinite(value) ? value : null;
    })(),
    last_seen: stringFromRow(row, ["last_seen"], "") || null,
  };
};

const normalizeOrderStats = (
  row: FlexibleRow,
): CommunityOrderStatsRecord | null => {
  const providerId = stringFromRow(row, ["provider_id"], "");
  if (!providerId) return null;

  return {
    provider_id: providerId,
    completed_jobs: numberFromRow(row, ["completed_jobs"], 0),
    open_leads: numberFromRow(row, ["open_leads"], 0),
  };
};

const isVisibleStatus = (statusValue: string | null | undefined) => {
  const status = trim(statusValue).toLowerCase();
  return ![
    "cancelled",
    "canceled",
    "closed",
    "completed",
    "fulfilled",
    "archived",
    "deleted",
    "draft",
    "hidden",
  ].includes(status);
};

const isRelistedHelpRequest = (
  metadata: Record<string, unknown> | null | undefined,
) =>
  Boolean(
    metadata &&
    typeof metadata.relist_after_decline === "boolean" &&
    metadata.relist_after_decline,
  );

const isPostVisibleToViewer = (
  post: CommunityPostRecord,
  viewerId: string,
  acceptedPeers: Set<string>,
) => {
  const ownerId =
    post.user_id ||
    post.author_id ||
    post.created_by ||
    post.requester_id ||
    post.owner_id ||
    post.provider_id ||
    "";
  const visibility = trim(post.visibility).toLowerCase() || "public";
  const postKind = trim(post.post_type || post.type).toLowerCase();
  const metadataSource =
    post.metadata &&
    typeof post.metadata === "object" &&
    !Array.isArray(post.metadata)
      ? trim((post.metadata as Record<string, unknown>).source).toLowerCase()
      : "";
  const isComposerOfferPost =
    metadataSource === "serviq_compose" &&
    (postKind === "service" || postKind === "product");

  if (!ownerId) return false;
  if (ownerId === viewerId) return true;
  if (!isVisibleStatus(post.status || post.state || "open")) return false;
  if (visibility === "private") return false;
  if (["connections", "network", "contacts"].includes(visibility)) {
    return isComposerOfferPost ? true : acceptedPeers.has(ownerId);
  }

  return true;
};

const shouldIncludeDiscoverableProfile = (
  profile: CommunityProfileRecord,
  viewerId: string,
  activeMemberIds: Set<string>,
) => {
  if (profile.id === viewerId) return true;
  if (activeMemberIds.has(profile.id)) return true;
  if (profile.onboarding_completed) return true;
  if ((profile.profile_completion_percent || 0) >= 60) return true;

  return Boolean(profile.name || profile.bio || profile.location);
};

const resolveProfilePreview = (
  services: Array<
    Pick<
      CommunityServiceRecord,
      "provider_id" | "image_url" | "metadata" | "title" | "created_at"
    >
  >,
  products: Array<
    Pick<
      CommunityProductRecord,
      "provider_id" | "image_url" | "metadata" | "title" | "created_at"
    >
  >,
  posts: Array<
    Pick<
      CommunityPostRecord,
      | "user_id"
      | "author_id"
      | "created_by"
      | "provider_id"
      | "metadata"
      | "created_at"
      | "title"
      | "description"
      | "type"
    >
  >,
  profileId: string,
): CommunityProfilePreview | null => {
  const candidates: Array<{
    createdAt: string | null | undefined;
    preview: CommunityProfilePreview | null;
  }> = [];

  services
    .filter((row) => row.provider_id === profileId)
    .forEach((row) => {
      const metadataMedia = mediaFromMarketplaceComposerMetadata(row.metadata);
      const imageUrl =
        metadataMedia[0]?.url || resolveListingImageUrl(row.image_url || null);
      if (!imageUrl) return;
      candidates.push({
        createdAt: row.created_at,
        preview: {
          imageUrl,
          mediaCount: Math.max(metadataMedia.length, imageUrl ? 1 : 0),
          title: row.title || null,
          source: "service",
        },
      });
    });

  products
    .filter((row) => row.provider_id === profileId)
    .forEach((row) => {
      const metadataMedia = mediaFromMarketplaceComposerMetadata(row.metadata);
      const imageUrl =
        metadataMedia[0]?.url || resolveListingImageUrl(row.image_url || null);
      if (!imageUrl) return;
      candidates.push({
        createdAt: row.created_at,
        preview: {
          imageUrl,
          mediaCount: Math.max(metadataMedia.length, imageUrl ? 1 : 0),
          title: row.title || null,
          source: "product",
        },
      });
    });

  posts
    .filter((row) => {
      const ownerId =
        row.user_id || row.author_id || row.created_by || row.provider_id || "";
      return ownerId === profileId;
    })
    .forEach((row) => {
      const metadataMedia = mediaFromMarketplaceComposerMetadata(row.metadata);
      const parsed = parseMarketplacePostText(
        row.description || row.title || "",
      );
      const imageUrl = metadataMedia[0]?.url || parsed.media[0]?.url || null;
      if (!imageUrl) return;
      candidates.push({
        createdAt: row.created_at,
        preview: {
          imageUrl,
          mediaCount: Math.max(
            metadataMedia.length,
            parsed.media.length,
            imageUrl ? 1 : 0,
          ),
          title: row.title || parsed.title || null,
          source: "post",
        },
      });
    });

  candidates.sort((left, right) => {
    const leftMs = Date.parse(left.createdAt || "");
    const rightMs = Date.parse(right.createdAt || "");
    return (
      (Number.isFinite(rightMs) ? rightMs : 0) -
      (Number.isFinite(leftMs) ? leftMs : 0)
    );
  });

  return candidates[0]?.preview || null;
};

const buildProfileReason = (params: {
  isAcceptedConnection: boolean;
  mutualConnectionsCount: number;
  isOnline: boolean;
  completedJobs: number;
  categoryHint: string;
}) => {
  if (params.isAcceptedConnection) {
    return "Accepted connection with stronger trust and follow-through.";
  }
  if (params.mutualConnectionsCount > 0) {
    return `${params.mutualConnectionsCount} mutual connection${
      params.mutualConnectionsCount === 1 ? "" : "s"
    } nearby.`;
  }
  if (params.isOnline) {
    return "Active now and visible for faster replies.";
  }
  if (params.completedJobs > 0) {
    return `${params.completedJobs} completed jobs signal stronger marketplace trust.`;
  }
  if (params.categoryHint) {
    return `Recommended because ${params.categoryHint} demand is active nearby.`;
  }
  return "Recommended local provider for nearby discovery.";
};

const buildProfilePriorityScore = (params: {
  isAcceptedConnection: boolean;
  mutualConnectionsCount: number;
  isOnline: boolean;
  completionPercent: number;
  completedJobs: number;
  reviewCount: number;
  averageRating: number | null;
}) => {
  let score = 0;
  if (params.isAcceptedConnection) score += 140;
  score += params.mutualConnectionsCount * 18;
  if (params.isOnline) score += 60;
  score += params.completionPercent;
  score += Math.min(params.completedJobs, 20) * 8;
  score += Math.min(params.reviewCount, 12) * 4;
  score += Math.round((params.averageRating || 0) * 12);
  return score;
};

export const loadCommunityFeedSnapshot = async (
  db: SupabaseClient,
  currentUserId: string,
  options: {
    viewerOverride?: { lat: number; lng: number } | null;
    scope?: "connected" | "all";
  } = {},
): Promise<Extract<CommunityFeedResponse, { ok: true }>> => {
  const [currentUserProfileRow, acceptedPeers] = await Promise.all([
    selectProfileById(db, currentUserId),
    listAcceptedConnectionPeerIds(db, currentUserId),
  ]);

  const acceptedPeerIds = Array.from(acceptedPeers);
  const currentUserProfile = currentUserProfileRow
    ? normalizeProfile(currentUserProfileRow)
    : null;
  const viewerRoleFamily = getProfileRoleFamily(currentUserProfile?.role);
  const feedScope = options.scope || "all";

  const [serviceRowsRaw, productRowsRaw, postRowsRaw, helpRequestRowsRaw] =
    await Promise.all([
      selectRowsWithFallback(
        db,
        "service_listings",
        "id,title,description,price,category,provider_id,image_url,metadata,created_at",
        {
          orderBy: { column: "created_at", ascending: false },
          limit: CONNECTED_FEED_LIMIT_PER_TYPE,
        },
      ),
      selectRowsWithFallback(
        db,
        "product_catalog",
        "id,title,description,price,category,provider_id,image_url,image_path,metadata,created_at",
        {
          orderBy: { column: "created_at", ascending: false },
          limit: CONNECTED_FEED_LIMIT_PER_TYPE,
        },
      ),
      selectRowsWithFallback(
        db,
        "posts",
        "id,text,content,description,title,user_id,author_id,created_by,requester_id,owner_id,provider_id,type,post_type,category,status,state,visibility,metadata,created_at",
        {
          orderBy: { column: "created_at", ascending: false },
          limit: CONNECTED_FEED_LIMIT_PER_TYPE,
        },
      ),
      selectRowsWithFallback(
        db,
        "help_requests",
        "id,requester_id,accepted_provider_id,title,details,category,urgency,budget_min,budget_max,location_label,latitude,longitude,status,metadata,created_at",
        {
          orderBy: { column: "created_at", ascending: false },
          limit: CONNECTED_FEED_LIMIT_PER_TYPE,
          allowMissingRelation: true,
        },
      ),
    ]);

  const services = serviceRowsRaw
    .map((row, index) => normalizeService(row, index))
    .filter((row): row is CommunityServiceRecord => !!row)
    .filter(
      (row) =>
        feedScope === "all" ||
        row.provider_id === currentUserId ||
        acceptedPeers.has(row.provider_id),
    );
  const products = productRowsRaw
    .map((row, index) => normalizeProduct(row, index))
    .filter((row): row is CommunityProductRecord => !!row)
    .filter(
      (row) =>
        feedScope === "all" ||
        row.provider_id === currentUserId ||
        acceptedPeers.has(row.provider_id),
    );
  const posts = postRowsRaw
    .map((row, index) => normalizePost(row, index))
    .filter((row): row is CommunityPostRecord => !!row)
    .filter((post) => isPostVisibleToViewer(post, currentUserId, acceptedPeers))
    .filter((post) => {
      if (feedScope === "all") return true;
      const ownerId =
        post.user_id ||
        post.author_id ||
        post.created_by ||
        post.requester_id ||
        post.owner_id ||
        post.provider_id ||
        "";
      return ownerId === currentUserId || acceptedPeers.has(ownerId);
    });
  const helpRequests = helpRequestRowsRaw
    .map((row, index) => normalizeHelpRequest(row, index))
    .filter((row): row is CommunityHelpRequestRecord => !!row)
    .filter(
      (row) =>
        isVisibleStatus(row.status || "open") ||
        isRelistedHelpRequest(row.metadata),
    )
    .filter((row) => !row.accepted_provider_id)
    .filter((row) => {
      const requesterId = row.requester_id || "";
      return (
        feedScope === "all" ||
        requesterId === currentUserId ||
        acceptedPeers.has(requesterId)
      );
    });

  const viewerHelpRequestIds = Array.from(
    new Set(helpRequests.map((row) => row.id).filter(Boolean)),
  );
  const viewerMatchRowsRaw =
    viewerHelpRequestIds.length > 0
      ? await selectRowsWithFallback(
          db,
          "help_request_matches",
          "help_request_id,status",
          {
            allowMissingRelation: true,
            eqFilters: [{ column: "provider_id", value: currentUserId }],
            inFilter: {
              column: "help_request_id",
              values: viewerHelpRequestIds,
            },
          },
        )
      : [];
  const viewerMatchStatusByHelpRequestId = viewerMatchRowsRaw.reduce<
    Record<string, MarketplaceNeedMatchStatus>
  >((current, row) => {
    const helpRequestId = stringFromRow(row, ["help_request_id"], "");
    const matchStatus = normalizeMarketplaceNeedMatchStatus(
      stringFromRow(row, ["status"], ""),
    );
    if (helpRequestId && matchStatus) {
      current[helpRequestId] = matchStatus;
    }

    return current;
  }, {});

  const profileIds = Array.from(
    new Set(
      [
        currentUserId,
        ...services.map((row) => row.provider_id),
        ...products.map((row) => row.provider_id),
        ...posts
          .map(
            (row) =>
              row.user_id ||
              row.author_id ||
              row.created_by ||
              row.requester_id ||
              row.owner_id ||
              row.provider_id ||
              "",
          )
          .filter(Boolean),
        ...helpRequests.map((row) => row.requester_id || "").filter(Boolean),
      ].filter(Boolean),
    ),
  );

  const [
    profileRowsRaw,
    reviewRowsRaw,
    presenceRowsRaw,
    providerOrderStatsResult,
    savedRowsRaw,
    feedbackRowsRaw,
    connectionGraph,
  ] = await Promise.all([
    selectProfilesByIds(db, profileIds),
    profileIds.length
      ? selectRowsWithFallback(db, "reviews", "provider_id,rating", {
          allowMissingRelation: true,
          inFilter: { column: "provider_id", values: profileIds },
        })
      : Promise.resolve([]),
    profileIds.length
      ? selectRowsWithFallback(
          db,
          "provider_presence",
          "provider_id,is_online,availability,response_sla_minutes,rolling_response_minutes,last_seen",
          { allowMissingRelation: true },
        ).then((rows) =>
          rows.filter((row) =>
            profileIds.includes(stringFromRow(row, ["provider_id"], "")),
          ),
        )
      : Promise.resolve([]),
    profileIds.length
      ? db
          .rpc("get_provider_order_stats", { provider_ids: profileIds })
          .then((result) => {
            if (result.error) {
              if (isMissingRelationError(result.error.message || "")) {
                return [] as FlexibleRow[];
              }
              throw new Error(result.error.message);
            }
            return toFlexibleRows(result.data);
          })
      : Promise.resolve([]),
    selectRowsWithFallback(db, "feed_card_saves", "card_id", {
      allowMissingRelation: true,
      eqFilters: [{ column: "user_id", value: currentUserId }],
      orderBy: { column: "created_at", ascending: false },
      limit: 500,
    }),
    selectRowsWithFallback(
      db,
      "feed_card_feedback",
      "card_id,focus_id,feedback_type",
      {
        allowMissingRelation: true,
        eqFilters: [{ column: "user_id", value: currentUserId }],
        orderBy: { column: "created_at", ascending: false },
        limit: 500,
      },
    ),
    buildAcceptedConnectionGraph(db, [
      currentUserId,
      ...acceptedPeerIds,
      ...profileIds,
    ]),
  ]);

  const profileMap = new Map<string, CommunityProfileRecord>();
  profileRowsRaw.forEach((row) => {
    const normalized = normalizeProfile(row);
    if (normalized) {
      profileMap.set(normalized.id, normalized);
    }
  });

  const snapshot: Parameters<typeof buildCommunityFeedView>[0] = {
    currentUserId,
    acceptedConnectionIds: acceptedPeerIds,
    currentUserProfile,
    services,
    products,
    posts,
    helpRequests,
    profiles: Array.from(profileMap.values()),
    reviews: reviewRowsRaw
      .map((row) => normalizeReview(row))
      .filter((row): row is CommunityReviewRecord => !!row),
    presence: presenceRowsRaw
      .map((row) => normalizePresence(row))
      .filter((row): row is CommunityPresenceRecord => !!row),
    orderStats: providerOrderStatsResult
      .map((row) => normalizeOrderStats(row))
      .filter((row): row is CommunityOrderStatsRecord => !!row),
    viewerMatchStatusByHelpRequestId,
    viewerRoleFamily,
    connectionGraph,
    savedCardIds: new Set(
      savedRowsRaw
        .map((row) => stringFromRow(row, ["card_id"], ""))
        .filter(Boolean),
    ),
    hiddenCardIds: new Set(
      feedbackRowsRaw
        .filter(
          (row) =>
            stringFromRow(row, ["feedback_type"], "").toLowerCase() === "hide",
        )
        .map((row) => stringFromRow(row, ["card_id"], ""))
        .filter(Boolean),
    ),
    hiddenFocusIds: new Set(
      feedbackRowsRaw
        .filter(
          (row) =>
            stringFromRow(row, ["feedback_type"], "").toLowerCase() === "hide",
        )
        .map((row) => stringFromRow(row, ["focus_id"], ""))
        .filter(Boolean),
    ),
  };

  const responseSnapshot = Object.fromEntries(
    Object.entries(snapshot).filter(
      ([key]) =>
        ![
          "viewerMatchStatusByHelpRequestId",
          "viewerRoleFamily",
          "connectionGraph",
          "savedCardIds",
          "hiddenCardIds",
          "hiddenFocusIds",
        ].includes(key),
    ),
  ) as Omit<
    typeof snapshot,
    | "viewerMatchStatusByHelpRequestId"
    | "viewerRoleFamily"
    | "connectionGraph"
    | "savedCardIds"
    | "hiddenCardIds"
    | "hiddenFocusIds"
  >;
  const communityView = buildCommunityFeedView(
    snapshot,
    options.viewerOverride || null,
  );
  const trustedFeedCount = communityView.feedItems.filter(
    (item) => item.sourceType === "accepted_connection",
  ).length;
  const earnableDemandCount = communityView.feedItems.filter(
    (item) => item.type === "demand" && item.viewerRoleFit === "earn",
  ).length;
  const defaultHomeSurface =
    acceptedPeerIds.length === 0
      ? "trusted"
      : viewerRoleFamily === "provider" && earnableDemandCount > 0
        ? "earn"
        : trustedFeedCount >= 3
          ? "trusted"
          : "for_you";
  const defaultHomeReason =
    defaultHomeSurface === "trusted"
      ? acceptedPeerIds.length === 0
        ? "Grow accepted connections first so Home gets more trustworthy."
        : "Your network is active enough to lead the Home experience."
      : defaultHomeSurface === "earn"
        ? "You are set up like a provider, so live demand gets priority."
        : "A blended feed is the best starting point for this account.";

  return {
    ok: true,
    ...responseSnapshot,
    viewerRoleFamily,
    savedCardIds: Array.from(snapshot.savedCardIds || []),
    defaultHomeSurface,
    defaultHomeReason,
    ...communityView,
  };
};

export const loadCommunityPeopleSnapshot = async (
  db: SupabaseClient,
  currentUserId: string,
): Promise<Extract<CommunityPeopleResponse, { ok: true }>> => {
  const [
    currentUserProfileRow,
    discoverableProfileRowsRaw,
    serviceRowsRaw,
    productRowsRaw,
    postRowsRaw,
    helpRequestRowsRaw,
  ] = await Promise.all([
    selectProfileById(db, currentUserId),
    selectRowsWithFallback(db, "profiles", "*", {
      orderBy: { column: "updated_at", ascending: false },
      limit: 200,
    }),
    selectRowsWithFallback(
      db,
      "service_listings",
      "provider_id,category,price,image_url,metadata,created_at,title",
      {
        allowMissingRelation: true,
      },
    ),
    selectRowsWithFallback(
      db,
      "product_catalog",
      "provider_id,category,price,image_url,metadata,created_at,title",
      {
        allowMissingRelation: true,
      },
    ),
    selectRowsWithFallback(
      db,
      "posts",
      "user_id,author_id,created_by,provider_id,category,status,state,visibility,metadata,created_at,title,description,type",
      { allowMissingRelation: true },
    ),
    selectRowsWithFallback(
      db,
      "help_requests",
      "requester_id,category,budget_min,budget_max,status",
      {
        allowMissingRelation: true,
      },
    ),
  ]);

  const services = serviceRowsRaw
    .map((row, index) => normalizeService(row, index))
    .filter((row): row is CommunityServiceRecord => !!row)
    .map((row) => ({
      provider_id: row.provider_id,
      category: row.category,
      price: row.price,
      image_url: row.image_url,
      metadata: row.metadata,
      created_at: row.created_at,
      title: row.title,
    }));
  const products = productRowsRaw
    .map((row, index) => normalizeProduct(row, index))
    .filter((row): row is CommunityProductRecord => !!row)
    .map((row) => ({
      provider_id: row.provider_id,
      category: row.category,
      price: row.price,
      image_url: row.image_url,
      metadata: row.metadata,
      created_at: row.created_at,
      title: row.title,
    }));
  const acceptedPeers = await listAcceptedConnectionPeerIds(db, currentUserId);
  const acceptedPeerIds = Array.from(acceptedPeers);
  const posts = postRowsRaw
    .map((row, index) => normalizePost(row, index))
    .filter((row): row is CommunityPostRecord => !!row)
    .filter((row) => isPostVisibleToViewer(row, currentUserId, acceptedPeers))
    .map((row) => ({
      user_id: row.user_id,
      author_id: row.author_id,
      created_by: row.created_by,
      provider_id: row.provider_id,
      category: row.category,
      status: row.status,
      state: row.state,
      metadata: row.metadata,
      created_at: row.created_at,
      title: row.title,
      description: row.description,
      type: row.type,
    }));
  const helpRequests = helpRequestRowsRaw
    .map((row, index) => normalizeHelpRequest(row, index))
    .filter((row): row is CommunityHelpRequestRecord => !!row)
    .filter(
      (row) =>
        isVisibleStatus(row.status || "open") ||
        isRelistedHelpRequest(row.metadata),
    )
    .map((row) => ({
      requester_id: row.requester_id,
      category: row.category,
      budget_min: row.budget_min,
      budget_max: row.budget_max,
      status: row.status,
    }));

  const activeMemberIds = new Set<string>(
    [
      ...services.map((row) => row.provider_id),
      ...products.map((row) => row.provider_id),
      ...posts
        .map(
          (row) =>
            row.user_id ||
            row.author_id ||
            row.created_by ||
            row.provider_id ||
            "",
        )
        .filter(Boolean),
      ...helpRequests.map((row) => row.requester_id || "").filter(Boolean),
    ].filter(Boolean),
  );

  const normalizedProfiles = discoverableProfileRowsRaw
    .map((row) => normalizeProfile(row))
    .filter((row): row is CommunityProfileRecord => !!row)
    .filter((profile) =>
      shouldIncludeDiscoverableProfile(profile, currentUserId, activeMemberIds),
    );

  const currentUserProfile = currentUserProfileRow
    ? normalizeProfile(currentUserProfileRow)
    : null;
  const viewerRoleFamily = getProfileRoleFamily(currentUserProfile?.role);

  const memberIds = Array.from(
    new Set(
      [
        ...normalizedProfiles.map((profile) => profile.id),
        ...Array.from(activeMemberIds),
        currentUserId,
      ].filter(Boolean),
    ),
  );

  const [
    reviewsResult,
    presenceResult,
    providerOrderStatsResult,
    connectionGraph,
  ] = await Promise.all([
    memberIds.length
      ? selectRowsWithFallback(db, "reviews", "provider_id,rating", {
          allowMissingRelation: true,
          inFilter: { column: "provider_id", values: memberIds },
        })
      : Promise.resolve([]),
    memberIds.length
      ? selectRowsWithFallback(
          db,
          "provider_presence",
          "provider_id,is_online,availability,response_sla_minutes,rolling_response_minutes,last_seen",
          { allowMissingRelation: true },
        ).then((rows) =>
          rows.filter((row) =>
            memberIds.includes(stringFromRow(row, ["provider_id"], "")),
          ),
        )
      : Promise.resolve([]),
    memberIds.length
      ? db
          .rpc("get_provider_order_stats", { provider_ids: memberIds })
          .then((result) => {
            if (result.error) {
              if (isMissingRelationError(result.error.message || "")) {
                return [] as FlexibleRow[];
              }
              throw new Error(result.error.message);
            }
            return toFlexibleRows(result.data);
          })
      : Promise.resolve([]),
    buildAcceptedConnectionGraph(db, [
      currentUserId,
      ...acceptedPeerIds,
      ...memberIds,
    ]),
  ]);

  const presenceByProfileId = new Map<string, CommunityPresenceRecord>();
  presenceResult
    .map((row) => normalizePresence(row))
    .filter((row): row is CommunityPresenceRecord => !!row)
    .forEach((row) => {
      presenceByProfileId.set(row.provider_id, row);
    });

  const reviewStatsByProfileId = new Map<
    string,
    { total: number; count: number }
  >();
  reviewsResult
    .map((row) => normalizeReview(row))
    .filter((row): row is CommunityReviewRecord => !!row)
    .forEach((row) => {
      if (!row.provider_id || typeof row.rating !== "number") return;
      const current = reviewStatsByProfileId.get(row.provider_id) || {
        total: 0,
        count: 0,
      };
      reviewStatsByProfileId.set(row.provider_id, {
        total: current.total + row.rating,
        count: current.count + 1,
      });
    });

  const orderStatsByProfileId = new Map<string, CommunityOrderStatsRecord>();
  providerOrderStatsResult
    .map((row) => normalizeOrderStats(row))
    .filter((row): row is CommunityOrderStatsRecord => !!row)
    .forEach((row) => {
      orderStatsByProfileId.set(row.provider_id, row);
    });

  const mutualConnectionsByProfileId: Record<string, number> = {};
  const profileReasonsById: Record<string, string> = {};
  const priorityScoreByProfileId: Record<string, number> = {};
  const profilePreviewById: Record<string, CommunityProfilePreview> = {};

  normalizedProfiles.forEach((profile) => {
    if (profile.id === currentUserId) return;

    const profileConnections =
      connectionGraph.get(profile.id) || new Set<string>();
    const mutualConnectionsCount = countMutualConnections(
      acceptedPeers,
      profileConnections,
      {
        exclude: [currentUserId, profile.id],
      },
    );
    const isAcceptedConnection = acceptedPeers.has(profile.id);
    const presence = presenceByProfileId.get(profile.id);
    const reviewStats = reviewStatsByProfileId.get(profile.id);
    const averageRating = reviewStats?.count
      ? reviewStats.total / reviewStats.count
      : null;
    const reviewCount = reviewStats?.count || 0;
    const orderStats = orderStatsByProfileId.get(profile.id);
    const completedJobs =
      typeof orderStats?.completed_jobs === "number"
        ? orderStats.completed_jobs
        : Number(orderStats?.completed_jobs || 0);
    const categoryHint =
      services.find((row) => row.provider_id === profile.id)?.category ||
      products.find((row) => row.provider_id === profile.id)?.category ||
      posts.find((row) => {
        const ownerId =
          row.user_id ||
          row.author_id ||
          row.created_by ||
          row.provider_id ||
          "";
        return ownerId === profile.id;
      })?.category ||
      "";

    mutualConnectionsByProfileId[profile.id] = mutualConnectionsCount;
    profileReasonsById[profile.id] = buildProfileReason({
      isAcceptedConnection,
      mutualConnectionsCount,
      isOnline: presence?.is_online === true,
      completedJobs: Number.isFinite(completedJobs) ? completedJobs : 0,
      categoryHint,
    });
    priorityScoreByProfileId[profile.id] = buildProfilePriorityScore({
      isAcceptedConnection,
      mutualConnectionsCount,
      isOnline: presence?.is_online === true,
      completionPercent: profile.profile_completion_percent || 0,
      completedJobs: Number.isFinite(completedJobs) ? completedJobs : 0,
      reviewCount,
      averageRating,
    });

    const preview = resolveProfilePreview(
      services,
      products,
      posts,
      profile.id,
    );
    if (preview) {
      profilePreviewById[profile.id] = preview;
    }
  });

  return {
    ok: true,
    currentUserId,
    acceptedConnectionIds: acceptedPeerIds,
    viewerRoleFamily,
    mutualConnectionsByProfileId,
    profileReasonsById,
    priorityScoreByProfileId,
    profilePreviewById,
    profiles: normalizedProfiles,
    services,
    products,
    posts,
    helpRequests,
    reviews: reviewsResult
      .map((row) => normalizeReview(row))
      .filter((row): row is CommunityReviewRecord => !!row),
    presence: presenceResult
      .map((row) => normalizePresence(row))
      .filter((row): row is CommunityPresenceRecord => !!row),
    orderStats: providerOrderStatsResult
      .map((row) => normalizeOrderStats(row))
      .filter((row): row is CommunityOrderStatsRecord => !!row),
  };
};
