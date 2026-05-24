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

  let body: { id: string; action: "dismiss" | "snooze" | "remove_content" | "suspend_user" };
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
      .select("metadata")
      .eq("id", body.id)
      .maybeSingle<{ metadata: Record<string, unknown> | null }>();
    if (!report) {
      return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Report not found." }, { status: 404 });
    }
    const adminAction = body.action === "remove_content" ? "content_removed" : "user_suspended";
    await db.from("feed_card_feedback").update({
      metadata: { ...(report.metadata ?? {}), admin_action: adminAction, resolved_at: new Date().toISOString() },
    }).eq("id", body.id);
    return NextResponse.json({ ok: true, action: adminAction });
  }

  return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Unsupported action." }, { status: 400 });
}
