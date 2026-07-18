import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };

async function getHandler(request: Request, { params }: RouteParams) {
  const { id: intentId } = await params;

  if (!intentId) {
    return NextResponse.json({ ok: false, message: "Missing intent ID" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "10", 10)));
  const offset = (page - 1) * limit;

  const { data: intent, error: intentErr } = await db
    .from("intent_logs")
    .select("id, query, parsed_action, parsed_category, parsed_urgency, parsed_location, matched_count, created_at")
    .eq("id", intentId)
    .single();

  if (intentErr || !intent) {
    return NextResponse.json({ ok: false, message: "Intent not found" }, { status: 404 });
  }

  const { data: matches, count, error: matchErr } = await db
    .from("intent_matches")
    .select("id, match_type, match_id, title, score, score_breakdown, rank", { count: "exact" })
    .eq("intent_id", intentId)
    .order("rank", { ascending: true })
    .range(offset, offset + limit - 1);

  if (matchErr) {
    return NextResponse.json({ ok: false, message: matchErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    intent: {
      id: intent.id,
      query: intent.query,
      action: intent.parsed_action,
      category: intent.parsed_category,
      urgency: intent.parsed_urgency,
      location: intent.parsed_location,
      matchedCount: intent.matched_count,
      createdAt: intent.created_at,
    },
    matches: (matches || []).map((m) => ({
      id: m.id,
      type: m.match_type,
      matchId: m.match_id,
      title: m.title,
      score: m.score,
      scoreBreakdown: m.score_breakdown,
      rank: m.rank,
    })),
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

export const GET = withErrorHandling(getHandler, "ai:intent:matches");
