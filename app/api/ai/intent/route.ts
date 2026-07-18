import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { matchIntent } from "@/lib/ai/intentMatching";
import { resolveLoop } from "@/lib/ai/decisionEngine";
import { applyRateLimit } from "@/lib/server/rateLimit";

const AI_RATE_LIMIT = { maxRequests: 10, windowSeconds: 60 };

export const runtime = "nodejs";

type IntentRequest = {
  query: string;
  latitude?: number;
  longitude?: number;
  localityId?: string;
};

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);

  let userId: string | null = null;
  if (!auth.ok) {
    // Allow unauthenticated requests with reduced functionality
    if (auth.status !== 401) {
      return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
    }
  } else {
    userId = auth.auth.userId;
  }

  const rateLimitResult = await applyRateLimit(userId, "ai:intent", AI_RATE_LIMIT);
  if (rateLimitResult.limited) {
    return rateLimitResult.response;
  }

  const body = (await request.json()) as IntentRequest;

  if (!body.query || typeof body.query !== "string" || body.query.trim().length < 2) {
    return NextResponse.json(
      { ok: false, message: "Query must be at least 2 characters" },
      { status: 400 },
    );
  }

  if (body.query.length > 500) {
    return NextResponse.json(
      { ok: false, message: "Query must be under 500 characters" },
      { status: 400 },
    );
  }

  const result = await matchIntent(
    body.query.trim(),
    userId,
    body.latitude ?? null,
    body.longitude ?? null,
    body.localityId ?? null,
  );

  const decision = resolveLoop(result.parsed, result.matches);

  return NextResponse.json({
    ok: true,
    intentId: result.intentId,
    intent: {
      action: result.parsed.action,
      category: result.parsed.category,
      subcategory: result.parsed.subcategory,
      urgency: result.parsed.urgency,
      location: result.parsed.location,
      budget: result.parsed.budget,
      keywords: result.parsed.keywords,
      intentType: result.parsed.intentType,
      confidence: result.parsed.confidence,
    },
    decision: {
      loop: decision.loop,
      confidence: decision.confidence,
      reason: decision.reason,
      prefillData: decision.prefillData,
      suggestedProviders: decision.suggestedProviders,
    },
    matches: result.matches.map((m) => ({
      type: m.matchType,
      id: m.matchId,
      title: m.title,
      score: m.score,
      rank: m.rank,
      metadata: m.metadata,
    })),
    responseText: result.responseText,
    createNeedPrompt: result.createNeedPrompt,
    responseMs: result.responseMs,
  });
}

export const POST = withErrorHandling(postHandler, "ai:intent");
