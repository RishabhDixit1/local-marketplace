import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { verifyCronSecret, cronAuthFailure } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

const RETENTION_DAYS = 7;

async function postHandler(request: Request) {
  if (!verifyCronSecret(request)) return cronAuthFailure();

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: deleted, error } = await db
    .from("background_jobs")
    .delete()
    .in("status", ["completed", "failed"])
    .lt("completed_at", cutoff);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    deletedCount: (deleted ?? []).length,
    retentionDays: RETENTION_DAYS,
  });
}

export const POST = withErrorHandling(postHandler, "cron:cleanup-jobs");
