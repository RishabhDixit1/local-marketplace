import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { withCache, queryCacheKey } from "@/lib/cache/withCache";
import { cleanPersonName } from "@/lib/profile/nameSanitize";

export const runtime = "nodejs";

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type ProvidersFilter = {
  category: string;
  lat: number | null;
  lng: number | null;
  limit: number;
  offset: number;
  minRating: number | null;
  onlineOnly: boolean;
  sortBy: "distance" | "rating" | "jobs" | "response" | "featured";
  search: string;
  radiusKm: number | null;
};

type ProvidersQueryResult = {
  ok: boolean;
  providers: Record<string, unknown>[];
  facets: Record<string, unknown> | null;
  pagination: { total: number; offset: number; limit: number; hasMore: boolean };
  error?: string;
};

async function loadProvidersData(filter: ProvidersFilter): Promise<ProvidersQueryResult> {
  const {
    category, lat: userLat, lng: userLng, limit, offset,
    minRating, onlineOnly, sortBy, search, radiusKm,
  } = filter;

  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const safeOffset = Math.max(offset, 0);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, providers: [], facets: null, pagination: { total: 0, offset: 0, limit: safeLimit, hasMore: false } };
  }

  try {
    const radiusActive =
      radiusKm != null && radiusKm > 0 && userLat != null && userLng != null;

    // Step 1: Get total count (fast with proper indexes)
    let countQuery = admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("role", ["provider", "business"])
      .not("full_name", "is", null)
      .eq("is_test", false);

    if (category) {
      countQuery = countQuery.contains("services", [category]);
    }

    if (search) {
      countQuery = countQuery.or(
        `full_name.ilike.%${search}%,name.ilike.%${search}%,location.ilike.%${search}%,bio.ilike.%${search}%`
      );
    }

    const countResult = await countQuery;
    let totalCount = countResult.count ?? null;
    if (countResult.error) console.error("[providers-by-category] count error:", countResult.error.message);

    // Step 2: Fetch only the page we need (with generous overfetch for in-memory sort stability)
    type ProfileRow = {
      id: string;
      full_name: string | null;
      name: string | null;
      location: string | null;
      latitude: number | null;
      longitude: number | null;
      avatar_url: string | null;
      bio: string | null;
      role: string | null;
      services: string[] | null;
      created_at: string;
      verification_status?: string | null;
    };

    const baseColumns =
      "id, full_name, name, location, latitude, longitude, avatar_url, bio, role, services, created_at, verification_status";

    const buildProfileQuery = () => {
      let q = admin
        .from("profiles")
        .select(baseColumns)
        .in("role", ["provider", "business"])
        .not("full_name", "is", null)
        .eq("is_test", false)
        .order("created_at", { ascending: false });
      if (category) q = q.contains("services", [category]);
      if (search) {
        q = q.or(
          `full_name.ilike.%${search}%,name.ilike.%${search}%,location.ilike.%${search}%,bio.ilike.%${search}%`
        );
      }
      return q;
    };

    let profiles: ProfileRow[] = [];

    if (radiusActive) {
      // A radius filter must see the FULL matching pool: both so the reported
      // total is the true in-radius count and so distance sorting cannot miss
      // an in-radius provider that happens to be old (the default path only
      // considers the newest ~200 rows). Rows are light; pages of 500.
      const PAGE = 500;
      const MAX_ROWS = 2000;
      for (let from = 0; from < MAX_ROWS; from += PAGE) {
        const { data, error } = await buildProfileQuery().range(from, from + PAGE - 1);
        if (error) {
          console.error("[providers-by-category] radius page error:", error.message);
          break;
        }
        if (!data || data.length === 0) break;
        profiles.push(...(data as ProfileRow[]));
        if (data.length < PAGE) break;
      }
      totalCount = profiles.filter((p) => {
        if (p.latitude == null || p.longitude == null) return false;
        return (
          distanceKm(userLat!, userLng!, Number(p.latitude), Number(p.longitude)) <=
          radiusKm!
        );
      }).length;
    } else {
      const fetchLimit = Math.min(safeLimit * 3 + safeOffset, 200);
      const { data, error } = await buildProfileQuery().limit(fetchLimit);
      if (error) {
        return { ok: false, error: error.message, providers: [], facets: null, pagination: { total: 0, offset: 0, limit: safeLimit, hasMore: false } };
      }
      profiles = (data as ProfileRow[]) || [];
    }

    const profileIds = (profiles || []).map((p) => p.id).filter(Boolean);

    if (profileIds.length === 0) {
      return {
        ok: true,
        providers: [],
        facets: {
          categories: [],
          minPrice: null,
          maxPrice: null,
          avgRatingRange: { min: 0, max: 0 },
          totalProviders: 0,
          onlineCount: 0,
        },
        pagination: { total: 0, offset: 0, limit: safeLimit, hasMore: false },
      };
    }

    const BATCH_SIZE = 500;
    const batchInQuery = async <T>(
      table: ReturnType<typeof admin.from>,
      selectCols: string,
      idCol: string,
      ids: string[]
    ): Promise<{ data: T[] | null; error: unknown }> => {
      const results: T[] = [];
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const { data, error } = await table.select(selectCols).in(idCol, batch);
        if (error) return { data: null, error };
        if (data) results.push(...(data as T[]));
      }
      return { data: results, error: null };
    };

    const [servicesResult, reviewsResult, presenceResult, orderStatsResult] = await Promise.all([
      batchInQuery<{ provider_id: string; id: string; title: string; category: string; price: number | null; metadata: unknown }>(
        admin.from("service_listings"),
        "provider_id, id, title, category, price, metadata",
        "provider_id",
        profileIds
      ),
      batchInQuery<{ provider_id: string; rating: number }>(
        admin.from("reviews"),
        "provider_id, rating",
        "provider_id",
        profileIds
      ),
      batchInQuery<{ provider_id: string; is_online: boolean; response_sla_minutes: number; rolling_response_minutes: number }>(
        admin.from("provider_presence"),
        "provider_id, is_online, response_sla_minutes, rolling_response_minutes",
        "provider_id",
        profileIds
      ),
      admin.rpc("get_provider_order_stats", { provider_ids: profileIds }),
    ]);

    const servicesData = (servicesResult.data || []) as Array<{ provider_id: string; id: string; title: string; category: string; price: number | null; metadata: unknown }>;
    const reviewsData = (reviewsResult.data || []) as Array<{ provider_id: string; rating: number }>;
    const presenceData = (presenceResult.data || []) as Array<{ provider_id: string; is_online: boolean; response_sla_minutes: number; rolling_response_minutes: number }>;
    const orderStatsData = orderStatsResult.data || [];

    const serviceMap: Record<string, { id: string; title: string; category: string; price: number | null }[]> = {};
    const priceMap: Record<string, number[]> = {};
    const allPrices: number[] = [];
    const allCategories = new Set<string>();

    for (const s of servicesData || []) {
      if (!serviceMap[s.provider_id]) serviceMap[s.provider_id] = [];
      serviceMap[s.provider_id].push({ id: s.id, title: s.title, category: s.category, price: s.price });
      if (s.category) allCategories.add(s.category);
      if (s.price != null) {
        if (!priceMap[s.provider_id]) priceMap[s.provider_id] = [];
        priceMap[s.provider_id].push(Number(s.price));
        allPrices.push(Number(s.price));
      }
    }

    const ratingMap: Record<string, number[]> = {};
    const allRatings: number[] = [];
    for (const r of reviewsData || []) {
      if (!ratingMap[r.provider_id]) ratingMap[r.provider_id] = [];
      ratingMap[r.provider_id].push(r.rating);
    }

    const presenceMap: Record<string, { isOnline: boolean; responseMinutes: number }> = {};
    for (const p of presenceData || []) {
      presenceMap[p.provider_id] = {
        isOnline: p.is_online ?? false,
        responseMinutes: p.rolling_response_minutes ?? p.response_sla_minutes ?? 30,
      };
    }

    const orderStats = Array.isArray(orderStatsData) ? orderStatsData : [];
    const completedJobsMap: Record<string, number> = {};
    for (const o of orderStats) {
      const record = o as { provider_id?: string; completed_jobs?: number };
      if (record.provider_id && record.completed_jobs != null) {
        completedJobsMap[record.provider_id] = Number(record.completed_jobs);
      }
    }

    let onlineCount = 0;

    const rawProviders = (profiles || []).map((p) => {
      const ratings = ratingMap[p.id] || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      if (avgRating != null && avgRating > 0) allRatings.push(avgRating);
      const prices = priceMap[p.id] || [];
      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
      const pres = presenceMap[p.id];
      const dist =
        p.latitude != null && p.longitude != null && userLat != null && userLng != null
          ? distanceKm(userLat, userLng, Number(p.latitude), Number(p.longitude))
          : null;

      const isOnline = pres?.isOnline ?? false;
      if (isOnline) onlineCount++;

      const pVerificationStatus = (p as Record<string, unknown>).verification_status as string || "unverified";

      return {
        id: p.id,
        name: cleanPersonName(p.full_name || p.name) || "",
        location: p.location || "",
        lat: p.latitude,
        lng: p.longitude,
        avatarUrl: resolveProfileAvatarUrl(p.avatar_url) || "",
        bio: p.bio || "",
        role: p.role || "provider",
        services: p.services || [],
        avgRating,
        reviewCount: ratings.length,
        serviceCount: (serviceMap[p.id] || []).length,
        completedJobs: completedJobsMap[p.id] || 0,
        responseMinutes: pres?.responseMinutes ?? null,
        isOnline,
        priceMin: minPrice,
        priceMax: maxPrice,
        distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
        verified: pVerificationStatus === "verified",
        featured: pVerificationStatus === "verified",
        listings: serviceMap[p.id] || [],
        sortScore: 0,
      };
    });

    let filteredProviders = [...rawProviders];

    if (radiusActive) {
      filteredProviders = filteredProviders.filter(
        (p) => p.distanceKm != null && p.distanceKm <= radiusKm!
      );
    }

    if (minRating != null) {
      filteredProviders = filteredProviders.filter((p) => (p.avgRating || 0) >= minRating);
    }

    if (onlineOnly) {
      filteredProviders = filteredProviders.filter((p) => p.isOnline);
    }

    // "Featured" ordering = verified providers first, then by average
    // rating descending. Verified status is the same signal that drives the
    // Verified badge, so a provider only earns the Featured slot if it is
    // genuinely verified.
    filteredProviders.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return (b.avgRating || 0) - (a.avgRating || 0);
        case "jobs":
          return b.completedJobs - a.completedJobs;
        case "response":
          return (a.responseMinutes || 60) - (b.responseMinutes || 60);
        case "featured":
          if (a.verified !== b.verified) return a.verified ? -1 : 1;
          return (b.avgRating || 0) - (a.avgRating || 0);
        case "distance":
        default:
          const da = a.distanceKm ?? Infinity;
          const db = b.distanceKm ?? Infinity;
          if (da !== db) return da - db;
          if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
          if (a.completedJobs !== b.completedJobs) return b.completedJobs - a.completedJobs;
          return (b.avgRating || 0) - (a.avgRating || 0);
      }
    });

    const categories: { category: string; count: number }[] = [];
    const categoryCounts: Record<string, number> = {};
    for (const p of filteredProviders) {
      for (const s of p.services) {
        categoryCounts[s] = (categoryCounts[s] || 0) + 1;
      }
    }
    for (const [cat, count] of Object.entries(categoryCounts)) {
      categories.push({ category: cat, count });
    }
    categories.sort((a, b) => b.count - a.count);

    const filteredPrices = filteredProviders
      .filter((p) => p.priceMin != null)
      .flatMap((p) => [p.priceMin!, p.priceMax!].filter(Boolean) as number[]);

    const total = totalCount ?? rawProviders.length;
    const paginatedProviders = filteredProviders.slice(safeOffset, safeOffset + safeLimit);

    return {
      ok: true,
      providers: paginatedProviders,
      facets: {
        categories,
        minPrice: filteredPrices.length > 0 ? Math.min(...filteredPrices) : null,
        maxPrice: filteredPrices.length > 0 ? Math.max(...filteredPrices) : null,
        avgRatingRange: {
          min: allRatings.length > 0 ? Math.min(...allRatings) : 0,
          max: allRatings.length > 0 ? Math.max(...allRatings) : 0,
        },
        totalProviders: totalCount ?? rawProviders.length,
        onlineCount,
      },
      pagination: {
        total,
        offset: safeOffset,
        limit: safeLimit,
        hasMore: safeOffset + safeLimit < total,
      },
    };
  } catch (e) {
    console.error("Providers API error:", e);
    return {
      ok: false,
      providers: [],
      facets: null,
      pagination: { total: 0, offset: 0, limit: safeLimit, hasMore: false },
    };
  }
}

