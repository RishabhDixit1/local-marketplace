const clean = (value: string | undefined | null): string => value?.trim() ?? "";

const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/u;
const OTP_PATTERN = /^\d{6}$/u;
const OTP_PLACEHOLDER_PATTERN = /\{\{\s*otp\s*\}\}|\{\s*otp\s*\}/iu;

export type SupabaseSendSmsHookPayload = {
  user?: {
    id?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  sms?: {
    otp?: string | null;
  } | null;
};

export type ExotelSmsResult = {
  sid: string | null;
  status: string | null;
  rawBody: string;
};

const requiredEnv = (name: string): string => {
  const value = clean(process.env[name]);
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
};

const renderOtpMessage = (template: string, otp: string): string => {
  if (!OTP_PLACEHOLDER_PATTERN.test(template)) {
    throw new Error("EXOTEL_OTP_MESSAGE_TEMPLATE must include {otp} or {{otp}}.");
  }

  return template.replace(/\{\{\s*otp\s*\}\}/giu, otp).replace(/\{\s*otp\s*\}/giu, otp);
};

const parseJsonIfPossible = (rawBody: string): unknown => {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
};

const extractSmsMeta = (parsedBody: unknown): { sid: string | null; status: string | null } => {
  if (!parsedBody || typeof parsedBody !== "object") {
    return { sid: null, status: null };
  }

  const record = parsedBody as Record<string, unknown>;
  const smsMessage =
    (record.SMSMessage && typeof record.SMSMessage === "object" ? record.SMSMessage : null) ||
    (record.sms_message && typeof record.sms_message === "object" ? record.sms_message : null) ||
    (record.message && typeof record.message === "object" ? record.message : null);

  if (!smsMessage) {
    return { sid: null, status: null };
  }

  const smsRecord = smsMessage as Record<string, unknown>;
  const sid = typeof smsRecord.Sid === "string" ? smsRecord.Sid : typeof smsRecord.sid === "string" ? smsRecord.sid : null;
  const status =
    typeof smsRecord.Status === "string" ? smsRecord.Status : typeof smsRecord.status === "string" ? smsRecord.status : null;

  return { sid, status };
};

export const maskPhoneNumber = (phone: string): string => {
  const normalized = clean(phone);
  if (!normalized) return "";
  if (normalized.length <= 6) return `${normalized.slice(0, 2)}***`;
  return `${normalized.slice(0, 4)}***${normalized.slice(-3)}`;
};

export const sendOtpSmsThroughExotel = async (params: {
  phone: string;
  otp: string;
}): Promise<ExotelSmsResult> => {
  const phone = clean(params.phone);
  const otp = clean(params.otp);

  if (!E164_PHONE_PATTERN.test(phone)) {
    throw new Error("Supabase hook payload contains an invalid phone number.");
  }

  if (!OTP_PATTERN.test(otp)) {
    throw new Error("Supabase hook payload contains an invalid OTP.");
  }

  const apiBaseUrl = new URL(requiredEnv("EXOTEL_API_BASE_URL"));
  const accountSid = requiredEnv("EXOTEL_ACCOUNT_SID");
  const apiKey = requiredEnv("EXOTEL_API_KEY");
  const apiToken = requiredEnv("EXOTEL_API_TOKEN");
  const from = requiredEnv("EXOTEL_FROM");

  const url = new URL(`/v1/Accounts/${encodeURIComponent(accountSid)}/Sms/send.json`, apiBaseUrl);
  url.username = apiKey;
  url.password = apiToken;

  const messageTemplate = clean(process.env.EXOTEL_OTP_MESSAGE_TEMPLATE) || "Your ServiQ OTP is {{otp}}. Do not share it.";
  const body = renderOtpMessage(messageTemplate, otp);

  const payload = new URLSearchParams({
    From: from,
    To: phone,
    Body: body,
    Priority: clean(process.env.EXOTEL_PRIORITY) || "high",
    SmsType: clean(process.env.EXOTEL_SMS_TYPE) || "transactional",
    CustomField: clean(process.env.EXOTEL_CUSTOM_FIELD) || "supabase_phone_otp",
  });

  const dltEntityId = clean(process.env.EXOTEL_DLT_ENTITY_ID);
  const dltTemplateId = clean(process.env.EXOTEL_DLT_TEMPLATE_ID);

  if (dltEntityId) payload.set("DltEntityId", dltEntityId);
  if (dltTemplateId) payload.set("DltTemplateId", dltTemplateId);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
    cache: "no-store",
  });

  const rawBody = await response.text();
  const parsedBody = parseJsonIfPossible(rawBody);

  if (!response.ok) {
    const fallbackMessage = rawBody.trim() || `Exotel returned HTTP ${response.status}.`;
    const responseMessage =
      parsedBody && typeof parsedBody === "object"
        ? JSON.stringify(parsedBody)
        : fallbackMessage;

    throw new Error(responseMessage);
  }

  const { sid, status } = extractSmsMeta(parsedBody);

  return {
    sid,
    status,
    rawBody,
  };
};
