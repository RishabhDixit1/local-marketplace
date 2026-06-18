import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { getProviderSubscription, hasFeature } from "@/lib/server/subscriptionCheck";

export const runtime = "nodejs";

/**
 * Returns pricing insights for a provider's listings:
 * - Average price for this category in the locality
 * - Suggested price range (competitive)
 * - Price position (above/below market)
 */
async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const userId = auth.auth.userId;

  const sub = await getProviderSubscription(userId);
  if (!sub.active || !hasFeature(sub, "analytics dashboard")) {
    return NextResponse.json({ ok: false, message: "Pricing insights require a subscription" }, { status: 403 });
  }

  // Get provider's locality
  const { data: profile } = await db
    .from("profiles")
    .select("locality_id, service_zone_ids")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ ok: false, message: "Profile not found" }, { status: 404 });
  }

  // Get provider's own listings
  const { data: myListings } = await db
    .from("service_listings")
    .select("id, title, category, price, pricing_type")
    .eq("provider_id", userId);

  if (!myListings || myListings.length === 0) {
    return NextResponse.json({ ok: true, insights: [], message: "No listings to analyze" });
  }

  // Get locality context
  const localityIds = [
    ...(profile.locality_id ? [profile.locality_id] : []),
    ...(profile.service_zone_ids ?? []),
  ];

  // Find other providers in same localities with same categories
  const categories = [...new Set(myListings.map((l) => l.category).filter(Boolean))];

  const localityInsights: Record<string, {
    category: string;
    myPrice: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    sampleSize: number;
    listingCount: number;
    pricePosition: "above" | "below" | "competitive";
    suggestedPrice: number;
    rationale: string;
  }> = {};

  for (const category of categories) {
    if (!category) continue;
    const myListingsInCat = myListings.filter((l) => l.category === category && l.price != null);
    if (myListingsInCat.length === 0) continue;

    const myAvgPrice = myListingsInCat.reduce((s, l) => s + Number(l.price), 0) / myListingsInCat.length;

    let query = db
      .from("service_listings")
      .select("price, provider_id")
      .eq("category", category)
      .not("provider_id", "eq", userId)
      .not("price", "is", null);

    if (localityIds.length > 0) {
      // Get listings from providers in same localities
      const { data: localityProviders } = await db
        .from("profiles")
        .select("id")
        .or(`locality_id.in.(${localityIds.join(",")}),service_zone_ids.cs.{${localityIds.map(() => "").join(",")}}`);

      const providerIds = (localityProviders ?? []).map((p) => p.id);
      if (providerIds.length > 0) {
        query = query.in("provider_id", providerIds);
      }
    }

    const { data: otherListings } = await query.limit(100);

    const prices = (otherListings ?? [])
      .map((l) => Number(l.price))
      .filter((p) => p > 0);

    const sampleSize = prices.length;
    const avgPrice = sampleSize > 0
      ? prices.reduce((s, p) => s + p, 0) / sampleSize
      : myAvgPrice;
    const minPrice = sampleSize > 0 ? Math.min(...prices) : myAvgPrice * 0.7;
    const maxPrice = sampleSize > 0 ? Math.max(...prices) : myAvgPrice * 1.3;

    const threshold = avgPrice * 0.1; // 10% threshold
    const pricePosition = myAvgPrice > avgPrice + threshold
      ? "above"
      : myAvgPrice < avgPrice - threshold
        ? "below"
        : "competitive";

    // Suggested: if above market, suggest lowering to near market avg
    // If below market, suggest raising slightly
    const suggestedPrice = pricePosition === "above"
      ? Math.round(avgPrice * 1.05) // 5% above avg
      : pricePosition === "below"
        ? Math.round(avgPrice * 0.95) // 5% below avg
        : Math.round(myAvgPrice);

    const rationale = sampleSize > 0
      ? pricePosition === "above"
        ? `Your price is above the local market average of ₹${avgPrice.toFixed(0)}. Consider pricing near ₹${suggestedPrice.toFixed(0)} to attract more customers.`
        : pricePosition === "below"
          ? `Your price is below the local market average of ₹${avgPrice.toFixed(0)}. You could increase to ₹${suggestedPrice.toFixed(0)} for better margins.`
          : `Your pricing is competitive with the local market average of ₹${avgPrice.toFixed(0)}.`
      : "Not enough local data. Price based on your current listings.";

    localityInsights[category] = {
      category,
      myPrice: Math.round(myAvgPrice),
      avgPrice: Math.round(avgPrice),
      minPrice: Math.round(minPrice),
      maxPrice: Math.round(maxPrice),
      sampleSize,
      listingCount: myListingsInCat.length,
      pricePosition,
      suggestedPrice: Math.round(suggestedPrice),
      rationale,
    };
  }

  return NextResponse.json({
    ok: true,
    insights: Object.values(localityInsights),
  });
}

export const GET = withErrorHandling(getHandler, "provider:pricing-insights");
