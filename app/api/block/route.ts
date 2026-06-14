import { NextRequest, NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let body: { blockedId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON." }, { status: 400 });
  }

  const blockedId = body.blockedId?.trim();
  if (!blockedId) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "blockedId is required." }, { status: 400 });
  }

  if (blockedId === auth.auth.userId) {
    return NextResponse.json({ ok: false, code: "SELF_BLOCK", message: "You cannot block yourself." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const { error } = await db.from("blocked_users").insert({
    blocker_id: auth.auth.userId,
    blocked_id: blockedId,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, alreadyBlocked: true });
    }
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const blockedId = url.searchParams.get("blockedId")?.trim();

  if (!blockedId) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "blockedId query param is required." }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const { error } = await db
    .from("blocked_users")
    .delete()
    .eq("blocker_id", auth.auth.userId)
    .eq("blocked_id", blockedId);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const targetId = url.searchParams.get("userId")?.trim();

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  if (targetId) {
    const { data } = await db
      .from("blocked_users")
      .select("id")
      .eq("blocker_id", auth.auth.userId)
      .eq("blocked_id", targetId)
      .maybeSingle();

    return NextResponse.json({ ok: true, blocked: !!data });
  }

  const { data, error } = await db
    .from("blocked_users")
    .select("blocked_id, created_at")
    .eq("blocker_id", auth.auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, blockedUsers: data ?? [] });
}
