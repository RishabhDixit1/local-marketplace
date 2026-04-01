import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { sendPushToUser } from "@/lib/server/pushNotifications";

export const runtime = "nodejs";

type SendPushRequest = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: authResult.message }, { status: authResult.status });
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!dbClient) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "Supabase server credentials are missing." }, { status: 500 });
  }

  let body: SendPushRequest;
  try {
    body = (await request.json()) as SendPushRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  const targetUserId = body.userId?.trim();
  const title = body.title?.trim();
  const message = body.body?.trim();

  if (!targetUserId || !title || !message) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: "userId, title, and body are required." },
      { status: 400 }
    );
  }

  const result = await sendPushToUser(dbClient, targetUserId, {
    title,
    body: message,
    data: body.data,
  });

  return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed });
}
