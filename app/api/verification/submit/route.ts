import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: 401 });

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "DB config error" }, { status: 500 });

  const { data: docs, error: docsError } = await db
    .from("verification_documents")
    .select("id")
    .eq("profile_id", auth.auth.userId)
    .eq("status", "pending");

  if (docsError) return NextResponse.json({ ok: false, message: docsError.message }, { status: 500 });

  if (!docs || docs.length === 0) {
    return NextResponse.json({ ok: false, message: "No pending documents to submit. Upload at least one document first." }, { status: 400 });
  }

  await db.from("profiles").update({ verification_status: "pending" }).eq("id", auth.auth.userId);

  return NextResponse.json({ ok: true, message: "Verification request submitted. We'll review your documents." });
}

export const POST = withErrorHandling(postHandler, "verification:submit");
