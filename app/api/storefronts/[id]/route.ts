import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }

  const { data: storefront, error } = await admin
    .from("storefronts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !storefront) {
    return NextResponse.json({ ok: false, error: "Storefront not found" }, { status: 404 });
  }

  let owner = null;
  if (storefront.owner_id) {
    const { data: ownerData } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url, trust_score, verification_status, bio, phone")
      .eq("id", storefront.owner_id)
      .single();
    owner = ownerData;
  }

  const { count: productCount } = await admin
    .from("product_catalog")
    .select("*", { count: "exact", head: true })
    .eq("storefront_id", id)
    .gt("stock", 0);

  const result = {
    id: storefront.id,
    ownerId: storefront.owner_id,
    name: storefront.name,
    category: storefront.category,
    description: storefront.description,
    coverUrl: storefront.cover_url,
    galleryUrls: storefront.gallery_urls,
    address: storefront.address,
    latitude: storefront.latitude,
    longitude: storefront.longitude,
    operatingHours: storefront.operating_hours,
    isVerified: storefront.is_verified,
    isActive: storefront.is_active,
    localityId: storefront.locality_id,
    productCount: productCount ?? 0,
    owner: owner
      ? {
          id: owner.id,
          fullName: owner.full_name,
          avatarUrl: owner.avatar_url,
          trustScore: owner.trust_score,
          verificationStatus: owner.verification_status,
          bio: owner.bio,
          phone: owner.phone,
        }
      : null,
    createdAt: storefront.created_at,
  };

  return NextResponse.json({ ok: true, storefront: result });
}, "storefronts/detail");
