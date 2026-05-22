import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const category = requestUrl.searchParams.get("category") || "";
  const latParam = requestUrl.searchParams.get("lat");
  const lngParam = requestUrl.searchParams.get("lng");
  const limitParam = requestUrl.searchParams.get("limit");
  
  const userLat = latParam ? parseFloat(latParam) : null;
  const userLng = lngParam ? parseFloat(lngParam) : null;
  const limit = limitParam ? parseInt(limitParam, 10) : 100;
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, providers: [] });
  }

  try {
    let query = admin
      .from("profiles")
      .select("id, full_name, name, location, latitude, longitude, avatar_url, bio, role, services, created_at")
      .in("role", ["provider", "business"])
      .not("full_name", "is", null)
      .limit(safeLimit);

    if (category) {
      query = query.contains("services", [category]);
    }

    const { data: profiles, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message, providers: [] });
    }

    const profileIds = (profiles || []).map((p) => p.id).filter(Boolean);

    const [servicesResult, reviewsResult, presenceResult, orderStatsResult] = await Promise.all([
      admin
        .from("service_listings")
        .select("provider_id, id, title, category, price, metadata")
        .in("provider_id", profileIds),
      admin
        .from("reviews")
        .select("provider_id, rating")
        .in("provider_id", profileIds),
      admin
        .from("provider_presence")
        .select("provider_id, is_online, response_sla_minutes, rolling_response_minutes")
        .in("provider_id", profileIds),
      admin.rpc("get_provider_order_stats", { p_provider_ids: profileIds }).maybeSingle(),
    ]);

    const servicesData = servicesResult.data || [];
    const reviewsData = reviewsResult.data || [];
    const presenceData = presenceResult.data || [];
    const orderStatsData = orderStatsResult.data || [];

    const serviceMap: Record<string, { id: string; title: string; category: string; price: number | null }[]> = {};
    const priceMap: Record<string, number[]> = {};
    for (const s of servicesData || []) {
      if (!serviceMap[s.provider_id]) serviceMap[s.provider_id] = [];
      serviceMap[s.provider_id].push({ id: s.id, title: s.title, category: s.category, price: s.price });
      if (s.price != null) {
        if (!priceMap[s.provider_id]) priceMap[s.provider_id] = [];
        priceMap[s.provider_id].push(Number(s.price));
      }
    }

    const ratingMap: Record<string, number[]> = {};
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
      if (o.provider_id && o.completed_jobs != null) {
        completedJobsMap[o.provider_id] = Number(o.completed_jobs);
      }
    }

    const rawProviders = (profiles || []).map((p) => {
      const ratings = ratingMap[p.id] || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
      const prices = priceMap[p.id] || [];
      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
      const pres = presenceMap[p.id];
      const dist =
        p.latitude != null && p.longitude != null && userLat != null && userLng != null
          ? distanceKm(userLat, userLng, Number(p.latitude), Number(p.longitude))
          : null;

      return {
        id: p.id,
        name: p.full_name || p.name || "",
        location: p.location || "",
        lat: p.latitude,
        lng: p.longitude,
        avatarUrl: p.avatar_url || "",
        bio: p.bio || "",
        role: p.role || "provider",
        services: p.services || [],
        avgRating,
        reviewCount: ratings.length,
        serviceCount: (serviceMap[p.id] || []).length,
        completedJobs: completedJobsMap[p.id] || 0,
        responseMinutes: pres?.responseMinutes ?? null,
        isOnline: pres?.isOnline ?? false,
        priceMin: minPrice,
        priceMax: maxPrice,
        distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
        verified: p.role === "provider",
        listings: serviceMap[p.id] || [],
      };
    });

    const sortByScore = (a: typeof rawProviders[0], b: typeof rawProviders[0]) => {
      if (a.isOnline !== b.isOnline) {
        return a.isOnline ? -1 : 1;
      }
      if (a.completedJobs !== b.completedJobs) {
        return b.completedJobs - a.completedJobs;
      }
      const ratingA = a.avgRating ?? 0;
      const ratingB = b.avgRating ?? 0;
      if (ratingA !== ratingB) {
        return ratingB - ratingA;
      }
      if (a.serviceCount !== b.serviceCount) {
        return b.serviceCount - a.serviceCount;
      }
      return 0;
    };

    let providers: typeof rawProviders;
    if (userLat != null && userLng != null) {
      providers = rawProviders.sort((a, b) => {
        const da = a.distanceKm ?? Infinity;
        const db = b.distanceKm ?? Infinity;
        if (da !== db) {
          return da - db;
        }
        return sortByScore(a, b);
      });
    } else {
      providers = rawProviders.sort(sortByScore);
    }

    return NextResponse.json({ ok: true, providers });
  } catch {
    return NextResponse.json({ ok: false, providers: [] });
  }
}
