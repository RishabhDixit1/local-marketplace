import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId");

  if (!providerId) {
    return NextResponse.json({ ok: false, message: "providerId is required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const { data: reviews, count } = await db
    .from("reviews")
    .select("id,rating,comment,created_at,reviewer_id,metadata", { count: "exact" })
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!reviews) {
    return NextResponse.json({ ok: true, reviews: [], count: 0 });
  }

  const reviewerIds = [...new Set(reviews.map((r) => r.reviewer_id).filter(Boolean))];

  let verifiedReviewers = new Set<string>();
  if (reviewerIds.length > 0) {
    const { data: verifiedOrders } = await db
      .from("orders")
      .select("consumer_id")
      .eq("provider_id", providerId)
      .eq("status", "completed")
      .in("consumer_id", reviewerIds);

    if (verifiedOrders) {
      verifiedReviewers = new Set(
        (verifiedOrders as Array<{ consumer_id: string }>).map((o) => o.consumer_id)
      );
    }
  }

  const reviewIds = reviews.map((r) => r.id);
  const votesMap = new Map<string, { helpful_count: number; not_helpful_count: number }>();

  if (reviewIds.length > 0) {
    const { data: votes } = await db
      .from("review_votes")
      .select("review_id, vote")
      .in("review_id", reviewIds);

    if (votes) {
      for (const reviewId of reviewIds) {
        const reviewVotes = votes.filter((v) => v.review_id === reviewId);
        votesMap.set(reviewId, {
          helpful_count: reviewVotes.filter((v) => v.vote === "helpful").length,
          not_helpful_count: reviewVotes.filter((v) => v.vote === "not_helpful").length,
        });
      }
    }
  }

  const enriched = reviews.map((r) => {
    const votes = votesMap.get(r.id) || { helpful_count: 0, not_helpful_count: 0 };
    const metadata = (r.metadata ?? {}) as Record<string, unknown>;
    const photos = metadata.photos as string[] | undefined;
    return {
      id: r.id,
      rating: typeof r.rating === "number" && Number.isFinite(r.rating) ? r.rating : 0,
      comment: r.comment?.trim() || null,
      createdAt: r.created_at || null,
      reviewerId: r.reviewer_id || null,
      isVerifiedPurchase: r.reviewer_id ? verifiedReviewers.has(r.reviewer_id) : false,
      photos: photos?.filter(Boolean) || [],
      helpfulCount: votes.helpful_count,
      notHelpfulCount: votes.not_helpful_count,
    };
  });

  return NextResponse.json({ ok: true, reviews: enriched, count: count ?? enriched.length });
}

export const GET = withErrorHandling(getHandler, "reviews:by-provider");
