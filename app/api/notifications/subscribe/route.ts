import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

type SubscribeRequest = {
  endpoint?: string;
  token?: string;
  fcmToken?: string;
  keys?: {
    p256dh: string;
    auth: string;
  };
  platform?: string;
  userAgent?: string;
};

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

  let body: SubscribeRequest;
  try {
    body = (await request.json()) as SubscribeRequest;
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD", message: "Invalid JSON payload." }, { status: 400 });
  }

  const fcmToken = (body.token || body.fcmToken || "").trim();
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!fcmToken && (!endpoint || !p256dh || !auth)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PAYLOAD", message: "Send an FCM token or a web push subscription endpoint and keys." },
      { status: 400 }
    );
  }

  const subscriptionEndpoint = fcmToken ? `fcm:${fcmToken}` : endpoint!;
  const { error } = await dbClient.from("provider_push_subscriptions").upsert(
    {
      provider_id: authResult.auth.userId,
      endpoint: subscriptionEndpoint,
      p256dh: p256dh || "",
      auth: auth || "",
      fcm_token: fcmToken || null,
      platform: body.platform?.trim() || null,
      user_agent: body.userAgent?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider_id,endpoint" }
  );

  if (error) {
    const missingSchema = /provider_push_subscriptions|does not exist|schema cache/i.test(error.message || "");
    return NextResponse.json(
      {
        ok: false,
        code: missingSchema ? "NOT_FOUND" : "DB",
        message: error.message || "Could not save push subscription.",
      },
      { status: missingSchema ? 503 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
