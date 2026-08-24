import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

// Off-domain guard: rows inserted outside the marketplace domain (e.g.
// funding/grants entries) are quarantined via product_catalog.is_active in
// migration 20260825000000; this pattern list is defense in depth.
const OFF_DOMAIN_TITLE_PATTERNS = [
  /government\s+grant/i,
  /startup\s+scheme/i,
  /angel\s+investor/i,
  /venture\s+capital/i,
];

const isOffDomain = (title: unknown, category: unknown): boolean => {
  const titleText = typeof title === "string" ? title : "";
  const categoryText = typeof category === "string" ? category : "";
  return (
    OFF_DOMAIN_TITLE_PATTERNS.some((pattern) => pattern.test(titleText)) ||
    /funding|investment/i.test(categoryText)
  );
};

export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30"), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);
  const category = url.searchParams.get("category") ?? "";
  const search = url.searchParams.get("search") ?? "";
  const storefrontId = url.searchParams.get("storefrontId") ?? "";

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }

  let query = admin
    .from("product_catalog")
    .select("*, storefronts!product_catalog_storefront_id_fkey(id, name, is_verified)", { count: "exact" })
    .gt("stock", 0)
    .eq("is_active", true);

  if (category) {
    query = query.ilike("category", `%${category}%`);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }
  if (storefrontId) {
    query = query.eq("storefront_id", storefrontId);
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error("[products] query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const products = (data ?? [])
    .filter((p: Record<string, unknown>) => !isOffDomain(p.title, p.category))
    .map((p: Record<string, unknown>) => {
    const sf = p.storefronts as Record<string, unknown> | null;
    return {
      id: p.id,
      providerId: p.provider_id,
      storefrontId: p.storefront_id,
      title: p.title,
      description: p.description,
      category: p.category,
      price: p.price,
      stock: p.stock,
      deliveryMethod: p.delivery_method,
      imageUrl: p.image_url,
      storefrontName: sf?.name ?? null,
      storefrontVerified: sf?.is_verified ?? false,
      createdAt: p.created_at,
    };
  });

  return NextResponse.json({
    ok: true,
    products,
    pagination: {
      total: count ?? 0,
      offset,
      limit,
      hasMore: (count ?? 0) > offset + limit,
    },
  });
}, "products/browse");
