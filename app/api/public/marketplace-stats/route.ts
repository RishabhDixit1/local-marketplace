import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { withCache, queryCacheKey } from "@/lib/cache/withCache";

export const runtime = "nodejs";

type StatsResponse = {
  ok: true;
  totalProviders: number;
  totalUsers: number;
  totalReviews: number;
  averageRating: number | null;
};

async function getHandler(): Promise<NextResponse> {
  const cacheKey = queryCacheKey("public-marketplace-stats");
  const result = await withCache<StatsResponse>(async () => {
    const db = createSupabaseAdminClient();
    if (!db) {
      return { ok: true, totalProviders: 0, totalUsers: 0, totalReviews: 0, averageRating: null };
    }

    const [{ count: totalUsers }, { count: totalProviders }, { count: totalReviews }, { data: ratingData }] =
      await Promise.all([
        db.from("profiles").select("*", { head: true, count: "exact" }),
        db
          .from("profiles")
          .select("*", { head: true, count: "exact" })
          .in("role", ["provider", "business"])
          .not("full_name", "is", null),
        db.from("reviews").select("*", { head: true, count: "exact" }),
        db.from("reviews").select("rating"),
      ]);

    const ratings = (ratingData as { rating: number | null }[] | null) || [];
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length) * 10) / 10
        : null;

    return {
      ok: true,
      totalProviders: totalProviders ?? 0,
      totalUsers: totalUsers ?? 0,
      totalReviews: totalReviews ?? 0,
      averageRating: avgRating,
    };
  }, { key: cacheKey, ttlSeconds: 60 });

  return NextResponse.json(result);
}

export const GET = withErrorHandling(getHandler, "public:marketplace-stats");
