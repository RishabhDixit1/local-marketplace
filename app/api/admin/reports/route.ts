import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireAdminAuth } from "@/lib/server/requestAuth";
import { applyRateLimit, WRITE_ROUTE_CONFIG } from "@/lib/server/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const url = new URL(request.url);
  const feedbackType = url.searchParams.get("feedbackType") || "report";
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 200);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const query = db
    .from("feed_card_feedback")
    .select("id,user_id,card_id,focus_id,card_type,feedback_type,reason,metadata,created_at")
    .eq("feedback_type", feedbackType)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reports: data ?? [], count: count ?? data?.length ?? 0 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const rateLimit = await applyRateLimit(auth.auth.userId, "admin:reports", WRITE_ROUTE_CONFIG);
  if (rateLimit.limited) return rateLimit.response;

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  let body: { id: string; action: "dismiss" | "snooze" | "remove_content" | "suspend_user" | "unsuspend_user"; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Report id is required." }, { status: 400 });
  }

  if (body.action === "dismiss") {
    const { error } = await db.from("feed_card_feedback").delete().eq("id", body.id);
    if (error) {
      return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, action: "dismissed" });
  }

  if (body.action === "remove_content" || body.action === "suspend_user") {
    const { data: report } = await db
      .from("feed_card_feedback")
      .select("metadata, user_id")
      .eq("id", body.id)
      .maybeSingle<{ metadata: Record<string, unknown> | null; user_id: string | null }>();
    if (!report) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Report not found." }, { status: 404 });
    }
    const adminAction = body.action === "remove_content" ? "content_removed" : "user_suspended";

    // If suspending the user, actually set the suspension flag on their profile
    if (body.action === "suspend_user" && report.user_id) {
      await db.from("profiles").update({
        is_suspended: true,
        suspended_at: new Date().toISOString(),
        suspended_reason: `Suspended via report ${body.id}`,
      }).eq("id", report.user_id);
    }

    await db.from("feed_card_feedback").update({
      metadata: { ...(report.metadata ?? {}), admin_action: adminAction, resolved_at: new Date().toISOString() },
    }).eq("id", body.id);
    return NextResponse.json({ ok: true, action: adminAction });
  }

  if (body.action === "unsuspend_user") {
    const userId = body.userId;
    if (!userId) {
      return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "userId is required for unsuspend." }, { status: 400 });
    }
    await db.from("profiles").update({
      is_suspended: false,
      suspended_at: null,
      suspended_reason: null,
    }).eq("id", userId);
    return NextResponse.json({ ok: true, action: "unsuspended" });
  }

  return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Unsupported action." }, { status: 400 });
}
