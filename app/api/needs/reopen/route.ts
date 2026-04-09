import { NextResponse } from "next/server";
import {
  getHelpRequestMatchStatusWriteCandidates,
  isHelpRequestMatchStatusConstraintError,
} from "@/lib/helpRequestMatchStatus";
import { normalizeHelpRequestProgressStage } from "@/lib/helpRequestProgress";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type ReopenNeedRequest = {
  helpRequestId: string;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const dbClient = createSupabaseAdminClient();
  if (!dbClient) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase server credentials are missing." },
      { status: 500 }
    );
  }

  let body: ReopenNeedRequest;
  try {
    body = (await request.json()) as ReopenNeedRequest;
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

  const { data: existing, error: existingError } = await dbClient
    .from("help_requests")
    .select("id,requester_id,accepted_provider_id,status,title,metadata")
    .eq("id", helpRequestId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ ok: false, code: "DB", message: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND", message: "Help request not found." }, { status: 404 });
  }

  const actorId = authResult.auth.userId;
  const acceptedProviderId = typeof existing.accepted_provider_id === "string" ? existing.accepted_provider_id.trim() : "";
  const requesterId = typeof existing.requester_id === "string" ? existing.requester_id.trim() : "";
  const currentStatus = typeof existing.status === "string" ? existing.status.trim().toLowerCase() : "";

  if (actorId !== requesterId && actorId !== acceptedProviderId) {
    return NextResponse.json({ ok: false, code: "FORBIDDEN", message: "Not allowed to update this request." }, { status: 403 });
  }

  if (!["accepted", "in_progress", "cancelled"].includes(currentStatus)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: `Cannot reopen a request from status "${existing.status || "unknown"}".` },
      { status: 400 }
    );
  }

  const existingMetadata =
    existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata) ? existing.metadata : {};
  const progressStage = normalizeHelpRequestProgressStage(existingMetadata.progress_stage, existing.status);
  const now = new Date().toISOString();

  const previousMatchStatus =
    acceptedProviderId && actorId === acceptedProviderId
      ? "withdrawn"
      : acceptedProviderId
        ? "rejected"
        : null;

  if (acceptedProviderId && previousMatchStatus) {
    let acceptedMatchError: { message: string } | null = null;

    for (const persistedStatus of getHelpRequestMatchStatusWriteCandidates(previousMatchStatus)) {
      const { error } = await dbClient
        .from("help_request_matches")
        .update({
          status: persistedStatus,
          updated_at: now,
        })
        .eq("help_request_id", helpRequestId)
        .eq("provider_id", acceptedProviderId);

      if (!error) {
        acceptedMatchError = null;
        break;
      }

      acceptedMatchError = error;
      if (!isHelpRequestMatchStatusConstraintError(error.message)) {
        break;
      }
    }

    if (acceptedMatchError) {
      return NextResponse.json({ ok: false, code: "DB", message: acceptedMatchError.message }, { status: 500 });
    }

    let reopenOtherMatchesError: { message: string } | null = null;

    for (const persistedStatus of getHelpRequestMatchStatusWriteCandidates("active_pool")) {
      const { error } = await dbClient
        .from("help_request_matches")
        .update({
          status: persistedStatus,
          updated_at: now,
        })
        .eq("help_request_id", helpRequestId)
        .neq("provider_id", acceptedProviderId)
        .in("status", ["rejected", "declined"]);

      if (!error) {
        reopenOtherMatchesError = null;
        break;
      }

      reopenOtherMatchesError = error;
      if (!isHelpRequestMatchStatusConstraintError(error.message)) {
        break;
      }
    }

    if (reopenOtherMatchesError) {
      return NextResponse.json({ ok: false, code: "DB", message: reopenOtherMatchesError.message }, { status: 500 });
    }
  }

  const { count: activeMatchCount, error: activeMatchCountError } = await dbClient
    .from("help_request_matches")
    .select("help_request_id", { count: "exact", head: true })
    .eq("help_request_id", helpRequestId)
    .in("status", ["open", "interested", "suggested"]);

  if (activeMatchCountError) {
    return NextResponse.json({ ok: false, code: "DB", message: activeMatchCountError.message }, { status: 500 });
  }

  const nextHelpRequestStatus = (activeMatchCount || 0) > 0 ? "matched" : "open";

  const { error: updateError } = await dbClient
    .from("help_requests")
    .update({
      status: nextHelpRequestStatus,
      accepted_provider_id: null,
      metadata: {
        ...existingMetadata,
        relist_after_decline: true,
        progress_stage: progressStage || "pending_acceptance",
        cancelled_from_stage: progressStage || "pending_acceptance",
        last_declined_at: now,
        last_declined_provider_id: acceptedProviderId || null,
        cancelled_by_user_id: actorId,
        progress_updated_at: now,
      },
      updated_at: now,
    })
    .eq("id", helpRequestId);

  if (updateError) {
    return NextResponse.json({ ok: false, code: "DB", message: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, helpRequestId, status: nextHelpRequestStatus, previousMatchStatus });
}
