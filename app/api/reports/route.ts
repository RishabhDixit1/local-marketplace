import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: {
    targetType: string;
    targetId: string;
    reason: string;
    description?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.targetType || !body.targetId || !body.reason) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "targetType, targetId, and reason are required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const { error } = await db.from("feed_card_feedback").insert({
    user_id: auth.auth.userId,
    card_id: body.targetType === "feedItem" ? body.targetId : null,
    focus_id: body.targetType === "provider" ? body.targetId : null,
    card_type: body.targetType === "feedItem" ? "service" : null,
    feedback_type: "report",
    reason: body.reason,
    metadata: {
      target_type: body.targetType,
      target_id: body.targetId,
      description: body.description ?? null,
      ...(body.metadata ?? {}),
    },
  });

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
