import "server-only";
import twilio from "twilio";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID ?? "";

export async function sendSms(
  to: string,
  message: string
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_MESSAGING_SERVICE_SID) {
    console.warn("[sendSms] Twilio not configured — missing env vars");
    return { ok: false, error: "Twilio not configured" };
  }

  try {
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    const result = await client.messages.create({
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      body: message,
      to,
    });
    return { ok: true, sid: result.sid };
  } catch (err) {
    console.error("[sendSms] failed:", err instanceof Error ? err.message : err);
    return { ok: false, error: err instanceof Error ? err.message : "SMS send failed" };
  }
}
