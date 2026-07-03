import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { withCache, queryCacheKey } from "@/lib/cache/withCache";

export const runtime = "nodejs";

const CURATED_COMMENT_PATTERNS = [
  "good services, best experienced ever",
  "Quantity and quality is best I ever seen",
  "fantastic work, next time will call u",
] as const;

type FeaturedReview = {
  reviewerFirstName: string;
  rating: number;
  comment: string;
};

function looksLikeUsername(name: string): boolean {
  return /\d/.test(name) || name.length <= 2;
}

function getFirstName(fullName: string): string {
  const first = fullName.split(" ")[0] || fullName;
  if (looksLikeUsername(first)) return "Verified Customer";
  return first;
}

function normalizeComment(text: string): string {
  return text
    .replace(/\s*([.,!?])\s*/g, "$1")
    .replace(/[.,!?]+$/g, "")
    .trim()
    .toLowerCase();
}

function matchPattern(comment: string, pattern: string): boolean {
  return normalizeComment(comment).includes(normalizeComment(pattern));
}

async function getHandler(): Promise<NextResponse> {
  const cacheKey = queryCacheKey("public-featured-reviews");
  const result = await withCache<{ ok: true; reviews: FeaturedReview[] }>(async () => {
    const db = createSupabaseAdminClient();
    if (!db) {
      return { ok: true, reviews: [] };
    }

    const { data: reviews, error } = await db
      .from("reviews")
      .select("rating, comment, reviewer_id")
      .not("comment", "is", null)
      .limit(50);

    if (error || !reviews) {
      return { ok: true, reviews: [] };
    }

    const matched: Array<{ rating: number; comment: string; reviewerId: string }> = [];

    for (const pattern of CURATED_COMMENT_PATTERNS) {
      const found = (reviews as Array<{ rating: number; comment: string | null; reviewer_id: string }>).find(
        (r) => r.comment && matchPattern(r.comment, pattern),
      );
      if (found) {
        matched.push({ rating: found.rating, comment: found.comment!, reviewerId: found.reviewer_id });
      }
    }

    if (matched.length === 0) {
      return { ok: true, reviews: [] };
    }

    const reviewerIds = [...new Set(matched.map((r) => r.reviewerId))];

    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name")
      .in("id", reviewerIds);

    const nameMap = new Map<string, string>();
    if (profiles) {
      for (const p of profiles as Array<{ id: string; full_name: string | null }>) {
        nameMap.set(p.id, p.full_name || "Member");
      }
    }

    const reviews_out: FeaturedReview[] = matched.map((r) => ({
      reviewerFirstName: getFirstName(nameMap.get(r.reviewerId) || "Member"),
      rating: r.rating,
      comment: r.comment,
    }));

    return { ok: true, reviews: reviews_out };
  }, { key: cacheKey, ttlSeconds: 120 });

  return NextResponse.json(result);
}

export const GET = withErrorHandling(getHandler, "public:featured-reviews");
