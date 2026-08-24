import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30"), 50);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }

  const { data, error, count } = await admin
    .from("product_catalog")
    .select("*", { count: "exact" })
    .eq("storefront_id", id)
    .gt("stock", 0)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[storefronts/products] query error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const products = (data ?? []).map((p: Record<string, unknown>) => ({
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
    createdAt: p.created_at,
  }));

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
}, "storefronts/products");
