import { NextResponse } from "next/server";
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
    .select("id,requester_id,accepted_provider_id,status,title")
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

  const { error: updateError } = await dbClient
    .from("help_requests")
    .update({
      status: "open",
      accepted_provider_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", helpRequestId);

  if (updateError) {
    return NextResponse.json({ ok: false, code: "DB", message: updateError.message }, { status: 500 });
  }

  if (acceptedProviderId) {
    await dbClient
      .from("help_request_matches")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("help_request_id", helpRequestId)
      .eq("provider_id", acceptedProviderId);
  }

  return NextResponse.json({ ok: true, helpRequestId, status: "open" });
}
