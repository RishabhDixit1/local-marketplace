import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);
  const category = url.searchParams.get("category") ?? "";
  const search = url.searchParams.get("search") ?? "";
  const localityId = url.searchParams.get("localityId") ?? "";

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }

  let query = admin
    .from("storefronts")
    .select("*", { count: "exact" })
    .eq("is_active", true);

  if (category) {
    query = query.ilike("category", `%${category}%`);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (localityId) {
    query = query.eq("locality_id", localityId);
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[storefronts] query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const ownerIds = [...new Set((data ?? []).map((sf: Record<string, unknown>) => sf.owner_id as string))];
  const ownerMap: Record<string, Record<string, unknown>> = {};
  if (ownerIds.length > 0) {
    const { data: owners } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url, trust_score, verification_status")
      .in("id", ownerIds);
    if (owners) {
      for (const o of owners) ownerMap[o.id] = o;
    }
  }

  const storefronts = (data ?? []).map((sf: Record<string, unknown>) => {
    const owner = ownerMap[sf.owner_id as string] ?? null;
    return {
      id: sf.id,
      ownerId: sf.owner_id,
      name: sf.name,
      category: sf.category,
      description: sf.description,
      coverUrl: sf.cover_url,
      galleryUrls: sf.gallery_urls,
      address: sf.address,
      latitude: sf.latitude,
      longitude: sf.longitude,
      operatingHours: sf.operating_hours,
      isVerified: sf.is_verified,
      isActive: sf.is_active,
      localityId: sf.locality_id,
      ownerName: owner?.full_name ?? null,
      ownerAvatarUrl: owner?.avatar_url ?? null,
      ownerTrustScore: owner?.trust_score ?? null,
      createdAt: sf.created_at,
    };
  });

  return NextResponse.json({
    ok: true,
    storefronts,
    pagination: {
      total: count ?? 0,
      offset,
      limit,
      hasMore: (count ?? 0) > offset + limit,
    },
  });
}, "storefronts/list");
