import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { sendPushToUser } from "@/lib/server/pushNotifications";

export const runtime = "nodejs";
const INTERNAL_PUSH_HEADER = "x-serviq-internal-key";

type SendPushRequest = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const hasTrustedInternalKey = (request: Request) => {
  const expected = process.env.SERVIQ_INTERNAL_PUSH_KEY?.trim() || "";
  const provided = request.headers.get(INTERNAL_PUSH_HEADER)?.trim() || "";

  if (!expected || !provided) return false;

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

export async function POST(request: Request) {
  if (!process.env.SERVIQ_INTERNAL_PUSH_KEY?.trim()) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "SERVIQ_INTERNAL_PUSH_KEY is required for push delivery." },
      { status: 503 }
    );
  }

  if (!hasTrustedInternalKey(request)) {
    return NextResponse.json(
      { ok: false, code: "FORBIDDEN", message: "Push delivery is restricted to trusted internal callers." },
      { status: 403 }
    );
  }

  const dbClient = createSupabaseAdminClient();
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