async function executeProvidersQuery(filter: ProvidersFilter): Promise<NextResponse> {
  const { category, limit, offset, sortBy, search, lat, lng, minRating, onlineOnly } = filter;
  const cacheKey = queryCacheKey(
    "providers-by-category",
    category,
    sortBy,
    search,
    String(limit),
    String(offset),
    // Location and filters shape results, so they MUST be part of the cache
    // key. Without them a response computed for one user's coordinates (or no
    // coordinates at all) would be served to another user, blanking or
    // mis-sorting the map/search results.
    lat != null ? String(lat) : "-",
    lng != null ? String(lng) : "-",
    minRating != null ? String(minRating) : "-",
    onlineOnly ? "online" : "all",
    filter.radiusKm != null ? String(filter.radiusKm) : "-",
  );
  const result = await withCache(
    () => loadProvidersData(filter),
    { key: cacheKey, ttlSeconds: 60 },
  );
  return NextResponse.json(result);
}

async function getHandler(request: Request) {
  const requestUrl = new URL(request.url);
  const category = requestUrl.searchParams.get("category") || "";
  const latParam = requestUrl.searchParams.get("lat");
  const lngParam = requestUrl.searchParams.get("lng");
  const limitParam = requestUrl.searchParams.get("limit");
  const offsetParam = requestUrl.searchParams.get("offset");
  const minRatingParam = requestUrl.searchParams.get("minRating");
  const onlineOnlyParam = requestUrl.searchParams.get("onlineOnly");
  const sortByParam = requestUrl.searchParams.get("sortBy") || "distance";
  const searchParam = requestUrl.searchParams.get("search") || "";
  const radiusParam = requestUrl.searchParams.get("radiusKm");

  const userLat = latParam ? parseFloat(latParam) : null;
  const userLng = lngParam ? parseFloat(lngParam) : null;
  const limit = limitParam ? parseInt(limitParam, 10) : 100;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  const minRating = minRatingParam ? parseFloat(minRatingParam) : null;
  const onlineOnly = onlineOnlyParam === "true" || onlineOnlyParam === "1";
  const radiusKm = radiusParam ? parseFloat(radiusParam) : null;
  const sortBy = ["distance", "rating", "jobs", "response", "featured"].includes(sortByParam)
    ? (sortByParam as "distance" | "rating" | "jobs" | "response" | "featured")
    : "distance";
  const search = searchParam.trim().toLowerCase();

  return executeProvidersQuery({
    category, lat: userLat, lng: userLng, limit, offset,
    minRating, onlineOnly, sortBy, search,
    radiusKm: radiusKm != null && Number.isFinite(radiusKm) && radiusKm > 0 ? Math.min(radiusKm, 500) : null,
  });
}

