import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type AcceptNeedRequest = {
  helpRequestId: string;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  // This RPC depends on auth.uid(), so it must run with the caller's session.
  const dbClient = createSupabaseUserServerClient(authResult.auth.accessToken) || createSupabaseAdminClient();
  if (!dbClient) {
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

  return NextResponse.json({ ok: true, status: "accepted", helpRequestId });
}
