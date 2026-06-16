import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";


export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { id: reviewId } = await params;
  let body: { vote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  if (!body.vote || !["helpful", "not_helpful"].includes(body.vote)) {
    return NextResponse.json({ ok: false, message: "vote must be 'helpful' or 'not_helpful'" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const userId = auth.auth.userId;

  // Try using the review_votes table first
  try {
    // Check existing vote
    const { data: existing } = await db
      .from("review_votes")
      .select("id, vote")
      .eq("review_id", reviewId)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      if (existing.vote === body.vote) {
        // Same vote — remove (toggle off)
        await db.from("review_votes").delete().eq("id", existing.id);
        return NextResponse.json({ ok: true, action: "removed", vote: null });
      }
      // Different vote — update
      await db.from("review_votes").update({ vote: body.vote }).eq("id", existing.id);
      return NextResponse.json({ ok: true, action: "updated", vote: body.vote });
    }

    // No existing vote — insert
    await db.from("review_votes").insert({
      review_id: reviewId,
      user_id: userId,
      vote: body.vote,
    });

    return NextResponse.json({ ok: true, action: "added", vote: body.vote });
  } catch {
    // review_votes table doesn't exist — fall back to metadata jsonb
    const { data: review } = await db
      .from("reviews")
      .select("metadata")
      .eq("id", reviewId)
      .single<{ metadata: Record<string, unknown> }>();

    if (!review) {
      return NextResponse.json({ ok: false, message: "Review not found" }, { status: 404 });
    }

    const meta = (review.metadata ?? {}) as Record<string, unknown>;
    const voters = Array.isArray(meta.voters) ? [...meta.voters] : [];
    const existingIdx = voters.findIndex((v) => typeof v === "object" && (v as Record<string, string>).userId === userId);

    if (existingIdx >= 0) {
      const existingVote = (voters[existingIdx] as Record<string, string>).vote;
      if (existingVote === body.vote) {
        voters.splice(existingIdx, 1); // toggle off
      } else {
        voters[existingIdx] = { userId, vote: body.vote }; // update
      }
    } else {
      voters.push({ userId, vote: body.vote });
    }

    const helpfulCount = voters.filter((v) => typeof v === "object" && (v as Record<string, string>).vote === "helpful").length;
    const notHelpfulCount = voters.filter((v) => typeof v === "object" && (v as Record<string, string>).vote === "not_helpful").length;

    await db.from("reviews").update({
      metadata: { ...meta, voters, helpful_count: helpfulCount, not_helpful_count: notHelpfulCount },
    }).eq("id", reviewId);

    return NextResponse.json({ ok: true, action: existingIdx >= 0 ? "updated" : "added", vote: body.vote });
  }
}