async function postHandler(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // Body is not valid JSON — proceed with defaults
  }
  const {
    category = "",
    lat = null,
    lng = null,
    limit: rawLimit,
    offset: rawOffset,
    minRating = null,
    onlineOnly = false,
    sortBy: rawSortBy,
    search: rawSearch = "",
    radiusKm: rawRadiusKm = null,
  } = body;

  const userLat = lat != null ? Number(lat) : null;
  const userLng = lng != null ? Number(lng) : null;
  const limit = typeof rawLimit === "number" ? rawLimit : 100;
  const offset = typeof rawOffset === "number" ? rawOffset : 0;
  const parsedRadiusKm = rawRadiusKm != null ? Number(rawRadiusKm) : null;
  const parsedSortBy = String(rawSortBy || "distance");
  const sortBy = (["distance", "rating", "jobs", "response", "featured"] as const).includes(
    parsedSortBy as "distance" | "rating" | "jobs" | "response" | "featured"
  )
    ? (parsedSortBy as "distance" | "rating" | "jobs" | "response" | "featured")
    : "distance";

  return executeProvidersQuery({
    category: String(category || ""),
    lat: userLat,
    lng: userLng,
    limit,
    offset,
    minRating: minRating != null ? Number(minRating) : null,
    onlineOnly: onlineOnly === true || onlineOnly === "true",
    sortBy,
    search: String(rawSearch || "").trim().toLowerCase(),
    radiusKm:
      parsedRadiusKm != null && Number.isFinite(parsedRadiusKm) && parsedRadiusKm > 0
        ? Math.min(parsedRadiusKm, 500)
        : null,
  });
}

export const GET = withErrorHandling(getHandler, "community:providers-by-category");
export const POST = withErrorHandling(postHandler, "community:providers-by-category");
