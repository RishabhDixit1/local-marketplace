import { NextResponse } from "next/server";
import { isRelistedHelpRequest, normalizeHelpRequestProgressStage } from "@/lib/helpRequestProgress";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type AcceptNeedRequest = {
  helpRequestId: string;
};

type ExistingHelpRequest = {
  requester_id: string | null;
  accepted_provider_id: string | null;
  metadata: Record<string, unknown> | null;
  status: string | null;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const userDbClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const adminDbClient = createSupabaseAdminClient();

  // This RPC depends on auth.uid(), so it must run with the caller's session when available.
  const dbClient = userDbClient || adminDbClient;
  const metadataClient = adminDbClient || userDbClient;
  if (!dbClient || !metadataClient) {
    return NextResponse.json(
      {
        ok: false,
        code: "CONFIG",
        message: "Supabase server credentials are missing.",
      },
      { status: 500 }
    );
  }

  let body: AcceptNeedRequest;
  try {
    body = (await request.json()) as AcceptNeedRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  const helpRequestId = body.helpRequestId?.trim();
  if (!helpRequestId) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: "helpRequestId is required." },
      { status: 400 }
    );
  }

  const { data: existing, error: existingError } = await metadataClient
    .from("help_requests")
    .select("requester_id,accepted_provider_id,metadata,status")
    .eq("id", helpRequestId)
    .maybeSingle<ExistingHelpRequest>();

  if (existingError) {
    return NextResponse.json({ ok: false, code: "DB", message: existingError.message }, { status: 500 });
  }

  const existingMetadata =
    existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata) ? existing.metadata : {};
  const requesterId = typeof existing?.requester_id === "string" ? existing.requester_id.trim() : "";
  const existingStatus = typeof existing?.status === "string" ? existing.status.trim().toLowerCase() : "";
  const now = new Date().toISOString();

  if (requesterId && requesterId === authResult.auth.userId) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "You cannot accept your own task." }, { status: 403 });
  }

  if (["cancelled", "canceled"].includes(existingStatus) && isRelistedHelpRequest(existingMetadata)) {
    const { error: reopenError } = await metadataClient
      .from("help_requests")
      .update({
        status: "open",
        updated_at: now,
      })
      .eq("id", helpRequestId)
      .eq("status", existing?.status || "cancelled")
      .is("accepted_provider_id", null);

    if (reopenError) {
      return NextResponse.json({ ok: false, code: "DB", message: reopenError.message }, { status: 500 });
    }
  }

  const { data, error } = await dbClient.rpc("accept_help_request", {
    target_help_request_id: helpRequestId,
  });

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "Request already accepted or unavailable." },
      { status: 409 }
    );
  }

  const nextProgressStage = normalizeHelpRequestProgressStage("pending_acceptance", existing?.status) || "pending_acceptance";

  await metadataClient
    .from("help_requests")
    .update({
      metadata: {
        ...existingMetadata,
        progress_stage: nextProgressStage,
        progress_updated_at: now,
        relist_after_decline: false,
        last_declined_at: null,
        last_declined_provider_id: null,
        cancelled_from_stage: null,
        cancelled_by_user_id: null,
      },
      updated_at: now,
    })
    .eq("id", helpRequestId);

  return NextResponse.json({ ok: true, status: "accepted", helpRequestId });
}
