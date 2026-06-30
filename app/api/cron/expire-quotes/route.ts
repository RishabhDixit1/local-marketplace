import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { verifyCronSecret, cronAuthFailure } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

async function postHandler(request: Request) {
  if (!verifyCronSecret(request)) return cronAuthFailure();

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const now = new Date().toISOString();

  const { data: expired, error: fetchError } = await db
    .from("quote_drafts")
    .select("id, provider_id, consumer_id, summary")
    .eq("status", "sent")
    .lt("expires_at", now)
    .limit(50);

  if (fetchError) {
    return NextResponse.json({ ok: false, message: fetchError.message }, { status: 500 });
  }

  if (!expired || expired.length === 0) {
    return NextResponse.json({ ok: true, expired: 0 });
  }

  const ids = expired.map((q: { id: string }) => q.id);

  const { error: updateError } = await db
    .from("quote_drafts")
    .update({
      status: "expired",
      updated_at: now,
    })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ ok: false, message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired: ids.length });
}

export const POST = withErrorHandling(postHandler, "cron:expire-quotes");
