import { NextResponse } from "next/server";
import {
  getHelpRequestMatchStatusWriteCandidates,
  isHelpRequestMatchStatusConstraintError,
} from "@/lib/helpRequestMatchStatus";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type WithdrawInterestRequest = {
  helpRequestId: string;
};

type ExistingMatchRow = {
  status: string | null;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const adminDbClient = createSupabaseAdminClient();
  if (!adminDbClient) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "Supabase server credentials are missing." }, { status: 500 });
  }

  let body: WithdrawInterestRequest;
  try {
    body = (await request.json()) as WithdrawInterestRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  const helpRequestId = body.helpRequestId?.trim();
  if (!helpRequestId) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "helpRequestId is required." }, { status: 400 });
  }

  const providerId = authResult.auth.userId;

  const { data: existingMatch, error: existingMatchError } = await adminDbClient
    .from("help_request_matches")
    .select("status")
    .eq("help_request_id", helpRequestId)
    .eq("provider_id", providerId)
    .maybeSingle<ExistingMatchRow>();

  if (existingMatchError) {
    return NextResponse.json({ ok: false, code: "DB", message: existingMatchError.message }, { status: 500 });
  }

  if (!existingMatch) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Interest was not found for this request." }, { status: 404 });
  }

  const currentStatus = (existingMatch.status || "").trim().toLowerCase();
  if (["accepted", "in_progress", "completed", "cancelled"].includes(currentStatus)) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "This interest can no longer be withdrawn here." }, { status: 409 });
  }

  const now = new Date().toISOString();
  let updateError: { message: string } | null = null;

  for (const persistedStatus of getHelpRequestMatchStatusWriteCandidates("withdrawn")) {
    const { error } = await adminDbClient
      .from("help_request_matches")
      .update({
        status: persistedStatus,
        updated_at: now,
      })
      .eq("help_request_id", helpRequestId)
      .eq("provider_id", providerId);

    if (!error) {
      updateError = null;
      break;
    }

    updateError = error;
    if (!isHelpRequestMatchStatusConstraintError(error.message)) {
      break;
    }
  }

  if (updateError) {
    return NextResponse.json({ ok: false, code: "DB", message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, helpRequestId, status: "withdrawn" });
}
