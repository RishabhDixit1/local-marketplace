import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { isAdminEmail, requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  if (!isAdminEmail(auth.auth.email)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Admin access required." }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const [
    { count: totalUsers },
    { count: totalProviders },
    { count: totalSeekers },
    { count: totalOrders },
    { count: completedOrders },
    { count: cancelledOrders },
    { count: totalReviews },
    { data: ratingData },
    { count: totalHelpRequests },
    { data: trustData },
  ] = await Promise.all([
    db.from("profiles").select("*", { head: true, count: "exact" }),
    db.from("profiles").select("*", { head: true, count: "exact" }).eq("role", "provider"),
    db.from("profiles").select("*", { head: true, count: "exact" }).eq("role", "seeker"),
    db.from("orders").select("*", { head: true, count: "exact" }),
    db.from("orders").select("*", { head: true, count: "exact" }).eq("status", "completed"),
    db.from("orders").select("*", { head: true, count: "exact" }).in("status", ["cancelled", "rejected"]),
    db.from("reviews").select("*", { head: true, count: "exact" }),
    db.from("reviews").select("rating"),
    db.from("help_requests").select("*", { head: true, count: "exact" }),
    db.from("trust_scores").select("trust_score"),
  ]);

  const ratings = (ratingData as { rating: number | null }[] | null) || [];
  const avgRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
    : null;

  const trustScores = (trustData as { trust_score: number | null }[] | null) || [];
  const avgTrustScore = trustScores.length > 0
    ? trustScores.reduce((sum, t) => sum + (t.trust_score || 0), 0) / trustScores.length
    : null;

  return NextResponse.json({
    ok: true,
    stats: {
      totalUsers: totalUsers ?? 0,
      totalProviders: totalProviders ?? 0,
      totalSeekers: totalSeekers ?? 0,
      totalOrders: totalOrders ?? 0,
      completedOrders: completedOrders ?? 0,
      cancelledOrders: cancelledOrders ?? 0,
      totalReviews: totalReviews ?? 0,
      averageRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
      totalHelpRequests: totalHelpRequests ?? 0,
      averageTrustScore: avgTrustScore ? Math.round(avgTrustScore) : null,
    },
  });
}
