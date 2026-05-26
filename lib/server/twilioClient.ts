import "server-only";
import twilio from "twilio";

const getTwilio = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  try {
    return twilio(accountSid, authToken);
  } catch {
    return null;
  }
};

export async function sendWhatsApp(
  to: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const client = getTwilio();
  if (!client) {
    return { ok: false, error: "Twilio not configured (missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)." };
  }

  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) {
    return { ok: false, error: "TWILIO_WHATSAPP_FROM not set." };
  }

  try {
    const normalizedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
    const result = await client.messages.create({
      from,
      body: message,
      to: normalizedTo,
    });
    return { ok: true, messageId: result.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "WhatsApp send failed." };
  }
}

export async function sendSms(
  to: string,
  message: string
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const client = getTwilio();
  if (!client) {
    return { ok: false, error: "Twilio not configured (missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)." };
  }

  const from = process.env.TWILIO_SMS_FROM;
  if (!from) {
    return { ok: false, error: "TWILIO_SMS_FROM not set." };
  }

  try {
    const result = await client.messages.create({
      from,
      body: message,
      to,
    });
    return { ok: true, messageId: result.sid };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "SMS send failed." };
  }
}
