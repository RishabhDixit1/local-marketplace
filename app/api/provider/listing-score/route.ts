import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { getProviderSubscription, hasFeature } from "@/lib/server/subscriptionCheck";

export const runtime = "nodejs";

type Suggestion = {
  field: string;
  severity: "high" | "medium" | "low";
  message: string;
};

type ScoreResult = {
  listingId: string;
  title: string;
  category: string;
  score: number;
  suggestions: Suggestion[];
};

/**
 * Analyzes each of the provider's listings and returns:
 * - A visibility score (0-100)
 * - Specific suggestions to improve each listing
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
    return NextResponse.json({ ok: false, message: "Listing optimization requires a subscription" }, { status: 403 });
  }

  const { data: listings } = await db
    .from("service_listings")
    .select("id, title, description, category, price, pricing_type, metadata, availability, created_at, updated_at")
    .eq("provider_id", userId)
    .order("created_at", { ascending: false });

  if (!listings || listings.length === 0) {
    return NextResponse.json({ ok: true, listings: [], averageScore: 0, totalListings: 0 });
  }

  const results: ScoreResult[] = [];
  let totalScore = 0;

  for (const listing of listings) {
    const suggestions: Suggestion[] = [];
    let score = 50; // Start at 50 (baseline for having a listing)

    // 1. Title quality
    const title = listing.title ?? "";
    if (title.length < 10) {
      score -= 10;
      suggestions.push({ field: "title", severity: "high", message: "Title is too short (under 10 characters). Add more descriptive keywords." });
    } else if (title.length < 25) {
      score -= 5;
      suggestions.push({ field: "title", severity: "medium", message: "Consider a longer title (25+ characters) with key details like service type and scope." });
    } else {
      score += 5;
    }

    if (/^(test|demo|sample)/i.test(title)) {
      score -= 20;
      suggestions.push({ field: "title", severity: "high", message: "Title appears to be placeholder text. Use a real service name." });
    }

    // 2. Description quality
    const desc = listing.description ?? "";
    if (!desc || desc.length < 20) {
      score -= 15;
      suggestions.push({ field: "description", severity: "high", message: "Description is missing or too short. Add details about what you offer, your experience, and what sets you apart." });
    } else if (desc.length < 80) {
      score -= 8;
      suggestions.push({ field: "description", severity: "medium", message: "Consider expanding your description (aim for 80+ characters) with service details, pricing, and service area." });
    } else {
      score += 5;
    }

    // 3. Category
    if (!listing.category) {
      score -= 10;
      suggestions.push({ field: "category", severity: "high", message: "No category set. Assign a category so customers can find your listing." });
    } else {
      score += 5;
    }

    // 4. Price
    if (listing.price == null || Number(listing.price) <= 0) {
      score -= 10;
      suggestions.push({ field: "price", severity: "high", message: "No price set. Listings with prices get more inquiries." });
    } else {
      score += 5;
    }

    // 5. Pricing type
    if (listing.pricing_type === "fixed") {
      score += 3;
    }

    // 6. Availability
    if (listing.availability === "available") {
      score += 5;
    } else if (listing.availability === "busy") {
      suggestions.push({ field: "availability", severity: "medium", message: "Marked as busy. Set to available to receive new orders." });
    }
    if (!listing.availability || listing.availability === "offline") {
      score -= 5;
      suggestions.push({ field: "availability", severity: "high", message: "Set your availability to 'available' to appear in search results." });
    }

    // 7. Has images (check metadata for image URLs)
    const meta = listing.metadata as Record<string, unknown> | null;
    const hasImages = meta?.images != null && Array.isArray(meta.images) && (meta.images as unknown[]).length > 0;
    const hasImageUrl = meta?.image_url != null && String(meta.image_url).length > 0;

    if (!hasImages && !hasImageUrl) {
      score -= 10;
      suggestions.push({ field: "images", severity: "high", message: "No images. Listings with photos get significantly more views and inquiries." });
    } else {
      score += 10;
    }

    // 8. Recently updated
    const updatedAt = new Date(listing.updated_at ?? listing.created_at).getTime();
    const daysSinceUpdate = (Date.now() - updatedAt) / 86400000;
    if (daysSinceUpdate > 90) {
      score -= 5;
      suggestions.push({ field: "freshness", severity: "low", message: `Listing hasn't been updated in ${Math.round(daysSinceUpdate)} days. Refresh it to stay relevant.` });
    } else if (daysSinceUpdate < 14) {
      score += 5;
    }

    // Clamp score 0-100
    score = Math.max(0, Math.min(100, score));
    totalScore += score;

    results.push({
      listingId: listing.id,
      title: title || "Untitled",
      category: listing.category ?? "uncategorized",
      score,
      suggestions,
    });
  }

  return NextResponse.json({
    ok: true,
    listings: results,
    averageScore: Math.round(totalScore / results.length),
    totalListings: results.length,
  });
}

export const GET = withErrorHandling(getHandler, "provider:listing-score");
