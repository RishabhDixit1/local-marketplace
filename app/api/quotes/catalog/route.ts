import { NextResponse } from "next/server";
import type { ProviderCatalogItem, QuoteApiErrorCode } from "@/lib/api/quotes";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toErrorResponse = (status: number, code: QuoteApiErrorCode, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details }, { status });

const toFiniteNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const getSource = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if ("source" in m && typeof m.source === "string") {
    return m.source;
  }
  return null;
};

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toErrorResponse(authResult.status, "UNAUTHORIZED", authResult.message);

  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("providerId")?.trim() || authResult.auth.userId;

  if (!providerId) {
    return toErrorResponse(400, "INVALID_PAYLOAD", "providerId is required.");
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) {
    return toErrorResponse(500, "CONFIG", "Supabase server credentials are missing.");
  }

  try {
    const servicesResult = await db
      .from("service_listings")
      .select("id,title,description,category,price,metadata")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(30);

    const productsResult = await db
      .from("product_catalog")
      .select("id,title,description,category,price,metadata")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false })
      .limit(30);

    const items: ProviderCatalogItem[] = [];

    if (!servicesResult.error && servicesResult.data) {
      servicesResult.data.forEach((row) => {
        items.push({
          id: String(row.id),
          title: String(row.title ?? ""),
          description: String(row.description ?? ""),
          category: String(row.category ?? "Service"),
          price: toFiniteNumber(row.price),
          source: getSource(row.metadata),
        });
      });
    }

    if (!productsResult.error && productsResult.data) {
      productsResult.data.forEach((row) => {
        items.push({
          id: String(row.id),
          title: String(row.title ?? ""),
          description: String(row.description ?? ""),
          category: String(row.category ?? "Product"),
          price: toFiniteNumber(row.price),
          source: getSource(row.metadata),
        });
      });
    }

    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(500, "UNKNOWN", error instanceof Error ? error.message : "Failed to load catalog.");
  }
}
