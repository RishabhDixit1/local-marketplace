import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { processPendingJobs } from "@/lib/server/backgroundJobs";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { verifyCronSecret, cronAuthFailure } from "@/lib/server/requestAuth";

// Ensure job handlers are registered
import "@/lib/server/jobHandlers";

export const runtime = "nodejs";

async function postHandler(request: Request) {
  if (!verifyCronSecret(request)) return cronAuthFailure();

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const result = await processPendingJobs(db, 20);

  return NextResponse.json({ ok: true, ...result });
}

export const POST = withErrorHandling(postHandler, "cron:process-jobs");
