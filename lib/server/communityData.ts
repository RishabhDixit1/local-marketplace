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
  CommunityReviewRecord,
  CommunityServiceRecord,
} from "@/lib/api/community";
import { buildCommunityFeedView } from "@/lib/server/communityFeedView";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { listAcceptedConnectionPeerIds } from "@/lib/server/chatGuards";

type FlexibleRow = Record<string, unknown>;

const isFlexibleRow = (value: unknown): value is FlexibleRow =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toFlexibleRow = (value: unknown): FlexibleRow | null => (isFlexibleRow(value) ? value : null);

const toFlexibleRows = (value: unknown): FlexibleRow[] =>
  Array.isArray(value) ? value.map((item) => toFlexibleRow(item)).filter((item): item is FlexibleRow => !!item) : [];

const isMissingColumnError = (message: string) =>
  /column .* does not exist|could not find the '.*' column/i.test(message);

const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|could not find the table '.*' in the schema cache/i.test(
    message
  );

const trim = (value: unknown) => (typeof value === "string" ? value.trim() : "");

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

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim())
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
  } = {}
): Promise<FlexibleRow[]> => {
  let primaryQuery = db.from(table).select(primarySelect);

  if (options.inFilter?.column && options.inFilter.values.length > 0) {
    primaryQuery = primaryQuery.in(options.inFilter.column, options.inFilter.values);
  }

  if (options.orFilter) {
    primaryQuery = primaryQuery.or(options.orFilter);
  }

  if (options.orderBy?.column) {
    primaryQuery = primaryQuery.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false });
  }

  if (typeof options.limit === "number" && options.limit > 0) {
    primaryQuery = primaryQuery.limit(options.limit);
  }

  const primaryResult = await primaryQuery;

  if (!primaryResult.error) {
    return toFlexibleRows(primaryResult.data);
  }

  if (options.allowMissingRelation && isMissingRelationError(primaryResult.error.message || "")) {
    return [];
  }

  if (!isMissingColumnError(primaryResult.error.message || "")) {
    throw new Error(primaryResult.error.message);
  }

  let fallbackQuery = db.from(table).select("*");

  if (options.inFilter?.column && options.inFilter.values.length > 0) {
    fallbackQuery = fallbackQuery.in(options.inFilter.column, options.inFilter.values);
  }

  if (options.orFilter) {
    fallbackQuery = fallbackQuery.or(options.orFilter);
  }

  if (options.orderBy?.column) {
    fallbackQuery = fallbackQuery.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? false });
  }

  if (typeof options.limit === "number" && options.limit > 0) {
    fallbackQuery = fallbackQuery.limit(options.limit);
  }

  const fallbackResult = await fallbackQuery;

  if (fallbackResult.error) {
    if (options.allowMissingRelation && isMissingRelationError(fallbackResult.error.message || "")) {
      return [];
    }
    throw new Error(fallbackResult.error.message);
  }

  return toFlexibleRows(fallbackResult.data);
};

const CONNECTED_FEED_LIMIT_PER_TYPE = 180;

const selectProfileById = async (db: SupabaseClient, userId: string) => {
  if (!userId) return null;

  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error && !isMissingColumnError(error.message || "")) {
    throw new Error(error.message);
  }
  return toFlexibleRow(data);
};

const selectProfilesByIds = async (db: SupabaseClient, profileIds: string[]) => {
  if (!profileIds.length) return [] as FlexibleRow[];

  const { data, error } = await db.from("profiles").select("*").in("id", profileIds);
  if (error && !isMissingColumnError(error.message || "")) {
    throw new Error(error.message);
  }

  return toFlexibleRows(data);
};

