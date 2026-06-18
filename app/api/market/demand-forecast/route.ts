import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

/**
 * Returns demand forecast data:
 * - Trending services per locality (by order volume change)
 * - Category growth rates (30-day vs prior 30-day)
 * - Seasonality patterns
 */
async function getHandler(request: Request) {
  const maybeDb = createSupabaseAdminClient();
  if (!maybeDb) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  const db = maybeDb;

  const url = new URL(request.url);
  const localityId = url.searchParams.get("locality_id") || "";
  const days = Math.min(90, Math.max(7, parseInt(url.searchParams.get("days") ?? "30", 10)));

  const now = new Date();
  const currentStart = new Date(now.getTime() - days * 86400000).toISOString();
  const priorStart = new Date(now.getTime() - 2 * days * 86400000).toISOString();
  const priorEnd = currentStart;

  // Base query: orders with listing_type = 'service' in a time range
  async function countByCategory(from: string, to: string): Promise<Record<string, number>> {
    let query = db!
      .from("orders")
      .select("metadata, listing_type, provider_id")
      .gte("created_at", from)
      .lt("created_at", to)
      .in("status", ["completed", "in_progress", "accepted"]);

    if (localityId) {
      // Filter by locality via provider's locality
      const { data: localityProviders } = await db
        .from("profiles")
        .select("id")
        .or(`locality_id.eq.${localityId},service_zone_ids.cs.{${localityId}}`);

      const providerIds = (localityProviders ?? []).map((p) => p.id);
      if (providerIds.length > 0) {
        query = query.in("provider_id", providerIds);
      } else {
        return {};
      }
    }

    const { data: orders } = await query.limit(1000);
    const counts: Record<string, number> = {};

    for (const order of orders ?? []) {
      const meta = order.metadata as Record<string, unknown> | null;
      const category = typeof meta?.category === "string"
        ? meta.category
        : order.listing_type ?? "other";
      counts[category] = (counts[category] ?? 0) + 1;
    }

    return counts;
  }

  const [currentCounts, priorCounts] = await Promise.all([
    countByCategory(currentStart, now.toISOString()),
    countByCategory(priorStart, priorEnd),
  ]);

  // Build trend data
  const allCategories = [...new Set([...Object.keys(currentCounts), ...Object.keys(priorCounts)])];
  const trends = allCategories.map((category) => {
    const current = currentCounts[category] ?? 0;
    const prior = priorCounts[category] ?? 0;
    const change = prior > 0 ? Math.round(((current - prior) / prior) * 100) : current > 0 ? 100 : 0;
    const direction = change > 10 ? "up" : change < -10 ? "down" : "stable";

    return {
      category,
      currentOrders: current,
      priorOrders: prior,
      changePercent: change,
      direction,
      trend: direction === "up" ? "growing" : direction === "down" ? "declining" : "stable",
    };
  });

  // Sort by growth rate descending
  trends.sort((a, b) => b.changePercent - a.changePercent);

  // Get locality name if specified
  let localityName = "";
  if (localityId) {
    const { data: loc } = await db
      .from("localities")
      .select("name")
      .eq("id", localityId)
      .maybeSingle();
    localityName = loc?.name ?? "";
  }

  // Top growing and declining
  const growing = trends.filter((t) => t.direction === "up").slice(0, 5);
  const declining = trends.filter((t) => t.direction === "down").slice(0, 5);

  return NextResponse.json({
    ok: true,
    localityId: localityId || undefined,
    localityName: localityName || undefined,
    periodDays: days,
    trends,
    growing,
    declining,
    summary: {
      totalCategories: allCategories.length,
      growingCategories: growing.length,
      decliningCategories: declining.length,
      stableCategories: trends.filter((t) => t.direction === "stable").length,
    },
  });
}

export const GET = withErrorHandling(getHandler, "market:demand-forecast");
