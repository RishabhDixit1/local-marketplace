import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };
type FeedbackBody = {
  matchId?: string;
  feedbackType: "clicked" | "contacted" | "booked" | "helpful" | "not_relevant" | "wrong_category" | "wrong_location";
  feedbackText?: string;
};

async function postHandler(request: Request, { params }: RouteParams) {
  const { id: intentId } = await params;

  const auth = await requireRequestAuth(request);
  let userId: string | null = null;

  if (auth.ok) {
    userId = auth.auth.userId;
  }

  if (!intentId) {
    return NextResponse.json({ ok: false, message: "Missing intent ID" }, { status: 400 });
  }

  const body = (await request.json()) as FeedbackBody;

  const validTypes = ["clicked", "contacted", "booked", "helpful", "not_relevant", "wrong_category", "wrong_location"];
  if (!body.feedbackType || !validTypes.includes(body.feedbackType)) {
    return NextResponse.json(
      { ok: false, message: `feedbackType must be one of: ${validTypes.join(", ")}` },
      { status: 400 },
    );
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  // Verify intent exists
  const { data: intent, error: intentErr } = await db
    .from("intent_logs")
    .select("id")
    .eq("id", intentId)
    .single();

  if (intentErr || !intent) {
    return NextResponse.json({ ok: false, message: "Intent not found" }, { status: 404 });
  }

  const { error } = await db.from("intent_feedback").insert({
    intent_id: intentId,
    user_id: userId,
    match_id: body.matchId || null,
    feedback_type: body.feedbackType,
    feedback_text: body.feedbackText || null,
  });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withErrorHandling(postHandler, "ai:intent:feedback");
