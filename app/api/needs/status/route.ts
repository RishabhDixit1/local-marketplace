import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type NeedStatus = "accepted" | "in_progress" | "completed" | "cancelled";

type TransitionRequest = {
  helpRequestId: string;
  status: NeedStatus;
};

const isValidStatus = (value: string): value is NeedStatus =>
  ["accepted", "in_progress", "completed", "cancelled"].includes(value);

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
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

  let body: TransitionRequest;
  try {
    body = (await request.json()) as TransitionRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  const helpRequestId = body.helpRequestId?.trim();
  const status = body.status?.trim();

  if (!helpRequestId || !status || !isValidStatus(status)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: "helpRequestId and valid status are required." },
      { status: 400 }
    );
  }

  const { data, error } = await dbClient.rpc("transition_help_request_status", {
    target_help_request_id: helpRequestId,
    next_status: status,
  });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, helpRequestId, status: typeof data === "string" ? data : status });
}
