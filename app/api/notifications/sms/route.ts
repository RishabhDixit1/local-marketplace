import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { sendSms } from "@/lib/server/sms";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  let to: string;
  let message: string;
  try {
    const body = (await request.json()) as { to?: string; message?: string };
    to = (body.to ?? "").trim();
    message = (body.message ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload" }, { status: 400 });
  }

  if (!to || !message) {
    return NextResponse.json({ ok: false, message: "to and message are required" }, { status: 400 });
  }

  const result = await sendSms(to, message);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export const POST = withErrorHandling(postHandler, "notifications:sms");
