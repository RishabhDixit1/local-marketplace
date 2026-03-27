import { NextResponse } from "next/server";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import {
  maskPhoneNumber,
  sendOtpSmsThroughExotel,
  type SupabaseSendSmsHookPayload,
} from "@/lib/server/exotel";

export const runtime = "nodejs";

const cleanHookSecret = (value: string | undefined): string => value?.trim().replace(/^v1,whsec_/iu, "") ?? "";

const isSupabaseSendSmsHookPayload = (payload: unknown): payload is SupabaseSendSmsHookPayload => {
  if (!payload || typeof payload !== "object") return false;
  const record = payload as Record<string, unknown>;
  const user = record.user;
  const sms = record.sms;

  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : null;
  const smsRecord = sms && typeof sms === "object" ? (sms as Record<string, unknown>) : null;

  return (
    !!userRecord &&
    !!smsRecord &&
    (typeof userRecord.phone === "string" || typeof userRecord.phone === "undefined" || userRecord.phone === null) &&
    (typeof smsRecord.otp === "string" || typeof smsRecord.otp === "undefined" || smsRecord.otp === null)
  );
};

export async function POST(request: Request) {
  const hookSecret = cleanHookSecret(process.env.SUPABASE_SEND_SMS_HOOK_SECRET);
  if (!hookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing SUPABASE_SEND_SMS_HOOK_SECRET.",
      },
      { status: 500 }
    );
  }

  let payloadText = "";
  let payload: unknown = null;
  let verifiedPayload: SupabaseSendSmsHookPayload;

  try {
    payloadText = await request.text();
    const headers = Object.fromEntries(request.headers);
    const webhook = new Webhook(hookSecret);
    payload = webhook.verify(payloadText, headers);
    if (!isSupabaseSendSmsHookPayload(payload)) {
      throw new Error("Invalid Supabase Send SMS hook payload.");
    }
    verifiedPayload = payload;
  } catch (error) {
    const message =
      error instanceof WebhookVerificationError
        ? "Invalid Supabase hook signature."
        : error instanceof Error && error.message
          ? error.message
          : "Unable to verify Supabase hook payload.";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: error instanceof WebhookVerificationError ? 401 : 400 }
    );
  }

  const phone = verifiedPayload.user?.phone?.trim() ?? "";
  const otp = verifiedPayload.sms?.otp?.trim() ?? "";

  if (!phone || !otp) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase hook payload is missing phone or OTP.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await sendOtpSmsThroughExotel({ phone, otp });
    console.info(
      "[auth/send-sms]",
      JSON.stringify({
        phone: maskPhoneNumber(phone),
        sid: result.sid,
        status: result.status,
      })
    );
    return new Response(null, { status: 200 });
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Unable to send SMS through Exotel.";
    console.error("[auth/send-sms:error]", message);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 502 }
    );
  }
}
