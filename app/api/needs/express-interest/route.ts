import { NextResponse } from "next/server";
import {
  getHelpRequestMatchStatusWriteCandidates,
  isHelpRequestMatchStatusConstraintError,
} from "@/lib/helpRequestMatchStatus";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type ExpressInterestRequest = {
  helpRequestId: string;
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

  let body: ExpressInterestRequest;
  try {
    body = (await request.json()) as ExpressInterestRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  const helpRequestId = body.helpRequestId?.trim();
  if (!helpRequestId) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "helpRequestId is required." }, { status: 400 });
  }

  const providerId = authResult.auth.userId;

  // Verify the help request exists and is open
  const { data: existing, error: fetchError } = await adminDbClient
    .from("help_requests")
    .select("requester_id, status, accepted_provider_id")
    .eq("id", helpRequestId)
    .maybeSingle<{ requester_id: string | null; status: string | null; accepted_provider_id: string | null }>();

  if (fetchError) {
    return NextResponse.json({ ok: false, code: "DB", message: fetchError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Help request not found." }, { status: 404 });
  }

  if (existing.requester_id === providerId) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "You cannot express interest in your own request." }, { status: 403 });
  }

  const status = (existing.status || "").trim().toLowerCase();
  if (["cancelled", "canceled", "closed", "completed", "fulfilled", "archived", "accepted", "in_progress"].includes(status)) {
    return NextResponse.json({ ok: false, code: "CLOSED", message: "This request is no longer accepting interest." }, { status: 409 });
  }

  // Upsert a match row — provider expresses interest (status = "open" = interested/pending)
  if (existing.accepted_provider_id && existing.accepted_provider_id !== providerId) {
    return NextResponse.json({ ok: false, code: "CLOSED", message: "This request already has an accepted provider." }, { status: 409 });
  }

  const now = new Date().toISOString();
  let upsertError: { message: string } | null = null;

  for (const persistedStatus of getHelpRequestMatchStatusWriteCandidates("interested")) {
    const { error } = await adminDbClient
      .from("help_request_matches")
      .upsert(
        {
          help_request_id: helpRequestId,
          provider_id: providerId,
          score: 0,
          status: persistedStatus,
          updated_at: now,
        },
        { onConflict: "help_request_id,provider_id", ignoreDuplicates: false }
      );

    if (!error) {
      upsertError = null;
      break;
    }

    upsertError = error;
    if (!isHelpRequestMatchStatusConstraintError(error.message)) {
      break;
    }
  }

  if (upsertError) {
    return NextResponse.json({ ok: false, code: "DB", message: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, helpRequestId, status: "interested" });
}
