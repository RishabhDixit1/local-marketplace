import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)), 100);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const { data, error } = await db
    .from("orders")
    .select("id, price, status, metadata, created_at")
    .eq("consumer_id", auth.auth.userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, transactions: data ?? [] });
}

export const GET = withErrorHandling(getHandler, "consumer:transactions");