const normalizeProfile = (row: FlexibleRow): CommunityProfileRecord | null => {
  const id = stringFromRow(row, ["id", "user_id"], "");
  if (!id) return null;

  const profileCompletion = numberFromRow(row, ["profile_completion_percent"], Number.NaN);
  const avatarUrl = resolveProfileAvatarUrl(stringFromRow(row, ["avatar_url", "avatar", "image_url"], ""));

  return {
    id,
    name: stringFromRow(row, ["full_name", "display_name", "name"], "") || null,
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
      const value = numberFromRow(row, ["longitude", "lng", "long"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    onboarding_completed: typeof row.onboarding_completed === "boolean" ? row.onboarding_completed : null,
    profile_completion_percent: Number.isFinite(profileCompletion) ? profileCompletion : null,
    created_at: stringFromRow(row, ["created_at"], "") || null,
    updated_at: stringFromRow(row, ["updated_at"], "") || null,
  };
};

const normalizeService = (row: FlexibleRow, index: number): CommunityServiceRecord | null => {
  const providerId = stringFromRow(row, ["provider_id", "user_id", "created_by", "owner_id"], "");
  if (!providerId) return null;

  return {
    id: stringFromRow(row, ["id"], `service-${index}`),
    title: stringFromRow(row, ["title", "name", "service_title"], "Local service"),
    description: stringFromRow(row, ["description", "details", "text"], "Service listing"),
    price: numberFromRow(row, ["price", "amount", "rate"], 0),
    category: stringFromRow(row, ["category", "service_category", "type"], "Service"),
    provider_id: providerId,
    image_url: stringFromRow(row, ["image_url"], "") || null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: stringFromRow(row, ["created_at", "createdAt"], "") || null,
  };
};

const normalizeProduct = (row: FlexibleRow, index: number): CommunityProductRecord | null => {
  const providerId = stringFromRow(row, ["provider_id", "user_id", "created_by", "owner_id"], "");
  if (!providerId) return null;

  return {
    id: stringFromRow(row, ["id"], `product-${index}`),
    title: stringFromRow(row, ["title", "name", "product_name"], "Local product"),
    description: stringFromRow(row, ["description", "details", "text"], "Product listing"),
    price: numberFromRow(row, ["price", "amount", "mrp"], 0),
    category: stringFromRow(row, ["category", "product_category", "type"], "Product"),
    provider_id: providerId,
    image_url: stringFromRow(row, ["image_url"], "") || null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: stringFromRow(row, ["created_at", "createdAt"], "") || null,
  };
};

const normalizePost = (row: FlexibleRow, index: number): CommunityPostRecord | null => {
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
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
    created_at: stringFromRow(row, ["created_at", "createdAt"], "") || null,
  };
};

const normalizeHelpRequest = (row: FlexibleRow, index: number): CommunityHelpRequestRecord | null => {
  const requesterId = stringFromRow(row, ["requester_id", "user_id", "created_by"], "");
  if (!requesterId) return null;

  return {
    id: stringFromRow(row, ["id"], `help-request-${index}`),
    requester_id: requesterId,
    accepted_provider_id: stringFromRow(row, ["accepted_provider_id"], "") || null,
    title: stringFromRow(row, ["title", "name"], "") || null,
    details: stringFromRow(row, ["details", "description", "text"], "") || null,
    category: stringFromRow(row, ["category"], "Need"),
    urgency: stringFromRow(row, ["urgency"], "") || null,
    budget_min: numberFromRow(row, ["budget_min", "budget"], 0),
    budget_max: numberFromRow(row, ["budget_max"], 0),
    location_label: stringFromRow(row, ["location_label", "location"], "") || null,
    latitude: (() => {
      const value = numberFromRow(row, ["latitude", "lat"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    longitude: (() => {
      const value = numberFromRow(row, ["longitude", "lng", "long"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    status: stringFromRow(row, ["status"], "") || null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
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

const normalizePresence = (row: FlexibleRow): CommunityPresenceRecord | null => {
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
      const value = numberFromRow(row, ["rolling_response_minutes"], Number.NaN);
      return Number.isFinite(value) ? value : null;
    })(),
    last_seen: stringFromRow(row, ["last_seen"], "") || null,
  };
};

const normalizeOrderStats = (row: FlexibleRow): CommunityOrderStatsRecord | null => {
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
  return !["cancelled", "canceled", "closed", "completed", "fulfilled", "archived", "deleted", "draft", "hidden"].includes(
    status
  );
};

const isPostVisibleToViewer = (post: CommunityPostRecord, viewerId: string, acceptedPeers: Set<string>) => {
  const ownerId =
    post.user_id || post.author_id || post.created_by || post.requester_id || post.owner_id || post.provider_id || "";
  const visibility = trim(post.visibility).toLowerCase() || "public";
  const postKind = trim(post.post_type || post.type).toLowerCase();
  const metadataSource =
    post.metadata && typeof post.metadata === "object" && !Array.isArray(post.metadata)
      ? trim((post.metadata as Record<string, unknown>).source).toLowerCase()
      : "";
  const isComposerOfferPost =
    metadataSource === "serviq_compose" && (postKind === "service" || postKind === "product");

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
  activeMemberIds: Set<string>
) => {
  if (profile.id === viewerId) return true;
  if (activeMemberIds.has(profile.id)) return true;
  if (profile.onboarding_completed) return true;
  if ((profile.profile_completion_percent || 0) >= 60) return true;

  return Boolean(profile.name || profile.bio || profile.location);
};

export const loadCommunityFeedSnapshot = async (
  db: SupabaseClient,
  currentUserId: string,
  options: {
    viewerOverride?: { lat: number; lng: number } | null;
    scope?: "connected" | "all";
  } = {}
): Promise<Extract<CommunityFeedResponse, { ok: true }>> => {
  const [currentUserProfileRow, acceptedPeers] = await Promise.all([
    selectProfileById(db, currentUserId),
    listAcceptedConnectionPeerIds(db, currentUserId),
  ]);

  const acceptedPeerIds = Array.from(acceptedPeers);
  const feedScope = options.scope || "all";

  const [serviceRowsRaw, productRowsRaw, postRowsRaw, helpRequestRowsRaw] = await Promise.all([
    selectRowsWithFallback(db, "service_listings", "id,title,description,price,category,provider_id,image_url,metadata,created_at", {
      orderBy: { column: "created_at", ascending: false },
      limit: CONNECTED_FEED_LIMIT_PER_TYPE,
    }),
    selectRowsWithFallback(db, "product_catalog", "id,title,description,price,category,provider_id,image_url,metadata,created_at", {
      orderBy: { column: "created_at", ascending: false },
      limit: CONNECTED_FEED_LIMIT_PER_TYPE,
    }),
    selectRowsWithFallback(
      db,
      "posts",
      "id,text,content,description,title,user_id,author_id,created_by,requester_id,owner_id,provider_id,type,post_type,category,status,state,visibility,metadata,created_at",
      {
        orderBy: { column: "created_at", ascending: false },
        limit: CONNECTED_FEED_LIMIT_PER_TYPE,
      }
    ),
    selectRowsWithFallback(
      db,
      "help_requests",
      "id,requester_id,accepted_provider_id,title,details,category,urgency,budget_min,budget_max,location_label,latitude,longitude,status,metadata,created_at",
      {
        orderBy: { column: "created_at", ascending: false },
        limit: CONNECTED_FEED_LIMIT_PER_TYPE,
        allowMissingRelation: true,
      }
    ),
  ]);

  const services = serviceRowsRaw
    .map((row, index) => normalizeService(row, index))
    .filter((row): row is CommunityServiceRecord => !!row)
    .filter((row) => feedScope === "all" || row.provider_id === currentUserId || acceptedPeers.has(row.provider_id));
  const products = productRowsRaw
    .map((row, index) => normalizeProduct(row, index))
    .filter((row): row is CommunityProductRecord => !!row)
    .filter((row) => feedScope === "all" || row.provider_id === currentUserId || acceptedPeers.has(row.provider_id));
  const posts = postRowsRaw
    .map((row, index) => normalizePost(row, index))
    .filter((row): row is CommunityPostRecord => !!row)
    .filter((post) => isPostVisibleToViewer(post, currentUserId, acceptedPeers))
    .filter((post) => {
      if (feedScope === "all") return true;
      const ownerId = post.user_id || post.author_id || post.created_by || post.requester_id || post.owner_id || post.provider_id || "";
      return ownerId === currentUserId || acceptedPeers.has(ownerId);
    });
  const helpRequests = helpRequestRowsRaw
    .map((row, index) => normalizeHelpRequest(row, index))
    .filter((row): row is CommunityHelpRequestRecord => !!row)
    .filter((row) => isVisibleStatus(row.status || "open"))
    .filter((row) => !row.accepted_provider_id)
    .filter((row) => feedScope === "all" || row.requester_id === currentUserId || acceptedPeers.has(row.requester_id));

  const profileIds = Array.from(
    new Set(
      [
        currentUserId,
        ...services.map((row) => row.provider_id),
        ...products.map((row) => row.provider_id),
        ...posts
          .map(
            (row) =>
              row.user_id || row.author_id || row.created_by || row.requester_id || row.owner_id || row.provider_id || ""
          )
          .filter(Boolean),
        ...helpRequests.map((row) => row.requester_id || "").filter(Boolean),
      ].filter(Boolean)
    )
  );

  const [profileRowsRaw, reviewRowsRaw, presenceRowsRaw] = await Promise.all([
    selectProfilesByIds(db, profileIds),
    profileIds.length
      ? selectRowsWithFallback(db, "reviews", "provider_id,rating", {
          allowMissingRelation: true,
        }).then((rows) => rows.filter((row) => profileIds.includes(stringFromRow(row, ["provider_id"], ""))))
      : Promise.resolve([]),
    profileIds.length
      ? selectRowsWithFallback(
          db,
          "provider_presence",
          "provider_id,is_online,availability,response_sla_minutes,rolling_response_minutes,last_seen",
          { allowMissingRelation: true }
        ).then((rows) => rows.filter((row) => profileIds.includes(stringFromRow(row, ["provider_id"], ""))))
      : Promise.resolve([]),
  ]);

  const profileMap = new Map<string, CommunityProfileRecord>();
  profileRowsRaw.forEach((row) => {
    const normalized = normalizeProfile(row);
    if (normalized) {
      profileMap.set(normalized.id, normalized);
    }
  });

  const snapshot: Omit<Extract<CommunityFeedResponse, { ok: true }>, "feedItems" | "feedStats" | "mapCenter"> = {
    ok: true,
    currentUserId,
    acceptedConnectionIds: acceptedPeerIds,
    currentUserProfile: currentUserProfileRow ? normalizeProfile(currentUserProfileRow) : null,
    services,
    products,
    posts,
    helpRequests,
    profiles: Array.from(profileMap.values()),
    reviews: reviewRowsRaw.map((row) => normalizeReview(row)).filter((row): row is CommunityReviewRecord => !!row),
    presence: presenceRowsRaw
      .map((row) => normalizePresence(row))
      .filter((row): row is CommunityPresenceRecord => !!row),
  };

  return {
    ...snapshot,
    ...buildCommunityFeedView(snapshot, options.viewerOverride || null),
  };
};

export const loadCommunityPeopleSnapshot = async (
  db: SupabaseClient,
  currentUserId: string
): Promise<Extract<CommunityPeopleResponse, { ok: true }>> => {
  const [discoverableProfileRowsRaw, serviceRowsRaw, productRowsRaw, postRowsRaw, helpRequestRowsRaw] = await Promise.all([
    selectRowsWithFallback(db, "profiles", "*", {
      orderBy: { column: "updated_at", ascending: false },
      limit: 200,
    }),
    selectRowsWithFallback(db, "service_listings", "provider_id,category,price", { allowMissingRelation: true }),
    selectRowsWithFallback(db, "product_catalog", "provider_id,category,price", { allowMissingRelation: true }),
    selectRowsWithFallback(
      db,
      "posts",
      "user_id,author_id,created_by,provider_id,category,status,state,visibility",
      { allowMissingRelation: true }
    ),
    selectRowsWithFallback(db, "help_requests", "requester_id,category,budget_min,budget_max,status", {
      allowMissingRelation: true,
    }),
  ]);

  const services = serviceRowsRaw
    .map((row, index) => normalizeService(row, index))
    .filter((row): row is CommunityServiceRecord => !!row)
    .map((row) => ({
      provider_id: row.provider_id,
      category: row.category,
      price: row.price,
    }));
  const products = productRowsRaw
    .map((row, index) => normalizeProduct(row, index))
    .filter((row): row is CommunityProductRecord => !!row)
    .map((row) => ({
      provider_id: row.provider_id,
      category: row.category,
      price: row.price,
    }));
  const acceptedPeers = await listAcceptedConnectionPeerIds(db, currentUserId);
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
    }));
  const helpRequests = helpRequestRowsRaw
    .map((row, index) => normalizeHelpRequest(row, index))
    .filter((row): row is CommunityHelpRequestRecord => !!row)
    .filter((row) => isVisibleStatus(row.status || "open"))
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
        .map((row) => row.user_id || row.author_id || row.created_by || row.provider_id || "")
        .filter(Boolean),
      ...helpRequests.map((row) => row.requester_id || "").filter(Boolean),
    ].filter(Boolean)
  );

  const normalizedProfiles = discoverableProfileRowsRaw
    .map((row) => normalizeProfile(row))
    .filter((row): row is CommunityProfileRecord => !!row)
    .filter((profile) => shouldIncludeDiscoverableProfile(profile, currentUserId, activeMemberIds));

  const memberIds = Array.from(
    new Set(
      [...normalizedProfiles.map((profile) => profile.id), ...Array.from(activeMemberIds), currentUserId].filter(Boolean)
    )
  );

  const [reviewsResult, presenceResult, providerOrderStatsResult] = await Promise.all([
    memberIds.length
      ? selectRowsWithFallback(db, "reviews", "provider_id,rating", { allowMissingRelation: true }).then((rows) =>
          rows.filter((row) => memberIds.includes(stringFromRow(row, ["provider_id"], "")))
        )
      : Promise.resolve([]),
    memberIds.length
      ? selectRowsWithFallback(
          db,
          "provider_presence",
          "provider_id,is_online,availability,response_sla_minutes,rolling_response_minutes,last_seen",
          { allowMissingRelation: true }
        ).then((rows) => rows.filter((row) => memberIds.includes(stringFromRow(row, ["provider_id"], ""))))
      : Promise.resolve([]),
    memberIds.length
      ? db.rpc("get_provider_order_stats", { provider_ids: memberIds }).then((result) => {
          if (result.error) {
            if (isMissingRelationError(result.error.message || "")) {
              return [] as FlexibleRow[];
            }
            throw new Error(result.error.message);
          }
          return toFlexibleRows(result.data);
        })
      : Promise.resolve([]),
  ]);

  return {
    ok: true,
    currentUserId,
    profiles: normalizedProfiles,
    services,
    products,
    posts,
    helpRequests,
    reviews: reviewsResult.map((row) => normalizeReview(row)).filter((row): row is CommunityReviewRecord => !!row),
    presence: presenceResult
      .map((row) => normalizePresence(row))
      .filter((row): row is CommunityPresenceRecord => !!row),
    orderStats: providerOrderStatsResult
      .map((row) => normalizeOrderStats(row))
      .filter((row): row is CommunityOrderStatsRecord => !!row),
  };
};
