import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id: reviewId } = await params;
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const userId = auth.auth.userId;

  try {
    const { data: votes } = await db
      .from("review_votes")
      .select("user_id, vote")
      .eq("review_id", reviewId);

    const helpful = (votes ?? []).filter((v) => v.vote === "helpful").length;
    const notHelpful = (votes ?? []).filter((v) => v.vote === "not_helpful").length;
    const userVote = (votes ?? []).find((v) => v.user_id === userId)?.vote ?? null;

    return NextResponse.json({ ok: true, helpful_count: helpful, not_helpful_count: notHelpful, user_vote: userVote });
  } catch {
    // Fall back to metadata
    const { data: review } = await db
      .from("reviews")
      .select("metadata")
      .eq("id", reviewId)
      .single<{ metadata: Record<string, unknown> }>();

    if (!review) {
      return NextResponse.json({ ok: false, message: "Review not found" }, { status: 404 });
    }

    const meta = (review.metadata ?? {}) as Record<string, unknown>;
    const voters = Array.isArray(meta.voters) ? (meta.voters as Array<{ userId: string; vote: string }>) : [];
    const helpful = voters.filter((v) => v.vote === "helpful").length;
    const notHelpful = voters.filter((v) => v.vote === "not_helpful").length;
    const userVote = voters.find((v) => v.userId === userId)?.vote ?? null;

    return NextResponse.json({ ok: true, helpful_count: helpful, not_helpful_count: notHelpful, user_vote: userVote });
  }
}
